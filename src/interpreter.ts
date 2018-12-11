import { assoc, compose, drop, lens, lensIndex, lensProp, ManualLens, over as change, path, pipe, prepend, reverse, set, view as get } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Assignment, Catch, Class, Constructor, Environment, Expression, Field, Id, List, Method, Module, Name, ObjectMember, Self, Sentence, Singleton, Test, Throw, Try } from './model'
import utils from './utils'


export interface Locals { readonly [name: string]: Id<'Linked'> }

export interface RuntimeObject {
  readonly id: Id<'Linked'>
  readonly module: Module<'Linked'>
  readonly attributes: Locals
  readonly innerValue?: any
}

export interface Frame {
  readonly locals: Locals
  // TODO: Don't save the whole sentence, just the id?
  readonly pending: List<[Sentence<'Linked'>, number]>
  readonly referenceStack: List<Id<'Linked'>>
}

export interface Evaluation {
  readonly status: 'error' | 'running' | 'success'
  readonly environment: Environment<'Linked'>
  readonly frameStack: List<Frame>
  readonly instances: { readonly [id: string]: RuntimeObject }
}

const NULL_ID = 'null'
const TRUE_ID = 'true'
const FALSE_ID = 'false'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LOOKUP
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const methodLookup = (environment: Environment<'Linked'>) =>
  (name: Name, argumentCount: number, start: Module<'Linked'>): Method<'Linked'> | undefined => {
    const { hierarchy } = utils(environment)
    for (const module of hierarchy(start)) {
      const found = (module.members as List<ObjectMember<'Linked'>>).find(member =>
        // TODO: Varargs
        member.kind === 'Method' && (!!member.body || member.isNative) && member.name === name && member.parameters.length === argumentCount
      )
      if (found) return found as Method<'Linked'>
    }
    return undefined
  }

const constructorLookup = (argumentCount: number, owner: Class<'Linked'>): Constructor<'Linked'> | undefined => {
  // TODO: Varargs
  const found = owner.members.find(member => member.kind === 'Constructor' && member.parameters.length === argumentCount)
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
// LENSES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function seq<A, R>(l1: ManualLens<R, A>): ManualLens<R, A>
function seq<A, B, R>(l1: ManualLens<B, A>, l2: ManualLens<R, B>): ManualLens<R, A>
function seq<A, B, C, R>(l1: ManualLens<B, A>, l2: ManualLens<C, B>, l3: ManualLens<R, C>): ManualLens<R, A>
function seq(...lenses: ManualLens<any, any>[]) { return (compose as any)(...lenses) }


const $top = <A, T>(arrayLens: ManualLens<ReadonlyArray<T>, A>) => seq(arrayLens, lensIndex(0) as any as ManualLens<T, ReadonlyArray<T>>)

const $locals = lens(
  ({ locals }: Frame) => locals,
  (locals, frame) => ({ ...frame, locals })
)

const $pending = lens(
  ({ pending }: Frame) => pending,
  (pending, frame) => ({ ...frame, pending })
)

const $referenceStack = lens(
  ({ referenceStack }: Frame) => referenceStack,
  (referenceStack, frame) => ({ ...frame, referenceStack })
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

const $currentLocals = seq($currentFrame, $locals)

const $currentLocal = <T>(key: string) => seq($currentLocals, lensProp(key) as any as ManualLens<T, Locals>)

const $currentPending = seq($currentFrame, $pending)

const $currentReferenceStack = seq($currentFrame, $referenceStack)

const $currentTopReference = $top($currentReferenceStack)


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type Instruction = (evaluation: Evaluation) => Evaluation

export const STORE = (name: Name): Instruction => evaluation => pipe(
  set($currentLocal(name), get($currentTopReference, evaluation)),
  change($currentReferenceStack, drop(1))
)(evaluation)

export const LOAD = (name: Name): Instruction => evaluation =>
  change($currentReferenceStack, prepend(get($currentLocals, evaluation)[name] || NULL_ID))(evaluation)

export const SET = (name: Name): Instruction => evaluation => {
  const [self, value, ...references] = get($currentReferenceStack, evaluation)
  const current = get($instances, evaluation)[self]
  return pipe(
    change($instances, assoc(self, { ...current, attributes: assoc(name, value, current.attributes) })),
    set($currentReferenceStack, references),
  )(evaluation)
}

export const POP_PENDING: Instruction = change($currentPending, pending => pending.slice(1))

export const PUSH_PENDING = (next: Sentence<'Linked'>): Instruction =>
  change($currentPending, pending => [[next, 0] as [Sentence<'Linked'>, number], ...pending])

export const INC_PC: Instruction =
  change($currentPending, ([[sentence, pc], ...others]) => [[sentence, pc + 1] as [Sentence<'Linked'>, number], ...others])

export const PUSH_REFERENCE = (next: Id<'Linked'>): Instruction => change($currentReferenceStack, prepend(next))

export const POP_REFERENCE: Instruction = change($currentReferenceStack, drop(1))

export const PUSH_FRAME = (pending: List<Sentence<'Linked'>>): Instruction => evaluation => change($frameStack, prepend({
  locals: get($currentLocals, evaluation),
  pending: pending.map(sentence => [sentence, 0] as [Sentence<'Linked'>, number]),
  referenceStack: [],
}))(evaluation)

export const POP_FRAME: Instruction = evaluation => pipe(
  change($frameStack, drop(1)),
  change($currentReferenceStack, prepend(get($currentTopReference, evaluation)))
)(evaluation)

export const INSTANTIATE = (module: Class<'Linked'>, innerValue: any = undefined, id: Id<'Linked'> = uuid()): Instruction => {
  const instance: RuntimeObject = { id, module, attributes: {}, innerValue }
  return pipe(
    change($currentReferenceStack, prepend(instance.id)),
    change($instances, assoc(instance.id, instance)),
  )
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const initialInstances = (environment: Environment<'Linked'>): List<RuntimeObject> => {
  const { descendants, resolve } = utils(environment)

  return [
    { id: NULL_ID, module: resolve<Class<'Linked'>>('wollok.lang.Object'), attributes: {} },
    { id: TRUE_ID, module: resolve<Class<'Linked'>>('wollok.lang.Boolean'), attributes: {} },
    { id: FALSE_ID, module: resolve<Class<'Linked'>>('wollok.lang.Boolean'), attributes: {} },
    ...descendants(environment)
      .filter<Singleton<'Linked'>>((node): node is Singleton<'Linked'> => node.kind === 'Singleton')
      .map(module => ({ id: module.id, module, attributes: {} })), // TODO: Initialize attributes
  ]
}


const createEvaluationFor = (environment: Environment<'Linked'>) => (node: Test<'Linked'>): Evaluation => {
  const instances = initialInstances(environment).reduce((all, instance) => assoc(instance.id, instance, all), {})
  return {
    environment,
    instances,
    status: 'running',
    frameStack: [{
      locals: instances,
      pending: node.body.sentences.map(sentence => [sentence, 0] as [Sentence<'Linked'>, number]),
      referenceStack: [],
    }],
  }
}

export default (environment: Environment<'Linked'>) => ({
  runTests: () => {
    const { descendants } = utils(environment)

    const tests = descendants(environment).filter<Test<'Linked'>>((node): node is Test<'Linked'> => node.kind === 'Test')

    return tests.map(test => {
      let evaluation = createEvaluationFor(environment)(test)
      const steps: Evaluation[] = []
      while (evaluation.frameStack.length && steps.length <= 1000) {
        steps.push(evaluation)
        evaluation = step(evaluation)
      }
    })
  },
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════


export const step = (evaluation: Evaluation): Evaluation => {

  const {
    status,
    frameStack: [currentFrame],
    instances,
    environment,
  } = evaluation

  const {
    pending,
    referenceStack,
    locals: locals,
  } = currentFrame

  const {
    firstAncestorOfKind,
    parentOf,
    hierarchy,
    inherits,
    resolve,
    getNodeById,
  } = utils(environment)

  if (status !== 'running') return evaluation
  if (!pending.length) return POP_FRAME(evaluation)

  const [[currentSentence, pc]] = pending

  switch (currentSentence.kind) {
    case 'Variable':
      switch (pc) {
        case 0: return pipe(
          INC_PC,
          PUSH_PENDING(currentSentence.value),
        )(evaluation)

        case 1: return pipe(
          POP_PENDING,
          PUSH_REFERENCE(referenceStack[0]),
          STORE(currentSentence.name),
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Return':
      if (!currentSentence.value) {
        return pipe(
          PUSH_REFERENCE(NULL_ID),
          POP_FRAME,
        )(evaluation)
      }

      switch (pc) {
        case 0: return pipe(
          INC_PC,
          PUSH_PENDING(currentSentence.value),
        )(evaluation)

        case 1: return pipe(
          POP_FRAME,
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    // TODO:
    case 'Assignment':
      switch (pc) {
        case 0: return pipe(
          INC_PC,
          PUSH_PENDING(currentSentence.value),
        )(evaluation)

        case 1:
          return getNodeById(currentSentence.reference.target).kind === 'Field'
            ? pipe(
              POP_PENDING,
              LOAD('self'),
              SET(currentSentence.reference.name),
            )(evaluation)
            : pipe(
              POP_PENDING,
              STORE(currentSentence.reference.name)
            )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Self': return pipe(
      POP_PENDING,
      LOAD('self'),
    )(evaluation)

    case 'Reference': return pipe(
      POP_PENDING,
      getNodeById(currentSentence.target).kind === 'Field'
        ? PUSH_REFERENCE(instances[instances[locals.self].attributes[currentSentence.name]].id)
        : LOAD(currentSentence.name)
    )(evaluation)

    case 'Literal':
      if (currentSentence.value === null) return pipe(
        POP_PENDING,
        PUSH_REFERENCE(NULL_ID),
      )(evaluation)

      if (typeof currentSentence.value === 'boolean') return pipe(
        POP_PENDING,
        PUSH_REFERENCE(currentSentence.value ? TRUE_ID : FALSE_ID)
      )(evaluation)

      // TODO: Add to instances
      if (typeof currentSentence.value === 'number') return pipe(
        POP_PENDING,
        // TODO: Make this 'wollok.Number'
        INSTANTIATE(resolve('wollok.lang.Number'), currentSentence.value),
      )(evaluation)

      // TODO: Add to instances
      if (typeof currentSentence.value === 'string') return pipe(
        POP_PENDING,
        // TODO: Make this 'wollok.String'
        INSTANTIATE(resolve('wollok.lang.String'), currentSentence.value),
      )(evaluation)

      if (currentSentence.value.kind === 'New') return pipe(
        POP_PENDING,
        PUSH_PENDING(currentSentence.value),
      )(evaluation)

      return pipe(
        POP_PENDING,
        PUSH_REFERENCE(instances[currentSentence.value.id].id),
      )(evaluation)

    case 'Send':
      if (pc === 0) return pipe(
        INC_PC,
        PUSH_PENDING(currentSentence.receiver),
      )(evaluation)

      if (pc <= currentSentence.args.length) return pipe(
        INC_PC,
        PUSH_PENDING(currentSentence.args[pc - 1]),
      )(evaluation)

      const receiver = instances[currentFrame.referenceStack[currentSentence.args.length]]
      // TODO: Maybe a single bytecode for this? invoke? May avoid repetition with super.
      // TODO: What about SELF AND SCOPE?
      const method = methodLookup(environment)(currentSentence.message, currentSentence.args.length, receiver.module)
      return (method
        ? [
          PUSH_FRAME(method.body!.sentences),
          // TODO: Handle varargs
          ...reverse(method.parameters).map(parameter => STORE(parameter.name)),
          STORE('self'),
        ]
        : [
          // TODO: We should not create unlinked nodes
          // TODO: We might replace this with a call to messageNotUnderstood, defined in wre
          PUSH_PENDING({
            kind: 'Throw',
            arg: {
              kind: 'New',
              className: {
                kind: 'Reference',
                name: 'MessageNotUnderstoodException',
                target: resolve('wollok.lang.MessageNotUnderstoodException').id,
              },
              args: [],
            },
          } as unknown as Throw<'Linked'>),
        ]).reduce(pipe)(evaluation)

    case 'Super':
      if (pc < currentSentence.args.length) return pipe(
        INC_PC,
        PUSH_PENDING(currentSentence.args[pc]),
      )(evaluation)

      const currentMethod = firstAncestorOfKind('Method', currentSentence)
      const superMethod = methodLookup(environment)(
        currentMethod.name,
        currentSentence.args.length,
        parentOf<Module<'Linked'>>(currentMethod)
      )

      return (superMethod
        ? [
          PUSH_FRAME(superMethod.body!.sentences),
          // TODO: Handle varargs
          ...reverse(superMethod.parameters).map(parameter => STORE(parameter.name)),
        ]
        : [
          // TODO: We should not create unlinked nodes
          // TODO: We might replace this with a call to messageNotUnderstood, defined in wre
          PUSH_PENDING({
            kind: 'Throw',
            arg: {
              kind: 'New',
              className: {
                kind: 'Reference',
                name: 'MessageNotUnderstoodException',
                target: resolve('wollok.lang.MessageNotUnderstoodException').id,
              },
              args: [],
            },
          } as unknown as Throw<'Linked'>),
        ]).reduce(pipe)(evaluation)

    case 'New':
      if (pc < currentSentence.args.length) return pipe(
        INC_PC,
        PUSH_PENDING(currentSentence.args[pc]),
      )(evaluation)

      const instantiatedClass = getNodeById<Class<'Linked'>>(currentSentence.className.target)
      const instantiatedClassHierarchy = hierarchy(instantiatedClass)
      const initializableFields = instantiatedClassHierarchy.reduce((fields, module) => [
        ...(module.members as ObjectMember<'Linked'>[]).filter(member => member.kind === 'Field' && !!member.value) as Field<'Linked'>[],
        ...fields,
      ], [] as Field<'Linked'>[])

      if (pc === currentSentence.args.length) return pipe(
        INC_PC,
        PUSH_FRAME([
          // TODO: We shouldn't create unlinked nodes like this...
          ...initializableFields.map(field => ({
            kind: 'Assignment',
            reference: {
              kind: 'Reference',
              name: field.name,
              target: field.id,
            },
            value: field.value!,
          }) as Assignment<'Linked'>),
          { kind: 'Self' } as Self<'Linked'>,
        ]),
        INSTANTIATE(instantiatedClass),
        STORE('self'),
      )(evaluation)

      const chain = constructorCallChain(environment)(instantiatedClass, currentSentence.args)

      if (!chain.length) return pipe(
        POP_PENDING,
      )(evaluation)

      // TODO: Call base constructor
      const [constructor] = chain[0]

      return pipe(
        POP_PENDING,
        PUSH_FRAME(constructor.body.sentences),
      )(evaluation)

    case 'If':
      switch (pc) {
        case 0: return pipe(
          INC_PC,
          PUSH_PENDING(currentSentence.condition),
        )(evaluation)

        case 1: return pipe(
          POP_PENDING,
          POP_REFERENCE,
          PUSH_FRAME(referenceStack[0] === TRUE_ID ? currentSentence.thenBody.sentences : currentSentence.elseBody.sentences)
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Throw':
      switch (pc) {
        case 0: return pipe(
          INC_PC,
          PUSH_PENDING(currentSentence.arg),
        )(evaluation)

        case 1:
          const error = instances[referenceStack[0]]
          const tryIndex = evaluation.frameStack.findIndex(stack => {
            const sentence = path<Sentence<'Linked'>>(['pending', '0', '0'], stack)
            return !!sentence && sentence.kind === 'Try' && sentence.catches.some(({ parameterType }) =>
              !parameterType || inherits(error.module, getNodeById(parameterType.target))
            )
          })

          if (tryIndex < 0) return { ...evaluation, status: 'error' }

          const tryNode: Try<'Linked'> = evaluation.frameStack[tryIndex].pending[0][0] as Try<'Linked'>
          const catchNode: Catch<'Linked'> = tryNode.catches.find(({ parameterType }) =>
            !parameterType || inherits(error.module, getNodeById(parameterType.target))
          )!

          // TODO: Evaluate intermediate always clauses
          return [
            ...new Array(tryIndex).map(_ => POP_FRAME),
            PUSH_FRAME(catchNode.body.sentences),
            PUSH_REFERENCE(error.id),
            STORE(catchNode.parameter.name),
          ].reduce(pipe)(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Try':
      switch (pc) {
        case 0: return pipe(
          INC_PC,
          PUSH_FRAME(currentSentence.body.sentences),
        )(evaluation)

        case 1: return pipe(
          POP_PENDING,
          PUSH_FRAME(currentSentence.always.sentences),
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }
  }

}