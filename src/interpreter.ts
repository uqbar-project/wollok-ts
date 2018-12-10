import { append, assoc, drop, lensPath as lens, over as change, path, pipe, prepend, reverse, set, view } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Assignment, Catch, Class, Constructor, Environment, Expression, Field, Id, List, Method, Module, Name, ObjectMember, Self, Sentence, Singleton, Test, Throw, Try } from './model'
import utils from './utils'


interface RuntimeScope { readonly [name: string]: Id<'Linked'> }

interface RuntimeObject {
  readonly id: Id<'Linked'>
  readonly module: Module<'Linked'>
  readonly attributes: RuntimeScope
  readonly innerValue?: any
}

interface Frame {
  readonly scope: RuntimeScope
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

// TODO: On validator, check that all the chain is there
const constructorCallChain = (environment: Environment<'Linked'>) =>
  (startingClass: Class<'Linked'>, startingArguments: List<Expression<'Linked'>>)
    : List<[Constructor<'Linked'>, List<Expression<'Linked'>>]> => {

    const { superclass } = utils(environment)

    const currentConstructor = constructorLookup(startingArguments.length, startingClass)
    const superClass = superclass(startingClass)

    return currentConstructor
      ? [
        [currentConstructor, startingArguments],
        ...currentConstructor.baseCall
          ? constructorCallChain(environment)(
            currentConstructor.baseCall.callsSuper ? superClass! : startingClass,
            currentConstructor.baseCall.args
          )
          : superClass
            ? constructorCallChain(environment)(superClass, [])
            : [],
      ]
      : superClass ? constructorCallChain(environment)(superClass, []) : []
  }


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type Instruction = (evaluation: Evaluation) => Evaluation


const INSTANCES = lens<{ readonly [id: string]: RuntimeObject }, Evaluation>(['instances'])
const FRAME_STACK = lens<List<Frame>, Evaluation>(['frameStack'])
const CURRENT_SCOPE = lens<RuntimeScope, Evaluation>(['frameStack', 0, 'scope'])
const CURRENT_PENDING = lens<List<[Sentence<'Linked'>, number]>, Evaluation>(['frameStack', 0, 'pending'])
const CURRENT_REFERENCE_STACK = lens<List<Id<'Linked'>>, Evaluation>(['frameStack', 0, 'referenceStack'])
const CURRENT_TOP_REFERENCE = lens<Id<'Linked'>, Evaluation>(['frameStack', 0, 'referenceStack', 0])


const STORE = (name: Name): Instruction => pipe(
  change(CURRENT_SCOPE, assoc(name, view(CURRENT_TOP_REFERENCE))),
  change(CURRENT_REFERENCE_STACK, drop(1))
)

const LOAD = (name: Name): Instruction => evaluation =>
  change(CURRENT_REFERENCE_STACK, append(view(CURRENT_SCOPE, evaluation)[name] || NULL_ID))(evaluation)

const SET = (name: Name): Instruction => evaluation => {
  const [self, value, ...references] = view(CURRENT_REFERENCE_STACK, evaluation)
  const current = view(INSTANCES, evaluation)[self]
  return pipe(
    change(INSTANCES, assoc(self, { ...current, attributes: assoc(name, value, current.attributes) })),
    set(CURRENT_REFERENCE_STACK, references),
  )(evaluation)
}

const POP_PENDING: Instruction = change(CURRENT_PENDING, pending => pending.slice(1))

const PUSH_PENDING = (next: Sentence<'Linked'>): Instruction =>
  change(CURRENT_PENDING, pending => [[next, 0] as [Sentence<'Linked'>, number], ...pending])

const INC_PC: Instruction =
  change(CURRENT_PENDING, ([[sentence, pc], ...others]) => [[sentence, pc + 1] as [Sentence<'Linked'>, number], ...others])

const PUSH_REFERENCE = (next: Id<'Linked'>): Instruction => change(CURRENT_REFERENCE_STACK, prepend(next))

const POP_REFERENCE: Instruction = change(CURRENT_REFERENCE_STACK, drop(1))

const PUSH_FRAME = (pending: List<Sentence<'Linked'>>): Instruction => evaluation => change(FRAME_STACK, prepend({
  scope: view(CURRENT_SCOPE, evaluation),
  pending: pending.map(sentence => [sentence, 0] as [Sentence<'Linked'>, number]),
  referenceStack: [],
}))(evaluation)

const POP_FRAME: Instruction = evaluation => pipe(
  change(FRAME_STACK, drop(1)),
  change(CURRENT_REFERENCE_STACK, prepend(view(CURRENT_TOP_REFERENCE, evaluation)))
)(evaluation)

const INSTANTIATE = (module: Class<'Linked'>, innerValue: any = undefined): Instruction => {
  const instance: RuntimeObject = { id: uuid(), module, attributes: {}, innerValue }
  return pipe(
    change(CURRENT_REFERENCE_STACK, prepend(instance.id)),
    change(INSTANCES, assoc(instance.id, instance)),
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
      scope: instances,
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
    scope,
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
        ? PUSH_REFERENCE(instances[instances[scope.self].attributes[currentSentence.name]].id)
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