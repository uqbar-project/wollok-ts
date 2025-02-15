import { APPLY_METHOD, CLOSURE_EVALUATE_METHOD } from '../constants'
import { anyPredicate, is, isEmpty, notEmpty } from '../extensions'
import { Environment, Method, Module, Node, Reference, Send } from '../model'
import { newTypeVariables, typeForModule, TypeVariable, typeVariableFor } from './typeVariables'
import { PARAM, RETURN, TypeRegistry, TypeSystemProblem, WollokModuleType, WollokType, WollokUnionType } from './wollokTypes'

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
    globalChange = [propagateTypes, inferFromMessages, reversePropagation, guessTypes].some(runStage(tVars))
  }
  assign(env, { typeRegistry: new TypeRegistry(tVars) })
}

type Stage = (tVar: TypeVariable) => boolean

const runStage = (tVars: Map<Node, TypeVariable>) => (stages: Stage[]) =>
  allValidTypeVariables(tVars).some(anyPredicate(...stages))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROPAGATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const propagateTypes = [propagateMinTypes, propagateMaxTypes, propagateMessages]

export function propagateMinTypes(tVar: TypeVariable): boolean {
  return propagateTypesUsing(tVar, tVar.allMinTypes(), tVar.validSupertypes())((targetTVar, type) => {
    targetTVar.addMinType(type)
    logger.log(`PROPAGATE MIN TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
  })
}
export function propagateMaxTypes(tVar: TypeVariable): boolean {
  if (tVar.messages.length) return false
  return propagateTypesUsing(tVar, tVar.allMaxTypes(), tVar.validSubtypes())((targetTVar, type) => {
    targetTVar.addMaxType(type)
    logger.log(`PROPAGATE MAX TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
  })
}
export function propagateMessages(tVar: TypeVariable): boolean {
  return propagateSendsUsing(tVar, tVar.messages, tVar.validSubtypes())((targetTVar, send) => {
    for (const type of targetTVar.allPossibleTypes()) {
      if (!type.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true }))
        return reportProblem(targetTVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))
    }
    targetTVar.addSend(send)
    logger.log(`PROPAGATE SEND (${send}) FROM |${tVar}| TO |${targetTVar}|`)
  })
}

type Propagator<Element> = (targetTVar: TypeVariable, something: Element) => void

const propagate = <Element>(checker: (target: TypeVariable, e: Element) => boolean, reporter: (source: TypeVariable, e: Element, target: TypeVariable) => boolean) => (tVar: TypeVariable, elements: Element[], targetTVars: TypeVariable[]) => (propagator: Propagator<Element>) => {
  let changed = false
  for (const type of elements) {
    for (const targetTVar of targetTVars) {
      if (!checker(targetTVar, type)) {
        if (targetTVar.closed) return reporter(tVar, type, targetTVar)
        propagator(targetTVar, type)
        changed = true
      }
    }
  }
  return changed
}

const propagateTypesUsing = propagate<WollokType>((targetTVar, type) => targetTVar.hasType(type), reportTypeMismatch)
const propagateSendsUsing = propagate<Send>((targetTVar, send) => targetTVar.hasSend(send), reportMessageNotUnderstood)


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MESSAGE BINDING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const inferFromMessages = [bindReceivedMessages, maxTypeFromMessages]

export function bindReceivedMessages(tVar: TypeVariable): boolean {
  const types = tVar.allPossibleTypes()
  let changed = false
  for (const type of types) {
    for (const send of tVar.messages) {
      if (send.receiver !== tVar.node) continue // should only bind the methods from the receiver types

      const message = send.message == APPLY_METHOD ? CLOSURE_EVALUATE_METHOD : send.message // 'apply' is a special case for closures
      const method = type.lookupMethod(message, send.args.length, { allowAbstractMethods: true })
      if (!method)
        return reportProblem(tVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))

      if (bindMethod(tVar, method, send))
        changed = true
    }
  }
  return changed
}

function bindMethod(receiver: TypeVariable, method: Method, send: Send): boolean {
  const methodInstance = typeVariableFor(method).instanceFor(receiver, typeVariableFor(send))
  const returnParam = methodInstance.atParam(RETURN)
  if (returnParam.hasSupertype(typeVariableFor(send))) return false

  logger.log(`\nBIND MESSAGE |${send}| WITH METHOD |${method}|`)
  returnParam.addSupertype(typeVariableFor(send))
  logger.log(`NEW SUPERTYPE |${typeVariableFor(send)}| FOR |${returnParam}|`)
  method.parameters.forEach((_param, i) => {
    const argTVAR = typeVariableFor(send.args[i])
    const currentParam = methodInstance.atParam(`${PARAM}${i}`)
    currentParam.addSubtype(argTVAR)
    logger.log(`NEW SUBTYPE |${argTVAR}| FOR |${currentParam}|`)
  })
  return true
}

export function maxTypeFromMessages(tVar: TypeVariable): boolean {
  if (tVar.closed) return false
  if (!tVar.messages.length) return false
  if (tVar.allMinTypes().length) return false
  if (tVar.messages.every(send => send.message == APPLY_METHOD)) return false // Avoid messages to closure
  let changed = false

  const [possibleTypes, mnuMessages] = inferMaxTypesFromMessages([...tVar.messages]) // Maybe we should remove from original collection for performance reason?

  for (const type of possibleTypes)
    if (!tVar.hasType(type)) {
      tVar.addMaxType(type)
      logger.log(`NEW MAX TYPE |${type}| FOR |${tVar}|`)
      changed = true
    }


  for (const send of mnuMessages)
    if (send.receiver === tVar.node) {
      reportProblem(tVar, new TypeSystemProblem('methodNotFound', [send.signature, tVar.type().name]))
      changed = true
    }

  return changed
}

function inferMaxTypesFromMessages(messages: Send[]): [WollokModuleType[], Send[]] {
  if (messages.every(allObjectsUnderstand)) return [[objectType(messages[0])], []]
  let possibleTypes = allTypesThatUndestand(messages)
  const mnuMessages = [] // Maybe we should check this when max types are propagated?
  while (!possibleTypes.length) { // Here we have a problem
    mnuMessages.push(messages.pop()!) // Search in a subset
    if (!messages.length) return [[], []] // Avoid inference for better error message? (Probably this is a bug)
    possibleTypes = allTypesThatUndestand(messages)
  }
  return [possibleTypes, mnuMessages]
}

function allTypesThatUndestand(messages: Send[]): WollokModuleType[] {
  const { environment } = messages[0]
  return allModulesThatUnderstand(environment, messages).map(typeForModule)
}

function allObjectsUnderstand(send: Send) {
  return send.environment.objectClass.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
}

function objectType(node: Node) {
  return typeForModule(node.environment.objectClass)
}

function allModulesThatUnderstand(environment: Environment, sends: Send[]) {
  return environment.descendants
    .filter(is(Module))
    .filter(module => sends.every(send =>
      // TODO: check params and return types
      module.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
    ))

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GUESS TYPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const reversePropagation = [reversePropagateMessages, reverseInference]

export function reversePropagateMessages(tVar: TypeVariable): boolean {
  if (tVar.closed) return false
  if (tVar.messages.length) return false
  if (tVar.allMaxTypes().length) return false
  let changed = false

  for (const subTVar of tVar.validSubtypes()) {
    changed = changed || propagateSendsUsing(subTVar, subTVar.messages, [tVar])((targetTVar, send) => {
      for (const type of targetTVar.allPossibleTypes()) {
        if (!type.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true }))
          return reportProblem(targetTVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))
      }
      targetTVar.addSend(send)
      logger.log(`REVERSE PROPAGATE SEND (${send}) FROM |${tVar}| TO |${targetTVar}|`)
    })
  }

  return changed
}


export function reverseInference(tVar: TypeVariable): boolean {
  if (tVar.closed) return false
  if (tVar.hasTypeInfered()) return false
  if (!tVar.synthetic && tVar.node.parentPackage?.isBaseWollokCode) return false
  let changed = false

  for (const subTVar of tVar.validSubtypes()) {
    changed = changed || propagateTypesUsing(subTVar, subTVar.allMaxTypes().filter(t => t.isComplete), [tVar])((targetTVar, type) => {
      targetTVar.addMinType(type)
      logger.log(`GUESS MIN TYPE (${type.name}) FROM |${subTVar}| TO |${targetTVar}|`)
    })
  }

  for (const superTVar of tVar.validSupertypes()) {
    changed = changed || propagateTypesUsing(superTVar, superTVar.allMinTypes().filter(t => t.isComplete), [tVar])((targetTVar, type) => {
      targetTVar.addMaxType(type)
      logger.log(`GUESS MAX TYPE (${type.name}) FROM |${superTVar}| TO |${targetTVar}|`)
    })
  }

  return changed
}

const guessTypes = [closeTypes]

export function closeTypes(tVar: TypeVariable): boolean {
  let changed = false
  if (isEmpty(tVar.allMaxTypes()) && notEmpty(tVar.allMinTypes()) && isEmpty(tVar.supertypes)) {
    tVar.typeInfo.maxTypes = tVar.allMinTypes()
    logger.log(`MAX TYPES |${new WollokUnionType(tVar.typeInfo.maxTypes).name}| FROM MIN FOR |${tVar}|`)
    changed = true
  }
  if (isEmpty(tVar.allMinTypes()) && notEmpty(tVar.allMaxTypes()) && isEmpty(tVar.subtypes)) {
    tVar.typeInfo.minTypes = tVar.allMaxTypes()
    logger.log(`MIN TYPES |${new WollokUnionType(tVar.typeInfo.minTypes).name}| FROM MAX FOR |${tVar}|`)
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

function reportMessageNotUnderstood(source: TypeVariable, send: Send, target: TypeVariable) {
  if (target.type().lookupMethod(send.message, send.numArgs)) return false

  logger.log(`TYPE ERROR REPORTED ON |${target}| SEDING: ${send} FROM ${source}`)
  return reportProblem(target, new TypeSystemProblem('typeMismatch', [source.type().name, target.type().name]))
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