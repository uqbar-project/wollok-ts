import { last, zipObj } from './extensions'
import log from './log'
import { is, Node, Body, Class, Describe, Environment, Expression, Id, List, Module, Name, NamedArgument, Sentence, Test, Variable, Singleton } from './model'
import { v4 as uuid } from 'uuid'

// TODO: Wishlist
// - Reify Contexts and make instances and Frames contain their own locals.
//    - Move logic to constructors
//    - Check if all the public fields need to be public
// - Unify Interpreter and Evaluation to get a consistent API and Refactor exported API
//    - Unshift frame in eval for better setup. Allow evaluation to have no active frame.
//    - More step methods: stepThrough, for example. Step to get inside closure?
// - More Instructions to simplify natives.
//    - Simplify weird Instruction parameters (take advantage of scopes. move towards just byte based arguments).
//    - Something to iterate list elements instead of mapping them?
//    - Rewrite long and complex natives and try so simplify them. Ensure test coverage.
//    - Maaaaybe make compilation a bit lower level? Compile to IDs/Identifiers only sort of thing?
// - Avoid trailing instructions for methods and tests when possible (return void), etc.
// - Send logger as parameter to support better handling and logging to file.
// - Migrate to TypeScript 4.1. Maybe drop Stages in the model? Not sure if worth it...
// - Drop deprecated Wollok 2 abstractions.

const { round } = Math
const { isArray } = Array

export type NativeFunction = (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => void
export interface Natives {
  [name: string]: NativeFunction | Natives
}

export const NULL_ID = 'null'
export const VOID_ID = 'void'
export const TRUE_ID = 'true'
export const FALSE_ID = 'false'
export const LAZY_ID = '<lazy>'

export const ROOT_CONTEXT_ID = 'root'

// TODO: Receive these as arguments, but have a default
export const DECIMAL_PRECISION = 5
export const MAX_STACK_SIZE = 1000

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNTIME
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// TODO: Implement single argument constructors instead ?
// TODO: Do all these fields still need to be an argument in the constructor ?
// TODO: Can some of the evaluation operations be delegated better?
// TODO: Should we parameterize the evaluation in the behavior of RuntimeObjects instead?

export class Evaluation {

  constructor(
    readonly environment: Environment,
    globals: Map<Name, Id>,
    protected frameStack: Frame[] = [],
    protected instances: Map<Id, RuntimeObject> = new Map(),
    protected code: Map<Id, List<Instruction>> = new Map(),
  ){
    const rootContext = new Context(this, undefined, new Map(globals), undefined, ROOT_CONTEXT_ID)
    this.rootContext = () => rootContext
  }

  copy(): Evaluation {
    const evaluation = new Evaluation(
      this.environment,
      new Map(this.rootContext().locals),
      this.frameStack.map(frame => frame.copy()),
      new Map(),
      new Map(this.code),
    )

    this.instances.forEach((instance, key) => evaluation.instances.set(key, instance.copy(evaluation)))

    return evaluation
  }

  codeFor(node: Node): List<Instruction> {
    if(!this.code.has(node.id)) {
      const compileSentences = compile(this.environment)
      if(node.is('Method') && node.body && node.body !== 'native') {
        this.code.set(node.id, [
          ...compileSentences(...node.body.sentences),
          PUSH(VOID_ID),
          RETURN,
        ])
      } else if (node.is('Constructor')) {
        const constructorClass = node.parent()
        this.code.set(node.id, [
          ...node.baseCall && constructorClass.superclass() ? [
            ...node.baseCall.args.flatMap(arg => compileSentences(arg)),
            LOAD('self'),
            INIT(
              node.baseCall.args.length,
              node.baseCall.callsSuper
                ? constructorClass.superclass()!.fullyQualifiedName()
                : constructorClass.fullyQualifiedName(),
              true,
            ),
          ] : [],
          ...compileSentences(...node.body.sentences),
          LOAD('self'),
          CALL('initialize', 0),
          LOAD('self'),
          RETURN,
        ])
      } else throw new Error(`Can't retrieve instructions for ${node.kind} node`)
    }

    return this.code.get(node.id)!
  }

  instance(id: Id): RuntimeObject {
    const response = this.instances.get(id)
    if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
    return response
  }

  maybeInstance(id: Id): RuntimeObject | undefined {
    return this.instances.get(id)
  }

  setInstance(id: Id, object: RuntimeObject): void{
    this.instances.set(id, object)
  }

  // TODO: Move these validations to the RuntimeObject constructor?
  createInstance(moduleFQN: Name, baseInnerValue?: InnerValue, defaultId: Id = uuid()): Id {
    let id: Id
    let innerValue = baseInnerValue

    switch (moduleFQN) {
      case 'wollok.lang.Number':
        if (typeof innerValue !== 'number') throw new TypeError(`Can't create a Number with innerValue ${innerValue}`)
        const stringValue = innerValue.toFixed(DECIMAL_PRECISION)
        id = 'N!' + stringValue
        innerValue = Number(stringValue)
        break

      case 'wollok.lang.String':
        if (typeof innerValue !== 'string') throw new TypeError(`Can't create a String with innerValue ${innerValue}`)
        id = 'S!' + innerValue
        break

      default:
        id = defaultId
    }

    if (!this.instances.has(id)) {
      this.instances.set(id, new RuntimeObject(
        this,
        this.currentFrame()?.context ?? this.rootContext(),
        moduleFQN,
        id,
        new Map([['self', id]]),
        innerValue,
      ))
    }

    return id
  }

  destroyInstance(id: Id): void { this.instances.delete(id) }

  listInstances(): List<RuntimeObject> { return [...this.instances.values()] }

  rootContext(): Context { throw new Error('Uninitialized root context') }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // STACK MANIPULATION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  currentFrame(): Frame | undefined { return last(this.frameStack) }

  baseFrame(): Frame { return this.frameStack[0] }

  stackDepth(): number { return this.frameStack.length }

  listFrames(): List<Frame> { return this.frameStack }

  pushFrame(frame: Frame): void {
    if (this.frameStack.length >= MAX_STACK_SIZE)
      return this.raise(this.createInstance('wollok.lang.StackOverflowException'))
    this.frameStack.push(frame)
  }

  popFrame(): Frame | undefined { return this.frameStack.pop() }

  raise(exceptionId: Id): void{
    let currentContext = this.currentFrame()?.context ?? this.rootContext() // TODO: evaluation.currentContext()?
    const exception = this.instance(exceptionId)

    const visited = []

    while (currentContext.exceptionHandlerIndex === undefined) {
      const currentFrame = this.currentFrame()

      if (!currentFrame) throw new Error(`Reached end of stack with unhandled exception ${JSON.stringify(exception)}`)

      if (currentFrame.context.id === currentFrame.id) {
        this.frameStack.pop()
        if (!this.currentFrame()) throw new Error(`Reached end of stack with unhandled exception ${JSON.stringify(exception)}`)
      } else {
        if (!currentContext.parent) throw new Error(`Reached the root context ${currentContext.id} before reaching the current frame ${currentFrame.id}. This should not happen!`)
        currentFrame.context = currentContext.parent
      }

      currentContext = this.currentFrame()!.context
      visited.push(currentContext)
    }

    if (!currentContext.parent) throw new Error('Popped root context')
    if (!this.currentFrame()) throw new Error(`Reached end of stack with unhandled exception ${JSON.stringify(exception)}`)

      this.currentFrame()!.nextInstruction = currentContext.exceptionHandlerIndex!
      this.currentFrame()!.context = currentContext.parent
      this.currentFrame()!.context.set('<exception>', exceptionId)
  }

}


export class Frame {
  constructor(
    public context: Context, // TODO: receive parent context instead
    readonly instructions: List<Instruction>,
    public nextInstruction: number = 0,
    public operandStack: Id[] = [],
    public id: Id = context.id, // TODO: Is this still necesary?
  ){ }

  copy(): Frame {
    return new Frame(
      this.context,
      this.instructions,
      this.nextInstruction,
      [...this.operandStack],
      this.id,
    )
  }

  popOperand(): Id {
    const response = this.operandStack.pop()
    if (!response) throw new RangeError('Popped empty operand stack')
    return response
  }

  pushOperand(id: Id): void {
    this.operandStack.push(id)
  }

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Context {
  constructor(
    evaluation: Evaluation,
    public readonly parent?: Context,
    public readonly locals: Map<Name, Id> = new Map(), // TODO: Reference to actual objects instead of Id?
    public readonly exceptionHandlerIndex?: number, // TODO: Exclusive of Block Context?
    public readonly id: Id = uuid(),
  ){
    this.evaluation = () => evaluation
  }

  // TODO: Replace with #evaluation once TS version is updated
  protected evaluation(): Evaluation { throw new Error('Uninitialized evaluation') }

  copy(evaluation: Evaluation): Context {
    return new Context(
      evaluation,
      this.parent,
      new Map(this.locals),
      this.exceptionHandlerIndex,
      this.id,
    )
  }

  getId(local: Name): Id | undefined {
    const reponse = this.locals.get(local)
    if (reponse) return reponse
    if (!this.parent) return undefined
    return this.parent.getId(local)
  }

  get(local: Name): RuntimeObject | undefined {
    const id = this.locals.get(local)
    return id ? this.evaluation().instance(id) : undefined
  }

  set(local: Name, valueId: Id): void {
    this.locals.set(local, valueId)
  }
}


export type InnerValue = string | number | Id[]

export class RuntimeObject extends Context {
  constructor(
    evaluation: Evaluation,
    public readonly parent: Context,
    public readonly moduleFQN: Name, // TODO: Reference to actual module to avoid evaluation?
    id?: Id,
    locals: Map<Name, Id> = new Map(),
    public innerValue?: InnerValue
  ) {
    super(evaluation, parent, locals, undefined, id)

    locals.set('self', this.id)
  }

  copy(evaluation: Evaluation): RuntimeObject {
    return new RuntimeObject(
      evaluation,
      this.parent,
      this.moduleFQN,
      this.id,
      new Map(this.locals),
      isArray(this.innerValue) ? [...this.innerValue] : this.innerValue
    )
  }

  module(): Module {
    return this.evaluation().environment.getNodeByFQN<'Module'>(this.moduleFQN)
  }

  assertIsNumber(): asserts this is RuntimeObject & { innerValue: number } { this.assertIs('wollok.lang.Number', 'number') }
  assertIsString(): asserts this is RuntimeObject & { innerValue: string } { this.assertIs('wollok.lang.String', 'string') }
  assertIsBoolean(): asserts this is RuntimeObject & { innerValue: string } { this.assertIs('wollok.lang.Boolean', 'boolean') }
  assertIsCollection(): asserts this is RuntimeObject & { innerValue: Id[] } {
    if (!isArray(this.innerValue) || (this.innerValue.length && typeof this.innerValue[0] !== 'string'))
      throw new TypeError(`Malformed Runtime Object: Collection inner value should be a List<Id> but was ${this.innerValue}`)
  }

  protected assertIs(module: Name, innerValueType: string): void {
    if (this.moduleFQN !== module)
      throw new TypeError(`Expected an instance of ${module} but got a ${this.moduleFQN} instead`)
    if (typeof this.innerValue !== innerValueType)
      throw new TypeError(`Malformed Runtime Object: invalid inner value ${this.innerValue} for ${module} instance`)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Instruction
  = { kind: 'LOAD', name: Name, lazyInitialization?: List<Instruction> }
  | { kind: 'STORE', name: Name, lookup: boolean }
  | { kind: 'PUSH', id: Id }
  | { kind: 'POP' }
  | { kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta?: number }
  | { kind: 'POP_CONTEXT' }
  | { kind: 'SWAP', distance: number }
  | { kind: 'DUP' }
  | { kind: 'INSTANTIATE', module: Name, innerValue?: InnerValue }
  | { kind: 'INHERITS', module: Name }
  | { kind: 'JUMP', count: number }
  | { kind: 'CONDITIONAL_JUMP', count: number }
  | { kind: 'CALL', message: Name, arity: number, useReceiverContext: boolean, lookupStart?: Name }
  | { kind: 'INIT', arity: number, lookupStart: Name, optional?: boolean }
  | { kind: 'INIT_NAMED', argumentNames: List<Name> }
  | { kind: 'INTERRUPT' }
  | { kind: 'RETURN' }

export const LOAD = (name: Name, lazyInitialization?: List<Instruction>): Instruction => ({ kind: 'LOAD', name, lazyInitialization })
export const STORE = (name: Name, lookup: boolean): Instruction => ({ kind: 'STORE', name, lookup })
export const PUSH = (id: Id): Instruction => ({ kind: 'PUSH', id })
export const POP: Instruction = ({ kind: 'POP' })
export const PUSH_CONTEXT = (exceptionHandlerIndexDelta?: number): Instruction => ({ kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta })
export const POP_CONTEXT: Instruction = ({ kind: 'POP_CONTEXT' })
export const SWAP = (distance = 0): Instruction => ({ kind: 'SWAP', distance })
export const DUP: Instruction = { kind: 'DUP' }
export const INSTANTIATE = (module: Name, innerValue?: InnerValue): Instruction => ({ kind: 'INSTANTIATE', module, innerValue })
export const INHERITS = (module: Name): Instruction => ({ kind: 'INHERITS', module })
export const JUMP = (count: number): Instruction => ({ kind: 'JUMP', count })
export const CONDITIONAL_JUMP = (count: number): Instruction => ({ kind: 'CONDITIONAL_JUMP', count })
export const CALL = (message: Name, arity: number, useReceiverContext = true, lookupStart?: Name): Instruction =>
  ({ kind: 'CALL', message, arity, useReceiverContext, lookupStart })
export const INIT = (arity: number, lookupStart: Name, optional = false): Instruction =>
  ({ kind: 'INIT', arity, lookupStart, optional })
export const INIT_NAMED = (argumentNames: List<Name>): Instruction => ({ kind: 'INIT_NAMED', argumentNames })
export const INTERRUPT: Instruction = ({ kind: 'INTERRUPT' })
export const RETURN: Instruction = ({ kind: 'RETURN' })

const compileExpressionClause = (environment: Environment) => ({ sentences }: Body): List<Instruction> =>
  sentences.length ? sentences.flatMap((sentence, index) => [
    ...compile(environment)(sentence),
    ...index < sentences.length - 1 ? [POP] : [],
  ]) : [PUSH(VOID_ID)]

export const compile = (environment: Environment) => (...sentences: Sentence[]): List<Instruction> =>
  sentences.flatMap(node => node.match({
    Variable: node => [
      ...compile(environment)(node.value),
      STORE(node.name, false),
      PUSH(VOID_ID),
    ],


    Return: node => [
      ...node.value
        ? compile(environment)(node.value)
        : [PUSH(VOID_ID)],
      RETURN,
    ],


    Assignment: node => [
      ...compile(environment)(node.value),
      STORE(node.variable.name, true),
      PUSH(VOID_ID),
    ],

    Self: () => [
      LOAD('self'),
    ],


    Reference: node => {
      const target = node.target()!

      if (target.is('Module')) return [
        LOAD(target.fullyQualifiedName()),
      ]

      if (target.is('Variable') && target.parent().is('Package')) return [
        LOAD(target.fullyQualifiedName(), compile(environment)(target.value)),
      ]

      return [LOAD(node.name)]
    },


    Literal: node => {
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

      if (node.value.is('Singleton')) {
        if (node.value.supercallArgs.some(is('NamedArgument'))) {
          const supercallArgs = node.value.supercallArgs as List<NamedArgument>
          return [
            ...supercallArgs.flatMap(({ value }) => compile(environment)(value)),
            INSTANTIATE(node.value.fullyQualifiedName()),
            INIT_NAMED(supercallArgs.map(({ name }) => name)),
            INIT(0, node.value.superclass()!.fullyQualifiedName(), true),
          ]
        } else {
          const supercallArgs = node.value.supercallArgs as List<Expression>
          return [
            ...supercallArgs.flatMap(arg => compile(environment)(arg)),
            INSTANTIATE(node.value.fullyQualifiedName()),
            INIT_NAMED([]),
            INIT(node.value.supercallArgs.length, node.value.superclass()!.fullyQualifiedName()),
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
    },


    Send: node => [
      ...compile(environment)(node.receiver),
      ...node.args.flatMap(arg => compile(environment)(arg)),
      CALL(node.message, node.args.length),
    ],


    Super: node => {
      const currentMethod = node.ancestors().find(is('Method'))!
      return [
        LOAD('self'),
        ...node.args.flatMap(arg => compile(environment)(arg)),
        CALL(currentMethod.name, node.args.length, true, currentMethod.parent().fullyQualifiedName()),
      ]
    },


    New: node => {
      const fqn = node.instantiated.target()!.fullyQualifiedName()

      if ((node.args as any[]).some(arg => arg.is('NamedArgument'))) {
        const args = node.args as List<NamedArgument>

        return [
          ...args.flatMap(({ value }) => compile(environment)(value)),
          INSTANTIATE(fqn),
          INIT_NAMED(args.map(({ name }) => name)),
          INIT(0, fqn, true),
        ]
      } else {
        return [
          ...(node.args as List<Expression>).flatMap(arg => compile(environment)(arg)),
          INSTANTIATE(fqn),
          INIT_NAMED([]),
          INIT(node.args.length, fqn),
        ]
      }
    },


    If: node => {
      const thenClause = compileExpressionClause(environment)(node.thenBody)
      const elseClause = compileExpressionClause(environment)(node.elseBody)
      return [
        ...compile(environment)(node.condition),
        PUSH_CONTEXT(),
        CONDITIONAL_JUMP(elseClause.length + 1),
        ...elseClause,
        JUMP(thenClause.length),
        ...thenClause,
        POP_CONTEXT,
      ]
    },


    Throw: node => [
      ...compile(environment)(node.exception),
      INTERRUPT,
    ],


    Try: node => {
      const clause = compileExpressionClause(environment)(node.body)
      const always = [
        ...compileExpressionClause(environment)(node.always),
        POP,
      ]
      const catches = node.catches.flatMap(({ parameter, parameterType, body }) => {
        const handler = compileExpressionClause(environment)(body)
        return [
          LOAD('<exception>'),
          INHERITS(parameterType.target()!.fullyQualifiedName()),
          CALL('negate', 0),
          CONDITIONAL_JUMP(handler.length + 5),
          LOAD('<exception>'),
          STORE(parameter.name, false),
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

        PUSH_CONTEXT(clause.length + 3),
        ...clause,
        STORE('<result>', true),
        POP_CONTEXT,
        JUMP(catches.length + 2),

        PUSH_CONTEXT(catches.length + 1),
        ...catches,
        POP_CONTEXT,

        PUSH_CONTEXT(),
        ...always,
        POP_CONTEXT,
        LOAD('<exception>'),
        INHERITS('wollok.lang.Exception'),
        CALL('negate', 0),
        CONDITIONAL_JUMP(2),
        LOAD('<exception>'),
        INTERRUPT,
        LOAD('<result>'),

        POP_CONTEXT,
      ]
    },
  }))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (natives: Natives) => (evaluation: Evaluation): void => {
  const { environment } = evaluation

  const currentFrame = evaluation.currentFrame()
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.instructions[currentFrame.nextInstruction]
  if (!instruction) throw new Error('Reached end of instructions')

  currentFrame.nextInstruction++

  try {

    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const value = currentFrame.context.getId(instruction.name)
        if (!value) throw new Error(`LOAD of missing local "${instruction.name}" on context ${currentFrame.context.id}`)

        // TODO: should add tests for the lazy load and store
        if (value !== LAZY_ID) currentFrame.pushOperand(value)
        else {
          if (!instruction.lazyInitialization) throw new Error(`No lazy initialization for lazy reference "${instruction.name}"`)

          evaluation.pushFrame(new Frame(
            currentFrame.context,
            [
              ...instruction.lazyInitialization,
              DUP,
              STORE(instruction.name, true),
              RETURN,
            ]))
        }
      })()


      case 'STORE': return (() => {
        const valueId = currentFrame.popOperand()
        const currentContext = currentFrame.context

        let context: Context | undefined = currentContext
        if (instruction.lookup) {
          while (context && !context.locals.has(instruction.name)) {
            context = context.parent
          }
        }

        (context ?? currentContext).set(instruction.name, valueId)
      })()


      case 'PUSH': return (() => {
        currentFrame.pushOperand(instruction.id)
      })()


      case 'POP': return (() => {
        currentFrame.popOperand()
      })()


      case 'PUSH_CONTEXT': return (() => {
        currentFrame.context = new Context(
          evaluation,
          currentFrame.context,
          undefined,
          instruction.exceptionHandlerIndexDelta
            ? currentFrame.nextInstruction + instruction.exceptionHandlerIndexDelta
            : undefined
        )
      })()


      case 'POP_CONTEXT': return (() => {
        const next = currentFrame.context.parent

        if (!next) throw new Error('Popped root context')

        currentFrame.context = next
      })()


      case 'SWAP': return (() => {
        const a = currentFrame.popOperand()
        const bs = new Array(instruction.distance).fill(null).map(() => currentFrame.popOperand()).reverse()
        const c = currentFrame.popOperand()
        currentFrame.pushOperand(a)
        bs.forEach(b => currentFrame.pushOperand(b))
        currentFrame.pushOperand(c)
      })()

      case 'DUP': return (() => {
        const a = currentFrame.popOperand()
        currentFrame.pushOperand(a)
        currentFrame.pushOperand(a)
      })()

      case 'INSTANTIATE': return (() => {
        const id = evaluation.createInstance(instruction.module, isArray(instruction.innerValue) ? [...instruction.innerValue] : instruction.innerValue)
        currentFrame.pushOperand(id)
      })()

      case 'INHERITS': return (() => {
        const selfId = currentFrame.popOperand()
        const self = evaluation.instance(selfId)
        currentFrame.pushOperand(self.module().inherits(environment.getNodeByFQN(instruction.module)) ? TRUE_ID : FALSE_ID)
      })()

      case 'JUMP': return (() => {
        if (currentFrame.nextInstruction + instruction.count >= currentFrame.instructions.length || instruction.count < 0)
          throw new Error(`Invalid jump count ${instruction.count} on index ${currentFrame.nextInstruction} of [${currentFrame.instructions.map(i => JSON.stringify(i))}]`)

        currentFrame.nextInstruction += instruction.count
      })()

      case 'CONDITIONAL_JUMP': return (() => {
        const check = currentFrame.popOperand()

        if (check !== TRUE_ID && check !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
        if (currentFrame.nextInstruction + instruction.count >= currentFrame.instructions.length || instruction.count < 0)
          throw new Error(`Invalid jump count ${instruction.count} on index ${currentFrame.nextInstruction} of [${currentFrame.instructions.map(i => JSON.stringify(i))}]`)

        currentFrame.nextInstruction += check === TRUE_ID ? instruction.count : 0
      })()


      case 'CALL': return (() => {
        const argIds = Array.from({ length: instruction.arity }, () => currentFrame.popOperand()).reverse()
        const self = evaluation.instance(currentFrame.popOperand())

        let lookupStart: Name
        if (instruction.lookupStart) {
          const ownHierarchy = self.module().hierarchy().map(module => module.fullyQualifiedName())
          const start = ownHierarchy.findIndex(fqn => fqn === instruction.lookupStart)
          lookupStart = ownHierarchy[start + 1]
        } else {
          lookupStart = self.moduleFQN
        }
        const method = environment.getNodeByFQN<'Module'>(lookupStart).lookupMethod(instruction.message, instruction.arity)

        if (!method) {
          log.warn('Method not found:', lookupStart, '>>', instruction.message, '/', instruction.arity)

          const messageNotUnderstood = self.module().lookupMethod('messageNotUnderstood', 2)!
          const messageNotUnderstoodArgs = [
            evaluation.createInstance('wollok.lang.String', instruction.message),
            evaluation.createInstance('wollok.lang.List', argIds),
          ]

          evaluation.pushFrame(new Frame(
            new Context(evaluation, self, new Map(messageNotUnderstood.parameters.map(({ name }, index) => [name, messageNotUnderstoodArgs[index]]))),
            evaluation.codeFor(messageNotUnderstood)
          ))
        } else {
          if (method.body === 'native') {
            log.debug('Calling Native:', lookupStart, '>>', instruction.message, '/', instruction.arity)
            const fqn = `${method.parent().fullyQualifiedName()}.${method.name}`
            const native: NativeFunction = fqn.split('.').reduce((current, name) => {
              const next = current[name]
              if (!next) throw new Error(`Native not found: ${fqn}`)
              return next
            }, natives as any)
            const args = argIds.map(id => {
              if (id === VOID_ID) throw new Error('Reference to void argument')
              return evaluation.instance(id)
            })

            native(self, ...args)(evaluation)
          } else {
            const locals = new Map(method.parameters.some(({ isVarArg }) => isVarArg)
              ? [
                ...method.parameters.slice(0, -1).map(({ name }, index) => [name, argIds[index]] as const),
                [last(method.parameters)!.name, evaluation.createInstance('wollok.lang.List', argIds.slice(method.parameters.length - 1))],
              ]
              : method.parameters.map(({ name }, index) => [name, argIds[index]])
            )

            evaluation.pushFrame(new Frame(
              new Context(evaluation, instruction.useReceiverContext ? self : self.parent, locals),
              evaluation.codeFor(method)
            ))
          }
        }
      })()


      case 'INIT': return (() => {
        const selfId = currentFrame.popOperand()
        const self = evaluation.instance(selfId)
        const argIds = Array.from({ length: instruction.arity }, () => currentFrame.popOperand()).reverse()
        const lookupStart: Class = environment.getNodeByFQN(instruction.lookupStart)
        const constructor = lookupStart.lookupConstructor(instruction.arity)

        if (!constructor) {
          if (instruction.optional) return evaluation.currentFrame()?.pushOperand(selfId)
          else throw new Error(`Missing constructor/${instruction.arity} on ${lookupStart.fullyQualifiedName()}`)
        }

        const locals = new Map(constructor.parameters.some(({ isVarArg }) => isVarArg)
          ? [
            ...constructor.parameters.slice(0, -1).map(({ name }, index) => [name, argIds[index]] as const),
            [last(constructor.parameters)!.name, evaluation.createInstance('wollok.lang.List', argIds.slice(constructor.parameters.length - 1))],
          ]
          : constructor.parameters.map(({ name }, index) => [name, argIds[index]])
        )

        evaluation.pushFrame(new Frame(
          new Context(evaluation, self, locals),
          evaluation.codeFor(constructor)
        ))
      })()

      case 'INIT_NAMED': return (() => {
        const selfId = currentFrame.popOperand()
        const self = evaluation.instance(selfId)

        const fields = self.module().hierarchy().flatMap(module => module.fields())

        for (const field of fields)
          self.set(field.name, VOID_ID)

        for (const name of [...instruction.argumentNames].reverse())
          self.set(name, currentFrame.popOperand())

        evaluation.pushFrame(new Frame(
          self,
          [
            ...fields.filter(field => !instruction.argumentNames.includes(field.name)).flatMap(field => [
              ...compile(environment)(field.value),
              STORE(field.name, true),
            ]),
            LOAD('self'),
            RETURN,
          ]))
      })()


      case 'INTERRUPT': return (() => {
        const exception = currentFrame.popOperand()
        evaluation.raise(exception)
      })()

      case 'RETURN': return (() => {
        const valueId = currentFrame.popOperand()
        evaluation.popFrame()

        const next = evaluation.currentFrame()

        if (!next) throw new Error('Returning from last frame')

        next.pushOperand(valueId)
      })()

    }
  } catch (error) {
    log.error(error)
    if (evaluation.currentFrame())
      evaluation.raise(evaluation.createInstance('wollok.lang.EvaluationError', error))
    else throw error
  }

}

/** Takes all possible steps, until the last frame has no pending instructions */
export const stepAll = (natives: Natives) => (evaluation: Evaluation): void => {
  const takeStep = step(natives)
  // TODO: add done() message to check instructions pending
  while (evaluation.currentFrame()!.nextInstruction < evaluation.currentFrame()!.instructions.length) {
    log.step(evaluation)
    takeStep(evaluation)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const buildEvaluation = (environment: Environment): Evaluation => {

  const globalConstants = environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
  const globalSingletons = environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)

  const evaluation = new Evaluation(environment, new Map([
    ['null', NULL_ID],
    ['true', TRUE_ID],
    ['false', FALSE_ID],
    ...globalSingletons.map(singleton => [singleton.fullyQualifiedName(), singleton.id] as const),
    ...globalConstants.map(constant => [constant.fullyQualifiedName(), LAZY_ID] as const),
  ]))

  evaluation.pushFrame(new Frame(evaluation.rootContext(), [
    ...globalSingletons.flatMap(singleton => {
      if (singleton.supercallArgs.some(is('NamedArgument'))) {
        const args = singleton.supercallArgs as List<NamedArgument>
        return [
          ...args.flatMap(({ value }) => compile(environment)(value)),
          PUSH(singleton.id),
          INIT_NAMED(args.map(({ name }) => name)),
          INIT(0, singleton.superclass()!.fullyQualifiedName(), true),
        ]
      } else {
        const args = singleton.supercallArgs as List<Expression>
        return [
          ...args.flatMap(arg => compile(environment)(arg)),
          PUSH(singleton.id),
          INIT_NAMED([]),
          INIT(args.length, singleton.superclass()!.fullyQualifiedName()),
        ]
      }
    }),
  ]))

  evaluation.createInstance('wollok.lang.Object', undefined, NULL_ID)
  evaluation.createInstance('wollok.lang.Boolean', undefined, TRUE_ID)
  evaluation.createInstance('wollok.lang.Boolean', undefined, FALSE_ID)
  for (const module of globalSingletons) evaluation.createInstance(module.fullyQualifiedName(), undefined, module.id)

  return evaluation
}

function run(evaluation: Evaluation, natives: Natives, sentences: List<Sentence>) {
  const instructions = compile(evaluation.environment)(...sentences)

  // TODO: This should not be run on a context child of the current frame's context. Either receive the context or use the global one.
  evaluation.pushFrame(new Frame(
    new Context(evaluation, evaluation.currentFrame()?.context ?? evaluation.rootContext()),
    instructions
  ))

  stepAll(natives)(evaluation)

  const currentFrame = evaluation.popFrame()!
  if(currentFrame.operandStack.length) {
    const topOperand = currentFrame.popOperand()
    if(topOperand !== VOID_ID) return evaluation.instance(topOperand)
  }
  return null

}

export interface TestResult {
  error?: Error,
  duration: number,
  evaluation: Evaluation,
}

function runTest(evaluation: Evaluation, natives: Natives, test: Test): TestResult {
  log.resetStep()

  if (test.parent().is('Describe')) {
    const describe = test.parent() as Describe
    const describeInstanceId = evaluation.createInstance(describe.fullyQualifiedName())
    const describeInstance = evaluation.instance(describeInstanceId)

    evaluation.pushFrame(new Frame(describeInstance, compile(evaluation.environment)(
      ...describe.variables(),
      ...describe.fixtures().flatMap(fixture => fixture.body.sentences),
    )))

    try {
      stepAll(natives)(evaluation)
    } catch (error) {
      return {
        error,
        duration: 0,
        evaluation,
      }
    }
  }

  let error: Error | undefined

  const before = process.hrtime()
  try {
    run(evaluation, natives, test.body.sentences)
  } catch (e) {
    error = e
  }
  const delta = process.hrtime(before)

  return {
    evaluation,
    error,
    duration: round(delta[0] * 1e3 + delta[1] / 1e6),
  }
}

// TODO: Add some unit tests.
const garbageCollect = (evaluation: Evaluation) => {
  const extractIdsFromInstructions = (instructions: List<Instruction>): List<Id> => {
    return instructions.flatMap(instruction => {
      if(instruction.kind === 'PUSH') return [instruction.id]
      if(instruction.kind === 'LOAD' && instruction.lazyInitialization) return extractIdsFromInstructions(instruction.lazyInitialization)
      return []
    })
  }

  const marked = new Set<Context>()
  const pending = [
    evaluation.rootContext(),
    ... evaluation.listFrames().flatMap(({ operandStack, context, instructions }) => [
      context,
      ...operandStack.map(id => evaluation.maybeInstance(id)),
      ...extractIdsFromInstructions(instructions).map(id => evaluation.maybeInstance(id)),
    ]),
  ]

  while(pending.length) {
    const next = pending.shift()
    if(next && !marked.has(next)) {
      marked.add(next)

      pending.push(
        ... next.parent ? [next.parent] : [],
        ...[...next.locals.values()].map(id => evaluation.instance(id)),
      )

      if(next instanceof RuntimeObject && isArray(next?.innerValue)) pending.push(...next!.innerValue.map(id => evaluation.instance(id)))
    }
  }

  for(const instance of evaluation.listInstances())
    if(!marked.has(instance)) {
      evaluation.destroyInstance(instance.id)
    }
}

// TODO: Refactor this interface
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (environment: Environment, natives: Natives) => ({

  buildEvaluation: () => buildEvaluation(environment),

  step: step(natives),

  stepAll: stepAll(natives),

  sendMessage: (message: string, receiver: Id, ...args: Id[]) => (evaluation: Evaluation) => {
    const takeStep = step(natives)
    const initialFrameCount = evaluation.stackDepth()

    evaluation.pushFrame(new Frame(
      new Context(evaluation, evaluation.instance(receiver)),
      [
        PUSH(receiver),
        ...args.map(PUSH),
        CALL(message, args.length),
        RETURN,
      ]))

    // TODO: stepAll?
    do {
      takeStep(evaluation)
    } while (evaluation.stackDepth() > initialFrameCount)
  },

  runProgram: (fullyQualifiedName: Name, evaluation?: Evaluation): void => {
    const programSentences = environment.getNodeByFQN<'Program'>(fullyQualifiedName).body.sentences

    log.start('Initializing Evaluation')
    const initializedEvaluation = evaluation || buildEvaluation(environment)
    stepAll(natives)(initializedEvaluation)
    log.done('Initializing Evaluation')

    log.info('Running program', fullyQualifiedName)
    run(initializedEvaluation, natives, programSentences)
    log.success('Done!')
  },

  runTest: (evaluation: Evaluation, test: Test): TestResult => runTest(evaluation, natives, test),

  runTests: (tests: List<Test>): Record<Name, TestResult> => {
    log.start('Initializing Evaluation')
    const evaluation = buildEvaluation(environment)
    stepAll(natives)(evaluation)
    evaluation.popFrame()
    log.done('Initializing Evaluation')

    garbageCollect(evaluation)

    return zipObj(
      tests.map(test => test.fullyQualifiedName()),
      tests.map(test => runTest(evaluation.copy(), natives, test))
    )
  },

  garbageCollect,
})