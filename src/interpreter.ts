import { append, assoc, drop, lensPath as lens, over as change, path, pipe, prepend, reverse, set, view } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Assignment, Catch, Class, Constructor, Environment, Expression, Field, Id, Method, Module, Name, ObjectMember, Self, Sentence, Singleton, Test, Throw, Try } from './model'
import utils from './utils'


interface RuntimeScope { readonly [name: string]: Id }

interface RuntimeObject {
  readonly id: Id
  readonly module: Singleton | Class
  readonly attributes: RuntimeScope
  readonly innerValue?: any
}

interface Frame {
  readonly scope: RuntimeScope
  readonly pending: ReadonlyArray<[Sentence, number]>
  readonly referenceStack: ReadonlyArray<Id>
}

export interface Evaluation {
  readonly status: 'error' | 'running' | 'success'
  readonly environment: Environment
  readonly frameStack: ReadonlyArray<Frame>
  readonly instances: { readonly [id: string]: RuntimeObject }
}

const NULL_ID = 'null'
const TRUE_ID = 'true'
const FALSE_ID = 'false'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LOOKUP
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const methodLookup = (environment: Environment) => (name: Name, argumentCount: number, start: Module): Method | undefined => {
  const { hierarchy } = utils(environment)
  for (const module of hierarchy(start)) {
    const found = (module.members as ReadonlyArray<ObjectMember>).find(member =>
      // TODO: Varargs
      member.kind === 'Method' && (!!member.body || member.isNative) && member.name === name && member.parameters.length === argumentCount
    )
    if (found) return found as Method
  }
  return undefined
}

const constructorLookup = (argumentCount: number, owner: Class): Constructor | undefined => {
  // TODO: Varargs
  const found = owner.members.find(member => member.kind === 'Constructor' && member.parameters.length === argumentCount)
  return found ? found as Constructor : undefined
}

// TODO: On validator, check that all the chain is there
const constructorCallChain = (environment: Environment) =>
  (startingClass: Class, startingArguments: ReadonlyArray<Expression>): ReadonlyArray<[Constructor, ReadonlyArray<Expression>]> => {

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
const FRAME_STACK = lens<ReadonlyArray<Frame>, Evaluation>(['frameStack'])
const CURRENT_SCOPE = lens<RuntimeScope, Evaluation>(['frameStack', 0, 'scope'])
const CURRENT_PENDING = lens<ReadonlyArray<[Sentence, number]>, Evaluation>(['frameStack', 0, 'pending'])
const CURRENT_REFERENCE_STACK = lens<ReadonlyArray<Id>, Evaluation>(['frameStack', 0, 'referenceStack'])
const CURRENT_TOP_REFERENCE = lens<Id, Evaluation>(['frameStack', 0, 'referenceStack', 0])


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

const PUSH_PENDING = (next: Sentence): Instruction => change(CURRENT_PENDING, pending => [[next, 0] as [Sentence, number], ...pending])

const INC_PC: Instruction =
  change(CURRENT_PENDING, ([[sentence, pc], ...others]) => [[sentence, pc + 1] as [Sentence, number], ...others])

const PUSH_REFERENCE = (next: Id): Instruction => change(CURRENT_REFERENCE_STACK, prepend(next))

const POP_REFERENCE: Instruction = change(CURRENT_REFERENCE_STACK, drop(1))

const PUSH_FRAME = (pending: ReadonlyArray<Sentence>): Instruction => evaluation => change(FRAME_STACK, prepend({
  scope: view(CURRENT_SCOPE, evaluation),
  pending: pending.map(sentence => [sentence, 0] as [Sentence, number]),
  referenceStack: [],
}))(evaluation)

const POP_FRAME: Instruction = evaluation => pipe(
  change(FRAME_STACK, drop(1)),
  change(CURRENT_REFERENCE_STACK, prepend(view(CURRENT_TOP_REFERENCE, evaluation)))
)(evaluation)

const INSTANTIATE = (module: Class, innerValue: any = undefined): Instruction => {
  const instance: RuntimeObject = { id: uuid(), module, attributes: {}, innerValue }
  return pipe(
    change(CURRENT_REFERENCE_STACK, prepend(instance.id)),
    change(INSTANCES, assoc(instance.id, instance)),
  )
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const initialInstances = (environment: Environment): ReadonlyArray<RuntimeObject> => {
  const { descendants, resolve } = utils(environment)

  return [
    { id: NULL_ID, module: resolve<Class>('wollok.lang.Object'), attributes: {} },
    { id: TRUE_ID, module: resolve<Class>('wollok.lang.Boolean'), attributes: {} },
    { id: FALSE_ID, module: resolve<Class>('wollok.lang.Boolean'), attributes: {} },
    ...descendants(environment)
      .filter<Singleton>((node): node is Singleton => node.kind === 'Singleton')
      .map(module => ({ id: module.id, module, attributes: {} })), // TODO: Initialize attributes
  ]
}


const createEvaluationFor = (environment: Environment) => (node: Test): Evaluation => {
  const instances = initialInstances(environment).reduce((all, instance) => assoc(instance.id, instance, all), {})
  return {
    environment,
    instances,
    status: 'running',
    frameStack: [{
      scope: instances,
      pending: node.body.sentences.map(sentence => [sentence, 0] as [Sentence, number]),
      referenceStack: [],
    }],
  }
}

export default (environment: Environment) => ({
  runTests: () => {
    const { descendants } = utils(environment)

    const tests = descendants(environment).filter<Test>((node): node is Test => node.kind === 'Test')

    return tests.map(test => {
      let evaluation = createEvaluationFor(environment)(test)
      while (evaluation.frameStack.length) {
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
    target,
    firstAncestorOfKind,
    parentOf,
    hierarchy,
    inherits,
    getNodeById,
  } = utils(environment)

  if (status !== 'running') return evaluation
  if (!pending.length) return POP_FRAME(evaluation)

  const [[currentSentence, pc]] = pending

  switch (currentSentence.kind) {
    case 'Variable':
      if (!currentSentence.value)
        return pipe(
          POP_PENDING,
          PUSH_REFERENCE(NULL_ID),
          STORE(currentSentence.name),
        )(evaluation)

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
          return target(currentSentence.reference).kind === 'Field'
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

    case 'Reference': return (
      target(currentSentence).kind === 'Field'
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
        INSTANTIATE(getNodeById(currentSentence.scope.Number), currentSentence.value),
      )(evaluation)

      // TODO: Add to instances
      if (typeof currentSentence.value === 'string') return pipe(
        POP_PENDING,
        // TODO: Make this 'wollok.String'
        INSTANTIATE(getNodeById(currentSentence.scope.String), currentSentence.value),
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

      const receiver = instances[currentFrame.referenceStack[0]]
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
          PUSH_PENDING({
            kind: 'Throw',
            arg: {
              kind: 'New',
              className: {
                kind: 'Reference',
                // TODO: Use proper path wollok...
                name: 'MessageNotUnderstood',
              },
              args: [],
            },
          } as unknown as Throw),
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
        parentOf<Module>(currentMethod)
      )

      return (superMethod
        ? [
          PUSH_FRAME(superMethod.body!.sentences),
          // TODO: Handle varargs
          ...reverse(superMethod.parameters).map(parameter => STORE(parameter.name)),
        ]
        : [
          PUSH_PENDING({
            kind: 'Throw',
            arg: {
              kind: 'New',
              className: {
                kind: 'Reference',
                // TODO: Use proper path wollok...
                name: 'MessageNotUnderstood',
              },
              args: [],
            },
          } as unknown as Throw),
        ]).reduce(pipe)(evaluation)

    case 'New':
      if (pc < currentSentence.args.length) return pipe(
        INC_PC,
        PUSH_PENDING(currentSentence.args[pc]),
      )(evaluation)

      const instantiatedClass = target<Class>(currentSentence.className)
      const instantiatedClassHierarchy = hierarchy(instantiatedClass)
      const initializableFields = instantiatedClassHierarchy.reduce((fields, module) => [
        ...(module.members as ObjectMember[]).filter(member => member.kind === 'Field' && !!member.value) as ReadonlyArray<Field>,
        ...fields,
      ], [] as ReadonlyArray<Field>)

      if (pc === currentSentence.args.length) return pipe(
        INC_PC,
        PUSH_FRAME([
          ...initializableFields.map(field => ({
            kind: 'Assignment',
            reference: { kind: 'Reference', name: field.name },
            value: field.value!,
          }) as Assignment),
          { kind: 'Self' } as Self,
        ]),
        INSTANTIATE(instantiatedClass),
        STORE('self'),
      )(evaluation)

      const chain = constructorCallChain(environment)(instantiatedClass, currentSentence.args)

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
            const sentence = path<Sentence>(['pending', '0', '0'], stack)
            return !!sentence && sentence.kind === 'Try' && sentence.catches.some(({ parameterType }) =>
              !parameterType || inherits(error.module, target(parameterType))
            )
          })

          if (!tryIndex) return { ...evaluation, status: 'error' }

          const tryNode: Try = evaluation.frameStack[tryIndex].pending[0][0] as Try
          const catchNode: Catch = tryNode.catches.find(({ parameterType }) =>
            !parameterType || inherits(error.module, target(parameterType))
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