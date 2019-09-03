import { v4 as uuid } from 'uuid'
import { flatMap, last, zipObj } from './extensions'
import log from './log'
import { Catch, Class, Describe, Environment, Expression, Field, Fixture, Id, is, isModule, Linked, List, Name, NamedArgument, Program, Sentence, Singleton, Test, Variable } from './model'
import tools from './tools'

export interface Locals { [name: string]: Id }

export interface RuntimeObject {
  readonly id: Id
  readonly module: Name
  readonly fields: Locals
  innerValue?: any
}

export interface Frame {
  readonly instructions: List<Instruction>
  nextInstruction: number
  locals: Locals
  operandStack: Id[]
  resume: Interruption[]
}

export type Interruption = 'return' | 'exception' | 'result'

export interface Evaluation {
  readonly environment: Environment
  frameStack: Frame[]
  instances: { [id: string]: RuntimeObject }
}

export type NativeFunction = (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => void
export interface Natives {
  [name: string]: NativeFunction | Natives
}

export const NULL_ID = 'null'
export const VOID_ID = 'void'
export const TRUE_ID = 'true'
export const FALSE_ID = 'false'

export const DECIMAL_PRECISION = 5

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Instruction
  = { kind: 'LOAD', name: Name }
  | { kind: 'STORE', name: Name, lookup: boolean }
  | { kind: 'PUSH', id: Id }
  | { kind: 'GET', name: Name }
  | { kind: 'SET', name: Name }
  | { kind: 'SWAP' }
  | { kind: 'DUP' }
  | { kind: 'INSTANTIATE', module: Name, innerValue?: any }
  | { kind: 'INHERITS', module: Name }
  | { kind: 'CONDITIONAL_JUMP', count: number }
  | { kind: 'CALL', message: Name, arity: number, lookupStart?: Name }
  | { kind: 'INIT', arity: number, lookupStart: Name, initFields: boolean }
  | { kind: 'IF_THEN_ELSE', thenHandler: List<Instruction>, elseHandler: List<Instruction> }
  | { kind: 'TRY_CATCH_ALWAYS', body: List<Instruction>, catchHandler: List<Instruction>, alwaysHandler: List<Instruction> }
  | { kind: 'INTERRUPT', interruption: Interruption }
  | { kind: 'RESUME_INTERRUPTION' }

export const LOAD = (name: Name): Instruction => ({ kind: 'LOAD', name })
export const STORE = (name: Name, lookup: boolean): Instruction => ({ kind: 'STORE', name, lookup })
export const PUSH = (id: Id): Instruction => ({ kind: 'PUSH', id })
export const GET = (name: Name): Instruction => ({ kind: 'GET', name })
export const SET = (name: Name): Instruction => ({ kind: 'SET', name })
export const SWAP: Instruction = { kind: 'SWAP' }
export const DUP: Instruction = { kind: 'DUP' }
export const INSTANTIATE = (module: Name, innerValue?: any): Instruction => ({ kind: 'INSTANTIATE', module, innerValue })
export const INHERITS = (module: Name): Instruction => ({ kind: 'INHERITS', module })
export const CONDITIONAL_JUMP = (count: number): Instruction => ({ kind: 'CONDITIONAL_JUMP', count })
export const CALL = (message: Name, arity: number, lookupStart?: Name): Instruction => ({ kind: 'CALL', message, arity, lookupStart })
export const INIT = (arity: number, lookupStart: Name, initFields: boolean): Instruction =>
  ({ kind: 'INIT', arity, lookupStart, initFields })
export const IF_THEN_ELSE = (thenHandler: List<Instruction>, elseHandler: List<Instruction>): Instruction =>
  ({ kind: 'IF_THEN_ELSE', thenHandler, elseHandler })
export const TRY_CATCH_ALWAYS = (body: List<Instruction>, catchHandler: List<Instruction>, alwaysHandler: List<Instruction>): Instruction =>
  ({ kind: 'TRY_CATCH_ALWAYS', body, catchHandler, alwaysHandler })
export const INTERRUPT = (interruption: Interruption): Instruction => ({ kind: 'INTERRUPT', interruption })
export const RESUME_INTERRUPTION: Instruction = ({ kind: 'RESUME_INTERRUPTION' })


// TODO: Memoize?
export const compile = (environment: Environment) => (...sentences: Sentence<Linked>[]): List<Instruction> =>
  flatMap<Sentence<Linked>, Instruction>(node => {
    const { resolveTarget, firstAncestorOfKind, fullyQualifiedName } = tools(environment)

    switch (node.kind) {

      case 'Variable': return (() => [
        ...compile(environment)(node.value),
        STORE(node.name, false),
      ])()

      case 'Return': return (() => [
        ...node.value
          ? compile(environment)(node.value)
          : [PUSH(VOID_ID)],
        INTERRUPT('return'),
      ])()


      case 'Assignment': return (() =>
        is('Field')(resolveTarget(node.variable))
          ? [
            LOAD('self'),
            ...compile(environment)(node.value),
            SET(node.variable.name),
          ]
          : [
            ...compile(environment)(node.value),
            STORE(node.variable.name, true),
          ]
      )()

      case 'Self': return (() => [
        LOAD('self'),
      ])()


      case 'Reference': return (() => {
        const target = resolveTarget(node)

        if (is('Field')(target)) return [
          LOAD('self'),
          GET(node.name),
        ]

        if (isModule(target)) return [
          LOAD(fullyQualifiedName(target)),
        ]

        return [
          LOAD(node.name),
        ]
      })()


      case 'Literal': return (() => {
        if (node.value === null) return [
          PUSH(NULL_ID),
        ]

        if (typeof node.value === 'boolean') return [
          PUSH(node.value ? TRUE_ID : FALSE_ID),
        ]

        if (typeof node.value === 'number') return [
          INSTANTIATE('wollok.lang.Number', node.value),
        ]

        if (typeof node.value === 'string') return [
          INSTANTIATE('wollok.lang.String', node.value),
        ]

        if (node.value.kind === 'Singleton') {
          if ((node.value.superCall.args as any[]).some(arg => is('NamedArgument')(arg))) {
            return [
              INSTANTIATE(fullyQualifiedName(node.value)),
              INIT(0, fullyQualifiedName(resolveTarget(node.value.superCall.superclass)), true),
              ...flatMap(({ name, value }: NamedArgument<Linked>) => [
                DUP,
                ...compile(environment)(value),
                SET(name),
              ])(node.value.superCall.args as List<NamedArgument<Linked>>),
            ]
          } else {
            return [
              ...flatMap(compile(environment))(node.value.superCall.args as List<Expression<Linked>>),
              INSTANTIATE(fullyQualifiedName(node.value)),
              INIT(node.value.superCall.args.length, fullyQualifiedName(resolveTarget(node.value.superCall.superclass)), true),
            ]
          }
        }

        return [
          ...flatMap(compile(environment))(node.value.args as List<Expression<Linked>>),
          INSTANTIATE(node.value.instantiated.name, []),
          INIT(node.value.args.length, node.value.instantiated.name, false),
        ]
      })()


      case 'Send': return (() => [
        ...compile(environment)(node.receiver),
        ...flatMap(compile(environment))(node.args),
        CALL(node.message, node.args.length),
      ])()


      case 'Super': return (() => {
        const currentMethod = firstAncestorOfKind('Method', node)!
        return [
          LOAD('self'),
          ...flatMap(compile(environment))(node.args),
          CALL(currentMethod.name, node.args.length, fullyQualifiedName(currentMethod.parent())),
        ]
      })()


      case 'New': return (() => {
        const fqn = fullyQualifiedName(resolveTarget(node.instantiated))

        if ((node.args as any[]).some(arg => is('NamedArgument')(arg))) {
          return [
            INSTANTIATE(fqn),
            INIT(0, fqn, true),
            ...flatMap(({ name, value }: NamedArgument<Linked>) => [
              DUP,
              ...compile(environment)(value),
              SET(name),
            ])(node.args as List<NamedArgument<Linked>>),
          ]
        } else {
          return [
            ...flatMap(compile(environment))(node.args as List<Expression<Linked>>),
            INSTANTIATE(fqn),
            INIT(node.args.length, fqn, true),
          ]
        }
      })()


      case 'If': return (() => [
        ...compile(environment)(node.condition),
        IF_THEN_ELSE(compile(environment)(...node.thenBody.sentences), compile(environment)(...node.elseBody.sentences)),
      ])()


      case 'Throw': return (() => [
        ...compile(environment)(node.exception),
        INTERRUPT('exception'),
      ])()


      case 'Try': return (() => [
        TRY_CATCH_ALWAYS(
          compile(environment)(...node.body.sentences),

          flatMap<Catch<Linked>, Instruction>(({ parameter, parameterType, body }) => {
            const compiledCatch: List<Instruction> = [
              PUSH(VOID_ID),
              LOAD('<exception>'),
              STORE(parameter.name, false),
              ...compile(environment)(...body.sentences),
              INTERRUPT('result'),
            ]
            return [
              LOAD('<exception>'),
              INHERITS(fullyQualifiedName(resolveTarget(parameterType))),
              CONDITIONAL_JUMP(compiledCatch.length),
              ...compiledCatch,
            ]
          })(node.catches),

          compile(environment)(...node.always.sentences)
        ),
      ])()
    }
  })(sentences)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const Operations = (evaluation: Evaluation) => {
  const { instances, frameStack } = evaluation
  const { operandStack } = last(frameStack)!

  const popOperand = (): Id => {
    const response = operandStack.pop()
    if (!response) throw new RangeError('Popped empty operand stack')
    return response
  }

  const pushOperand = (id: Id) => {
    operandStack.push(id)
  }

  const getInstance = (id: Id): RuntimeObject => {
    const response = instances[id]
    if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
    return response
  }

  const addInstance = (module: Name, baseInnerValue?: any): Id => {
    let id: Id
    let innerValue = baseInnerValue

    switch (module) {
      case 'wollok.lang.Number':
        const stringValue = innerValue.toFixed(DECIMAL_PRECISION)
        id = 'N!' + stringValue
        innerValue = Number(stringValue)
        break

      case 'wollok.lang.String':
        id = 'S!' + innerValue
        break

      default:
        id = uuid()
    }

    instances[id] = { id, module, fields: {}, innerValue }
    return id
  }

  const interrupt = (interruption: Interruption, valueId: Id) => {
    let nextFrame
    do {
      frameStack.pop()
      nextFrame = last(frameStack)
    } while (nextFrame && !nextFrame.resume.includes(interruption))

    if (!nextFrame) {
      const value = getInstance(valueId)
      const message = interruption === 'exception'
        ? `${value.module}: ${value.fields.message && getInstance(value.fields.message).innerValue || value.innerValue}`
        : ''

      throw new Error(`Unhandled "${interruption}" interruption: [${valueId}] ${message}`)
    }

    nextFrame.resume = nextFrame.resume.filter(elem => elem !== interruption)
    nextFrame.operandStack.push(valueId)
  }

  return {
    popOperand,
    pushOperand,
    getInstance,
    addInstance,
    interrupt,
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (natives: {}) => (evaluation: Evaluation) => {
  const { environment, frameStack } = evaluation

  const {
    hierarchy,
    superclass,
    resolve,
    fullyQualifiedName,
    inherits,
    constructorLookup,
    methodLookup,
    nativeLookup,
  } = tools(environment)

  const {
    popOperand,
    pushOperand,
    getInstance,
    addInstance,
    interrupt,
  } = Operations(evaluation)

  const currentFrame = last(frameStack)!
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.instructions[currentFrame.nextInstruction]
  if (!instruction) throw new Error(`Reached end of instructions`)

  currentFrame.nextInstruction++

  try {

    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const value = frameStack.map(({ locals }) => locals[instruction.name]).reverse().find(it => !!it)
        if (!value) throw new Error(`LOAD of missing local "${instruction.name}"`)
        pushOperand(value)
      })()


      case 'STORE': return (() => {
        const valueId = popOperand()
        const frame = instruction.lookup && [...frameStack].reverse().find(({ locals }) => instruction.name in locals) || currentFrame
        frame.locals[instruction.name] = valueId
      })()


      case 'PUSH': return (() => {
        pushOperand(instruction.id)
      })()


      case 'GET': return (() => {
        const selfId = popOperand()
        const self = getInstance(selfId)
        const value = self.fields[instruction.name]
        if (!value) throw new Error(`Access to undefined field "${self.module}>>${instruction.name}"`)
        pushOperand(value)
      })()


      case 'SET': return (() => {
        const valueId = popOperand()
        const selfId = popOperand()
        const self = getInstance(selfId)
        self.fields[instruction.name] = valueId
      })()

      case 'SWAP': return (() => {
        const a = popOperand()
        const b = popOperand()
        pushOperand(a)
        pushOperand(b)
      })()

      case 'DUP': return (() => {
        const a = popOperand()
        pushOperand(a)
        pushOperand(a)
      })()

      case 'INSTANTIATE': return (() => {
        const id = addInstance(instruction.module, instruction.innerValue)
        pushOperand(id)
      })()

      case 'INHERITS': return (() => {
        const selfId = popOperand()
        const self = getInstance(selfId)
        pushOperand(inherits(resolve(self.module), resolve(instruction.module)) ? TRUE_ID : FALSE_ID)
      })()

      // TODO: can't we just use IF_ELSE instead?
      case 'CONDITIONAL_JUMP': return (() => {
        const check = popOperand()

        if (check !== TRUE_ID && check !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
        if (currentFrame.nextInstruction + instruction.count >= currentFrame.instructions.length || instruction.count < 0)
          throw new Error(`Invalid jump count ${instruction.count}`)

        currentFrame.nextInstruction += check === FALSE_ID ? instruction.count : 0
      })()


      case 'CALL': return (() => {
        const argIds = Array.from({ length: instruction.arity }, popOperand).reverse()
        const selfId = popOperand()
        const self = getInstance(selfId)
        let lookupStart: Name
        if (instruction.lookupStart) {
          const ownHierarchy = hierarchy(resolve(self.module)).map(fullyQualifiedName)
          const start = ownHierarchy.findIndex(fqn => fqn === instruction.lookupStart)
          lookupStart = ownHierarchy[start + 1]
        } else {
          lookupStart = self.module
        }

        const method = methodLookup(instruction.message, instruction.arity, resolve(lookupStart))

        if (!method) {
          log.warn('Method not found:', lookupStart, '>>', instruction.message, '/', instruction.arity)

          const messageNotUnderstood = methodLookup('messageNotUnderstood', 2, resolve(self.module))!
          const nameId = addInstance('wollok.lang.String', instruction.message)
          const argsId = addInstance('wollok.lang.List', argIds)

          currentFrame.resume.push('return')
          frameStack.push({
            instructions: compile(environment)(...messageNotUnderstood.body!.sentences),
            nextInstruction: 0,
            locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]), self: selfId },
            operandStack: [],
            resume: [],
          })
        } else {

          if (method.isNative) {
            log.debug('Calling Native:', lookupStart, '>>', instruction.message, '/', instruction.arity)
            const native = nativeLookup(natives, method)
            const args = argIds.map(id => {
              if (id === VOID_ID) throw new Error('reference to void argument')
              return evaluation.instances[id]
            })
            native(self, ...args)(evaluation)
          } else {

            const parameterNames = method.parameters.map(({ name }) => name)
            let locals: Locals

            if (method.parameters.some(({ isVarArg }) => isVarArg)) {
              const restId = addInstance('wollok.lang.List', argIds.slice(method.parameters.length - 1))
              locals = {
                ...zipObj(parameterNames.slice(0, -1), argIds),
                [last(method.parameters)!.name]: restId,
                self: selfId,
              }
            } else {
              locals = {
                ...zipObj(parameterNames, argIds),
                self: selfId,
              }
            }

            currentFrame.resume.push('return')
            frameStack.push({
              instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                INTERRUPT('return'),
              ],
              nextInstruction: 0,
              locals,
              operandStack: [],
              resume: [],
            })
          }
        }
      })()


      case 'INIT': return (() => {
        const selfId = popOperand()
        const argIds = Array.from({ length: instruction.arity }, popOperand).reverse()
        const self = getInstance(selfId)

        const lookupStart: Class<Linked> = resolve(instruction.lookupStart)

        // TODO: Add to Filler a method for doing this and just call it ?
        const allFields = hierarchy(resolve(self.module)).reduce((fields, module) => [
          ...module.fields(),
          ...fields,
        ], [] as Field<Linked>[])

        const constructor = constructorLookup(instruction.arity, lookupStart)
        const ownSuperclass = superclass(lookupStart)

        if (!constructor) throw new Error(`Missing constructor/${instruction.arity} on ${fullyQualifiedName(lookupStart)}`)

        let locals: Locals
        if (constructor.parameters.some(({ isVarArg }) => isVarArg)) {
          const restObject = addInstance('wollok.lang.List', argIds.slice(constructor.parameters.length - 1))
          locals = {
            ...zipObj(constructor.parameters.slice(0, -1).map(({ name }) => name), argIds),
            [last(constructor.parameters)!.name]: restObject,
            self: selfId,
          }
        } else {
          locals = { ...zipObj(constructor.parameters.map(({ name }) => name), argIds), self: selfId }
        }

        currentFrame.resume.push('return')
        frameStack.push({
          instructions: new Array<Instruction>(
            ...instruction.initFields ? [
              ...flatMap(({ value: v, name }: Field<Linked>) => [
                LOAD('self'),
                ...compile(environment)(v),
                SET(name),
              ])(allFields),
            ] : [],
            ...ownSuperclass || !constructor.baseCall.callsSuper ? new Array<Instruction>(
              ...flatMap(compile(environment))(constructor.baseCall.args),
              LOAD('self'),
              INIT(
                constructor.baseCall.args.length,
                constructor.baseCall.callsSuper ? fullyQualifiedName(ownSuperclass!) : instruction.lookupStart,
                false
              ),
            ) : [],
            ...compile(environment)(...constructor.body.sentences),
            LOAD('self'),
            INTERRUPT('return')
          ),
          nextInstruction: 0,
          locals,
          operandStack: [],
          resume: [],
        })
      })()


      case 'IF_THEN_ELSE': return (() => {
        const check = popOperand()
        if (!check) throw new Error('Popped empty operand stack')

        if (check !== TRUE_ID && check !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)

        currentFrame.resume.push('result')
        frameStack.push({
          instructions: [
            PUSH(VOID_ID),
            ...check === TRUE_ID ? instruction.thenHandler : instruction.elseHandler,
            INTERRUPT('result'),
          ],
          nextInstruction: 0,
          locals: {},
          operandStack: [],
          resume: [],
        })
      })()


      case 'TRY_CATCH_ALWAYS': return (() => {
        currentFrame.resume.push('result')

        frameStack.push({
          instructions: [
            STORE('<previous_interruption>', false),
            ...instruction.alwaysHandler,
            LOAD('<previous_interruption>'),
            RESUME_INTERRUPTION,
          ] as Instruction[],
          nextInstruction: 0,
          locals: {},
          operandStack: [],
          resume: ['result', 'return', 'exception'] as Interruption[],
        })

        frameStack.push({
          instructions: [
            STORE('<exception>', false),
            ...instruction.catchHandler,
            LOAD('<exception>'),
            INTERRUPT('exception'),
          ],
          nextInstruction: 0,
          locals: {},
          operandStack: [],
          resume: ['exception'] as Interruption[],
        })

        frameStack.push({
          instructions: [
            PUSH(VOID_ID),
            ...instruction.body,
            INTERRUPT('result'),
          ],
          nextInstruction: 0,
          locals: {},
          operandStack: [],
          resume: [],
        })
      })()


      case 'INTERRUPT': return (() => {
        const valueId = popOperand()
        interrupt(instruction.interruption, valueId)
      })()


      case 'RESUME_INTERRUPTION': return (() => {
        const allInterruptions: Interruption[] = ['exception', 'return', 'result']
        if (currentFrame.resume.length !== allInterruptions.length - 1) throw new Error('Interruption to resume cannot be inferred')
        const lastInterruption = allInterruptions.find(interruption => !currentFrame.resume.includes(interruption))!

        const valueId = popOperand()
        interrupt(lastInterruption, valueId)
      })()
    }

  } catch (error) {
    log.error(error)
    interrupt('exception', addInstance('wollok.lang.EvaluationError', error))
  }

}

/** Takes all possible steps, until the last frame has no pending instructions */
export const stepAll = (natives: {}) => (evaluation: Evaluation) => {
  const takeStep = step(natives)
  while (last(evaluation.frameStack)!.nextInstruction < last(evaluation.frameStack)!.instructions.length) {
    log.step(evaluation)
    takeStep(evaluation)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const copyEvaluation = (evaluation: Evaluation): Evaluation => ({
  ...evaluation,
  instances: Object.keys(evaluation.instances).reduce((instanceClones, name) => ({
    ...instanceClones, [name]: {
      ...evaluation.instances[name],
      fields: { ...evaluation.instances[name].fields },
    },
  }), {}),
  frameStack: evaluation.frameStack.map(frame => ({
    ...frame,
    locals: { ...frame.locals },
    operandStack: [...frame.operandStack],
    resume: [...frame.resume],
  })),
})

const buildEvaluation = (environment: Environment): Evaluation => {
  const { fullyQualifiedName, resolveTarget } = tools(environment)

  const globalSingletons = environment.descendants<Singleton<Linked>>(is('Singleton')).filter(node => !!node.name)

  const instances = [
    { id: NULL_ID, module: 'wollok.lang.Object', fields: {}, innerValue: null },
    { id: TRUE_ID, module: 'wollok.lang.Boolean', fields: {}, innerValue: true },
    { id: FALSE_ID, module: 'wollok.lang.Boolean', fields: {}, innerValue: false },
    ...globalSingletons.map(module => ({ id: module.id, module: fullyQualifiedName(module), fields: {} })),
  ].reduce((all, instance) => ({ ...all, [instance.id]: instance }), {})

  const locals = {
    null: NULL_ID,
    true: TRUE_ID,
    false: FALSE_ID,
    ...globalSingletons.reduce((all, singleton) => ({ ...all, [fullyQualifiedName(singleton)]: singleton.id }), {}),
  }

  return {
    environment,
    instances,
    frameStack: [{
      instructions: [
        ...flatMap(({ id, superCall: { superclass, args } }: Singleton<Linked>) => {
          if ((args as any[]).some(is('NamedArgument'))) {
            return [
              PUSH(id),
              INIT(0, fullyQualifiedName(resolveTarget(superclass)), true),
              ...flatMap(({ name, value }: NamedArgument<Linked>) => [
                DUP,
                ...compile(environment)(value),
                SET(name),
              ])(args as List<NamedArgument<Linked>>),
              PUSH(id),
            ]
          } else {
            return [
              ...flatMap(compile(environment))(args as List<Expression<Linked>>),
              PUSH(id),
              INIT(args.length, fullyQualifiedName(resolveTarget(superclass)), true),
            ]
          }
        })(globalSingletons),
      ],
      nextInstruction: 0,
      locals,
      operandStack: [],
      resume: [],
    }],
  }
}

function run(evaluation: Evaluation, natives: Natives, sentences: List<Sentence<Linked>>) {

  const instructions = compile(evaluation.environment)(...sentences)

  evaluation.frameStack.push({
    instructions,
    nextInstruction: 0,
    locals: {},
    operandStack: [],
    resume: [],
  })

  stepAll(natives)(evaluation)

  return evaluation.instances[evaluation.frameStack.pop()!.operandStack.pop()!]
}

export default (environment: Environment, natives: {}) => ({

  buildEvaluation: () => buildEvaluation(environment),

  copyEvaluation,

  step: step(natives),

  stepAll: stepAll(natives),

  sendMessage: (message: string, receiver: Id, ...args: Id[]) => (evaluation: Evaluation) => {
    const takeStep = step(natives)
    const initialFrameCount = evaluation.frameStack.length
    last(evaluation.frameStack)!.resume.push('return')
    evaluation.frameStack.push({
      instructions: [
        CALL(message, args.length),
        INTERRUPT('return'),
      ],
      nextInstruction: 0,
      locals: {},
      operandStack: [receiver, ...args],
      resume: [],
    })
    do {
      takeStep(evaluation)
    } while (evaluation.frameStack.length > initialFrameCount)
  },

  runProgram: (fullyQualifiedName: Name, evaluation?: Evaluation): void => {
    const { resolve } = tools(environment)

    const programSentences = resolve<Program<Linked>>(fullyQualifiedName).body.sentences

    log.start('Initializing Evaluation')
    const initializedEvaluation = evaluation || buildEvaluation(environment)
    stepAll(natives)(initializedEvaluation)
    log.done('Initializing Evaluation')

    log.info('Running program', fullyQualifiedName)
    run(initializedEvaluation, natives, programSentences)
    log.success('Done!')
  },

  runTests: (): [number, number] => {
    // TODO: descendants stage should be inferred from the parameter
    // TODO: maybe descendants should have an optional filter function
    // TODO: create extension function to divide array based on condition
    const describes = environment.descendants<Describe<Linked>>(is('Describe'))
    const freeTests = environment.descendants<Test<Linked>>(is('Test')).filter(node => !is('Describe')(node.parent()))

    log.start('Initializing Evaluation')
    const initializedEvaluation = buildEvaluation(environment)
    stepAll(natives)(initializedEvaluation)
    log.done('Initializing Evaluation')

    let total = 0
    let passed = 0
    const runTests = ((testsToRun: List<Test<Linked>>, sentences: (t: Test<Linked>) => List<Sentence<Linked>>) => {
      const testsCount = testsToRun.length
      total += testsCount
      log.separator()
      testsToRun.forEach((test, i) => {
        const n = i + 1
        log.resetStep()
        const evaluation = copyEvaluation(initializedEvaluation)
        log.info('Running test', n, '/', testsCount, ':', test.source && test.source.file, '>>', test.name)
        log.start(test.name)
        try {
          run(evaluation, natives, sentences(test))
          passed++
          log.success('Passed!', n, '/', testsCount, ':', test.source && test.source.file, '>>', test.name)
        } catch (error) {
          log.error('Failed!', n, '/', testsCount, ':', test.source && test.source.file, '>>', test.name)
        }
        log.done(test.name)
        log.separator()
      })
    })

    log.start('Running free tests')
    runTests(freeTests, (test) => test.body.sentences)
    log.done('Running free tests')


    log.start('Running describes')
    describes.forEach((describe: Describe<Linked>) => {
      const variables = describe.descendants<Variable<Linked>>(is('Variable'))
      const fixture = describe.descendants<Fixture<Linked>>(is('Fixture'))[0]
      const fixtureSentences = (fixture) ? fixture.body!.sentences : []
      runTests(describe.tests(), ({ body: { sentences } }) => [...variables, ...fixtureSentences, ...sentences])
    })
    log.done('Running describes')

    return [passed, total]
  },

})