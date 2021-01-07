import { last, get } from './extensions'
import { is, Node, Body, Environment, Expression, Id, List, Module, Name, NamedArgument, Variable, Singleton, Field, isNode, Method } from './model'
import { v4 as uuid } from 'uuid'
import { Logger, nullLogger } from './log'

// TODO:
// - evaluation.instance(evaluation.environment.getNodeByFQN('x').id) ===> evaluation.instance('x')
// - Split this file in smaller more manageable pieces.

// TODO: Create tickets:
// - Create and use toJSON / fromJSON methods on runtime model and use it to replace the test metrics
// - More step methods: stepThrough, for example. Step to get inside closure?
// - Create facade service that generates single, meaningful results, hiding the evaluation complexity:
//    - run tests
//    - run programs
//    - send a message and obtain result

const { isArray } = Array
const { assign, keys } = Object

export type NativeFunction = (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => void
export interface Natives { [name: string]: NativeFunction | Natives }

export type Locals = Map<Name, RuntimeObject | LazyInitializer | undefined>

const NULL_ID = 'null'
const TRUE_ID = 'true'
const FALSE_ID = 'false'

const COPY = Symbol('copy')
const CREATE_OR_RETRIEVE = Symbol('createOrRetrieve')

// TODO: Receive these as arguments, but have a default
export const DECIMAL_PRECISION = 5
export const MAX_FRAME_STACK_SIZE = 1000
export const MAX_OPERAND_STACK_SIZE = 10000

export class WollokError extends Error { constructor(readonly moduleFQN: Name) { super(moduleFQN) } }
export class WollokUnrecoverableError extends Error { }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Evaluation {
  log: Logger
  readonly environment: Environment
  readonly rootContext: Context
  readonly frameStack: Stack<Frame>
  readonly natives: Natives
  protected readonly instanceCache: Map<Id, RuntimeObject>

  get currentFrame(): Frame | undefined { return this.frameStack.top }
  get currentContext(): Context { return this.currentFrame?.context ?? this.rootContext }
  get instances(): List<RuntimeObject> { return [...this.instanceCache.values()] }


  static create(environment: Environment, natives: Natives, stepAllInitialization = true): Evaluation {
    const rootContext = new Context()
    const evaluation = new Evaluation(environment, natives, () => rootContext)

    const globalConstants = environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
    const globalSingletons = environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)

    rootContext.set('null', RuntimeObject.null(evaluation))
    rootContext.set('true', RuntimeObject.boolean(evaluation, true))
    rootContext.set('false', RuntimeObject.boolean(evaluation, false))

    for (const module of globalSingletons)
      rootContext.set(module.fullyQualifiedName(), RuntimeObject.object(evaluation, module))

    for (const constant of globalConstants)
      rootContext.set(constant.fullyQualifiedName(), new LazyInitializer(evaluation, rootContext, constant.fullyQualifiedName(), compile(constant.value)))

    evaluation.pushFrame(new Frame(rootContext, [
      ...globalSingletons.flatMap(singleton => {
        if (singleton.supercallArgs.some(is('NamedArgument'))) {
          return [
            PUSH(singleton.id),
            INIT([]),
            CALL_CONSTRUCTOR(0, singleton.superclass()!.fullyQualifiedName(), true),
          ]
        } else {
          const args = singleton.supercallArgs as List<Expression>
          return [
            ...args.flatMap(arg => compile(arg)),
            PUSH(singleton.id),
            INIT([]),
            CALL_CONSTRUCTOR(args.length, singleton.superclass()!.fullyQualifiedName()),
          ]
        }
      }),
    ]))

    if (stepAllInitialization) {
      evaluation.log.start('Initializing Evaluation')
      evaluation.stepAll()
      evaluation.log.done('Initializing Evaluation')
    }

    return evaluation
  }


  protected constructor(
    environment: Environment,
    natives: Natives,
    rootContext: (evaluation: Evaluation) => Context,
    frameStack = (_evaluation: Evaluation) => new Stack<Frame>(MAX_FRAME_STACK_SIZE),
    instanceCache = (_evaluation: Evaluation) => new Map<Id, RuntimeObject>(),
    logger: Logger = nullLogger,
  ) {
    this.environment = environment
    this.natives = natives
    this.rootContext = rootContext(this)
    this.frameStack = frameStack(this)
    this.instanceCache = instanceCache(this)
    this.log = logger
  }


  [CREATE_OR_RETRIEVE](instance: RuntimeObject): RuntimeObject {
    const existing = this.instanceCache.get(instance.id)
    if (existing) return existing

    this.instanceCache.set(instance.id, instance)

    return instance
  }

  copy(): Evaluation {
    const cache = new Map<Id, any>()

    return new Evaluation(
      this.environment,
      this.natives,
      evaluation => this.rootContext[COPY](evaluation, cache),
      evaluation => this.frameStack.map(frame => frame[COPY](evaluation, cache)),
      evaluation => new Map([...this.instanceCache.entries()].map(([name, instance]) => [name, instance[COPY](evaluation, cache)])),
      this.log,
    )
  }

  pushFrame(frame: Frame): void { this.frameStack.push(frame) }

  popFrame(): void { this.frameStack.pop() }

  instance(id: Id): RuntimeObject {
    const response = this.instanceCache.get(id)
    if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
    return response
  }

  freeInstance(id: Id): void { this.instanceCache.delete(id) }

  invoke(methodOrMessage: Method | string, receiver: RuntimeObject, ...args: RuntimeObject[]): void {
    const method = methodOrMessage instanceof Method ? methodOrMessage : receiver.module.lookupMethod(methodOrMessage, args.length)
    if (!method) throw new Error(`Can't invoke unexistent method ${receiver.module.fullyQualifiedName()}.${methodOrMessage}/${args.length}`)
    if (method.isAbstract()) throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
    if (methodOrMessage instanceof Method && !method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

    if (method.body === 'native') {
      const nativeFQN = `${method.parent().fullyQualifiedName()}.${method.name}`
      const native = get<NativeFunction>(this.natives, nativeFQN)
      if (native) this.log.debug('Invoking Native:', nativeFQN, '/', args.length)
      else throw new Error(`Native not found: ${nativeFQN}`)
      native(receiver, ...args)(this)
    } else {
      this.pushFrame(new Frame(
        receiver,
        compile(method),
        new Map(method.parameters.map(({ name, isVarArg }, index) => [name,
          isVarArg
            ? RuntimeObject.list(this, args.slice(index).map(({ id }) => id))
            : args[index],
        ]))
      ))
    }
  }

  raise(exception: RuntimeObject): void {
    while (!this.frameStack.isEmpty()) {
      const currentFrame = this.currentFrame!

      while (currentFrame.hasNestedContext()) {
        if (currentFrame.context.exceptionHandlerIndex !== undefined) {
          currentFrame.jumpTo(currentFrame.context.exceptionHandlerIndex)
          currentFrame.popContext()
          currentFrame.pushOperand(exception)
          return
        }

        currentFrame.popContext()
      }

      this.popFrame()
    }

    throw new WollokUnrecoverableError(`Reached end of stack with unhandled exception ${exception.module.fullyQualifiedName()}: ${exception.get('message')?.innerValue}`)
  }

  stepInto(): void {
    this.log.step(this)
    step(this)
  }

  stepOut(): void {
    const initialFrameDepth = this.frameStack.depth
    do {
      this.stepInto()
    } while (this.frameStack.depth >= initialFrameDepth)
  }

  /** Takes all possible steps, until the last frame has no pending instructions and then drops that frame */
  stepAll(): void {
    while (!this.currentFrame!.isFinished()) this.stepInto()
    this.popFrame()
  }

  // TODO: stepThrough
  // TODO: stepIn === step
  // TODO: stepOver

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STACKS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Stack<T> {
  protected readonly maxSize: number
  protected readonly elements: T[] = []

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get depth(): number { return this.elements.length }

  get top(): T | undefined { return last(this.elements) }

  *[Symbol.iterator](): Iterator<T> { yield* this.elements }

  isEmpty(): boolean { return !this.elements.length }

  forEach(f: (element: T) => void): void { this.elements.forEach(f) }

  map<U>(tx: (element: T) => U): Stack<U> {
    const response = new Stack<U>(this.maxSize)
    response.unshift(...this.elements.map(tx))
    return response
  }

  unshift(...elements: T[]): void {
    if (this.maxSize! < this.elements.length + elements.length)
      throw new WollokError('wollok.lang.StackOverflowException')

    this.elements.unshift(...elements)
  }

  push(...elements: T[]): void {
    if (this.maxSize! < this.elements.length + elements.length)
      throw new WollokError('wollok.lang.StackOverflowException')

    this.elements.push(...elements)
  }

  pop(): T {
    if (!this.elements.length) throw new Error('Stack underflow')
    return this.elements.pop()!
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FRAMES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Frame {
  readonly operandStack = new Stack<RuntimeObject | undefined>(MAX_OPERAND_STACK_SIZE)
  readonly instructions: List<Instruction>
  readonly baseContext: Context
  protected pc = 0
  protected currentContext: Context

  get nextInstructionIndex(): number { return this.pc }
  get context(): Context { return this.currentContext }


  [COPY](evaluation: Evaluation, cache: Map<Id, any>): Frame {
    const copy = new Frame(this.context[COPY](evaluation, cache), this.instructions)

    assign(copy, { currentContext: copy.context.parentContext, initialContext: copy.context.parentContext })
    copy.operandStack.unshift(...this.operandStack.map(operand => operand?.[COPY](evaluation, cache)))
    copy.pc = this.pc

    return copy
  }


  constructor(parentContext: Context, instructions: List<Instruction>, locals: Locals = new Map()) {
    this.baseContext = new Context(parentContext)
    this.currentContext = this.baseContext
    this.instructions = instructions

    locals.forEach((instance, name) => this.baseContext.set(name, instance))
  }


  isFinished(): boolean { return this.pc >= this.instructions.length }

  hasNestedContext(): boolean { return this.context !== this.baseContext }

  pushOperand(operand: RuntimeObject | undefined): void {
    this.operandStack.push(operand)
  }

  popOperand(): RuntimeObject | undefined {
    return this.operandStack.pop()
  }

  pushContext(exceptionHandlerIndex?: number): void {
    this.currentContext = new Context(this.currentContext, exceptionHandlerIndex)
  }

  popContext(): void {
    if (!this.hasNestedContext()) throw new Error('Popped frame base context')
    this.currentContext = this.currentContext.parentContext!
  }

  takeNextInstruction(): Instruction {
    if (this.isFinished()) throw new Error('Reached end of instructions')
    return this.instructions[this.pc++]
  }

  jump(instructionDelta: number): void {
    this.jumpTo(this.pc + instructionDelta)
  }

  jumpTo(instructionIndex: number): void {
    if (instructionIndex < 0 || instructionIndex >= this.instructions.length)
      throw new Error(`Out of range jump to instruction index ${instructionIndex}`)

    this.pc = instructionIndex
  }

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Context {
  readonly id: Id
  readonly parentContext?: Context
  readonly locals: Locals = new Map()
  readonly exceptionHandlerIndex?: number

  constructor(parent?: Context, exceptionHandlerIndex?: number, id: Id = uuid()) {
    this.parentContext = parent
    this.exceptionHandlerIndex = exceptionHandlerIndex
    this.id = id
  }

  [COPY](evaluation: Evaluation, cache: Map<Id, any>): Context {
    const cached = cache.get(this.id)
    if (cached) return cached

    const copy = new Context(
      this.parentContext?.[COPY](evaluation, cache),
      this.exceptionHandlerIndex,
      this.id,
    )

    cache.set(this.id, copy)

    this.locals.forEach((local, name) => copy.locals.set(name, local?.[COPY](evaluation, cache)))

    return copy
  }

  get(local: Name): RuntimeObject | undefined {
    return (this.locals.get(local) ?? this.parentContext?.get(local))?.materialize()
  }

  set(local: Name, value: RuntimeObject | LazyInitializer | undefined): void {
    this.locals.set(local, value)
  }

  contextHierarchy(): List<Context> {
    return [this, ...this.parentContext?.contextHierarchy() ?? []]
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNTIME OBJECTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type InnerValue = string | number | Id[]

export class RuntimeObject extends Context {
  readonly parentContext!: Context
  readonly module: Module
  readonly innerValue?: InnerValue

  static null(evaluation: Evaluation): RuntimeObject {
    return evaluation[CREATE_OR_RETRIEVE](
      new RuntimeObject(
        evaluation.currentContext,
        evaluation.environment.getNodeByFQN('wollok.lang.Object'),
        undefined,
        NULL_ID,
      )
    )
  }

  static boolean(evaluation: Evaluation, value: boolean): RuntimeObject {
    return evaluation[CREATE_OR_RETRIEVE](
      new RuntimeObject(
        evaluation.currentContext,
        evaluation.environment.getNodeByFQN('wollok.lang.Boolean'),
        undefined,
        value ? TRUE_ID : FALSE_ID,
      )
    )
  }

  static number(evaluation: Evaluation, value: number): RuntimeObject {
    const stringValue = value.toFixed(DECIMAL_PRECISION)
    const id = `N!${stringValue}`

    return evaluation[CREATE_OR_RETRIEVE](
      new RuntimeObject(
        evaluation.rootContext,
        evaluation.environment.getNodeByFQN('wollok.lang.Number'),
        Number(stringValue),
        id,
      )
    )
  }

  static string(evaluation: Evaluation, value: string): RuntimeObject {
    return evaluation[CREATE_OR_RETRIEVE](
      new RuntimeObject(
        evaluation.rootContext,
        evaluation.environment.getNodeByFQN('wollok.lang.String'),
        value,
        `S!${value}`,
      )
    )
  }

  static list(evaluation: Evaluation, elements: List<Id>): RuntimeObject {
    return evaluation[CREATE_OR_RETRIEVE](
      new RuntimeObject(
        evaluation.currentContext,
        evaluation.environment.getNodeByFQN('wollok.lang.List'),
        [...elements],
      )
    )
  }

  static set(evaluation: Evaluation, elements: List<Id>): RuntimeObject {
    return evaluation[CREATE_OR_RETRIEVE](
      new RuntimeObject(
        evaluation.currentContext,
        evaluation.environment.getNodeByFQN('wollok.lang.Set'),
        [...elements],
      )
    )
  }

  static object(evaluation: Evaluation, moduleOrFQN: Module | Name, locals: Record<Name, RuntimeObject | undefined> = {}): RuntimeObject {
    const module = isNode(moduleOrFQN) ? moduleOrFQN : evaluation.environment.getNodeByFQN<'Module'>(moduleOrFQN)
    const instance = new RuntimeObject(
      evaluation.currentContext,
      module,
      undefined,
      module.is('Describe') || module.is('Singleton') && !!module.name ? module.id : undefined
    )

    for (const local of keys(locals)) instance.set(local, locals[local])

    return evaluation[CREATE_OR_RETRIEVE](instance)
  }

  protected constructor(parent: Context, module: Module, innerValue?: InnerValue, id?: Id) {
    super(parent, undefined, id)

    this.module = module
    this.innerValue = innerValue

    this.locals.set('self', this)
  }

  [COPY](evaluation: Evaluation, cache: Map<Id, any>): RuntimeObject {
    const cached = cache.get(this.id)
    if (cached) return cached

    const copy = new RuntimeObject(
      this.parentContext[COPY](evaluation, cache),
      this.module,
      isArray(this.innerValue) ? [...this.innerValue] : this.innerValue,
      this.id,
    )

    cache.set(this.id, copy)

    this.locals.forEach((local, name) => copy.locals.set(name, local?.[COPY](evaluation, cache)))

    return copy
  }

  materialize(): RuntimeObject | undefined { return this }

  assertIsNumber(): asserts this is RuntimeObject & { innerValue: number } { this.assertIs('wollok.lang.Number', 'number') }

  assertIsString(): asserts this is RuntimeObject & { innerValue: string } { this.assertIs('wollok.lang.String', 'string') }

  assertIsCollection(): asserts this is RuntimeObject & { innerValue: Id[] } {
    if (!isArray(this.innerValue) || this.innerValue.length && typeof this.innerValue[0] !== 'string')
      throw new TypeError(`Malformed Runtime Object: Collection inner value should be a List<Id> but was ${this.innerValue}`)
  }

  protected assertIs(moduleFQN: Name, innerValueType: string): void {
    if (this.module.fullyQualifiedName() !== moduleFQN)
      throw new TypeError(`Expected an instance of ${moduleFQN} but got a ${this.module.fullyQualifiedName()} instead`)
    if (typeof this.innerValue !== innerValueType)
      throw new TypeError(`Malformed Runtime Object: invalid inner value ${this.innerValue} for ${moduleFQN} instance`)
  }
}

export class LazyInitializer {
  constructor(
    protected readonly evaluation: Evaluation,
    readonly context: Context,
    readonly local: Name,
    readonly instructions: List<Instruction>,
  ) { }

  [COPY](evaluation: Evaluation, cache: Map<Id, Context>): LazyInitializer {
    return new LazyInitializer(evaluation, this.context[COPY](evaluation, cache), this.local, this.instructions)
  }

  materialize(): RuntimeObject | undefined {
    this.evaluation.log.info('Materializing lazy initializer of', this.local)
    const frame = new Frame(this.context, this.instructions)
    this.evaluation.pushFrame(frame)
    this.evaluation.stepAll()

    const value = frame.popOperand()

    this.evaluation.log.info('Materialized lazy initializer of', this.local, 'to', value?.id)

    this.context.set(this.local, value)
    return value
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Instruction
  = { kind: 'LOAD', name: Name }
  | { kind: 'STORE', name: Name, lookup: boolean }
  | { kind: 'PUSH', id?: Id }
  | { kind: 'POP' }
  | { kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta?: number }
  | { kind: 'POP_CONTEXT' }
  | { kind: 'SWAP', distance: number }
  | { kind: 'DUP' }
  | { kind: 'INSTANTIATE', moduleFQN: Name, innerValue?: InnerValue }
  | { kind: 'INHERITS', moduleFQN: Name }
  | { kind: 'JUMP', count: number }
  | { kind: 'CONDITIONAL_JUMP', count: number }
  | { kind: 'CALL', message: Name, arity: number, lookupStartFQN?: Name }
  | { kind: 'CALL_CONSTRUCTOR', arity: number, lookupStart: Name, optional?: boolean }
  | { kind: 'INIT', argumentNames: List<Name> }
  | { kind: 'INTERRUPT' }
  | { kind: 'RETURN' }

export const LOAD = (name: Name): Instruction => ({ kind: 'LOAD', name })
export const STORE = (name: Name, lookup: boolean): Instruction => ({ kind: 'STORE', name, lookup })
export const PUSH = (id?: Id): Instruction => ({ kind: 'PUSH', id })
export const POP: Instruction = { kind: 'POP' }
export const PUSH_CONTEXT = (exceptionHandlerIndexDelta?: number): Instruction => ({ kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta })
export const POP_CONTEXT: Instruction = { kind: 'POP_CONTEXT' }
export const SWAP = (distance = 0): Instruction => ({ kind: 'SWAP', distance })
export const DUP: Instruction = { kind: 'DUP' }
export const INSTANTIATE = (module: Name, innerValue?: InnerValue): Instruction => ({ kind: 'INSTANTIATE', moduleFQN: module, innerValue })
export const INHERITS = (module: Name): Instruction => ({ kind: 'INHERITS', moduleFQN: module })
export const JUMP = (count: number): Instruction => ({ kind: 'JUMP', count })
export const CONDITIONAL_JUMP = (count: number): Instruction => ({ kind: 'CONDITIONAL_JUMP', count })
export const CALL = (message: Name, arity: number, lookupStartFQN?: Name): Instruction => ({ kind: 'CALL', message, arity, lookupStartFQN })
export const CALL_CONSTRUCTOR = (arity: number, lookupStart: Name, optional = false): Instruction => ({ kind: 'CALL_CONSTRUCTOR', arity, lookupStart, optional })
export const INIT = (argumentNames: List<Name>): Instruction => ({ kind: 'INIT', argumentNames })
export const INTERRUPT: Instruction = { kind: 'INTERRUPT' }
export const RETURN: Instruction = { kind: 'RETURN' }


export const compile = (node: Node): List<Instruction> => {

  const compileExpressionClause = ({ sentences }: Body): List<Instruction> =>
    sentences.length ? sentences.flatMap((sentence, index) => [
      ...compile(sentence),
      ...index < sentences.length - 1 ? [POP] : [],
    ]) : [PUSH()]

  return node.match({

    Variable: node => [
      ...compile(node.value),
      STORE(node.name, false),
      PUSH(),
    ],


    Return: node => [
      ...node.value
        ? compile(node.value)
        : [PUSH()],
      RETURN,
    ],


    Assignment: node => [
      ...compile(node.value),
      STORE(node.variable.name, true),
      PUSH(),
    ],

    Self: () => [
      LOAD('self'),
    ],


    Reference: node => {
      const target = node.target()!

      return [
        LOAD(target.is('Module') || target.is('Variable') && target.parent().is('Package')
          ? target.fullyQualifiedName()
          : node.name
        ),
      ]
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
            ...supercallArgs.flatMap(({ value }) => compile(value)),
            INSTANTIATE(node.value.fullyQualifiedName()),
            INIT(supercallArgs.map(({ name }) => name)),
            CALL_CONSTRUCTOR(0, node.value.superclass()!.fullyQualifiedName(), true),
          ]
        } else {
          const supercallArgs = node.value.supercallArgs as List<Expression>
          return [
            ...supercallArgs.flatMap(arg => compile(arg)),
            INSTANTIATE(node.value.fullyQualifiedName()),
            INIT([]),
            CALL_CONSTRUCTOR(node.value.supercallArgs.length, node.value.superclass()!.fullyQualifiedName()),
          ]
        }
      }

      const args = node.value.args as List<Expression>
      return [
        INSTANTIATE(node.value.instantiated.name, []),
        INIT([]),
        CALL_CONSTRUCTOR(0, node.value.instantiated.name),
        ...args.flatMap(arg => [
          DUP,
          ...compile(arg),
          CALL('add', 1),
          POP,
        ]),
      ]
    },


    Send: node => [
      ...compile(node.receiver),
      ...node.args.flatMap(arg => compile(arg)),
      CALL(node.message, node.args.length),
    ],


    Super: node => {
      const currentMethod = node.ancestors().find(is('Method'))!
      return [
        LOAD('self'),
        ...node.args.flatMap(arg => compile(arg)),
        CALL(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName()),
      ]
    },


    New: node => {
      const fqn = node.instantiated.target()!.fullyQualifiedName()

      if ((node.args as any[]).some(arg => arg.is('NamedArgument'))) {
        const args = node.args as List<NamedArgument>

        return [
          ...args.flatMap(({ value }) => compile(value)),
          INSTANTIATE(fqn),
          INIT(args.map(({ name }) => name)),
          CALL_CONSTRUCTOR(0, fqn, true),
        ]
      } else {
        return [
          ...(node.args as List<Expression>).flatMap(arg => compile(arg)),
          INSTANTIATE(fqn),
          INIT([]),
          CALL_CONSTRUCTOR(node.args.length, fqn),
        ]
      }
    },


    If: node => {
      const thenClause = compileExpressionClause(node.thenBody)
      const elseClause = compileExpressionClause(node.elseBody)
      return [
        ...compile(node.condition),
        PUSH_CONTEXT(),
        CONDITIONAL_JUMP(elseClause.length + 1),
        ...elseClause,
        JUMP(thenClause.length),
        ...thenClause,
        POP_CONTEXT,
      ]
    },


    Throw: node => [
      ...compile(node.exception),
      INTERRUPT,
    ],


    Try: node => {
      const clause = compileExpressionClause(node.body)

      const always = [
        ...compileExpressionClause(node.always),
        POP,
      ]

      const catches = node.catches.flatMap(({ parameter, parameterType, body }) => {
        const handler = compileExpressionClause(body)
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
        PUSH(),
        STORE('<result>', false),

        PUSH_CONTEXT(clause.length + 3),
        ...clause,
        STORE('<result>', true),
        POP_CONTEXT,
        JUMP(catches.length + 3),

        STORE('<exception>', false),
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


    Method: node => {
      if (!node.body) throw new Error(`Can't compile abstract method ${node.name}`)
      if (node.body === 'native') throw new Error(`Can't compile native method ${node.name}`)
      return [
        ...compile(node.body),
        PUSH(),
        RETURN,
      ]
    },

    Program: node => compile(node.body),

    Test: node => compile(node.body),

    Constructor: node => {
      const constructorClass = node.parent()
      return [
        ...node.baseCall && constructorClass.superclass() ? [
          ...node.baseCall.args.flatMap(arg => compile(arg)),
          LOAD('self'),
          CALL_CONSTRUCTOR(
            node.baseCall.args.length,
            node.baseCall.callsSuper
              ? constructorClass.superclass()!.fullyQualifiedName()
              : constructorClass.fullyQualifiedName(),
            true,
          ),
        ] : [],
        ...compile(node.body),
        LOAD('self'),
        CALL('initialize', 0),
        LOAD('self'),
        RETURN,
      ]
    },

    Fixture: node => compile(node.body),

    Body: node => node.sentences.flatMap(compile),

    Node: () => { throw new Error(`Can't compile ${node.kind} node`) },
  })
}


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EXECUTION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const step = (evaluation: Evaluation): void => {
  const { environment } = evaluation

  const currentFrame = evaluation.currentFrame
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.takeNextInstruction()

  try {
    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const { name } = instruction
        currentFrame.pushOperand(currentFrame.context.get(name))
      })()


      case 'STORE': return (() => {
        const { name, lookup } = instruction
        const value = currentFrame.popOperand()

        const currentContext = currentFrame.context
        let context: Context | undefined = currentContext
        if (lookup) {
          while (context && !context.locals.has(name)) {
            context = context.parentContext
          }
        }

        (context ?? currentContext).set(name, value)
      })()


      case 'PUSH': return (() => {
        const { id } = instruction
        currentFrame.pushOperand(id ? evaluation.instance(id) : undefined)
      })()


      case 'POP': return (() => {
        currentFrame.popOperand()
      })()


      case 'PUSH_CONTEXT': return (() => {
        const { exceptionHandlerIndexDelta } = instruction
        currentFrame.pushContext(exceptionHandlerIndexDelta
          ? currentFrame.nextInstructionIndex + exceptionHandlerIndexDelta
          : undefined
        )
      })()


      case 'POP_CONTEXT': return (() => {
        currentFrame.popContext()
      })()


      case 'SWAP': return (() => {
        const { distance } = instruction
        const a = currentFrame.popOperand()
        const others = new Array(distance).fill(null).map(() => currentFrame.popOperand()).reverse()
        const b = currentFrame.popOperand()

        currentFrame.pushOperand(a)
        others.forEach(operand => currentFrame.pushOperand(operand))
        currentFrame.pushOperand(b)
      })()

      case 'DUP': return (() => {
        const operand = currentFrame.popOperand()
        currentFrame.pushOperand(operand)
        currentFrame.pushOperand(operand)
      })()

      case 'INSTANTIATE': return (() => {
        const { moduleFQN, innerValue } = instruction
        const instance =
          moduleFQN === 'wollok.lang.String' ? RuntimeObject.string(evaluation, `${innerValue}`) :
          moduleFQN === 'wollok.lang.Number' ? RuntimeObject.number(evaluation, Number(innerValue)) :
          moduleFQN === 'wollok.lang.List' ? RuntimeObject.list(evaluation, innerValue as Id[]) :
          moduleFQN === 'wollok.lang.Set' ? RuntimeObject.set(evaluation, innerValue as Id[]) :
          RuntimeObject.object(evaluation, moduleFQN)

        currentFrame.pushOperand(instance)
      })()

      case 'INHERITS': return (() => {
        const { moduleFQN } = instruction
        const self = currentFrame.popOperand()!
        const inherits = self.module.inherits(environment.getNodeByFQN(moduleFQN))
        currentFrame.pushOperand(RuntimeObject.boolean(evaluation, inherits))
      })()

      case 'JUMP': return (() => {
        const { count } = instruction
        currentFrame.jump(count)
      })()

      case 'CONDITIONAL_JUMP': return (() => {
        const { count } = instruction
        const check = currentFrame.popOperand()

        if (check?.id === TRUE_ID) return currentFrame.jump(count)
        if (check?.id !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
      })()


      case 'CALL': return (() => {
        const { message, arity, lookupStartFQN } = instruction
        const args = Array.from({ length: arity }, () => currentFrame.popOperand()!).reverse()
        const self = currentFrame.popOperand()!
        const method = self.module.lookupMethod(message, arity, lookupStartFQN)

        if (method) evaluation.invoke(method, self, ...args)
        else {
          evaluation.log.warn('Method not found:', lookupStartFQN ?? self.module.fullyQualifiedName(), '>>', message, '/', arity)
          evaluation.invoke(
            'messageNotUnderstood',
            self,
            RuntimeObject.string(evaluation, message),
            RuntimeObject.list(evaluation, args.map(({ id }) => id)),
          )
        }
      })()


      case 'CALL_CONSTRUCTOR': return (() => {
        const { arity, lookupStart, optional } = instruction
        const self = currentFrame.popOperand()!
        const args = Array.from({ length: arity }, () => currentFrame.popOperand()!).reverse()
        const argIds = args.map(({ id }) => id)
        const lookupStartClass = environment.getNodeByFQN<'Class'>(lookupStart)
        const constructor = lookupStartClass.lookupConstructor(arity)

        if (!constructor) {
          if (optional) return evaluation.currentFrame?.pushOperand(self)
          else throw new Error(`Missing constructor/${arity} on ${lookupStartClass.fullyQualifiedName()}`)
        }

        evaluation.pushFrame(new Frame(
          self,
          compile(constructor),
          new Map(constructor.parameters.map(({ name, isVarArg }, index) =>
            [name, isVarArg ? RuntimeObject.list(evaluation, argIds.slice(index)) : args[index]]
          ))
        ))
      })()


      case 'INIT': return (() => {
        const { argumentNames } = instruction
        const self = currentFrame.popOperand()!

        if(self.module.is('Describe')) {
          for (const variable of self.module.variables()) self.set(variable.name, undefined)

          return evaluation.pushFrame(new Frame(self, [
            ...self.module.variables().flatMap(field => [
              ...compile(field.value),
              STORE(field.name, true),
            ]),
            LOAD('self'),
            RETURN,
          ]))
        }

        const fields: List<Field> = self.module.hierarchy().flatMap(module => module.fields())

        for (const field of fields)
          self.set(field.name, undefined)

        for (const name of [...argumentNames].reverse())
          self.set(name, currentFrame.popOperand())

        if(self.module.is('Singleton')) {

          if(!self.module.name) return evaluation.pushFrame(new Frame(self, [
            ...fields.filter(field => !argumentNames.includes(field.name)).flatMap(field => [
              ...compile(field.value),
              STORE(field.name, true),
            ]),
            LOAD('self'),
            RETURN,
          ]))

          for(const field of fields) {
            const defaultValue = (self.module.supercallArgs as List<NamedArgument>).find(arg => arg.is('NamedArgument') && arg.name === field.name)
            self.set(field.name, new LazyInitializer(evaluation, self, field.name, compile(defaultValue?.value ?? field.value)))
          }
        } else {
          for(const field of fields)
            if(!argumentNames.includes(field.name))
              self.set(field.name, new LazyInitializer(evaluation, self, field.name, compile(field.value)))
        }


        evaluation.currentFrame!.pushOperand(self)
      })()


      case 'INTERRUPT': return (() => {
        const exception = currentFrame.popOperand()!
        evaluation.raise(exception)
      })()


      case 'RETURN': return (() => {
        const value = currentFrame.popOperand()
        evaluation.popFrame()

        const next = evaluation.currentFrame
        if (!next) throw new Error('Returning from last frame')

        next.pushOperand(value)
      })()

    }
  } catch (error) {
    evaluation.log.error(error)

    if(error instanceof WollokUnrecoverableError) throw error

    const exceptionType = error instanceof WollokError ? error.moduleFQN : 'wollok.lang.EvaluationError'
    const message = error.message ? RuntimeObject.string(evaluation, error.message) : undefined
    evaluation.raise(RuntimeObject.object(evaluation, exceptionType, { message }))
  }

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GC
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// TODO: Add some unit tests.
export const garbageCollect = (evaluation: Evaluation): void => {
  const extractIdsFromInstructions = (instructions: List<Instruction>): List<Id> => {
    return instructions.flatMap(instruction => {
      if (instruction.kind === 'PUSH') return instruction.id ? [] : [instruction.id!]
      return []
    })
  }

  const marked = new Set<Context>()
  const pending: (Context | LazyInitializer | undefined)[] = [
    evaluation.rootContext,
    ...[...evaluation.frameStack].flatMap(({ operandStack, context, instructions }) => [
      context,
      ...operandStack,
      ...extractIdsFromInstructions(instructions).map(id => evaluation.instance(id)),
    ]),
  ]

  while (pending.length) {
    const next = pending.shift()
    if (next && !(next instanceof LazyInitializer) && !marked.has(next)) {
      marked.add(next)

      pending.push(
        ...next.parentContext ? [next.parentContext] : [],
        ...next.locals.values(),
      )

      if (next instanceof RuntimeObject && isArray(next?.innerValue)) pending.push(...next!.innerValue.map(id => evaluation.instance(id)))
    }
  }

  for (const instance of evaluation.instances)
    if (!marked.has(instance)) {
      evaluation.freeInstance(instance.id)
    }
}