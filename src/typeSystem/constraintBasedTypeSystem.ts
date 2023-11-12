import { anyPredicate, is } from '../extensions'
import { Environment, Module, Node, Reference } from '../model'
import { newTypeVariables, TypeVariable, typeVariableFor } from './typeVariables'
import { PARAM, RETURN, TypeRegistry, TypeSystemProblem, WollokModuleType, WollokType } from './wollokTypes'

const { assign } = Object

interface Logger { log: (message: string) => void }
let logger: Logger = { log: () => { } }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INFERENCE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function inferTypes(env: Environment, someLogger?: Logger): void {
  if (someLogger) logger = someLogger
  const tVars = newTypeVariables(env)
  let globalChange = true
  while (globalChange) {
    globalChange = [propagateTypes, bindMessages, maxTypesFromMessages].some(f => f(tVars))
  }
  assign(env, { typeRegistry: new TypeRegistry(tVars) })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROPAGATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function allValidTypeVariables(tVars: Map<Node, TypeVariable>) {
  return [...tVars.values()].filter(tVar => !tVar.hasProblems)
}


function propagateTypes(tVars: Map<Node, TypeVariable>) {
  return allValidTypeVariables(tVars).some(anyPredicate(propagateMinTypes, propagateMaxTypes))
}

export const propagateMinTypes = (tVar: TypeVariable): boolean => {
  return propagateMinTypesTo(tVar, tVar.allMinTypes(), tVar.validSupertypes())
}
const propagateMinTypesTo = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[]) => {
  let changed = false
  for (const type of types) {
    for (const targetTVar of targetTVars) {
      if (!targetTVar.hasType(type)) {
        if (targetTVar.closed)
          return reportTypeMismatch(tVar, type, targetTVar)
        targetTVar.addMinType(type)
        logger.log(`PROPAGATE MIN TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
        changed = true
      }
    }
  }
  return changed
}

export const propagateMaxTypes = (tVars: TypeVariable): boolean => {
  return propagateMaxTypesTo(tVars, tVars.allMaxTypes(), tVars.validSubtypes())
}

const propagateMaxTypesTo = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[]) => {
  let changed = false
  for (const type of types) {
    for (const targetTVar of targetTVars) {
      if (!targetTVar.hasType(type)) {
        if (targetTVar.closed)
          return reportTypeMismatch(tVar, type, targetTVar)
        targetTVar.addMaxType(type)
        logger.log(`PROPAGATE MAX TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
        changed = true
      }
    }
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MESSAGE BINDING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function bindMessages(tVars: Map<Node, TypeVariable>) {
  return allValidTypeVariables(tVars).some(bindReceivedMessages)
}

export const bindReceivedMessages = (tVar: TypeVariable): boolean => {
  const types = tVar.allPossibleTypes()
  let changed = false
  for (const type of types) {
    for (const send of tVar.messages) {
      const message = send.message == 'apply' ? '<apply>' : send.message // 'apply' is a special case for closures
      const method = type.lookupMethod(message, send.args.length, { allowAbstractMethods: true })
      if (!method)
        return reportProblem(tVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))

      const methodInstance = typeVariableFor(method).instanceFor(tVar, typeVariableFor(send))
      if (!methodInstance.atParam(RETURN).hasSupertype(typeVariableFor(send))) {
        methodInstance.atParam(RETURN).addSupertype(typeVariableFor(send))
        method.parameters.forEach((_param, i) => {
          methodInstance.atParam(`${PARAM}${i}`).addSubtype(typeVariableFor(send.args[i]))
        })

        logger.log(`BIND MESSAGE |${send}| WITH METHOD |${method}|`)
        changed = true
      }
    }
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GUESS TYPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function maxTypesFromMessages(tVars: Map<Node, TypeVariable>) {
  return allValidTypeVariables(tVars).some(anyPredicate(maxTypeFromMessages, mergeSuperAndSubTypes, closeTypes))
}

export const maxTypeFromMessages = (tVar: TypeVariable): boolean => {
  if (!tVar.messages.length) return false
  if (tVar.allMinTypes().length) return false
  let changed = false
  tVar.node.environment.descendants
    .filter(is(Module))
    .filter(module => tVar.messages.every(send =>
      module.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
      // TODO: check params and return types
    ))
    .map(_ => new WollokModuleType(_)) // Or bind to the module?
    .forEach(type => {
      if (!tVar.hasType(type)) {
        tVar.addMaxType(type)
        logger.log(`NEW MAX TYPE |${type}| FOR |${tVar.node}|`)
        changed = true
      }
    })
  return changed
}

export const mergeSuperAndSubTypes = (tVar: TypeVariable): boolean => {
  if (tVar.allPossibleTypes().length) return false
  let changed = false
  for (const superTVar of tVar.validSupertypes()) {
    if (!tVar.subtypes.includes(superTVar)) {
      tVar.beSupertypeOf(superTVar)
      logger.log(`GUESS TYPE OF |${tVar}| FROM |${superTVar}|`)
      changed = true
    }
  }
  for (const subTVar of tVar.validSubtypes()) {
    if (!tVar.supertypes.includes(subTVar)) {
      tVar.beSubtypeOf(subTVar)
      logger.log(`GUESS TYPE OF |${tVar}| FROM |${subTVar}|`)
      changed = true
    }
  }
  return changed
}

export const closeTypes = (tVar: TypeVariable): boolean => {
  // if(tVar.syntetic) return false
  let changed = false
  if(tVar.allMaxTypes().length === 0 && tVar.allMinTypes().length > 0  && tVar.supertypes.length === 0) {
    tVar.typeInfo.maxTypes = tVar.allMinTypes()
    logger.log(`MAX TYPES FROM MIN FOR |${tVar}|`)
    changed = true
  }
  if(tVar.allMinTypes().length === 0 && tVar.allMaxTypes().length > 0 && tVar.subtypes.length === 0) {
    tVar.typeInfo.minTypes = tVar.allMaxTypes()
    logger.log(`MIN TYPES FROM MAX FOR |${tVar}|`)
    changed = true
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTING PROBLEMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function reportProblem(tVar: TypeVariable, problem: TypeSystemProblem) {
  tVar.addProblem(problem)
  return true // Something changed
}

function reportTypeMismatch(source: TypeVariable, type: WollokType, target: TypeVariable) {
  const [reported, expected, actual] = selectVictim(source, type, target, target.type())
  return reportProblem(reported, new TypeSystemProblem('typeMismatch', [expected.name, actual.name]))
}

function selectVictim(source: TypeVariable, type: WollokType, target: TypeVariable, targetType: WollokType): [TypeVariable, WollokType, WollokType] {
  // Super random, to be improved
  if (source.syntetic) return [target, targetType, type]
  if (target.syntetic) return [source, type, targetType]
  if (source.node.is(Reference)) return [source, type, targetType]
  if (target.node.is(Reference)) return [target, targetType, type]
  return [target, targetType, type]
  // throw new Error('No victim found')
}