import { last, get } from '../extensions'
import { is, Node, Environment, Expression, Id, List, Module, Name, Variable, Singleton, isNode, Method } from '../model'
import { v4 as uuid } from 'uuid'
import { Logger, nullLogger } from './log'
import compile, { PUSH, INIT, Instruction, NULL_ID, TRUE_ID, FALSE_ID } from './compiler'
import takeStep from './interpreter'

const { isArray } = Array
const { assign, keys } = Object

export type Locals = Map<Name, RuntimeObject | LazyInitializer | undefined>
export type NativeFunction = (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => void
export interface Natives { [name: string]: NativeFunction | Natives }


const DECIMAL_PRECISION = 5
const MAX_FRAME_STACK_SIZE = 1000
const MAX_OPERAND_STACK_SIZE = 10000


const COPY = Symbol('copy')
const CREATE_OR_RETRIEVE = Symbol('createOrRetrieve')

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ERRORS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

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
          ]
        } else {
          const args = singleton.supercallArgs as List<Expression>
          return [
            ...args.flatMap(arg => compile(arg)),
            PUSH(singleton.id),
            INIT([]),
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

  stepIn(): void {
    this.log.step(this)
    takeStep(this)
  }

  stepOut(): void {
    const initialFrameDepth = this.frameStack.depth
    do {
      this.stepIn()
    } while (this.frameStack.depth >= initialFrameDepth)
  }

  stepOver(): void {
    const initialFrameDepth = this.frameStack.depth
    do {
      this.stepIn()
    } while (this.frameStack.depth > initialFrameDepth)
  }

  /** Takes all possible steps, until the last frame has no pending instructions and then drops that frame */
  stepAll(): void {
    while (!this.currentFrame!.isFinished()) this.stepIn()
    this.popFrame()
  }

  // TODO: stepThrough
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
    const module = isNode(moduleOrFQN) ? moduleOrFQN : evaluation.environment.getNodeByFQN<Module>(moduleOrFQN)
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