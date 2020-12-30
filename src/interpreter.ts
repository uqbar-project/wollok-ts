import { last, get } from './extensions'
import { is, Node, Body, Environment, Expression, Id, List, Module, Name, NamedArgument, Sentence, Variable, Singleton, Field, isNode, Method } from './model'
import { v4 as uuid } from 'uuid'
import { Logger, nullLogger } from './log'

// TODO: Wishlist
// - Rethink tests
// - More Instructions to simplify natives.
//    - Something to iterate list elements instead of mapping them?
//    - Rewrite long and complex natives and try so simplify them. Ensure test coverage.
// - Avoid trailing instructions for methods and tests when possible (return void), etc.
// - Split this file in smaller more manageable pieces.

// TODO: Create tickets:
// - More step methods: stepThrough, for example. Step to get inside closure?
// - Create facade service that generates single, meaningful results, hiding the evaluation complexity:
//    - run tests
//    - run programs
//    - send a message and obtain result

const { isArray } = Array
const { assign, keys } = Object

export type NativeFunction = (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => void
export interface Natives { [name: string]: NativeFunction | Natives }

export type Locals = Map<Name, RuntimeObject | undefined>

const NULL_ID = 'null'
const TRUE_ID = 'true'
const FALSE_ID = 'false'

// TODO: Receive these as arguments, but have a default
export const DECIMAL_PRECISION = 5
export const MAX_FRAME_STACK_SIZE = 1000
export const MAX_OPERAND_STACK_SIZE = 10000

export class WollokError extends Error {
  constructor(readonly moduleFQN: Name) { super(moduleFQN) }
}

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
  protected readonly codeCache: Map<Id, List<Instruction>>

  // TODO: currentFrame?
  get currentContext(): Context { return this.frameStack.top?.context ?? this.rootContext }
  get instances(): List<RuntimeObject> { return [...this.instanceCache.values()] }


  static create(environment: Environment, natives: Natives, stepAllInitialization = true): Evaluation {
    const rootContext = new Context()
    const evaluation = new Evaluation(environment, natives, rootContext)

    const globalConstants = environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
    const globalSingletons = environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)

    rootContext.set('null', RuntimeObject.null(evaluation))
    rootContext.set('true', RuntimeObject.boolean(evaluation, true))
    rootContext.set('false', RuntimeObject.boolean(evaluation, false))

    for (const module of globalSingletons)
      rootContext.set(module.fullyQualifiedName(), RuntimeObject.object(evaluation, module))

    for (const constant of globalConstants) {
      rootContext.set(constant.fullyQualifiedName(), RuntimeObject.lazy(evaluation, constant.value))
    }

    evaluation.frameStack.push(new Frame(rootContext, [
      ...globalSingletons.flatMap(singleton => {
        if (singleton.supercallArgs.some(is('NamedArgument'))) {
          const args = singleton.supercallArgs as List<NamedArgument>
          return [
            ...args.flatMap(({ value }) => compileSentence(environment)(value)),
            PUSH(singleton.id),
            INIT(args.map(({ name }) => name)),
            CALL_CONSTRUCTOR(0, singleton.superclass()!.fullyQualifiedName(), true),
          ]
        } else {
          const args = singleton.supercallArgs as List<Expression>
          return [
            ...args.flatMap(arg => compileSentence(environment)(arg)),
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

  static _retrieveInstanceOrSaveDefault(evaluation: Evaluation, instance: RuntimeObject): RuntimeObject {
    const existing = evaluation.instanceCache.get(instance.id)
    if (existing) return existing

    evaluation.instanceCache.set(instance.id, instance)

    return instance
  }


  protected constructor(
    environment: Environment,
    natives: Natives,
    rootContext: Context,
    frameStack = new Stack<Frame>(MAX_FRAME_STACK_SIZE),
    instanceCache = new Map<Id, RuntimeObject>(),
    code = new Map<Id, List<Instruction>>(),
    logger: Logger = nullLogger,
  ) {
    this.environment = environment
    this.natives = natives
    this.rootContext = rootContext
    this.frameStack = frameStack
    this.instanceCache = instanceCache
    this.codeCache = code
    this.log = logger
  }


  copy(): Evaluation {
    const cache = new Map<Id, any>()

    return new Evaluation(
      this.environment,
      this.natives,
      Context._copy(this.rootContext, cache),
      this.frameStack.map(frame => Frame._copy(frame, cache)),
      new Map([...this.instanceCache.entries()].map(([name, instance]) => [name, RuntimeObject._copy(instance, cache)])),
      this.codeCache,
      this.log,
    )
  }

  codeFor(node: Node): List<Instruction> {
    if (!this.codeCache.has(node.id)) {
      const compileSentences = compileSentence(this.environment)
      if (node.is('Method') && node.body && node.body !== 'native') {
        this.codeCache.set(node.id, [
          ...compileSentences(...node.body.sentences),
          PUSH(),
          RETURN,
        ])
      } else if (node.is('Constructor')) {
        const constructorClass = node.parent()
        this.codeCache.set(node.id, [
          ...node.baseCall && constructorClass.superclass() ? [
            ...node.baseCall.args.flatMap(arg => compileSentences(arg)),
            LOAD('self'),
            CALL_CONSTRUCTOR(
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
      } else if(node.is('Sentence')) {
        this.codeCache.set(node.id, compileSentences(node))
      } else throw new Error(`Can't retrieve instructions for ${node.kind} node`)
    }

    return this.codeCache.get(node.id)!
  }

  instance(id: Id): RuntimeObject {
    const response = this.instanceCache.get(id)
    if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
    return response
  }

  freeInstance(id: Id): void { this.instanceCache.delete(id) }

  invoke(method: Method, receiver: RuntimeObject | Id, ...args: (RuntimeObject | Id)[]): void {
    if (!method.body) throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
    if (!method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

    const receiverInstance = receiver instanceof RuntimeObject ? receiver : this.instance(receiver)
    const argumentInstances = args.map(arg => arg instanceof RuntimeObject ? arg : this.instance(arg))

    if (method.body === 'native') {
      const nativeFQN = `${method.parent().fullyQualifiedName()}.${method.name}`
      const native = get<NativeFunction>(this.natives, nativeFQN)
      if (native) this.log.debug('Invoking Native:', nativeFQN, '/', args.length)
      else throw new Error(`Native not found: ${nativeFQN}`)
      native(receiverInstance, ...argumentInstances)(this)
    } else {
      this.frameStack.push(new Frame(
        receiverInstance,
        this.codeFor(method),
        new Map(method.parameters.map(({ name, isVarArg }, index) => [name,
          isVarArg
            ? RuntimeObject.list(this, argumentInstances.slice(index).map(({ id }) => id))
            : argumentInstances[index],
        ]))
      ))
    }
  }

  raise(exception: RuntimeObject): void {
    while (!this.frameStack.isEmpty()) {
      const currentFrame = this.frameStack.top!

      while (currentFrame.hasNestedContext()) {
        if (currentFrame.context.exceptionHandlerIndex !== undefined) {
          currentFrame.jumpTo(currentFrame.context.exceptionHandlerIndex)
          currentFrame.popContext()
          currentFrame.operandStack.push(exception)
          return
        }

        currentFrame.popContext()
      }

      this.frameStack.pop()
    }

    throw new Error(`Reached end of stack with unhandled exception ${exception.id}`)
  }

  step(): void { step(this) }

  /** Takes all possible steps, until the last frame has no pending instructions and then drops that frame */
  stepAll(): void {
    while (!this.frameStack.top!.isFinished()) {
      this.log.step(this)
      this.step()
    }
    this.frameStack.pop()
  }

  // TODO: stepThrough
  // TODO: stepOut
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


  static _copy(frame: Frame, cache: Map<Id, any>): Frame {
    const copy = new Frame(Context._copy(frame.context, cache), frame.instructions)
    assign(copy, { currentContext: copy.context.parentContext, initialContext: copy.context.parentContext })
    copy.operandStack.unshift(...frame.operandStack.map(operand => RuntimeObject._copy(operand, cache)))
    copy.pc = frame.pc

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


  static _copy(context: Context, cache: Map<Id, any>): Context
  static _copy(context: Context | undefined, cache: Map<Id, any>): Context | undefined
  static _copy(context: Context | undefined, cache: Map<Id, any>): Context | undefined {
    if (!context) return undefined
    if (context instanceof RuntimeObject) return RuntimeObject._copy(context, cache)

    const cached = cache.get(context.id)
    if (cached) return cached

    const copy = new Context(
      Context._copy(context.parentContext, cache),
      context.exceptionHandlerIndex,
      context.id,
    )

    cache.set(context.id, copy)

    context.locals.forEach((local, name) => copy.locals.set(name, RuntimeObject._copy(local, cache)))

    return copy
  }


  constructor(parent?: Context, exceptionHandlerIndex?: number, id: Id = uuid()) {
    this.parentContext = parent
    this.exceptionHandlerIndex = exceptionHandlerIndex
    this.id = id
  }

  get(local: Name): RuntimeObject | undefined {
    return this.locals.get(local) ?? this.parentContext?.get(local)
  }

  set(local: Name, value: RuntimeObject | undefined): void {
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
  readonly lazyInitializer?: Expression


  static _copy(instance: RuntimeObject, cache: Map<Id, any>): RuntimeObject
  static _copy(instance: RuntimeObject | undefined, cache: Map<Id, any>): RuntimeObject | undefined
  static _copy(instance: RuntimeObject | undefined, cache: Map<Id, any>): RuntimeObject | undefined {
    if (!instance) return undefined

    const cached = cache.get(instance.id)
    if (cached) return cached

    const copy = new RuntimeObject(
      Context._copy(instance.parentContext, cache),
      instance.module,
      isArray(instance.innerValue) ? [...instance.innerValue] : instance.innerValue,
      instance.id,
      instance.lazyInitializer,
    )

    cache.set(instance.id, copy)

    instance.locals.forEach((local, name) => copy.locals.set(name, RuntimeObject._copy(local, cache)))

    return copy
  }

  static null(evaluation: Evaluation): RuntimeObject {
    return Evaluation._retrieveInstanceOrSaveDefault(
      evaluation,
      new RuntimeObject(
        evaluation.currentContext,
        evaluation.environment.getNodeByFQN('wollok.lang.Object'),
        undefined,
        NULL_ID,
      )
    )
  }

  static boolean(evaluation: Evaluation, value: boolean): RuntimeObject {
    return Evaluation._retrieveInstanceOrSaveDefault(
      evaluation,
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

    return Evaluation._retrieveInstanceOrSaveDefault(
      evaluation,
      new RuntimeObject(
        evaluation.rootContext,
        evaluation.environment.getNodeByFQN('wollok.lang.Number'),
        Number(stringValue),
        id,
      )
    )
  }

  static string(evaluation: Evaluation, value: string): RuntimeObject {
    return Evaluation._retrieveInstanceOrSaveDefault(
      evaluation,
      new RuntimeObject(
        evaluation.rootContext,
        evaluation.environment.getNodeByFQN('wollok.lang.String'),
        value,
        `S!${value}`,
      )
    )
  }

  static list(evaluation: Evaluation, elements: List<Id>): RuntimeObject {
    return Evaluation._retrieveInstanceOrSaveDefault(
      evaluation,
      new RuntimeObject(
        evaluation.currentContext,
        evaluation.environment.getNodeByFQN('wollok.lang.List'),
        [...elements],
      )
    )
  }

  static set(evaluation: Evaluation, elements: List<Id>): RuntimeObject {
    return Evaluation._retrieveInstanceOrSaveDefault(
      evaluation,
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

    for (const local of keys(locals))
      instance.set(local, locals[local])

    return Evaluation._retrieveInstanceOrSaveDefault(evaluation, instance)
  }

  static lazy(evaluation: Evaluation, initializer: Expression): RuntimeObject {
    const instance = new RuntimeObject(
      evaluation.currentContext,
      undefined as any,
      undefined,
      undefined,
      initializer
    )

    return Evaluation._retrieveInstanceOrSaveDefault(evaluation, instance)
  }

  protected constructor(parent: Context, module: Module, innerValue?: InnerValue, id?: Id, initializer?: Expression) {
    super(parent, undefined, id)

    this.module = module
    this.innerValue = innerValue
    this.lazyInitializer = initializer

    this.locals.set('self', this)
  }


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

const compileExpressionClause = (environment: Environment) => ({ sentences }: Body): List<Instruction> =>
  sentences.length ? sentences.flatMap((sentence, index) => [
    ...compileSentence(environment)(sentence),
    ...index < sentences.length - 1 ? [POP] : [],
  ]) : [PUSH()]

export const compileSentence = (environment: Environment) => (...sentences: Sentence[]): List<Instruction> =>
  sentences.flatMap(node => {
    const compile = compileSentence(environment)

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
        const thenClause = compileExpressionClause(environment)(node.thenBody)
        const elseClause = compileExpressionClause(environment)(node.elseBody)
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
    })
  })


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EXECUTION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const step = (evaluation: Evaluation): void => {
  const { environment } = evaluation

  const currentFrame = evaluation.frameStack.top
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.takeNextInstruction()

  try {
    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const { name } = instruction
        const value = currentFrame.context.get(name)

        if (!value?.lazyInitializer) currentFrame.operandStack.push(value)
        else {
          evaluation.frameStack.push(new Frame(currentFrame.context, [
            ...evaluation.codeFor(value.lazyInitializer),
            DUP,
            STORE(name, true),
            RETURN,
          ]))
        }
      })()


      case 'STORE': return (() => {
        const { name, lookup } = instruction
        const value = currentFrame.operandStack.pop()

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
        currentFrame.operandStack.push(id ? evaluation.instance(id) : undefined)
      })()


      case 'POP': return (() => {
        currentFrame.operandStack.pop()
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
        const a = currentFrame.operandStack.pop()
        const others = new Array(distance).fill(null).map(() => currentFrame.operandStack.pop()).reverse()
        const b = currentFrame.operandStack.pop()

        currentFrame.operandStack.push(a)
        currentFrame.operandStack.push(...others)
        currentFrame.operandStack.push(b)
      })()

      case 'DUP': return (() => {
        const operand = currentFrame.operandStack.pop()
        currentFrame.operandStack.push(operand)
        currentFrame.operandStack.push(operand)
      })()

      case 'INSTANTIATE': return (() => {
        const { moduleFQN, innerValue } = instruction
        const instance =
          moduleFQN === 'wollok.lang.String' ? RuntimeObject.string(evaluation, `${innerValue}`) :
          moduleFQN === 'wollok.lang.Number' ? RuntimeObject.number(evaluation, Number(innerValue)) :
          moduleFQN === 'wollok.lang.List' ? RuntimeObject.list(evaluation, innerValue as Id[]) :
          moduleFQN === 'wollok.lang.Set' ? RuntimeObject.set(evaluation, innerValue as Id[]) :
          RuntimeObject.object(evaluation, moduleFQN)

        currentFrame.operandStack.push(instance)
      })()

      case 'INHERITS': return (() => {
        const { moduleFQN } = instruction
        const self = currentFrame.operandStack.pop()!
        const inherits = self.module.inherits(environment.getNodeByFQN(moduleFQN))
        currentFrame.operandStack.push(RuntimeObject.boolean(evaluation, inherits))
      })()

      case 'JUMP': return (() => {
        const { count } = instruction
        currentFrame.jump(count)
      })()

      case 'CONDITIONAL_JUMP': return (() => {
        const { count } = instruction
        const check = currentFrame.operandStack.pop()

        if (check?.id === TRUE_ID) return currentFrame.jump(count)
        if (check?.id !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
      })()


      case 'CALL': return (() => {
        const { message, arity, lookupStartFQN } = instruction
        const args = Array.from({ length: arity }, () => currentFrame.operandStack.pop()!).reverse()
        const self = currentFrame.operandStack.pop()!
        const method = self.module.lookupMethod(message, arity, lookupStartFQN)

        if (method) evaluation.invoke(method, self, ...args)
        else {
          evaluation.log.warn('Method not found:', lookupStartFQN ?? self.module.fullyQualifiedName(), '>>', message, '/', arity)
          evaluation.invoke(
            self.module.lookupMethod('messageNotUnderstood', 2)!,
            self,
            RuntimeObject.string(evaluation, message),
            RuntimeObject.list(evaluation, args.map(({ id }) => id)),
          )
        }
      })()


      case 'CALL_CONSTRUCTOR': return (() => {
        const { arity, lookupStart, optional } = instruction
        const self = currentFrame.operandStack.pop()!
        const args = Array.from({ length: arity }, () => currentFrame.operandStack.pop()!).reverse()
        const argIds = args.map(({ id }) => id)
        const lookupStartClass = environment.getNodeByFQN<'Class'>(lookupStart)
        const constructor = lookupStartClass.lookupConstructor(arity)

        if (!constructor) {
          if (optional) return evaluation.frameStack.top?.operandStack.push(self)
          else throw new Error(`Missing constructor/${arity} on ${lookupStartClass.fullyQualifiedName()}`)
        }

        evaluation.frameStack.push(new Frame(
          self,
          evaluation.codeFor(constructor),
          new Map(constructor.parameters.map(({ name, isVarArg }, index) =>
            [name, isVarArg ? RuntimeObject.list(evaluation, argIds.slice(index)) : args[index]]
          ))
        ))
      })()


      case 'INIT': return (() => {
        const { argumentNames } = instruction
        const self = currentFrame.operandStack.pop()!

        const fields: List<Field | Variable> = self.module.is('Describe')
          ? self.module.variables()
          : self.module.hierarchy().flatMap(module => module.fields())

        for (const field of fields)
          self.set(field.name, undefined)

        for (const name of [...argumentNames].reverse())
          self.set(name, currentFrame.operandStack.pop())

        evaluation.frameStack.push(new Frame(self, [
          ...fields.flatMap(field => argumentNames.includes(field.name)
            ? []
            : [...evaluation.codeFor(field.value), STORE(field.name, true)]
          ),
          LOAD('self'),
          RETURN,
        ]))
      })()


      case 'INTERRUPT': return (() => {
        const exception = currentFrame.operandStack.pop()!
        evaluation.raise(exception)
      })()


      case 'RETURN': return (() => {
        const value = currentFrame.operandStack.pop()
        evaluation.frameStack.pop()

        const next = evaluation.frameStack.top
        if (!next) throw new Error('Returning from last frame')

        next.operandStack.push(value)
      })()

    }
  } catch (error) {
    evaluation.log.error(error)
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
  const pending = [
    evaluation.rootContext,
    ...[...evaluation.frameStack].flatMap(({ operandStack, context, instructions }) => [
      context,
      ...operandStack,
      ...extractIdsFromInstructions(instructions).map(id => evaluation.instance(id)),
    ]),
  ]

  while (pending.length) {
    const next = pending.shift()
    if (next && !marked.has(next)) {
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