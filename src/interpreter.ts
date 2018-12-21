import { assoc, chain as flatMap, compose, drop, lens, lensIndex, ManualLens, max, over as change, pipe, prepend, PseudoLens, reverse, set, without, zipObj } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Body, Class, ClassMember, Constructor, Environment, Expression, Field, Id, If, is, List, Method, Module, Name, ObjectMember, Sentence, Try } from './model'
import utils from './utils'

// TODO: Remove the parameter type from Id
// TODO: Closure need to be a node, so return will exit the current frame


export interface Locals { readonly [name: string]: Id<'Linked'> }

export interface RuntimeObject {
  readonly id: Id<'Linked'>
  readonly module: Module<'Linked'> // TODO: Use id or FQN instead
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

const NULL_ID = 'null'
const VOID_ID = 'void'
const TRUE_ID = 'true'
const FALSE_ID = 'false'


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
// LOOKUP
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const methodLookup = (environment: Environment<'Linked'>) =>
  (name: Name, arity: number, start: Module<'Linked'>): Method<'Linked'> | undefined => {
    const { hierarchy } = utils(environment)
    for (const module of hierarchy(start)) {
      const found = (module.members as List<ObjectMember<'Linked'>>).find(member =>
        // TODO: Varargs
        member.kind === 'Method' && (!!member.body || member.isNative) && member.name === name && member.parameters.length === arity
      )
      if (found) return found as Method<'Linked'>
    }
    return undefined
  }

const constructorLookup = (arity: number, owner: Class<'Linked'>): Constructor<'Linked'> | undefined => {
  // TODO: Varargs
  const found = owner.members.find(member => member.kind === 'Constructor' && member.parameters.length === arity)
  return found ? found as Constructor<'Linked'> : undefined
}

const constructorCallChain = (environment: Environment<'Linked'>) =>
  (startingClass: Class<'Linked'>, startingArguments: List<Expression<'Linked'>>)
    : List<[Constructor<'Linked'>, List<Expression<'Linked'>>]> => {

    const { superclass } = utils(environment)

    const currentConstructor = constructorLookup(startingArguments.length, startingClass)
    const superClass = superclass(startingClass)

    return currentConstructor
      ? [
        [currentConstructor, startingArguments],
        ...constructorCallChain(environment)(
          currentConstructor.baseCall.callsSuper ? superClass! : startingClass,
          currentConstructor.baseCall.args
        ),
      ]
      : superClass ? constructorCallChain(environment)(superClass, []) : []
  }


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

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
  | IF_ELSE
  | TRY_CATCH_ALWAYS
  | INTERRUPT
  | RESUME_INTERRUPTION

export type LOAD = { kind: 'LOAD', name: Name }
export type STORE = { kind: 'STORE', name: Name, lookup: boolean }
export type PUSH = { kind: 'PUSH', id: Id<'Linked'> }
export type GET = { kind: 'GET', name: Name }
export type SET = { kind: 'SET', name: Name }
export type INSTANTIATE = { kind: 'INSTANTIATE', module: Name, innerValue?: any }
export type INHERITS = { kind: 'INHERITS', name: Name }
export type CONDITIONAL_JUMP = { kind: 'CONDITIONAL_JUMP', count: number }
export type CALL = { kind: 'CALL', message: Name, arity: number, lookupStart?: Name }
export type INIT = { kind: 'INIT', arity: number, lookupStart: Name }
export type IF_ELSE = { kind: 'IF_ELSE', node: If<'Linked'> }
export type TRY_CATCH_ALWAYS = { kind: 'TRY_CATCH_ALWAYS', node: Try<'Linked'> }
export type INTERRUPT = { kind: 'INTERRUPT', interruption: Interruption }
export type RESUME_INTERRUPTION = { kind: 'RESUME_INTERRUPTION' }

export const compile = (environment: Environment<'Linked'>) => (node: Sentence<'Linked'>): List<Instruction> => {
  // TODO: rename utils to "tools"
  const { resolveTarget, firstAncestorOfKind, parentOf, fullyQualifiedName } = utils(environment)
  switch (node.kind) {
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
      return is('Field')(resolveTarget(node))
        ? [
          { kind: 'LOAD', name: 'self' },
          { kind: 'GET', name: node.name },
        ]
        : [
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
        { kind: 'INIT', lookupStart: 'wollok.lang.Number', arity: 0 },
      ]
      if (typeof node.value === 'string') return [
        { kind: 'INSTANTIATE', module: 'wollok.lang.String', innerValue: node.value },
        { kind: 'INIT', lookupStart: 'wollok.lang.String', arity: 0 },
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
        { kind: 'INIT', lookupStart: fullyQualifiedName(resolveTarget(node.className)), arity: node.args.length },
      ]


    case 'If':
      return [
        ...compile(environment)(node.condition),
        { kind: 'IF_ELSE', node },
      ]


    case 'Throw':
      return [
        ...compile(environment)(node.arg),
        { kind: 'INTERRUPT', interruption: 'exception' },
      ]


    case 'Try':
      return [
        { kind: 'TRY_CATCH_ALWAYS', node },
      ]
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (previousEvaluation: Evaluation): Evaluation => {

  const { environment, frameStack, instances } = previousEvaluation
  const [currentFrame] = frameStack

  if (!currentFrame) throw new Error('Reached end of frame stack')

  const { operandStack: currentOperandStack, pending: currentPending } = currentFrame

  const [instruction] = currentPending
  const [currentTopOperand] = currentOperandStack

  if (!instruction) throw new Error('Reached end of pending instructions')

  const evaluation = change($currentPending, drop(1))(previousEvaluation)
  const { hierarchy, superclass, resolve, fullyQualifiedName, resolveTarget, inherits } = utils(environment)

  switch (instruction.kind) {

    case 'LOAD': return (() => {
      const value = frameStack.map(({ locals }) => locals[instruction.name]).find(id => !!id)
      return change($currentOperandStack, prepend(value || VOID_ID))(evaluation)
    })()


    case 'STORE': return (() => {
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
      return set($currentOperandStack, prepend(current.fields[instruction.name])(operandStack))(evaluation)
    })()


    case 'SET': return (() => {
      const [value, self, ...operandStack] = currentOperandStack
      const current = instances[self]
      return pipe(
        change($instances, assoc(self, { ...current, fields: assoc(instruction.name, value, current.fields) })),
        set($currentOperandStack, operandStack),
      )(evaluation)
    })()

    case 'INSTANTIATE': return (() => {
      const instantiatedClass = resolve<Class<'Linked'>>(instruction.module)
      const instance: RuntimeObject = { id: uuid(), module: instantiatedClass, fields: {}, innerValue: instruction.innerValue }
      // TODO: Add to Filler method for doing this and just call it.
      const allFields = hierarchy(instantiatedClass).reduce((fields, module) => [
        ...(module.members as ClassMember<'Linked'>[]).filter(is('Field')),
        ...fields,
      ], [] as Field<'Linked'>[])


      return pipe(
        change($instances, assoc(instance.id, instance)),
        change($currentOperandStack, prepend(instance.id)),
        change($frameStack, prepend({
          pending: [
            ...flatMap<Field<'Linked'>, Instruction>(({ value, name }) => [
              { kind: 'LOAD', name: 'self' },
              ...compile(environment)(value),
              { kind: 'SET', name },
            ], allFields),
          ],
          locals: { self: instance.id },
          operandStack: [],
          resume: [],
        }))
      )(evaluation)
    })()

    case 'INHERITS':
      return pipe(
        change($currentOperandStack, drop(1)),
        change($currentOperandStack, prepend(
          inherits(instances[currentTopOperand].module, resolve(instruction.name)) ? TRUE_ID : FALSE_ID
        )),
      )(evaluation)

    case 'CONDITIONAL_JUMP':
      return change($currentPending, drop(currentTopOperand === FALSE_ID ? instruction.count : 0))(evaluation)


    case 'CALL': return (() => {
      const [self, ...args] = reverse(currentOperandStack.slice(0, instruction.arity + 1))
      const method = methodLookup(environment)(
        instruction.message,
        instruction.arity,
        instruction.lookupStart ? resolve(instruction.lookupStart) : instances[self].module
      )

      // TODO: call messageNotUnderstood(message, parameters), defined in wre
      if (!method) return change($currentOperandStack, drop(instruction.arity + 1))(evaluation)

      // TODO: primitives
      // TODO: varargs
      return pipe(
        change($currentOperandStack, drop(instruction.arity + 1)),
        change($currentResume, resume => [...resume, 'return' as Interruption]),
        change($frameStack, prepend({
          pending: flatMap(compile(environment), method.body!.sentences),
          locals: { ...zipObj(method.parameters.map(({ name }) => name), args), self },
          operandStack: [],
          resume: [],
        }))
      )(evaluation)
      // TODO: Shouldn't we leave something here for the return to find? The current CALL was already removed.
    })()


    case 'INIT': return (() => {
      const [self, ...args] = currentOperandStack.slice(0, instruction.arity + 1)
      const lookupStart: Class<'Linked'> = resolve(instruction.lookupStart)
      const constructor = constructorLookup(instruction.arity, lookupStart)
      const ownSuperclass = superclass(lookupStart)

      // TODO: throw error? Shouldn't this be ensured by the validator?
      if (!constructor) return change($currentOperandStack, drop(instruction.arity + 1))(evaluation)

      // TODO: varargs
      return pipe(
        change($currentOperandStack, drop(instruction.arity + 1)),
        change($currentOperandStack, prepend(self)),
        change($currentResume, resume => [...resume, 'return' as Interruption]),
        change($frameStack, prepend({
          pending: [
            ...ownSuperclass || !constructor.baseCall.callsSuper ? [
              ...flatMap(compile(environment), constructor.baseCall.args),
              { kind: 'LOAD', name: 'self' },
              {
                kind: 'INIT',
                lookupStart: constructor.baseCall.callsSuper ? ownSuperclass : instruction.lookupStart,
                arity: constructor.baseCall.args.length,
              },
            ] : [],
            ...flatMap(compile(environment), constructor.body.sentences), // TODO: compile body?
          ] as Instruction[],
          locals: { ...zipObj(constructor.parameters.map(({ name }) => name), reverse(args)), self },
          operandStack: [],
          resume: [],
        }))
      )(evaluation)
    })()


    case 'IF_ELSE': return (() => {
      const compiledThen: Instruction[] = [
        { kind: 'PUSH', id: VOID_ID },
        ...flatMap(compile(environment), instruction.node.thenBody.sentences),
        { kind: 'INTERRUPT', interruption: 'result' },
      ]
      const compiledElse: Instruction[] = [
        { kind: 'PUSH', id: VOID_ID },
        ...flatMap(compile(environment), instruction.node.elseBody.sentences),
        { kind: 'INTERRUPT', interruption: 'result' },
      ]
      return pipe(
        change($currentOperandStack, drop(1)),
        change($currentResume, resume => [...resume, 'result' as Interruption]),
        change($frameStack, prepend({
          pending: [
            { kind: 'CONDITIONAL_JUMP', count: compiledThen.length } as Instruction,
            ...compiledThen,
            ...compiledElse,
          ],
          locals: {},
          operandStack: [currentTopOperand],
          resume: [],
        }))
      )(evaluation)
    })()


    case 'TRY_CATCH_ALWAYS':
      return pipe(
        change($frameStack, prepend({
          pending: [
            ({ kind: 'STORE', name: '<previous_interruption>' }),
            ...flatMap(compile(environment), instruction.node.always.sentences),
            ({ kind: 'LOAD', name: '<previous_interruption>' }),
            ({ kind: 'RESUME_INTERRUPTION' }),
          ] as Instruction[],
          locals: {},
          operandStack: [],
          resume: ['result', 'return', 'exception'] as Interruption[],
        })),
        change($frameStack, prepend({
          pending: [
            { kind: 'STORE', name: '<exception>' } as Instruction,
            ...flatMap(({ parameter, parameterType, body }) => {
              const compiledCatch: List<Instruction> = [
                { kind: 'PUSH', id: VOID_ID } as Instruction,
                { kind: 'LOAD', name: '<exception>' } as Instruction,
                { kind: 'STORE', name: parameter.name } as Instruction,
                ...flatMap(compile(environment), body.sentences),
                { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
              ]
              return [
                { kind: 'LOAD', name: '<exception>' } as Instruction,
                { kind: 'INHERITS', name: fullyQualifiedName(resolveTarget(parameterType)) } as Instruction,
                { kind: 'CONDITIONAL_JUMP', count: compiledCatch.length } as Instruction,
                ...compiledCatch,
              ]
            }, instruction.node.catches),
            { kind: 'LOAD', name: '<exception>' } as Instruction,
            { kind: 'INTERRUPT', interruption: 'exception' } as Instruction,
          ],
          locals: instruction.node.catches.reduce((locals, { parameter }) => ({ ...locals, [parameter.name]: VOID_ID }), {}),
          operandStack: [],
          resume: ['exception'] as Interruption[],
        })),
        change($frameStack, prepend({
          pending: [
            { kind: 'PUSH', id: VOID_ID } as Instruction,
            ...flatMap(compile(environment), instruction.node.body.sentences),
            { kind: 'INTERRUPT', interruption: 'result' } as Instruction,
          ],
          locals: {},
          operandStack: [],
          resume: [],
        })),
      )(evaluation)


    case 'INTERRUPT':
      const [interruptionValue] = currentOperandStack
      const framesToDrop = frameStack.findIndex(({ resume }) => resume.includes(instruction.interruption))

      if (framesToDrop < 0) throw new Error('Unhandled interruption')

      return pipe(
        change($frameStack, drop(framesToDrop)),
        change($currentResume, without([instruction.interruption])),
        change($currentOperandStack, prepend(interruptionValue)),
      )(evaluation)


    case 'RESUME_INTERRUPTION':
      const lastInterruption = new Array<Interruption>('exception', 'return', 'result').find(interruption =>
        currentFrame.resume.includes(interruption)
      )
      return step(
        change($currentPending, prepend({ kind: 'INTERRUPT', interruption: lastInterruption } as Instruction))(evaluation)
      )
  }
}
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const initialInstances = (environment: Environment<'Linked'>): List<RuntimeObject> => {
  const { descendants, resolve } = utils(environment)
  return [
    { id: NULL_ID, module: resolve('wollok.lang.Object'), fields: {} },
    { id: TRUE_ID, module: resolve('wollok.lang.Boolean'), fields: {} },
    { id: FALSE_ID, module: resolve('wollok.lang.Boolean'), fields: {} },
    ...descendants(environment)
      .filter(is('Singleton'))
      .map(module => ({ id: module.id, module, fields: {} })), // TODO: Initialize attributes
  ]
}


const createEvaluationFor = (environment: Environment<'Linked'>) => (body: Body<'Linked'>): Evaluation => {
  const instances = initialInstances(environment).reduce((all, instance) => assoc(instance.id, instance, all), {})
  return {
    environment,
    instances,
    frameStack: [{
      pending: flatMap(compile(environment), body.sentences),
      locals: instances,
      operandStack: [],
      resume: [],
    }],
  }
}

// TODO: This feels so much like a generator... Can we make it so?
export const run = (evaluation: Evaluation): Evaluation => {
  while (evaluation.frameStack[0].pending.length) evaluation = step(evaluation)
  return evaluation
}

export default (environment: Environment<'Linked'>) => ({

  runTests: () => {
    const { descendants } = utils(environment)

    const tests = descendants(environment).filter(is('Test'))

    return tests.map(test => run(createEvaluationFor(environment)(test.body)))
  },

})

