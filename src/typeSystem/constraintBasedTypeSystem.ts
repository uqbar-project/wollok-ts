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
    globalChange = [basicPropagation, inferFromMessages, reversePropagation, guessTypes].some(runStage(tVars))
  }
  assign(env, { typeRegistry: new TypeRegistry(tVars) })
}

type Stage = (tVar: TypeVariable) => boolean

const runStage = (tVars: Map<Node, TypeVariable>) => (stages: Stage[]) =>
  allValidTypeVariables(tVars).some(anyPredicate(...stages))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROPAGATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const basicPropagation = [propagateMinTypes, propagateMaxTypes, propagateMessages]

export function propagateMinTypes(tVar: TypeVariable): boolean {
  return propagateMinTypesUsing(tVar.allMinTypes(), tVar.validSupertypes())((targetTVar, type) => {
    if (targetTVar.closed) return reportTypeMismatchUnknownVictim(tVar, type, targetTVar)
    targetTVar.addMinType(type)
    logger.log(`PROPAGATE MIN TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
  })
}
export function propagateMaxTypes(tVar: TypeVariable): boolean {
  if (tVar.messages.length) return false // If I have send then just propagate them

  return propagateMaxTypesUsing(tVar.allMaxTypes(), tVar.validSubtypes())((targetTVar, type) => {
    if (targetTVar.closed) return reportTypeMismatchUnknownVictim(tVar, type, targetTVar)
    targetTVar.addMaxType(type)
    logger.log(`PROPAGATE MAX TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
  })
}
export function propagateMessages(tVar: TypeVariable): boolean {
  return propagateSendsUsing(tVar.messages, tVar.validSubtypes())((targetTVar, send) => {
    if (validateUnderstandMessage(targetTVar, send, tVar)) return true // Avoid propagation
    targetTVar.addSend(send)
    logger.log(`PROPAGATE SEND (${send}) FROM |${tVar}| TO |${targetTVar}|`)
  })
}

type Propagator<Element> = (targetTVar: TypeVariable, something: Element) => void | true
type Checker<Element> = (target: TypeVariable, e: Element) => boolean

const propagate = <Element>(checker: Checker<Element>) => (elements: Element[], targetTVars: TypeVariable[]) => (propagator: Propagator<Element>) => {
  let changed = false
  for (const type of elements) {
    for (const targetTVar of targetTVars) {
      if (!checker(targetTVar, type)) {
        if (propagator(targetTVar, type)) return true // Stop on error
        changed = true
      }
    }
  }
  return changed
}

const propagateMinTypesUsing = propagate<WollokType>((targetTVar, type) => targetTVar.hasMinType(type))
const propagateMaxTypesUsing = propagate<WollokType>((targetTVar, type) => targetTVar.hasType(type))
const propagateSendsUsing = propagate<Send>((targetTVar, send) => targetTVar.hasSend(send))


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
        return reportMethodNotFound(tVar, send, type)

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
  if (tVar.node?.is(Send)) return false // Bind messages from receiver types in message chain 
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
      reportMethodNotFound(tVar, send, tVar.type())
      changed = true
    }

  return changed
}

function inferMaxTypesFromMessages(messages: Send[]): [WollokModuleType[], Send[]] {
  if (messages.every(allObjectsUnderstand)) return [[objectType(messages[0])], []]
  let possibleTypes = allTypesThatUndestand(messages)
  const mnuMessages: Send[] = [] // Maybe we should check this when max types are propagated?
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
    changed = changed || propagateSendsUsing(subTVar.messages, [tVar])((targetTVar, send) => {
      if (validateUnderstandMessage(targetTVar, send, subTVar)) return true // Avoid propagation
      targetTVar.addSend(send)
      logger.log(`REVERSE PROPAGATE SEND (${send}) FROM |${subTVar}| TO |${targetTVar}|`)
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
    changed = changed || propagateMaxTypesUsing(subTVar.allMaxTypes().filter(t => t.isComplete), [tVar])((targetTVar, type) => {
      targetTVar.addMinType(type)
      logger.log(`GUESS MIN TYPE (${type.name}) FROM |${subTVar}| TO |${targetTVar}|`)
    })
  }

  for (const superTVar of tVar.validSupertypes()) {
    changed = changed || propagateMinTypesUsing(superTVar.allMinTypes().filter(t => t.isComplete), [tVar])((targetTVar, type) => {
      targetTVar.addMaxType(type)
      logger.log(`GUESS MAX TYPE (${type.name}) FROM |${superTVar}| TO |${targetTVar}|`)
    })
  }

  return changed
}

const guessTypes = [closeTypes]

export function closeTypes(tVar: TypeVariable): boolean {
  let changed = false
  if (isEmpty(tVar.allMaxTypes()) && notEmpty(tVar.allMinTypes()) && isEmpty(tVar.supertypes.filter(_super => _super.hasSubtype(tVar)))) {
    tVar.typeInfo.maxTypes = tVar.allMinTypes()
    logger.log(`MAX TYPES |${new WollokUnionType(tVar.typeInfo.maxTypes).name}| FROM MIN FOR |${tVar}|`)
    changed = true
  }
  if (isEmpty(tVar.allMinTypes()) && notEmpty(tVar.allMaxTypes()) && isEmpty(tVar.subtypes.filter(_super => _super.hasSupertype(tVar)))) {
    tVar.typeInfo.minTypes = tVar.allMaxTypes()
    logger.log(`MIN TYPES |${new WollokUnionType(tVar.typeInfo.minTypes).name}| FROM MAX FOR |${tVar}|`)
    changed = true
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTING PROBLEMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function reportProblem(tVar: TypeVariable, problem: TypeSystemProblem): true {
  tVar.addProblem(problem)
  return true // Something changed
}

function reportTypeMismatchUnknownVictim(source: TypeVariable, type: WollokType, target: TypeVariable) {
  return reportTypeMismatch(...selectVictim(source, type, target, target.type()))
}

function reportTypeMismatch(tVar: TypeVariable, expected: WollokType, actual: WollokType) {
  logger.log(`\nERROR: TYPE Expected: ${expected.name} Actual: ${actual.name} FOR |${tVar}|`)
  return reportProblem(tVar, new TypeSystemProblem('typeMismatch', [expected.name, actual.name]))
}

function reportMethodNotFound(tVar: TypeVariable, send: Send, type: WollokType) {
  logger.log(`\nERROR: METHOD |${send.signature}| NOT FOUND ON TYPE |${type.name}| FOR |${tVar}|`)
  return reportProblem(tVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))
}

function selectVictim(source: TypeVariable, type: WollokType, target: TypeVariable, targetType: WollokType): [TypeVariable, WollokType, WollokType] {
  // Super random, to be improved
  if (source.synthetic) return [target, targetType, type]
  if (target.synthetic) return [source, type, targetType]
  if (source.node.is(Reference)) return [source, type, targetType]
  if (target.node.is(Reference)) return [target, targetType, type]
  return [target, targetType, type]
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// OTHERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function validateUnderstandMessage(tVar: TypeVariable, send: Send, source?: TypeVariable) {
  for (const type of tVar.allPossibleTypes()) {
    if (!type.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true }))
      return source?.hasTypeInfered() ? reportTypeMismatch(tVar, source.type(), type) : reportMethodNotFound(tVar, send, type)
  }
  return false
}

function allValidTypeVariables(tVars: Map<Node, TypeVariable>) {
  return [...tVars.values()].filter(tVar => !tVar.hasProblems)
}