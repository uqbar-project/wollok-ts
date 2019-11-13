import * as build from './builders'
import { last, zipObj } from './extensions'
import log from './log'
import { Class, Describe, Entity, Environment, Expression, Id, List, Method, Module, Name, NamedArgument, Program, Sentence, Singleton, Test, Variable } from './model'

export type Locals = Record<Name, Id>

export interface Context {
  readonly parent: Id
  readonly locals: Locals
  readonly exceptionHandlerIndex?: number
}

export type InnerValue = string | number | Id[]
export interface RuntimeObject {
  readonly id: Id
  readonly module: Name
  innerValue?: InnerValue

  context(): Context
  get(field: Name): RuntimeObject | undefined
  set(field: Name, valueId: Id): void

  assertIsNumber(): asserts this is RuntimeObject & { innerValue: number }
  assertIsString(): asserts this is RuntimeObject & { innerValue: string }
  assertIsCollection(): asserts this is RuntimeObject & { innerValue: Id[] }
}

export interface Frame {
  readonly instructions: List<Instruction>
  context: Id
  nextInstruction: number
  operandStack: Id[]
  resume: Interruption[]

  popOperand(): Id
  pushOperand(id: Id): void
}

export type Interruption = 'return' | 'exception'

export interface Evaluation {
  readonly environment: Environment
  frameStack: Frame[]
  instances: Record<Id, RuntimeObject>
  contexts: Record<Id, Context> // TODO: GC contexts

  currentFrame(): Frame
  instance(id: Id): RuntimeObject
  createInstance(module: Name, baseInnerValue?: InnerValue, id?: Id): Id
  context(id: Id): Context
  createContext(parent: Id, locals?: Locals, id?: Id, exceptionHandlerIndex?: number): Id
  // TODO: mover a Frame?
  suspend(until: Interruption | List<Interruption>, instructions: List<Instruction>, context: Id): void
  // TODO: mover a Frame?
  interrupt(interruption: Interruption, valueId: Id): void
  copy(): Evaluation
}

export type NativeFunction = (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => void
export interface Natives {
  [name: string]: NativeFunction | Natives
}

export const NULL_ID = 'null'
export const VOID_ID = 'void'
export const TRUE_ID = 'true'
export const FALSE_ID = 'false'
export const LAZY_ID = '<lazy>'

export const DECIMAL_PRECISION = 5

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Instruction
  = { kind: 'LOAD', name: Name, lazyInitialization?: List<Instruction> }
  | { kind: 'STORE', name: Name, lookup: boolean }
  | { kind: 'PUSH', id: Id }
  | { kind: 'POP' } // TODO: test
  | { kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta?: number } // TODO: test
  | { kind: 'POP_CONTEXT' } // TODO: test
  | { kind: 'SWAP', distance: number } // TODO: test with parameters
  | { kind: 'DUP' }
  | { kind: 'INSTANTIATE', module: Name, innerValue?: InnerValue }
  | { kind: 'INHERITS', module: Name }
  | { kind: 'CONDITIONAL_JUMP', count: number }
  | { kind: 'CALL', message: Name, arity: number, useReceiverContext: boolean, lookupStart?: Name }
  | { kind: 'INIT', arity: number, lookupStart: Name }
  | { kind: 'INIT_NAMED', argumentNames: List<Name> }
  | { kind: 'INTERRUPT', interruption: Interruption }

export const LOAD = (name: Name, lazyInitialization?: List<Instruction>): Instruction => ({ kind: 'LOAD', name, lazyInitialization })
export const STORE = (name: Name, lookup: boolean): Instruction => ({ kind: 'STORE', name, lookup })
export const PUSH = (id: Id): Instruction => ({ kind: 'PUSH', id })
export const POP: Instruction = ({ kind: 'POP' })
export const PUSH_CONTEXT = (exceptionHandlerIndexDelta?: number): Instruction => ({ kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta })
export const POP_CONTEXT: Instruction = ({ kind: 'POP_CONTEXT' })
export const SWAP = (distance: number = 0): Instruction => ({ kind: 'SWAP', distance })
export const DUP: Instruction = { kind: 'DUP' }
export const INSTANTIATE = (module: Name, innerValue?: InnerValue): Instruction => ({ kind: 'INSTANTIATE', module, innerValue })
export const INHERITS = (module: Name): Instruction => ({ kind: 'INHERITS', module })
export const CONDITIONAL_JUMP = (count: number): Instruction => ({ kind: 'CONDITIONAL_JUMP', count })
export const CALL = (message: Name, arity: number, useReceiverContext: boolean = true, lookupStart?: Name): Instruction =>
  ({ kind: 'CALL', message, arity, useReceiverContext, lookupStart })
export const INIT = (arity: number, lookupStart: Name): Instruction =>
  ({ kind: 'INIT', arity, lookupStart })
export const INIT_NAMED = (argumentNames: List<Name>): Instruction => ({ kind: 'INIT_NAMED', argumentNames })
export const INTERRUPT = (interruption: Interruption): Instruction => ({ kind: 'INTERRUPT', interruption })

export const compile = (environment: Environment) => (...sentences: Sentence[]): List<Instruction> =>
  sentences.flatMap(node => {
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


      case 'Assignment': return (() => [
        ...compile(environment)(node.value),
        STORE(node.variable.name, true),
      ])()

      case 'Self': return (() => [
        LOAD('self'),
      ])()


      case 'Reference': return (() => {
        const target = node.target()

        if (target.is('Variable') && target.parent().is('Package')) return [
          LOAD(target.fullyQualifiedName(), compile(environment)(target.value)),
        ]

        if (target.is('Module')) return [
          LOAD(target.fullyQualifiedName()),
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
          if ((node.value.superCall.args as any[]).some(arg => arg.is('NamedArgument'))) {
            const supercallArgs = node.value.superCall.args as List<NamedArgument>
            return [
              ...supercallArgs.flatMap(({ value }) => compile(environment)(value)),
              INSTANTIATE(node.value.fullyQualifiedName()),
              INIT_NAMED(supercallArgs.map(({ name }) => name)),
              INIT(0, node.value.superCall.superclass.target<Class>().fullyQualifiedName()),
            ]
          } else {
            return [
              ...(node.value.superCall.args as List<Expression>).flatMap(arg => compile(environment)(arg)),
              INSTANTIATE(node.value.fullyQualifiedName()),
              INIT_NAMED([]),
              INIT(node.value.superCall.args.length, node.value.superCall.superclass.target<Class>().fullyQualifiedName()),
            ]
          }
        }

        const args = node.value.args as List<Expression>

        return [
          INSTANTIATE(node.value.instantiated.name, []),
          INIT_NAMED([]),
          INIT(0, node.value.instantiated.name),
          ...args.flatMap(arg => [
            DUP,
            ...compile(environment)(arg),
            CALL('add', 1),
            POP,
          ]),
        ]
      })()


      case 'Send': return (() => [
        ...compile(environment)(node.receiver),
        ...node.args.flatMap(arg => compile(environment)(arg)),
        CALL(node.message, node.args.length),
      ])()


      case 'Super': return (() => {
        const currentMethod = node.closestAncestor<Method>('Method')!
        return [
          LOAD('self'),
          ...node.args.flatMap(arg => compile(environment)(arg)),
          CALL(currentMethod.name, node.args.length, true, currentMethod.parent().fullyQualifiedName()),
        ]
      })()


      case 'New': return (() => {
        const fqn = node.instantiated.target<Entity>().fullyQualifiedName()

        if ((node.args as any[]).some(arg => arg.is('NamedArgument'))) {
          const args = node.args as List<NamedArgument>

          return [
            ...args.flatMap(({ value }) => compile(environment)(value)),
            INSTANTIATE(fqn),
            INIT_NAMED(args.map(({ name }) => name)),
            INIT(0, fqn),
          ]
        } else {
          return [
            ...(node.args as List<Expression>).flatMap(arg => compile(environment)(arg)),
            INSTANTIATE(fqn),
            INIT_NAMED([]),
            INIT(node.args.length, fqn),
          ]
        }
      })()


      case 'If': return (() => {
        const compiledThen = compile(environment)(...node.thenBody.sentences)
        const thenClause = compiledThen.length ? compiledThen : [PUSH(VOID_ID)]
        const compiledElse = compile(environment)(...node.elseBody.sentences)
        const elseClause = compiledElse.length ? compiledElse : [PUSH(VOID_ID)]
        return [
          ...compile(environment)(node.condition),
          PUSH_CONTEXT(),
          CONDITIONAL_JUMP(thenClause.length + 2),
          ...thenClause,
          PUSH(FALSE_ID),
          CONDITIONAL_JUMP(elseClause.length),
          ...elseClause,
          POP_CONTEXT,
        ]
      })()


      case 'Throw': return (() => [
        ...compile(environment)(node.exception),
        INTERRUPT('exception'),
      ])()


      case 'Try': return (() => {
        const clause = compile(environment)(...node.body.sentences)
        const always = compile(environment)(...node.always.sentences)
        const catches = node.catches.flatMap(({ parameter, parameterType, body }) => {
          const handler = compile(environment)(...body.sentences)
          return [
            LOAD('<exception>'),
            INHERITS(parameterType.target<Module>().fullyQualifiedName()),
            CONDITIONAL_JUMP(handler.length + 6),
            LOAD('<exception>'),
            STORE(parameter.name, false),
            PUSH(VOID_ID),
            ...handler,
            STORE('<result>', true),
            PUSH(FALSE_ID),
            STORE('<exception>', true),
          ]
        })

        return [
          PUSH_CONTEXT(),
          PUSH(FALSE_ID),
          STORE('<exception>', false),
          PUSH(VOID_ID),
          STORE('<result>', false),

          PUSH_CONTEXT(clause.length + 5),
          PUSH(VOID_ID), // TODO: Won't this break if we asume expressions only push 1 to the stack?
          ...clause,
          STORE('<result>', true),
          POP_CONTEXT,
          PUSH(FALSE_ID),
          CONDITIONAL_JUMP(catches.length + 2),

          PUSH_CONTEXT(catches.length + 1),
          ...catches,
          POP_CONTEXT,

          PUSH_CONTEXT(),
          ...always,
          POP_CONTEXT,
          LOAD('<exception>'),
          INHERITS('wollok.lang.Exception'),
          CONDITIONAL_JUMP(2),
          LOAD('<exception>'),
          INTERRUPT('exception'),
          LOAD('<result>'),

          POP_CONTEXT,
        ]
      })()
    }
  })

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (natives: {}) => (evaluation: Evaluation) => {
  const { environment } = evaluation

  const currentFrame = evaluation.currentFrame()
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.instructions[currentFrame.nextInstruction]
  if (!instruction) throw new Error(`Reached end of instructions`)

  currentFrame.nextInstruction++

  try {

    switch (instruction.kind) {

      case 'LOAD': return (() => {
        function resolve(name: Name, contextId: Id): Id | undefined {
          const context = evaluation.context(contextId)
          const reponse = context.locals[name]
          if (reponse) return reponse
          if (!context.parent) return undefined
          return resolve(name, context.parent)
        }

        const value = resolve(instruction.name, currentFrame.context)
        if (!value) throw new Error(`LOAD of missing local "${instruction.name}" on context ${JSON.stringify(evaluation.context(currentFrame.context))}`)

        // TODO: should add tests for the lazy load and store
        if (value !== LAZY_ID) currentFrame.pushOperand(value)
        else {
          if (!instruction.lazyInitialization) throw new Error(`No lazy initialization for lazy reference "${instruction.name}"`)

          evaluation.suspend([], [
            ...instruction.lazyInitialization,
            DUP,
            STORE(instruction.name, true),
            INTERRUPT('return'),
          ], currentFrame.context)
        }
      })()


      case 'STORE': return (() => {
        const valueId = evaluation.currentFrame().popOperand()
        const currentContext = evaluation.context(currentFrame.context)

        let context: Context | undefined = currentContext
        if (instruction.lookup) {
          while (context && !(instruction.name in context.locals)) {
            context = context.parent ? evaluation.context(context.parent) : undefined
          }
        }

        (context ?? currentContext).locals[instruction.name] = valueId
      })()


      case 'PUSH': return (() => {
        currentFrame.pushOperand(instruction.id)
      })()


      case 'POP': return (() => {
        currentFrame.popOperand()
      })()


      case 'PUSH_CONTEXT': return (() => {
        currentFrame.context = evaluation.createContext(
          currentFrame.context,
          undefined,
          undefined,
          instruction.exceptionHandlerIndexDelta
            ? currentFrame.nextInstruction + instruction.exceptionHandlerIndexDelta
            : undefined
        )
      })()


      case 'POP_CONTEXT': return (() => {
        currentFrame.context = evaluation.context(currentFrame.context).parent
      })()


      case 'SWAP': return (() => {
        const a = currentFrame.popOperand()
        const bs = new Array(instruction.distance).fill(null).map(() => evaluation.currentFrame().popOperand()).reverse()
        const c = currentFrame.popOperand()
        currentFrame.pushOperand(a)
        bs.forEach(b => currentFrame.pushOperand(b))
        currentFrame.pushOperand(c)
      })()

      case 'DUP': return (() => {
        const a = evaluation.currentFrame().popOperand()
        currentFrame.pushOperand(a)
        currentFrame.pushOperand(a)
      })()

      case 'INSTANTIATE': return (() => {
        const id = evaluation.createInstance(instruction.module, instruction.innerValue)
        currentFrame.pushOperand(id)
      })()

      case 'INHERITS': return (() => {
        const selfId = evaluation.currentFrame().popOperand()
        const self = evaluation.instance(selfId)
        currentFrame.pushOperand(
          environment.getNodeByFQN<Module>(self.module).inherits(environment.getNodeByFQN(instruction.module)) ? TRUE_ID : FALSE_ID
        )
      })()

      case 'CONDITIONAL_JUMP': return (() => {
        const check = evaluation.currentFrame().popOperand()

        if (check !== TRUE_ID && check !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
        if (currentFrame.nextInstruction + instruction.count >= currentFrame.instructions.length || instruction.count < 0)
          throw new Error(`Invalid jump count ${instruction.count} on index ${currentFrame.nextInstruction} of [${currentFrame.instructions.map(i => JSON.stringify(i))}]`)

        currentFrame.nextInstruction += check === FALSE_ID ? instruction.count : 0
      })()


      case 'CALL': return (() => {
        const argIds = Array.from({ length: instruction.arity }, () => evaluation.currentFrame().popOperand()).reverse()
        const selfId = evaluation.currentFrame().popOperand()
        const self = evaluation.instance(selfId)
        let lookupStart: Name
        if (instruction.lookupStart) {
          const ownHierarchy = environment.getNodeByFQN<Module>(self.module).hierarchy().map(module => module.fullyQualifiedName())
          const start = ownHierarchy.findIndex(fqn => fqn === instruction.lookupStart)
          lookupStart = ownHierarchy[start + 1]
        } else {
          lookupStart = self.module
        }
        const method = environment.getNodeByFQN<Module>(lookupStart).lookupMethod(instruction.message, instruction.arity)

        if (!method) {
          log.warn('Method not found:', lookupStart, '>>', instruction.message, '/', instruction.arity)

          const messageNotUnderstood = environment.getNodeByFQN<Module>(self.module).lookupMethod('messageNotUnderstood', 2)!
          const nameId = evaluation.createInstance('wollok.lang.String', instruction.message)
          const argsId = evaluation.createInstance('wollok.lang.List', argIds)

          evaluation.suspend(
            'return',
            compile(environment)(...messageNotUnderstood.body!.sentences),
            evaluation.createContext(self.id, {
              ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]),
            })
          )

        } else {

          if (method.isNative) {
            log.debug('Calling Native:', lookupStart, '>>', instruction.message, '/', instruction.arity)
            const fqn = `${method.parent().fullyQualifiedName()}.${method.name}`
            const native: NativeFunction = fqn.split('.').reduce((current, name) => {
              const next = current[name]
              if (!next) throw new Error(`Native not found: ${fqn}`)
              return next
            }, natives as any)
            const args = argIds.map(id => {
              if (id === VOID_ID) throw new Error('reference to void argument')
              return evaluation.instances[id]
            })

            native(self, ...args)(evaluation)
          } else {
            const parameterNames = method.parameters.map(({ name }) => name)
            const locals: Locals = method.parameters.some(({ isVarArg }) => isVarArg)
              ? {
                ...zipObj(parameterNames.slice(0, -1), argIds),
                [last(method.parameters)!.name]: evaluation.createInstance('wollok.lang.List', argIds.slice(method.parameters.length - 1)),
              }
              : {
                ...zipObj(parameterNames, argIds),
              }

            evaluation.suspend('return', [
              ...compile(environment)(...method.body!.sentences),
              PUSH(VOID_ID),
              INTERRUPT('return'),
            ], evaluation.createContext(instruction.useReceiverContext ? selfId : evaluation.context(selfId).parent, locals))
          }
        }
      })()


      case 'INIT': return (() => {
        const selfId = evaluation.currentFrame().popOperand()
        const self = evaluation.instance(selfId)
        const argIds = Array.from({ length: instruction.arity }, () => evaluation.currentFrame().popOperand()).reverse()
        const lookupStart: Class = environment.getNodeByFQN(instruction.lookupStart)
        const constructor = lookupStart.lookupConstructor(instruction.arity)
        const ownSuperclass = lookupStart.superclassNode()

        if (!constructor) throw new Error(`Missing constructor/${instruction.arity} on ${lookupStart.fullyQualifiedName()}`)

        const locals = constructor.parameters.some(({ isVarArg }) => isVarArg)
          ? {
            ...zipObj(constructor.parameters.slice(0, -1).map(({ name }) => name), argIds),
            [last(constructor.parameters)!.name]:
              evaluation.createInstance('wollok.lang.List', argIds.slice(constructor.parameters.length - 1)),
          }
          : { ...zipObj(constructor.parameters.map(({ name }) => name), argIds) }

        evaluation.suspend('return', [
          ...ownSuperclass || !constructor.baseCall.callsSuper ? [
            ...constructor.baseCall.args.flatMap(arg => compile(environment)(arg)),
            LOAD('self'),
            INIT(
              constructor.baseCall.args.length,
              constructor.baseCall.callsSuper ? ownSuperclass!.fullyQualifiedName() : instruction.lookupStart,
            ),
          ] : [],
          ...compile(environment)(...constructor.body.sentences),
          LOAD('self'),
          CALL('initialize', 0),
          LOAD('self'),
          INTERRUPT('return'),
        ], evaluation.createContext(self.id, locals))
      })()

      case 'INIT_NAMED': return (() => {
        const selfId = evaluation.currentFrame().popOperand()
        const self = evaluation.instance(selfId)

        const fields = environment
          .getNodeByFQN<Module>(self.module)
          .hierarchy()
          .flatMap(module => module.fields())

        for (const field of fields)
          self.set(field.name, VOID_ID)

        for (const name of [...instruction.argumentNames].reverse())
          self.set(name, evaluation.currentFrame().popOperand())

        evaluation.suspend('return', [
          ...fields.filter(field => !instruction.argumentNames.includes(field.name)).flatMap(field => [
            ...compile(environment)(field.value),
            STORE(field.name, true),
          ]),
          LOAD('self'),
          INTERRUPT('return'),
        ], self.id)
      })()


      case 'INTERRUPT': return (() => {
        const valueId = evaluation.currentFrame().popOperand()
        evaluation.interrupt(instruction.interruption, valueId)
      })()

    }

  } catch (error) {
    log.error(error)
    evaluation.interrupt('exception', evaluation.createInstance('wollok.lang.EvaluationError', error))
  }

}

/** Takes all possible steps, until the last frame has no pending instructions */
export const stepAll = (natives: {}) => (evaluation: Evaluation) => {
  const takeStep = step(natives)
  // TODO: add done() message to check instructions pending
  while (evaluation.currentFrame().nextInstruction < evaluation.currentFrame().instructions.length) {
    log.step(evaluation)
    takeStep(evaluation)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const buildEvaluation = (environment: Environment): Evaluation => {

  const globalConstants = environment.descendants<Variable>('Variable').filter(node => node.parent().is('Package'))
  const globalSingletons = environment.descendants<Singleton>('Singleton').filter(node => !!node.name)

  const evaluation = build.Evaluation(environment)()

  const globalContext = evaluation.createContext('', {
    null: NULL_ID,
    true: TRUE_ID,
    false: FALSE_ID,
    ...globalSingletons.reduce((all, singleton) => ({ ...all, [singleton.fullyQualifiedName()]: singleton.id }), {}),
    ...globalConstants.reduce((all, constant) => ({ ...all, [constant.fullyQualifiedName()]: LAZY_ID }), {}),
  })

  evaluation.frameStack.push(build.Frame({
    context: globalContext,
    instructions: [
      ...globalSingletons.flatMap(({ id, superCall: { superclass, args } }) => {
        if ((args as any[]).some(arg => arg.is('NamedArgument'))) {
          const argList = args as List<NamedArgument>
          return [
            ...argList.flatMap(({ value }) => compile(environment)(value)),
            PUSH(id),
            INIT_NAMED(argList.map(({ name }) => name)),
            INIT(0, superclass.target<Class>().fullyQualifiedName()),
          ]
        } else {
          return [
            ...(args as List<Expression>).flatMap(arg => compile(environment)(arg)),
            PUSH(id),
            INIT_NAMED([]),
            INIT(args.length, superclass.target<Class>().fullyQualifiedName()),
          ]
        }
      }),
    ],
  }))

  evaluation.createInstance('wollok.lang.Object', undefined, NULL_ID)
  evaluation.createInstance('wollok.lang.Boolean', undefined, TRUE_ID)
  evaluation.createInstance('wollok.lang.Boolean', undefined, FALSE_ID)
  for (const module of globalSingletons) evaluation.createInstance(module.fullyQualifiedName(), undefined, module.id)

  return evaluation
}

function run(evaluation: Evaluation, natives: Natives, sentences: List<Sentence>) {
  const instructions = compile(evaluation.environment)(...sentences)
  const context = evaluation.createContext(evaluation.currentFrame().context)

  evaluation.suspend([], instructions, context)

  stepAll(natives)(evaluation)

  const currentFrame = evaluation.frameStack.pop()!
  return currentFrame.operandStack.length ? evaluation.instances[currentFrame.popOperand()] : null
}

// TODO: Refactor this interface
export default (environment: Environment, natives: {}) => ({

  buildEvaluation: () => buildEvaluation(environment),

  step: step(natives),

  stepAll: stepAll(natives),

  sendMessage: (message: string, receiver: Id, ...args: Id[]) => (evaluation: Evaluation) => {
    const takeStep = step(natives)
    const initialFrameCount = evaluation.frameStack.length

    evaluation.suspend('return', [
      PUSH(receiver),
      ...args.map(PUSH),
      CALL(message, args.length),
      INTERRUPT('return'),
    ], evaluation.createContext(receiver))

    // TODO: stepAll?
    do {
      takeStep(evaluation)
    } while (evaluation.frameStack.length > initialFrameCount)
  },

  runProgram: (fullyQualifiedName: Name, evaluation?: Evaluation): void => {
    const programSentences = environment.getNodeByFQN<Program>(fullyQualifiedName).body.sentences

    log.start('Initializing Evaluation')
    const initializedEvaluation = evaluation || buildEvaluation(environment)
    stepAll(natives)(initializedEvaluation)
    log.done('Initializing Evaluation')

    log.info('Running program', fullyQualifiedName)
    run(initializedEvaluation, natives, programSentences)
    log.success('Done!')
  },

  runTests: (): [number, number] => {
    // TODO: create extension function to divide array based on condition
    const describes = environment.descendants<Describe>('Describe')
    const freeTests = environment.descendants<Test>('Test').filter(node => !node.parent().is('Describe'))

    log.start('Initializing Evaluation')
    const initializedEvaluation = buildEvaluation(environment)
    stepAll(natives)(initializedEvaluation)
    log.done('Initializing Evaluation')

    let total = 0
    let passed = 0
    const runTests = ((tests: List<Test>, baseEvaluation: Evaluation) => {
      const testsCount = tests.length
      total += testsCount
      log.separator()
      tests.forEach((test, i) => {
        const n = i + 1
        const evaluation = baseEvaluation.copy()

        log.resetStep()
        log.info('Running test', n, '/', testsCount, ':', test.source && test.source.file, '>>', test.name)
        log.start(test.name)

        try {
          run(evaluation, natives, test.body.sentences)
          passed++
          log.success('Passed!', n, '/', testsCount, ':', test.source && test.source.file, '>>', test.name)
        } catch (error) {
          log.error('Failed!', n, '/', testsCount, ':', test.source && test.source.file, '>>', test.name)
          log.error(error)
        }

        log.done(test.name)
        log.separator()
      })
    })

    log.start('Running free tests')
    runTests(freeTests, initializedEvaluation)
    log.done('Running free tests')

    log.start('Running describes')
    describes.forEach((describe: Describe) => {
      const describeEvaluation = initializedEvaluation.copy()
      const describeId = describeEvaluation.createInstance(describe.fullyQualifiedName())

      log.info(`Running describe ${describe.fullyQualifiedName()}`)

      describeEvaluation.suspend([], compile(describeEvaluation.environment)(
        ...describe.variables(),
        ...describe.fixtures().flatMap(fixture => fixture.body.sentences),
      ), describeEvaluation.instance(describeId).id)

      try {
        stepAll(natives)(describeEvaluation)
        runTests(describe.tests(), describeEvaluation)
      } catch (error) {
        log.error(`Failed! Error during initialization of describe ${describe.fullyQualifiedName()}`)
        log.error(error)
      }

    })

    log.done('Running describes')

    return [passed, total]
  },

})