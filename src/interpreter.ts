import { lensPath as lens, over, path, pipe, reverse, view } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Catch, Class, Constructor, Environment, getNodeById, hierarchy, Id, inherits, Method, Module, Name, ObjectMember, Sentence, Singleton, target, Try } from './model'

interface RuntimeObject {
  readonly id: Id
  readonly module: Singleton | Class
  readonly attributes: { readonly [name: string]: Id }
}

interface RuntimeScope { readonly [name: string]: RuntimeObject }

interface Frame {
  readonly scope: RuntimeScope
  readonly pending: ReadonlyArray<[Sentence, number]>
  readonly referenceStack: ReadonlyArray<RuntimeObject>
}

export interface Evaluation {
  readonly status: 'error' | 'running' | 'success'
  readonly environment: Environment
  readonly frameStack: ReadonlyArray<Frame>
  readonly instances: Map<Id, RuntimeObject>
}

const NULL_ID = 'null'
const TRUE_ID = 'true'
const FALSE_ID = 'false'

const INSTANCES = lens<Map<Id, RuntimeObject>, Evaluation>(['instances'])
const FRAME_STACK = lens<ReadonlyArray<Frame>, Evaluation>(['frameStack'])
const CURRENT_SCOPE = lens<RuntimeScope, Evaluation>(['frameStack', '0', 'scope'])
const CURRENT_PENDING = lens<ReadonlyArray<[Sentence, number]>, Evaluation>(['frameStack', '0', 'pending'])
const CURRENT_REFERENCE_STACK = lens<ReadonlyArray<RuntimeObject>, Evaluation>(['frameStack', '0', 'referenceStack'])

const methodLookup = (environment: Environment, name: Name, argumentCount: number, start: Module): Method | null => {
  for (const module of hierarchy(environment)(start)) {
    const found = (module.members as ReadonlyArray<ObjectMember>).find(member =>
      // TODO: Varargs
      member.kind === 'Method' && (!!member.body || member.isNative) && member.name === name && member.parameters.length === argumentCount
    )
    if (found) return found as Method
  }
  return null
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TRANSFORMATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type Transformation = (evaluation: Evaluation) => Evaluation

const store = (name: Name): Transformation => evaluation => pipe(
  over(CURRENT_SCOPE, scope => ({ ...scope, [name]: view(CURRENT_REFERENCE_STACK, evaluation)[0] })),
  over(CURRENT_REFERENCE_STACK, references => references.slice(1))
)(evaluation)

const load = (name: Name): Transformation => evaluation =>
  over(CURRENT_REFERENCE_STACK, references => [
    view(CURRENT_SCOPE, evaluation)[name] || evaluation.instances.get(NULL_ID),
    ...references,
  ])(evaluation)


const set = (name: Name): Transformation => evaluation => {
  const [self, value, ...references] = view(CURRENT_REFERENCE_STACK, evaluation)
  return pipe(
    over(INSTANCES, instances => new Map([
      ...instances,
      [self.id, { ...self, attributes: { ...self.attributes, [name]: value.id } }],
    ])),
    over(CURRENT_REFERENCE_STACK, () => references),
  )(evaluation)
}

const popPending: Transformation = over(CURRENT_PENDING, pending => pending.slice(1))

const pushPending = (next: Sentence): Transformation => over(CURRENT_PENDING, pending => [[next, 0] as [Sentence, number], ...pending])

const incPC: Transformation =
  over(CURRENT_PENDING, ([[sentence, pc], ...others]) => [[sentence, pc + 1] as [Sentence, number], ...others])

const pushReference = (next: RuntimeObject): Transformation => over(CURRENT_REFERENCE_STACK, references => [next, ...references])

const popReference: Transformation = over(CURRENT_REFERENCE_STACK, references => references.slice(1))

const pushFrame = (pending: ReadonlyArray<Sentence>): Transformation => evaluation => over(FRAME_STACK, stacks => [
  {
    scope: view(CURRENT_SCOPE, evaluation),
    pending: pending.map(sentence => [sentence, 0] as [Sentence, number]),
    referenceStack: [],
  },
  ...stacks,
])(evaluation)

const popFrame: Transformation = evaluation => pipe(
  over(FRAME_STACK, stacks => stacks.slice(1)),
  over(CURRENT_REFERENCE_STACK, references => [view(CURRENT_REFERENCE_STACK, evaluation)[0], ...references])
)(evaluation)

const instantiate = (module: Class): Transformation => evaluation => {
  const instance: RuntimeObject = { id: uuid(), module, attributes: {} }
  return pipe(
    over(CURRENT_REFERENCE_STACK, references => [instance, ...references]),
    over(INSTANCES, instances => new Map([...instances, [instance.id, instance]])),
  )(evaluation)
}

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
    scope,
  } = currentFrame

  const NULL: RuntimeObject = instances.get(NULL_ID) as RuntimeObject
  const TRUE: RuntimeObject = instances.get(TRUE_ID) as RuntimeObject
  const FALSE: RuntimeObject = instances.get(FALSE_ID) as RuntimeObject

  if (status !== 'running') return evaluation
  if (!pending.length) return popFrame(evaluation)

  const [[currentSentence, pc]] = pending

  switch (currentSentence.kind) {
    case 'Variable':
      if (!currentSentence.value)
        return pipe(
          popPending,
          pushReference(NULL),
          store(currentSentence.name),
        )(evaluation)

      switch (pc) {
        case 0: return pipe(
          incPC,
          pushPending(currentSentence.value),
        )(evaluation)

        case 1: return pipe(
          popPending,
          pushReference(referenceStack[0]),
          store(currentSentence.name),
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Return':
      switch (pc) {
        case 0: return pipe(
          incPC,
          pushPending(currentSentence.value),
        )(evaluation)

        case 1: return pipe(
          popFrame,
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    // TODO:
    case 'Assignment':
      switch (pc) {
        case 0: return pipe(
          incPC,
          pushPending(currentSentence.value),
        )(evaluation)

        case 1:
          return target(environment)(currentSentence.reference).kind === 'Field'
            ? pipe(
              popPending,
              load('self'),
              set(currentSentence.reference.name),
            )(evaluation)
            : pipe(
              popPending,
              store(currentSentence.reference.name)
            )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Self': return pipe(
      load('self')
    )(evaluation)

    case 'Reference': return (
      target(environment)(currentSentence).kind === 'Field'
        ? pushReference(instances.get(scope.self.attributes[currentSentence.name])!)
        : load(currentSentence.name)
    )(evaluation)

    case 'Literal':
      if (currentSentence.value === null) return pipe(
        popPending,
        pushReference(NULL),
      )(evaluation)

      if (typeof currentSentence.value === 'boolean') return pipe(
        popPending,
        pushReference(currentSentence.value ? TRUE : FALSE)
      )(evaluation)

      // TODO: Add to instances
      if (typeof currentSentence.value === 'number') return pipe(
        popPending,
        pushReference({
          id: uuid(),
          // TODO: Make this 'wollok.Number'
          module: getNodeById<Class>(environment, currentSentence.scope.Number),
          attributes: {},
          innerValue: currentSentence.value,
        } as RuntimeObject)
      )(evaluation)

      // TODO: Add to instances
      if (typeof currentSentence.value === 'string') return pipe(
        popPending,
        pushReference({
          id: uuid(),
          // TODO: Make this 'wollok.String'
          module: getNodeById<Class>(environment, currentSentence.scope.String),
          attributes: {},
          innerValue: currentSentence.value,
        } as RuntimeObject)
      )(evaluation)

      if (currentSentence.value.kind === 'New') return pipe(
        popPending,
        pushPending(currentSentence.value),
      )(evaluation)

      return pipe(
        popPending,
        pushReference(instances.get(currentSentence.value.id)!),
      )(evaluation)

    case 'Send':
      if (pc === 0) return pipe(
        incPC,
        pushPending(currentSentence.receiver),
      )(evaluation)

      if (pc <= currentSentence.args.length) return pipe(
        incPC,
        pushPending(currentSentence.args[pc - 1]),
      )(evaluation)

      const receiver = currentFrame.referenceStack[0]
      // TODO: Maybe a single bytecode for this? invoke? May avoid repetition with super.
      // TODO: What about SELF AND SCOPE?
      // TODO:
      const method = methodLookup(environment, currentSentence.message, currentSentence.args.length, receiver.module)
      // TODO: throw error if no method
      return (method
        ? [
          pushFrame(method.body!.sentences),
          // TODO: Handle varargs
          ...reverse(method.parameters).map(parameter => store(parameter.name)),
          store('self'),
        ]
        : [
          pushPending({ kind: 'Throw', arg: { kind: 'New' } }, id: ''),
        ]).reduce(pipe)(evaluation)

    case 'Super':
      if (pc < currentSentence.args.length) return pipe(
        incPC,
        pushPending(currentSentence.args[pc]),
      )(evaluation)

      const sentenceContext: Method = currentSentence
      const superMethod = methodLookup(environment, sentenceContext.name, currentSentence.args.length, sentenceContext.parent.ancestors[0])
      // TODO: throw error if no method
      return [
        pushFrame(superMethod.body!.sentences),
        // TODO: Handle varargs
        ...reverse(superMethod.parameters).map(parameter => load(parameter.name)),
        load('self'),
      ].reduce(pipe)(evaluation)

    // TODO:
    case 'New':
      if (pc < currentSentence.args.length) return pipe(
        incPC,
        pushPending(currentSentence.args[pc]),
      )(evaluation)

      const constructor: Constructor = 
      // TODO: Call super constructor
      return [
        pushFrame(constructor.body.sentences),
        // TODO: Handle varargs
        ...reverse(constructor.parameters).map(parameter => load(parameter.name)),
        instantiate(target(environment)<Class>(currentSentence.className)),
        store('self'),
        // TODO: Initialize object inner variables
      ].reduce(pipe)(evaluation)

    case 'If':
      switch (pc) {
        case 0: return pipe(
          incPC,
          pushPending(currentSentence.condition),
        )(evaluation)

        case 1: return pipe(
          popPending,
          popReference,
          pushFrame(referenceStack[0] === TRUE ? currentSentence.thenBody.sentences : currentSentence.elseBody.sentences)
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Throw':
      switch (pc) {
        case 0: return pipe(
          incPC,
          pushPending(currentSentence.arg),
        )(evaluation)

        case 1:
          const error = referenceStack[0]
          const tryIndex = evaluation.frameStack.findIndex(stack => {
            const sentence = path<Sentence>(['pending', '0', '0'], stack)
            return !!sentence && sentence.kind === 'Try' && sentence.catches.some(({ parameterType }) =>
              !parameterType || inherits(environment)(error.module, target(environment)(parameterType))
            )
          })

          if (!tryIndex) return { ...evaluation, status: 'error' }

          const tryNode: Try = evaluation.frameStack[tryIndex].pending[0][0] as Try
          const catchNode: Catch = tryNode.catches.find(({ parameterType }) =>
            !parameterType || inherits(environment)(error.module, target(environment)(parameterType))
          )!

          // TODO: Evaluate intermediate always clauses
          return [
            ...new Array(tryIndex).map(_ => popFrame),
            pushFrame(catchNode.body.sentences),
            pushReference(error),
            store(catchNode.parameter.name),
          ].reduce(pipe)(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }

    case 'Try':
      switch (pc) {
        case 0: return pipe(
          incPC,
          pushFrame(currentSentence.body.sentences),
        )(evaluation)

        case 1: return pipe(
          popPending,
          pushFrame(currentSentence.always.sentences),
        )(evaluation)

        default: throw new Error(`Invalid PC: ${evaluation}`)
      }
  }

}