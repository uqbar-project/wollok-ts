import { assoc, chain as flatMap, last, memoizeWith, zipObj } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Body, Catch, Class, ClassMember, Environment, Field, Id, is, isModule, List, Name, Sentence } from './model'
import utils from './utils'

// TODO: Remove the parameter type from Id

export interface Locals { [name: string]: Id<'Linked'> }

export interface RuntimeObject {
  readonly id: Id<'Linked'>
  readonly module: Name
  readonly fields: Locals
  readonly innerValue?: any
}

export interface Frame {
  readonly pending: List<Instruction>
  pc: number
  locals: Locals
  operandStack: Id<'Linked'>[]
  resume: Interruption[]
}

export type Interruption = 'return' | 'exception' | 'result'

export interface Evaluation {
  readonly environment: Environment<'Linked'>
  frameStack: Frame[]
  instances: { [id: string]: RuntimeObject }
}

export type Native = (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => void

export const NULL_ID = 'null'
export const VOID_ID = 'void'
export const TRUE_ID = 'true'
export const FALSE_ID = 'false'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// TODO: Factory functions
export type Instruction = LOAD
  | STORE
  | PUSH
  | GET
  | SET
  | INSTANTIATE
  | INHERITS
  | CONDITIONAL_JUMP
  | CALL
  | INIT
  | IF_THEN_ELSE
  | TRY_CATCH_ALWAYS
  | INTERRUPT
  | RESUME_INTERRUPTION

export type LOAD = { kind: 'LOAD', name: Name }
export type STORE = { kind: 'STORE', name: Name, lookup: boolean }
export type PUSH = { kind: 'PUSH', id: Id<'Linked'> }
export type GET = { kind: 'GET', name: Name }
export type SET = { kind: 'SET', name: Name }
export type INSTANTIATE = { kind: 'INSTANTIATE', module: Name, innerValue?: any }
export type INHERITS = { kind: 'INHERITS', module: Name }
export type CONDITIONAL_JUMP = { kind: 'CONDITIONAL_JUMP', count: number }
export type CALL = { kind: 'CALL', message: Name, arity: number, lookupStart?: Name }
export type INIT = { kind: 'INIT', arity: number, lookupStart: Name, initFields: boolean }
export type IF_THEN_ELSE = { kind: 'IF_THEN_ELSE', then: List<Instruction>, else: List<Instruction> }
export type TRY_CATCH_ALWAYS = { kind: 'TRY_CATCH_ALWAYS', try: List<Instruction>, catch: List<Instruction>, always: List<Instruction> }
export type INTERRUPT = { kind: 'INTERRUPT', interruption: Interruption }
export type RESUME_INTERRUPTION = { kind: 'RESUME_INTERRUPTION' }

// TODO: Memoize
export const compile = (environment: Environment<'Linked'>) => memoizeWith(node => environment.id + node.id)(
  (node: Sentence<'Linked'> | Body<'Linked'>): List<Instruction> => {
    // TODO: rename utils to "tools"
    const { resolveTarget, firstAncestorOfKind, parentOf, fullyQualifiedName } = utils(environment)
    switch (node.kind) {

      case 'Body': return flatMap(compile(environment), node.sentences)

      case 'Variable':
        return [
          ...compile(environment)(node.value),
          { kind: 'STORE', name: node.name, lookup: false },
        ]

      case 'Return':
        return [
          ...node.value ? compile(environment)(node.value) : [{ kind: 'PUSH', id: VOID_ID } as Instruction],
          { kind: 'INTERRUPT', interruption: 'return' },
        ]


      case 'Assignment':
        return is('Field')(resolveTarget(node.reference))
          ? [
            { kind: 'LOAD', name: 'self' },
            ...compile(environment)(node.value),
            { kind: 'SET', name: node.reference.name },
          ]
          : [
            ...compile(environment)(node.value),
            { kind: 'STORE', name: node.reference.name, lookup: true },
          ]


      case 'Self':
        return [
          { kind: 'LOAD', name: 'self' },
        ]


      case 'Reference':
        const target = resolveTarget(node)

        if (is('Field')(target)) return [
          { kind: 'LOAD', name: 'self' },
          { kind: 'GET', name: node.name },
        ]

        if (isModule(target)) return [
          { kind: 'LOAD', name: fullyQualifiedName(target) },
        ]

        return [
          { kind: 'LOAD', name: node.name },
        ]


      case 'Literal':
        if (node.value === null) return [
          { kind: 'PUSH', id: NULL_ID },
        ]
        if (typeof node.value === 'boolean') return [
          { kind: 'PUSH', id: node.value ? TRUE_ID : FALSE_ID },
        ]
        if (typeof node.value === 'number') return [
          { kind: 'INSTANTIATE', module: 'wollok.lang.Number', innerValue: node.value },
          { kind: 'INIT', lookupStart: 'wollok.lang.Number', arity: 0, initFields: false }, // TODO: is this necesary?
        ]
        if (typeof node.value === 'string') return [
          { kind: 'INSTANTIATE', module: 'wollok.lang.String', innerValue: node.value },
          { kind: 'INIT', lookupStart: 'wollok.lang.String', arity: 0, initFields: false }, // TODO: is this necesary?
        ]
        if (node.value.kind === 'Singleton') return [
          { kind: 'PUSH', id: node.value.id },
        ]
        return compile(environment)(node.value)


      case 'Send':
        return [
          ...compile(environment)(node.receiver),
          ...flatMap(compile(environment), node.args),
          { kind: 'CALL', message: node.message, arity: node.args.length },
        ]


      case 'Super':
        const currentMethod = firstAncestorOfKind('Method', node)
        return [
          { kind: 'LOAD', name: 'self' },
          ...flatMap(compile(environment), node.args),
          { kind: 'CALL', message: currentMethod.name, arity: node.args.length, lookupStart: fullyQualifiedName(parentOf(currentMethod)) },
        ]


      case 'New':
        return [
          ...flatMap(compile(environment), node.args),
          { kind: 'INSTANTIATE', module: node.className.name },
          { kind: 'INIT', lookupStart: fullyQualifiedName(resolveTarget(node.className)), arity: node.args.length, initFields: true },
        ]


      case 'If':
        return [
          ...compile(environment)(node.condition),
          { kind: 'IF_THEN_ELSE', then: compile(environment)(node.elseBody), else: compile(environment)(node.elseBody) },
        ]


      case 'Throw':
        return [
          ...compile(environment)(node.arg),
          { kind: 'INTERRUPT', interruption: 'exception' },
        ]


      case 'Try':
        return [
          {
            kind: 'TRY_CATCH_ALWAYS',
            try: compile(environment)(node.body),
            catch: flatMap<Catch<'Linked'>, Instruction>(({ parameter, parameterType, body }) => {
              const compiledCatch: List<Instruction> = [
                { kind: 'PUSH', id: VOID_ID } as Instruction,
                { kind: 'LOAD', name: '<exception>' } as Instruction,
                { kind: 'STORE', name: parameter.name } as Instruction,
                ...compile(environment)(body),
                { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
              ]
              return [
                { kind: 'LOAD', name: '<exception>' } as Instruction,
                { kind: 'INHERITS', module: fullyQualifiedName(resolveTarget(parameterType)) } as Instruction,
                { kind: 'CONDITIONAL_JUMP', count: compiledCatch.length } as Instruction,
                ...compiledCatch,
              ]
            }, node.catches),
            always: compile(environment)(node.always),
          },
        ]
    }
  })

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (natives: {}) => (evaluation: Evaluation): Evaluation => {

  const { environment, frameStack, instances } = evaluation
  const currentFrame = last(frameStack)

  const EvaluationError = (message: string) =>
    new Error(`${message}: ${JSON.stringify(evaluation, (key, value) => key === 'environment' ? undefined : value)}`)

  if (!currentFrame) throw EvaluationError('Reached end of frame stack')

  const { operandStack: currentOperandStack, pending: currentPending, pc: currentPC } = currentFrame

  const instruction = currentPending[currentPC]

  if (!instruction) throw EvaluationError(`Reached end of pending instructions {${JSON.stringify(currentFrame)}}[${currentPC}]`)

  const {
    hierarchy,
    superclass,
    resolve,
    fullyQualifiedName,
    inherits,
    constructorLookup,
    methodLookup,
    nativeLookup,
  } = utils(environment)

  switch (instruction.kind) {

    case 'LOAD':
      const value = frameStack.map(({ locals }) => locals[instruction.name]).reverse().find(it => !!it)
      if (!value) throw EvaluationError(`LOAD of missing local "${instruction.name}"`)
      currentOperandStack.push(value)
      break


    case 'STORE':
      const valueId = currentOperandStack.pop()
      if (!valueId) throw EvaluationError('Popped empty operand stack')

      const frame = instruction.lookup && [...frameStack].reverse().find(({ locals }) => instruction.name in locals) || currentFrame

      frame.locals[instruction.name] = valueId
      break


    case 'PUSH':
      currentOperandStack.push(instruction.id)
      break


    case 'GET':
      // TODO: don't use switch... I want variables.
      // TODO: extract: popOperandStack function?
      const selfId = currentOperandStack.pop()
      if (!selfId) throw EvaluationError('Popped empty operand stack')

      const self = instances[selfId]
      if (!self) throw EvaluationError(`Access to undefined instance "${selfId}"`)

      currentOperandStack.push(self.fields[instruction.name])
      break


    case 'SET':
      const setValueId = currentOperandStack.pop()
      const setSelfId = currentOperandStack.pop()
      if (!setValueId || !setSelfId) throw EvaluationError('Popped empty operand stack')

      const setSelf = instances[setSelfId]
      if (!setSelf) throw EvaluationError(`Access to undefined instance "${setSelfId}"`)

      setSelf.fields[instruction.name] = setValueId
      break


    case 'INSTANTIATE':
      const instance: RuntimeObject = { id: uuid(), module: instruction.module, fields: {}, innerValue: instruction.innerValue }

      instances[instance.id] = instance
      currentOperandStack.push(instance.id)
      break


    case 'INHERITS':
      const inhselfId = currentOperandStack.pop()
      if (!inhselfId) throw EvaluationError('Popped empty operand stack')
      const inhself = instances[inhselfId]
      if (!inhself) throw EvaluationError(`Access to undefined instance "${inhselfId}"`)

      currentOperandStack.push(
        inherits(resolve(inhself.module), resolve(instruction.module)) ? TRUE_ID : FALSE_ID
      )
      break

    // TODO: can't we just use IF_ELSE instead?
    case 'CONDITIONAL_JUMP':
      const check = currentOperandStack.pop()
      if (!check) throw EvaluationError('Popped empty operand stack')

      if (check !== TRUE_ID && check !== FALSE_ID)
        throw EvaluationError(`Non boolean condition "${check}"`)

      if (currentPC + instruction.count >= currentPending.length || instruction.count < 0)
        throw EvaluationError(`Invalid jump count ${instruction.count}`)

      currentFrame.pc += check === FALSE_ID ? instruction.count : 0
      break


    // TODO: refactor this
    case 'CALL':
      if (currentOperandStack.length < instruction.arity + 1) throw EvaluationError('Popped empty operand stack')
      const argIds = Array.from({ length: instruction.arity }, () => currentOperandStack.pop()!).reverse()
      const callselfId = currentOperandStack.pop()!

      const callself = instances[callselfId]
      if (!callself) throw EvaluationError(`Access to undefined instance "${callselfId}"`)

      const method = methodLookup(
        instruction.message,
        instruction.arity,
        resolve(instruction.lookupStart || callself.module)
      )

      if (!method) {
        const messageNotUnderstood = methodLookup('messageNotUnderstood', 2, resolve(callself.module))!
        const nameObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.String',
          fields: {},
          innerValue: messageNotUnderstood.name,
        }
        instances[nameObject.id] = nameObject

        const argsObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.List',
          fields: {},
          innerValue: argIds,
        }
        instances[argsObject.id] = argsObject

        currentFrame.resume.push('return')
        frameStack.push({
          pending: compile(environment)(messageNotUnderstood.body!),
          pc: 0,
          locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameObject.id, argsObject.id]), self: callselfId },
          operandStack: [],
          resume: [],
        })
      } else {
        if (method.isNative) {
          const native = nativeLookup(natives, method)
          native(callself, ...argIds.map(arg => instances[arg]))(evaluation)
        } else {
          if (method.parameters.some(({ isVarArg }) => isVarArg)) {
            const restObject: RuntimeObject = {
              id: uuid(),
              module: 'wollok.lang.List',
              fields: {},
              innerValue: argIds.slice(method.parameters.length - 1),
            }
            instances[restObject.id] = restObject

            currentFrame.resume.push('return')
            frameStack.push({
              pending: compile(environment)(method.body!),
              pc: 0,
              locals: {
                ...zipObj(method.parameters.slice(0, -1).map(({ name }) => name), argIds),
                [last(method.parameters)!.name]: restObject.id,
                self: callselfId,
              },
              operandStack: [],
              resume: [],
            })

          } else {
            currentFrame.resume.push('return')
            frameStack.push({
              pending: compile(environment)(method.body!),
              pc: 0,
              locals: { ...zipObj(method.parameters.map(({ name }) => name), argIds), self: callselfId },
              operandStack: [],
              resume: [],
            })
          }
        }
      }
      break


    // TODO: refactor this
    case 'INIT':
      if (currentOperandStack.length < instruction.arity + 1) throw EvaluationError('Popped empty operand stack')
      const initselfId = currentOperandStack.pop()!
      const initargIds = Array.from({ length: instruction.arity }, () => currentOperandStack.pop()!).reverse()

      const initself = instances[initselfId]
      if (!initself) throw EvaluationError(`Access to undefined instance "${initselfId}"`)

      const lookupStart: Class<'Linked'> = resolve(instruction.lookupStart)

      // TODO: Add to Filler method for doing this and just call it ?
      const allFields = hierarchy(resolve(initself.module)).reduce((fields, module) => [
        ...(module.members as ClassMember<'Linked'>[]).filter(is('Field')),
        ...fields,
      ], [] as Field<'Linked'>[])


      const constructor = constructorLookup(instruction.arity, lookupStart)
      const ownSuperclass = superclass(lookupStart)

      if (!constructor) throw EvaluationError(`Missing constructor/${instruction.arity} on ${lookupStart}`)

      currentFrame.resume.push('return')

      if (constructor.parameters.some(({ isVarArg }) => isVarArg)) {
        const restObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.List',
          fields: {},
          innerValue: initargIds.slice(constructor.parameters.length - 1),
        }
        instances[restObject.id] = restObject

        frameStack.push({
          pending: new Array<Instruction>(
            { kind: 'LOAD', name: 'self' },
            ...instruction.initFields ? [
              ...flatMap<Field<'Linked'>, Instruction>(({ value: v, name }) => [
                { kind: 'LOAD', name: 'self' },
                ...compile(environment)(v),
                { kind: 'SET', name },
              ], allFields),
            ] : [],
            ...ownSuperclass || !constructor.baseCall.callsSuper ? new Array<Instruction>(
              ...flatMap(compile(environment), constructor.baseCall.args),
              { kind: 'LOAD', name: 'self' },
              {
                kind: 'INIT',
                lookupStart: constructor.baseCall.callsSuper ? fullyQualifiedName(ownSuperclass!) : instruction.lookupStart,
                arity: constructor.baseCall.args.length,
                initFields: false,
              },
            ) : [],
            ...compile(environment)(constructor.body),
            { kind: 'INTERRUPT', interruption: 'return' as Interruption },
          ),
          locals: {
            ...zipObj(constructor.parameters.slice(0, -1).map(({ name }) => name), initargIds),
            [last(constructor.parameters)!.name]: restObject.id,
            self: initselfId,
          },
          pc: 0,
          operandStack: [],
          resume: [],
        })
      } else {
        frameStack.push({
          pending: new Array<Instruction>(
            ...instruction.initFields ? [
              ...flatMap<Field<'Linked'>, Instruction>(({ value: v, name }) => [
                { kind: 'LOAD', name: 'self' },
                ...compile(environment)(v),
                { kind: 'SET', name },
              ], allFields),
            ] : [],
            ...ownSuperclass || !constructor.baseCall.callsSuper ? new Array<Instruction>(
              ...flatMap(compile(environment), constructor.baseCall.args),
              { kind: 'LOAD', name: 'self' },
              {
                kind: 'INIT',
                lookupStart: constructor.baseCall.callsSuper ? fullyQualifiedName(ownSuperclass!) : instruction.lookupStart,
                arity: constructor.baseCall.args.length,
                initFields: false,
              },
            ) : [],
            ...compile(environment)(constructor.body),
            { kind: 'LOAD', name: 'self' },
            { kind: 'INTERRUPT', interruption: 'return' as Interruption },
          ),
          pc: 0,
          locals: { ...zipObj(constructor.parameters.map(({ name }) => name), initargIds), self: initselfId },
          operandStack: [],
          resume: [],
        })
      }
      break


    case 'IF_THEN_ELSE':
      const ifcheck = currentOperandStack.pop()
      if (!ifcheck) throw EvaluationError('Popped empty operand stack')

      if (ifcheck !== TRUE_ID && ifcheck !== FALSE_ID)
        throw EvaluationError(`Non boolean condition "${ifcheck}"`)

      currentFrame.resume.push('result')
      frameStack.push({
        pending: [
          { kind: 'PUSH', id: VOID_ID } as Instruction,
          ...ifcheck === TRUE_ID ? instruction.then : instruction.else,
          { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
        ],
        pc: 0,
        locals: {},
        operandStack: [],
        resume: [],
      })
      break


    case 'TRY_CATCH_ALWAYS':
      currentFrame.resume.push('result')

      frameStack.push({
        pending: [
          { kind: 'STORE', name: '<previous_interruption>' },
          ...instruction.always,
          { kind: 'LOAD', name: '<previous_interruption>' },
          { kind: 'RESUME_INTERRUPTION' },
        ] as Instruction[],
        pc: 0,
        locals: {},
        operandStack: [],
        resume: ['result', 'return', 'exception'] as Interruption[],
      })

      frameStack.push({
        pending: [
          { kind: 'STORE', name: '<exception>' } as Instruction,
          ...instruction.catch,
          { kind: 'LOAD', name: '<exception>' } as Instruction,
          { kind: 'INTERRUPT', interruption: 'exception' } as Instruction,
        ],
        pc: 0,
        locals: {},
        operandStack: [],
        resume: ['exception'] as Interruption[],
      })

      frameStack.push({
        pending: [
          { kind: 'PUSH', id: VOID_ID } as Instruction,
          ...instruction.try,
          { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
        ],
        pc: 0,
        locals: {},
        operandStack: [],
        resume: [],
      })
      break


    case 'INTERRUPT':
      const intvalue = currentOperandStack.pop()
      if (!intvalue) throw EvaluationError('Popped empty operand stack')

      let nextFrame
      do {
        frameStack.pop()
        nextFrame = last(frameStack)
      } while (nextFrame && !nextFrame.resume.includes(instruction.interruption))

      if (!nextFrame) throw EvaluationError('Unhandled interruption')

      nextFrame.resume = nextFrame.resume.filter(elem => elem !== instruction.interruption)
      nextFrame.operandStack.push(intvalue)
      break


    case 'RESUME_INTERRUPTION':
      const allInterruptions: Interruption[] = ['exception', 'return', 'result']
      if (currentFrame.resume.length !== allInterruptions.length - 1) throw EvaluationError('Interruption to resume cannot be inferred')
      const lastInterruption = allInterruptions.find(interruption => !currentFrame.resume.includes(interruption))!

      const resumevalue = currentOperandStack.pop()
      if (!resumevalue) throw EvaluationError('Popped empty operand stack')

      let resumenextFrame
      do {
        frameStack.pop()
        resumenextFrame = last(frameStack)
      } while (resumenextFrame && !resumenextFrame.resume.includes(lastInterruption))

      if (!resumenextFrame) throw EvaluationError('Unhandled interruption')

      resumenextFrame.resume = resumenextFrame.resume.filter(elem => elem !== lastInterruption)
      resumenextFrame.operandStack.push(resumevalue)
      break
  }

  currentFrame.pc++
  return evaluation
}
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const createEvaluation = (environment: Environment<'Linked'>): Evaluation => {

  const { descendants, fullyQualifiedName } = utils(environment)

  const singletons = descendants(environment).filter(is('Singleton'))
  const instances = [
    { id: NULL_ID, module: 'wollok.lang.Object', fields: {} },
    { id: TRUE_ID, module: 'wollok.lang.Boolean', fields: {} },
    { id: FALSE_ID, module: 'wollok.lang.Boolean', fields: {} },
    // TODO: Initialize attributes
    ...singletons.map(module => ({ id: module.id, module: fullyQualifiedName(module), fields: {} })),
  ].reduce((all, instance) => assoc(instance.id, instance, all), {})
  const locals = {
    null: NULL_ID,
    true: TRUE_ID,
    false: FALSE_ID,
    ...singletons.reduce((all, singleton) => assoc(fullyQualifiedName(singleton), singleton.id, all), {}),
  }

  return {
    environment,
    instances,
    frameStack: [{
      pending: [],
      pc: 0,
      locals,
      operandStack: [],
      resume: [],
    }],
  }
}

// TODO: This feels so much like a generator... Can we make it so?
export const run = (natives: {}, evaluation: Evaluation): Evaluation => {
  while (evaluation.frameStack[0].pending.length) {
    evaluation = step(natives)(evaluation)
  }
  return evaluation
}

export default (environment: Environment<'Linked'>, natives: {}) => ({

  runTests: () => {
    const { descendants } = utils(environment)

    const tests = descendants(environment).filter(is('Test'))

    // TODO:
    // tslint:disable:no-console
    let count = 0
    let success = 0
    for (const test of tests) {
      count += 1
      try {
        const baseEvaluation = createEvaluation(environment)
        const evaluation: Evaluation = {
          ...baseEvaluation,
          frameStack: [{ ...baseEvaluation.frameStack[0], pending: compile(environment)(test.body) }],
        }
        run(natives, evaluation)
        success += 1
        console.log(`${count}/${tests.length} PASSED: ${test.name}`)
      } catch (e) {
        console.log(`${count}/${tests.length} FAILED: ${test.name}`)
      }
    }
    console.log(`TOTAL PASSED: ${success}/${tests.length}`)
  },

})