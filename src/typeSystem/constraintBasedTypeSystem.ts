import { APPLY_METHOD } from '../constants'
import { anyPredicate, is, isEmpty, notEmpty } from '../extensions'
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
    globalChange = [propagateTypes, bindMessages, maxTypesFromMessages].some(stage => stage(tVars))
  }
  assign(env, { typeRegistry: new TypeRegistry(tVars) })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROPAGATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const propagateMinTypes = (tVar: TypeVariable): boolean => {
  return propagateMinTypesTo(tVar, tVar.allMinTypes(), tVar.validSupertypes())
}

export const propagateMaxTypes = (tVars: TypeVariable): boolean => {
  return propagateMaxTypesTo(tVars, tVars.allMaxTypes(), tVars.validSubtypes())
}

function propagateTypes(tVars: Map<Node, TypeVariable>) {
  return allValidTypeVariables(tVars).some(anyPredicate(propagateMinTypes, propagateMaxTypes))
}

const propagateMinTypesTo = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[]) =>
  propagateTypesUsing(tVar, types, targetTVars, (targetTVar, type) => {
    targetTVar.addMinType(type)
    logger.log(`PROPAGATE MIN TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
  })

const propagateMaxTypesTo = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[]) =>
  propagateTypesUsing(tVar, types, targetTVars, (targetTVar, type) => {
    targetTVar.addMaxType(type)
    logger.log(`PROPAGATE MAX TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
  })


type Propagator = (targetTVar: TypeVariable, type: WollokType) => void

const propagateTypesUsing = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[], propagator: Propagator) => {
  let changed = false
  for (const type of types) {
    for (const targetTVar of targetTVars) {
      if (!targetTVar.hasType(type)) {
        if (targetTVar.closed)
          return reportTypeMismatch(tVar, type, targetTVar)
        propagator(targetTVar, type)
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
      const message = send.message == APPLY_METHOD ? '<apply>' : send.message // 'apply' is a special case for closures
      const method = type.lookupMethod(message, send.args.length, { allowAbstractMethods: true })
      if (!method)
        return reportProblem(tVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))

      const methodInstance = typeVariableFor(method).instanceFor(tVar, typeVariableFor(send))
      const returnParam = methodInstance.atParam(RETURN)
      if (!returnParam.hasSupertype(typeVariableFor(send))) {
        returnParam.addSupertype(typeVariableFor(send))
        logger.log(`NEW SUPERTYPE |${typeVariableFor(send)}| for |${returnParam}|`)
        method.parameters.forEach((_param, i) => {
          const argTVAR = typeVariableFor(send.args[i])
          const currentParam = methodInstance.atParam(`${PARAM}${i}`)
          currentParam.addSubtype(argTVAR)
          logger.log(`NEW SUBTYPE |${argTVAR}| for |${currentParam}|`)
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
  if (tVar.hasTypeInfered()) return false
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
  let changed = false
  if (isEmpty(tVar.allMaxTypes()) && notEmpty(tVar.allMinTypes()) && isEmpty(tVar.supertypes)) {
    tVar.typeInfo.maxTypes = tVar.allMinTypes()
    logger.log(`MAX TYPES FROM MIN FOR |${tVar}|`)
    changed = true
  }
  if (isEmpty(tVar.allMinTypes()) && notEmpty(tVar.allMaxTypes()) && isEmpty(tVar.subtypes)) {
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
  logger.log(`TYPE ERROR REPORTED ON |${reported}| - Expected: ${expected.name} Actual: ${actual.name}`)
  return reportProblem(reported, new TypeSystemProblem('typeMismatch', [expected.name, actual.name]))
}

function selectVictim(source: TypeVariable, type: WollokType, target: TypeVariable, targetType: WollokType): [TypeVariable, WollokType, WollokType] {
  // Super random, to be improved
  if (source.synthetic) return [target, targetType, type]
  if (target.synthetic) return [source, type, targetType]
  if (source.node.is(Reference)) return [source, type, targetType]
  if (target.node.is(Reference)) return [target, targetType, type]
  return [target, targetType, type]
  // throw new Error('No victim found')
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// OTHERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function allValidTypeVariables(tVars: Map<Node, TypeVariable>) {
  return [...tVars.values()].filter(tVar => !tVar.hasProblems)
}