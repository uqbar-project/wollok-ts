import { assoc, chain as flatMap, compose, drop, last, lens, lensIndex, ManualLens, max, memoizeWith, over as change, pipe, prepend, PseudoLens, reverse, set, without, zipObj } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Body, Catch, Class, ClassMember, Environment, Field, Id, is, isModule, List, Name, Sentence } from './model'
import utils from './utils'

// TODO: Remove the parameter type from Id

export interface Locals { readonly [name: string]: Id<'Linked'> }

export interface RuntimeObject {
  readonly id: Id<'Linked'>
  readonly module: Name
  readonly fields: Locals
  readonly innerValue?: any
}


export interface Frame {
  readonly pending: List<Instruction>
  readonly locals: Locals
  readonly operandStack: List<Id<'Linked'>>
  readonly resume: List<Interruption>
}

export type Interruption = 'return' | 'exception' | 'result'

export interface Evaluation {
  readonly environment: Environment<'Linked'>
  readonly frameStack: List<Frame>
  readonly instances: { readonly [id: string]: RuntimeObject }
}

export type Native = (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => Promise<Evaluation>

export const NULL_ID = 'null'
export const VOID_ID = 'void'
export const TRUE_ID = 'true'
export const FALSE_ID = 'false'


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LENSES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const seq = <A, B, R>(l1: ManualLens<B, A>, l2: ManualLens<R, B> | PseudoLens<number>): ManualLens<R, A> => (compose as any)(l1, l2)

const $top = <A, T>(arrayLens: ManualLens<ReadonlyArray<T>, A>) => seq(arrayLens, lensIndex(0) as any as ManualLens<T, ReadonlyArray<T>>)

const $locals = lens(
  ({ locals }: Frame) => locals,
  (locals, frame) => ({ ...frame, locals })
)

const $pending = lens(
  ({ pending }: Frame) => pending,
  (pending, frame) => ({ ...frame, pending })
)

const $resume = lens(
  ({ resume }: Frame) => resume,
  (resume, frame) => ({ ...frame, resume })
)

const $operandStack = lens(
  ({ operandStack }: Frame) => operandStack,
  (operandStack, frame) => ({ ...frame, operandStack })
)


const $instances = lens(
  ({ instances }: Evaluation) => instances,
  (instances, evaluation) => ({ ...evaluation, instances }),
)

const $frameStack = lens(
  ({ frameStack }: Evaluation) => frameStack,
  (frameStack, evaluation) => ({ ...evaluation, frameStack }),
)


const $currentFrame = $top($frameStack)

const $currentPending = seq($currentFrame, $pending)

const $currentResume = seq($currentFrame, $resume)

const $currentOperandStack = seq($currentFrame, $operandStack)

const $nthFrame = (index: number) => seq($frameStack, lensIndex(index))


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
          { kind: 'INIT', lookupStart: 'wollok.lang.Number', arity: 0, initFields: false },
        ]
        if (typeof node.value === 'string') return [
          { kind: 'INSTANTIATE', module: 'wollok.lang.String', innerValue: node.value },
          { kind: 'INIT', lookupStart: 'wollok.lang.String', arity: 0, initFields: false },
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

export const step = (natives: {}) => async (previousEvaluation: Evaluation): Promise<Evaluation> => {

  const { environment, frameStack, instances } = previousEvaluation
  const [currentFrame] = frameStack

  const EvaluationError = (message: string) =>
    new Error(`${message}: ${JSON.stringify(previousEvaluation, (key, value) => key === 'environment' ? undefined : value)}`)

  if (!currentFrame) throw EvaluationError('Reached end of frame stack')

  const { operandStack: currentOperandStack, pending: currentPending } = currentFrame

  const [instruction] = currentPending
  const [currentTopOperand] = currentOperandStack

  if (!instruction) throw EvaluationError('Reached end of pending instructions')

  const evaluation = change($currentPending, drop(1))(previousEvaluation)
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

    case 'LOAD': return (() => {
      const value = frameStack.map(({ locals }) => locals[instruction.name]).find(id => !!id)
      if (!value) throw EvaluationError(`LOAD of missing local "${instruction.name}"`)
      return change($currentOperandStack, prepend(value))(evaluation)
    })()


    case 'STORE': return (() => {
      if (!currentTopOperand) throw EvaluationError('Popped empty operand stack')

      const frameIndex = instruction.lookup
        ? max(0, frameStack.findIndex(({ locals }) => instruction.name in locals))
        : 0

      return pipe(
        change($nthFrame(frameIndex), change($locals, assoc(instruction.name, currentTopOperand))),
        change($currentOperandStack, drop(1))
      )(evaluation)
    })()


    case 'PUSH':
      return change($currentOperandStack, prepend(instruction.id))(evaluation)


    case 'GET': return (() => { // TODO: don't use switch... I want variables.
      const [self, ...operandStack] = currentOperandStack
      const current = instances[self]
      if (!self) throw EvaluationError('Popped empty operand stack')
      if (!current) throw EvaluationError(`Access to undefined instance "${self}"`)
      return set($currentOperandStack, prepend(current.fields[instruction.name])(operandStack))(evaluation)
    })()


    case 'SET': return (() => {
      const [value, self, ...operandStack] = currentOperandStack
      const current = instances[self]
      if (!value || !self) throw EvaluationError('Popped empty operand stack')
      if (!current) throw EvaluationError(`Access to undefined instance "${self}"`)
      return pipe(
        change($instances, assoc(self, { ...current, fields: assoc(instruction.name, value, current.fields) })),
        set($currentOperandStack, operandStack),
      )(evaluation)
    })()

    case 'INSTANTIATE': return (() => {
      const instance: RuntimeObject = { id: uuid(), module: instruction.module, fields: {}, innerValue: instruction.innerValue }

      return pipe(
        change($instances, assoc(instance.id, instance)),
        change($currentOperandStack, prepend(instance.id)),
      )(evaluation)
    })()

    case 'INHERITS': return (() => {
      const current = instances[currentTopOperand]
      if (!currentTopOperand) throw EvaluationError('Popped empty operand stack')
      if (!current) throw EvaluationError(`Access to undefined instance "${currentTopOperand}"`)

      return pipe(
        change($currentOperandStack, drop(1)),
        change($currentOperandStack, prepend(
          inherits(resolve(current.module), resolve(instruction.module)) ? TRUE_ID : FALSE_ID
        )),
      )(evaluation)
    })()


    // TODO: can't we just use IF_ELSE instead?
    case 'CONDITIONAL_JUMP':
      if (!currentTopOperand) throw EvaluationError('Popped empty operand stack')
      if (currentTopOperand !== TRUE_ID && currentTopOperand !== FALSE_ID)
        throw EvaluationError(`Non boolean condition "${currentTopOperand}"`)
      if (instruction.count > currentPending.length || instruction.count < 0)
        throw EvaluationError(`Invalid jump count ${instruction.count}`)

      return pipe(
        change($currentOperandStack, drop(1)),
        change($currentPending, drop(currentTopOperand === FALSE_ID ? instruction.count : 0)),
      )(evaluation)


    // TODO: refactor this
    case 'CALL': return (() => {
      const [self, ...args] = reverse(currentOperandStack.slice(0, instruction.arity + 1))
      const current = instances[self]

      if (currentOperandStack.length < instruction.arity + 1) throw EvaluationError('Popped empty operand stack')
      if (!current) throw EvaluationError(`Access to undefined instance "${self}"`)

      const method = methodLookup(
        instruction.message,
        instruction.arity,
        resolve(instruction.lookupStart || current.module)
      )

      if (!method) {
        const messageNotUnderstood = methodLookup('messageNotUnderstood', 2, resolve(current.module))!
        const nameObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.String',
          fields: {},
          innerValue: messageNotUnderstood.name,
        }
        const argsObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.List',
          fields: {},
          innerValue: args,
        }

        return pipe(
          change($currentOperandStack, drop(instruction.arity + 1)),
          change($currentResume, prepend('return' as Interruption)),
          change($instances, assoc(nameObject.id, nameObject)),
          change($instances, assoc(argsObject.id, argsObject)),
          change($frameStack, prepend({
            pending: compile(environment)(messageNotUnderstood.body!),
            locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameObject.id, argsObject.id]), self },
            operandStack: [],
            resume: [],
          }))
        )(evaluation)
      }

      if (method.isNative) {
        const native = nativeLookup(natives, method)

        return native(current, ...args.map(arg => instances[arg]))(pipe(
          change($currentOperandStack, drop(instruction.arity + 1))
        )(evaluation))
      }

      if (method.parameters.some(({ isVarArg }) => isVarArg)) {
        const restObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.List',
          fields: {},
          innerValue: args.slice(method.parameters.length - 1),
        }

        return pipe(
          change($currentOperandStack, drop(instruction.arity + 1)),
          change($instances, assoc(restObject.id, restObject)),
          change($currentResume, prepend('return' as Interruption)),
          change($frameStack, prepend({
            pending: compile(environment)(method.body!),
            locals: {
              ...zipObj(method.parameters.slice(0, -1).map(({ name }) => name), args),
              [last(method.parameters)!.name]: restObject.id,
              self,
            },
            operandStack: [],
            resume: [],
          }))
        )(evaluation)
      }

      return pipe(
        change($currentOperandStack, drop(instruction.arity + 1)),
        change($currentResume, prepend('return' as Interruption)),
        change($frameStack, prepend({
          pending: compile(environment)(method.body!),
          locals: { ...zipObj(method.parameters.map(({ name }) => name), args), self },
          operandStack: [],
          resume: [],
        }))
      )(evaluation)
    })()


    case 'INIT': return (() => {
      if (currentOperandStack.length < instruction.arity + 1) throw EvaluationError('Popped empty operand stack')

      const [self, ...reverseArgs] = currentOperandStack.slice(0, instruction.arity + 1)
      const args = reverse(reverseArgs)
      const lookupStart: Class<'Linked'> = resolve(instruction.lookupStart)

      // TODO: Add to Filler method for doing this and just call it ?
      const allFields = hierarchy(resolve(instances[self].module)).reduce((fields, module) => [
        ...(module.members as ClassMember<'Linked'>[]).filter(is('Field')),
        ...fields,
      ], [] as Field<'Linked'>[])


      const constructor = constructorLookup(instruction.arity, lookupStart)
      const ownSuperclass = superclass(lookupStart)

      if (!constructor) throw EvaluationError(`Missing constructor/${instruction.arity} on ${lookupStart}`)

      // TODO: refactor this

      if (constructor.parameters.some(({ isVarArg }) => isVarArg)) {
        const restObject: RuntimeObject = {
          id: uuid(),
          module: 'wollok.lang.List',
          fields: {},
          innerValue: args.slice(constructor.parameters.length - 1),
        }

        // TODO: natives
        return pipe(
          change($currentOperandStack, drop(instruction.arity + 1)),
          change($currentResume, prepend('return' as Interruption)),
          change($instances, assoc(restObject.id, restObject)),
          change($frameStack, prepend<Frame>({
            pending: new Array<Instruction>(
              { kind: 'LOAD', name: 'self' },
              ...instruction.initFields ? [
                ...flatMap<Field<'Linked'>, Instruction>(({ value, name }) => [
                  { kind: 'LOAD', name: 'self' },
                  ...compile(environment)(value),
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
              ...zipObj(constructor.parameters.slice(0, -1).map(({ name }) => name), args),
              [last(constructor.parameters)!.name]: restObject.id,
              self,
            },
            operandStack: [],
            resume: [],
          }))


        )(evaluation)
      }

      // TODO: natives
      return pipe(
        change($currentOperandStack, drop(instruction.arity + 1)),
        change($currentResume, prepend('return' as Interruption)),
        change($frameStack, prepend<Frame>({
          pending: new Array<Instruction>(
            ...instruction.initFields ? [
              ...flatMap<Field<'Linked'>, Instruction>(({ value, name }) => [
                { kind: 'LOAD', name: 'self' },
                ...compile(environment)(value),
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
          locals: { ...zipObj(constructor.parameters.map(({ name }) => name), args), self },
          operandStack: [],
          resume: [],
        }))
      )(evaluation)
    })()


    case 'IF_THEN_ELSE': return (() => {
      if (!currentTopOperand) throw EvaluationError('Popped empty operand stack')
      if (currentTopOperand !== TRUE_ID && currentTopOperand !== FALSE_ID)
        throw EvaluationError(`Non boolean condition "${currentTopOperand}"`)

      return pipe(
        change($currentOperandStack, drop(1)),
        change($currentResume, prepend('result' as Interruption)),
        change($frameStack, prepend({
          pending: [
            { kind: 'PUSH', id: VOID_ID } as Instruction,
            ...currentTopOperand === TRUE_ID ? instruction.then : instruction.else,
            { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
          ],
          locals: {},
          operandStack: [],
          resume: [],
        }))
      )(evaluation)
    })()


    case 'TRY_CATCH_ALWAYS':
      return pipe(
        change($currentResume, prepend('result' as Interruption)),
        change($frameStack, prepend({
          pending: [
            { kind: 'STORE', name: '<previous_interruption>' },
            ...instruction.always,
            { kind: 'LOAD', name: '<previous_interruption>' },
            { kind: 'RESUME_INTERRUPTION' },
          ] as Instruction[],
          locals: {},
          operandStack: [],
          resume: ['result', 'return', 'exception'] as Interruption[],
        })),
        change($frameStack, prepend({
          pending: [
            { kind: 'STORE', name: '<exception>' } as Instruction,
            ...instruction.catch,
            { kind: 'LOAD', name: '<exception>' } as Instruction,
            { kind: 'INTERRUPT', interruption: 'exception' } as Instruction,
          ],
          locals: {},
          operandStack: [],
          resume: ['exception'] as Interruption[],
        })),
        change($frameStack, prepend({
          pending: [
            { kind: 'PUSH', id: VOID_ID } as Instruction,
            ...instruction.try,
            { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
          ],
          locals: {},
          operandStack: [],
          resume: [],
        })),
      )(evaluation)


    case 'INTERRUPT':
      if (!currentTopOperand) throw EvaluationError('Popped empty operand stack')

      const framesToDrop = frameStack.findIndex(({ resume }) => resume.includes(instruction.interruption))

      if (framesToDrop < 0) throw EvaluationError('Unhandled interruption')

      return pipe(
        change($frameStack, drop(framesToDrop)),
        change($currentResume, without([instruction.interruption])),
        change($currentOperandStack, prepend(currentTopOperand)),
      )(evaluation)


    case 'RESUME_INTERRUPTION':
      const allInterruptions: Interruption[] = ['exception', 'return', 'result']
      if (currentFrame.resume.length !== allInterruptions.length - 1) throw EvaluationError('Interruption to resume cannot be inferred')
      const lastInterruption = allInterruptions.find(interruption => !currentFrame.resume.includes(interruption))
      return step(natives)(
        change($currentPending, prepend({ kind: 'INTERRUPT', interruption: lastInterruption } as Instruction))(evaluation)
      )
  }
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
      locals,
      operandStack: [],
      resume: [],
    }],
  }
}

// TODO: This feels so much like a generator... Can we make it so?
export const run = async (natives: {}, evaluation: Evaluation): Promise<Evaluation> => {
  while (evaluation.frameStack[0].pending.length) {
    evaluation = await step(natives)(evaluation)
  }
  return evaluation
}

export default (environment: Environment<'Linked'>, natives: {}) => ({

  runTests: async () => {
    const { descendants } = utils(environment)

    const tests = descendants(environment).filter(is('Test'))
    const baseEvaluation = createEvaluation(environment)


    let count = 0
    let success = 0
    for (const test of tests) {
      count += 1
      console.time('Total')
      try {
        console.time('Compilation')
        const evaluation: Evaluation = {
          ...baseEvaluation,
          frameStack: [{ ...baseEvaluation.frameStack[0], pending: compile(environment)(test.body) }],
        }
        console.timeEnd('Compilation')
        console.time('Run')
        await run(natives, evaluation)
        console.timeEnd('Run')
        success += 1
        console.log(`${count}/${tests.length} PASSED: ${test.name}`)
      } catch (e) {
        console.timeEnd('Run')
        console.log(`${count}/${tests.length} FAILED: ${test.name}`)
      }
      console.timeEnd('Total')
    }
    console.log(`TOTAL PASSED: ${success}/${tests.length}`)

    // for (const test of tests) {
    //   await run(natives, createEvaluationFor(environment)(test.body))
    // }
  },

})