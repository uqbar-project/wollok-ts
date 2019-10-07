import * as build from './builders'
import { last, zipObj } from './extensions'
import log from './log'
import { Class, Describe, Entity, Environment, Expression, Field, Fixture, Id, List, Method, Module, Name, NamedArgument, Program, Sentence, Singleton, Test, Variable } from './model'

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

  popOperand(): Id
  pushOperand(id: Id): void
}

export type Interruption = 'return' | 'exception' | 'result'

export interface Evaluation {
  readonly environment: Environment
  frameStack: Frame[]
  instances: { [id: string]: RuntimeObject }

  currentFrame(): Frame
  instance(id: Id): RuntimeObject
  createInstance(module: Name, baseInnerValue?: any): Id
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


      case 'Assignment': return (() =>
        node.variable.target().is('Field')
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
        const target = node.target()

        if (target.is('Field')) return [
          LOAD('self'),
          GET(node.name),
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
            return [
              INSTANTIATE(node.value.fullyQualifiedName()),
              INIT(0, node.value.superCall.superclass.target<Class>().fullyQualifiedName(), true),
              ...(node.value.superCall.args as List<NamedArgument>).flatMap(({ name, value }: NamedArgument) => [
                DUP,
                ...compile(environment)(value),
                SET(name),
              ]),
            ]
          } else {
            return [
              ...(node.value.superCall.args as List<Expression>).flatMap(arg => compile(environment)(arg)),
              INSTANTIATE(node.value.fullyQualifiedName()),
              INIT(node.value.superCall.args.length, node.value.superCall.superclass.target<Class>().fullyQualifiedName(), true),
            ]
          }
        }

        return [
          ...(node.value.args as List<Expression>).flatMap(arg => compile(environment)(arg)),
          INSTANTIATE(node.value.instantiated.name, []),
          INIT(node.value.args.length, node.value.instantiated.name, false),
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
          CALL(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName()),
        ]
      })()


      case 'New': return (() => {
        const fqn = node.instantiated.target<Entity>().fullyQualifiedName()

        if ((node.args as any[]).some(arg => arg.is('NamedArgument'))) {
          return [
            INSTANTIATE(fqn),
            ...(node.args as List<NamedArgument>).flatMap(({ name, value }: NamedArgument) => [
              DUP,
              ...compile(environment)(value),
              SET(name),
            ]),
            INIT(0, fqn, true),
          ]
        } else {
          return [
            ...(node.args as List<Expression>).flatMap(arg => compile(environment)(arg)),
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

          node.catches.flatMap(({ parameter, parameterType, body }) => {
            const compiledCatch: List<Instruction> = [
              PUSH(VOID_ID),
              LOAD('<exception>'),
              STORE(parameter.name, false),
              ...compile(environment)(...body.sentences),
              INTERRUPT('result'),
            ]
            return [
              LOAD('<exception>'),
              INHERITS(parameterType.target<Module>().fullyQualifiedName()),
              CONDITIONAL_JUMP(compiledCatch.length),
              ...compiledCatch,
            ]
          }),

          compile(environment)(...node.always.sentences)
        ),
      ])()
    }
  })

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (natives: {}) => (evaluation: Evaluation) => {
  const { environment, frameStack } = evaluation

  const currentFrame = evaluation.currentFrame()
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.instructions[currentFrame.nextInstruction]
  if (!instruction) throw new Error(`Reached end of instructions`)

  currentFrame.nextInstruction++

  try {

    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const value = frameStack.map(({ locals }) => locals[instruction.name]).reverse().find(it => !!it)
        if (!value) throw new Error(`LOAD of missing local "${instruction.name}"`)
        currentFrame.pushOperand(value)
      })()


      case 'STORE': return (() => {
        const valueId = evaluation.currentFrame().popOperand()
        const frame = instruction.lookup && [...frameStack].reverse().find(({ locals }) => instruction.name in locals) || currentFrame
        frame.locals[instruction.name] = valueId
      })()


      case 'PUSH': return (() => {
        currentFrame.pushOperand(instruction.id)
      })()


      case 'GET': return (() => {
        const selfId = evaluation.currentFrame().popOperand()
        const self = evaluation.instance(selfId)
        const value = self.fields[instruction.name]
        if (!value) throw new Error(`Access to undefined field "${self.module}>>${instruction.name}"`)
        currentFrame.pushOperand(value)
      })()


      case 'SET': return (() => {
        const valueId = evaluation.currentFrame().popOperand()
        const selfId = evaluation.currentFrame().popOperand()
        const self = evaluation.instance(selfId)
        self.fields[instruction.name] = valueId
      })()

      case 'SWAP': return (() => {
        const a = evaluation.currentFrame().popOperand()
        const b = evaluation.currentFrame().popOperand()
        currentFrame.pushOperand(a)
        currentFrame.pushOperand(b)
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

      // TODO: can't we just use IF_ELSE instead?
      case 'CONDITIONAL_JUMP': return (() => {
        const check = evaluation.currentFrame().popOperand()

        if (check !== TRUE_ID && check !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
        if (currentFrame.nextInstruction + instruction.count >= currentFrame.instructions.length || instruction.count < 0)
          throw new Error(`Invalid jump count ${instruction.count}`)

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

          currentFrame.resume.push('return')
          frameStack.push(build.Frame({
            instructions: compile(environment)(...messageNotUnderstood.body!.sentences),
            locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]), self: selfId },
          }))
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
            let locals: Locals

            if (method.parameters.some(({ isVarArg }) => isVarArg)) {
              const restId = evaluation.createInstance('wollok.lang.List', argIds.slice(method.parameters.length - 1))
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

            frameStack.push(build.Frame({
              locals,
              instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                INTERRUPT('return'),
              ],
            }))
          }
        }
      })()


      case 'INIT': return (() => {
        const selfId = evaluation.currentFrame().popOperand()
        const argIds = Array.from({ length: instruction.arity }, () => evaluation.currentFrame().popOperand()).reverse()
        const self = evaluation.instance(selfId)
        const lookupStart: Class = environment.getNodeByFQN(instruction.lookupStart)

        // TODO: Add to Filler a method for doing this and just call it ?
        const allFields = environment.getNodeByFQN<Module>(self.module).hierarchy().reduce((fields, module) => [
          ...module.fields(),
          ...fields,
        ], [] as Field[])
        const unitializedFields = allFields.filter(field => !self.fields[field.name])

        const constructor = lookupStart.lookupConstructor(instruction.arity)
        const ownSuperclass = lookupStart.superclassNode()

        if (!constructor) throw new Error(`Missing constructor/${instruction.arity} on ${lookupStart.fullyQualifiedName()}`)

        let locals: Locals
        if (constructor.parameters.some(({ isVarArg }) => isVarArg)) {
          const restObject = evaluation.createInstance('wollok.lang.List', argIds.slice(constructor.parameters.length - 1))
          locals = {
            ...zipObj(constructor.parameters.slice(0, -1).map(({ name }) => name), argIds),
            [last(constructor.parameters)!.name]: restObject,
            self: selfId,
          }
        } else {
          locals = { ...zipObj(constructor.parameters.map(({ name }) => name), argIds), self: selfId }
        }

        currentFrame.resume.push('return')
        frameStack.push(build.Frame({
          locals,
          instructions: new Array<Instruction>(
            ...instruction.initFields ? [
              ...unitializedFields.flatMap(({ value: v, name }: Field) => [
                LOAD('self'),
                ...compile(environment)(v),
                SET(name),
              ]),
            ] : [],
            ...ownSuperclass || !constructor.baseCall.callsSuper ? new Array<Instruction>(
              ...constructor.baseCall.args.flatMap(arg => compile(environment)(arg)),
              LOAD('self'),
              INIT(
                constructor.baseCall.args.length,
                constructor.baseCall.callsSuper ? ownSuperclass!.fullyQualifiedName() : instruction.lookupStart,
                false
              ),
            ) : [],
            ...compile(environment)(...constructor.body.sentences),
            LOAD('self'),
            INTERRUPT('return')
          ),
        }))
      })()


      case 'IF_THEN_ELSE': return (() => {
        const check = evaluation.currentFrame().popOperand()

        if (check !== TRUE_ID && check !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)

        currentFrame.resume.push('result')
        frameStack.push(build.Frame({
          instructions: [
            PUSH(VOID_ID),
            ...check === TRUE_ID ? instruction.thenHandler : instruction.elseHandler,
            INTERRUPT('result'),
          ],
        }))
      })()


      case 'TRY_CATCH_ALWAYS': return (() => {
        currentFrame.resume.push('result')

        frameStack.push(build.Frame({
          instructions: [
            STORE('<previous_interruption>', false),
            ...instruction.alwaysHandler,
            LOAD('<previous_interruption>'),
            RESUME_INTERRUPTION,
          ] as Instruction[],
          resume: ['result', 'return', 'exception'] as Interruption[],
        }))

        frameStack.push(build.Frame({
          instructions: [
            STORE('<exception>', false),
            ...instruction.catchHandler,
            LOAD('<exception>'),
            INTERRUPT('exception'),
          ],
          resume: ['exception'] as Interruption[],
        }))

        frameStack.push(build.Frame({
          instructions: [
            PUSH(VOID_ID),
            ...instruction.body,
            INTERRUPT('result'),
          ],
        }))
      })()


      case 'INTERRUPT': return (() => {
        const valueId = evaluation.currentFrame().popOperand()
        evaluation.interrupt(instruction.interruption, valueId)
      })()


      case 'RESUME_INTERRUPTION': return (() => {
        const allInterruptions: Interruption[] = ['exception', 'return', 'result']
        if (currentFrame.resume.length !== allInterruptions.length - 1) throw new Error('Interruption to resume cannot be inferred')
        const lastInterruption = allInterruptions.find(interruption => !currentFrame.resume.includes(interruption))!

        const valueId = evaluation.currentFrame().popOperand()
        evaluation.interrupt(lastInterruption, valueId)
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
  while (last(evaluation.frameStack)!.nextInstruction < last(evaluation.frameStack)!.instructions.length) {
    log.step(evaluation)
    takeStep(evaluation)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const buildEvaluation = (environment: Environment): Evaluation => {

  const globalSingletons = environment.descendants<Singleton>('Singleton').filter(node => !!node.name)

  const instances = [
    { id: NULL_ID, module: 'wollok.lang.Object', fields: {}, innerValue: null },
    { id: TRUE_ID, module: 'wollok.lang.Boolean', fields: {}, innerValue: true },
    { id: FALSE_ID, module: 'wollok.lang.Boolean', fields: {}, innerValue: false },
    ...globalSingletons.map(module => ({ id: module.id, module: module.fullyQualifiedName(), fields: {} })),
  ].reduce((all, instance) => ({ ...all, [instance.id]: instance }), {})

  const locals = {
    null: NULL_ID,
    true: TRUE_ID,
    false: FALSE_ID,
    ...globalSingletons.reduce((all, singleton) => ({ ...all, [singleton.fullyQualifiedName()]: singleton.id }), {}),
  }

  return build.Evaluation(environment, instances)(
    build.Frame({
      locals,
      instructions: [
        ...globalSingletons.flatMap(({ id, superCall: { superclass, args } }: Singleton) => {
          if ((args as any[]).some(arg => arg.is('NamedArgument'))) {
            return [
              PUSH(id),
              INIT(0, superclass.target<Class>().fullyQualifiedName(), true),
              ...(args as List<NamedArgument>).flatMap(({ name, value }: NamedArgument) => [
                DUP,
                ...compile(environment)(value),
                SET(name),
              ]),
              PUSH(id),
            ]
          } else {
            return [
              ...(args as List<Expression>).flatMap(arg => compile(environment)(arg)),
              PUSH(id),
              INIT(args.length, superclass.target<Class>().fullyQualifiedName(), true),
            ]
          }
        }),
      ],
    })
  )
}

function run(evaluation: Evaluation, natives: Natives, sentences: List<Sentence>) {

  const instructions = compile(evaluation.environment)(...sentences)

  evaluation.frameStack.push(build.Frame({
    instructions,
  }))

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
    last(evaluation.frameStack)!.resume.push('return')
    evaluation.frameStack.push(build.Frame({
      instructions: [
        CALL(message, args.length),
        INTERRUPT('return'),
      ],
      operandStack: [receiver, ...args],
    }))
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
    const runTests = ((testsToRun: List<Test>, baseEvaluation: Evaluation, sentences: (t: Test) => List<Sentence>) => {
      const testsCount = testsToRun.length
      total += testsCount
      log.separator()
      testsToRun.forEach((test, i) => {
        const n = i + 1
        log.resetStep()
        const evaluation = baseEvaluation.copy()
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
    runTests(freeTests, initializedEvaluation, (test) => test.body.sentences)
    log.done('Running free tests')

    log.start('Running describes')
    describes.forEach((describe: Describe) => {
      const variables = describe.children().filter((child): child is Variable => child.is('Variable'))
      const fixtures = describe.children().filter((child): child is Fixture => child.is('Fixture'))
      const fixtureSentences = fixtures.flatMap(fixture => fixture.body.sentences)
      const describeEvaluation = initializedEvaluation.copy()
      describeEvaluation.frameStack.push(build.Frame({
        locals: {
          self: describeEvaluation.createInstance(describe.fullyQualifiedName()),
        },
      }))
      runTests(describe.tests(), describeEvaluation, ({ body: { sentences } }) => [...variables, ...fixtureSentences, ...sentences])
    })
    log.done('Running describes')

    return [passed, total]
  },

})