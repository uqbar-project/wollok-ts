import { last, zipObj } from './extensions'
import log from './log'
import { is, Node, Body, Class, Environment, Expression, Id, List, Module, Name, NamedArgument, Sentence, Test, Variable, Singleton, Field, isNode } from './model'
import { v4 as uuid } from 'uuid'

// TODO: Wishlist
// - Unify Interpreter and Evaluation to get a consistent API and Refactor exported API
//    - More step methods: stepThrough, for example. Step to get inside closure?
//    - method to set-up evaluation for a message send: ev.sendMessage('m', o, p1, p2)
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
  readonly environment: Environment
  readonly rootContext: Context
  readonly frameStack: Stack<Frame>
  protected readonly instanceCache: Map<Id, RuntimeObject>
  protected readonly code: Map<Id, List<Instruction>>

  get currentContext(): Context { return this.frameStack.top?.context ?? this.rootContext }
  get instances(): List<RuntimeObject> { return [...this.instanceCache.values()] }


  static of(environment: Environment): Evaluation {
    const rootContext = new Context()
    const evaluation = new Evaluation(environment, rootContext)

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

    return evaluation
  }

  static _retrieveInstanceOrSaveDefault(evaluation: Evaluation, instance: RuntimeObject): RuntimeObject {
    const existing = evaluation.instanceCache.get(instance.id)
    if(existing) return existing

    evaluation.instanceCache.set(instance.id, instance)

    return instance
  }


  protected constructor(
    environment: Environment,
    rootContext: Context,
    frameStack = new Stack<Frame>(MAX_FRAME_STACK_SIZE),
    instanceCache = new Map<Id, RuntimeObject>(),
    code = new Map<Id, List<Instruction>>()
  ){
    this.environment = environment
    this.rootContext = rootContext
    this.frameStack = frameStack
    this.instanceCache = instanceCache
    this.code = code
  }


  copy(): Evaluation {
    const cache = new Map<Id, any>()

    return new Evaluation(
      this.environment,
      Context._copy(this.rootContext, cache),
      this.frameStack.map(frame => Frame._copy(frame, cache)),
      new Map([...this.instanceCache.entries()].map(([name, instance]) => [name, RuntimeObject._copy(instance, cache)])),
      this.code
    )
  }

  codeFor(node: Node): List<Instruction> {
    if(!this.code.has(node.id)) {
      const compileSentences = compile(this.environment)
      if(node.is('Method') && node.body && node.body !== 'native') {
        this.code.set(node.id, [
          ...compileSentences(...node.body.sentences),
          PUSH(),
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
    const response = this.instanceCache.get(id)
    if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
    return response
  }

  freeInstance(id: Id): void { this.instanceCache.delete(id) }


  raise(exception: RuntimeObject): void {
    while(!this.frameStack.isEmpty()) {
      const currentFrame = this.frameStack.top!

      while(currentFrame.hasNestedContext()) {
        if(currentFrame.context.exceptionHandlerIndex !== undefined) {
          currentFrame.jumpTo(currentFrame.context.exceptionHandlerIndex)
          currentFrame.popContext()
          currentFrame.context.set('<exception>', exception)
          return
        }

        currentFrame.popContext()
      }

      this.frameStack.pop()
    }

    throw new Error(`Reached end of stack with unhandled exception ${exception.id}`)
  }

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
  protected pc = 0
  protected currentContext: Context
  protected readonly baseContext: Context

  get nextInstructionIndex(): number { return this.pc }
  get context(): Context { return this.currentContext }


  static _copy(frame: Frame, cache: Map<Id, any>): Frame {
    const copy = new Frame(Context._copy(frame.context, cache), frame.instructions)

    assign(copy, { context: copy.context.parent, baseContext: copy.context.parent })
    copy.operandStack.unshift(...frame.operandStack.map(operand => RuntimeObject._copy(operand, cache)))
    copy.pc = frame.pc

    return copy
  }


  constructor(parentContext: Context, instructions: List<Instruction>, locals: Locals = new Map()){
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
    if(!this.hasNestedContext()) throw new Error('Popped frame base context')
    this.currentContext = this.currentContext.parent!
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
  readonly parent?: Context
  readonly locals: Locals = new Map()
  readonly exceptionHandlerIndex?: number


  static _copy(context: Context, cache: Map<Id, any>): Context
  static _copy(context: Context | undefined, cache: Map<Id, any>): Context | undefined
  static _copy(context: Context | undefined, cache: Map<Id, any>): Context | undefined {
    if(!context) return undefined

    const cached = cache.get(context.id)
    if(cached) return cached

    const copy = new Context(
      Context._copy(context.parent, cache),
      context.exceptionHandlerIndex,
      context.id,
    )

    cache.set(context.id, copy)

    context.locals.forEach((local, name) => copy.locals.set(name, RuntimeObject._copy(local, cache)))

    return copy
  }


  constructor(parent?: Context, exceptionHandlerIndex?: number, id: Id = uuid()){
    this.parent = parent
    this.exceptionHandlerIndex = exceptionHandlerIndex
    this.id = id
  }


  get(local: Name): RuntimeObject | undefined {
    return this.locals.get(local) ?? this.parent?.get(local)
  }

  set(local: Name, value: RuntimeObject | undefined): void {
    this.locals.set(local, value)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNTIME OBJECTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type InnerValue = string | number | Id[]

export class RuntimeObject extends Context {
  readonly parent!: Context
  readonly module: Module
  readonly innerValue?: InnerValue
  readonly lazyInitializer?: Expression


  static _copy(instance: RuntimeObject, cache: Map<Id, any>): RuntimeObject
  static _copy(instance: RuntimeObject | undefined, cache: Map<Id, any>): RuntimeObject | undefined
  static _copy(instance: RuntimeObject | undefined, cache: Map<Id, any>): RuntimeObject | undefined {
    if(!instance) return undefined

    const cached = cache.get(instance.id)
    if(cached) return cached

    const copy = new RuntimeObject(
      Context._copy(instance.parent, cache),
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

  static object(evaluation: Evaluation, moduleOrFQN: Module | Name, locals: Record<Name, RuntimeObject> = {}): RuntimeObject {
    const module = isNode(moduleOrFQN) ? moduleOrFQN : evaluation.environment.getNodeByFQN<'Module'>(moduleOrFQN)
    const instance = new RuntimeObject(
      evaluation.currentContext,
      module,
      undefined,
      module.is('Singleton') && !!module.name ? module.id : undefined
    )

    for(const local of keys(locals))
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
  | { kind: 'STORE', name: Name, lookup: boolean } // TODO: !
  | { kind: 'PUSH', id?: Id }
  | { kind: 'POP' }
  | { kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta?: number }
  | { kind: 'POP_CONTEXT' }
  | { kind: 'SWAP', distance: number }
  | { kind: 'DUP' }
  | { kind: 'INSTANTIATE', module: Name, innerValue?: InnerValue }
  | { kind: 'INHERITS', module: Name }
  | { kind: 'JUMP', count: number }
  | { kind: 'CONDITIONAL_JUMP', count: number }
  | { kind: 'CALL', message: Name, arity: number, useReceiverContext: boolean, lookupStart?: Name } // TODO: !
  | { kind: 'INIT', arity: number, lookupStart: Name, optional?: boolean }
  | { kind: 'INIT_NAMED', argumentNames: List<Name> }
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
export const INSTANTIATE = (module: Name, innerValue?: InnerValue): Instruction => ({ kind: 'INSTANTIATE', module, innerValue })
export const INHERITS = (module: Name): Instruction => ({ kind: 'INHERITS', module })
export const JUMP = (count: number): Instruction => ({ kind: 'JUMP', count })
export const CONDITIONAL_JUMP = (count: number): Instruction => ({ kind: 'CONDITIONAL_JUMP', count })
export const CALL = (message: Name, arity: number, useReceiverContext = true, lookupStart?: Name): Instruction => ({ kind: 'CALL', message, arity, useReceiverContext, lookupStart })
export const INIT = (arity: number, lookupStart: Name, optional = false): Instruction => ({ kind: 'INIT', arity, lookupStart, optional })
export const INIT_NAMED = (argumentNames: List<Name>): Instruction => ({ kind: 'INIT_NAMED', argumentNames })
export const INTERRUPT: Instruction = { kind: 'INTERRUPT' }
export const RETURN: Instruction = { kind: 'RETURN' }

const compileExpressionClause = (environment: Environment) => ({ sentences }: Body): List<Instruction> =>
  sentences.length ? sentences.flatMap((sentence, index) => [
    ...compile(environment)(sentence),
    ...index < sentences.length - 1 ? [POP] : [],
  ]) : [PUSH()]

const compile = (environment: Environment) => (...sentences: Sentence[]): List<Instruction> =>
  sentences.flatMap(node => node.match({
    Variable: node => [
      ...compile(environment)(node.value),
      STORE(node.name, false),
      PUSH(),
    ],


    Return: node => [
      ...node.value
        ? compile(environment)(node.value)
        : [PUSH()],
      RETURN,
    ],


    Assignment: node => [
      ...compile(environment)(node.value),
      STORE(node.variable.name, true),
      PUSH(),
    ],

    Self: () => [
      LOAD('self'),
    ],


    Reference: node => {
      const target = node.target()!

      if (target.is('Module') || target.is('Variable') && target.parent().is('Package')) return [
        LOAD(target.fullyQualifiedName()),
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
        PUSH(),
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
// EXECUTION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const step = (natives: Natives) => (evaluation: Evaluation): void => {
  const { environment } = evaluation

  const currentFrame = evaluation.frameStack.top
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.takeNextInstruction()

  try {
    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const value = currentFrame.context.get(instruction.name)

        // TODO: should add tests for the lazy load and store
        if (!value?.lazyInitializer) currentFrame.operandStack.push(value)
        else {
          evaluation.frameStack.push(new Frame(currentFrame.context, [
            ...compile(environment)(value.lazyInitializer),
            DUP,
            STORE(instruction.name, true),
            RETURN,
          ]))
        }
      })()


      case 'STORE': return (() => {
        const value = currentFrame.operandStack.pop()
        const currentContext = currentFrame.context

        let context: Context | undefined = currentContext
        if (instruction.lookup) {
          while (context && !context.locals.has(instruction.name)) {
            context = context.parent
          }
        }

        (context ?? currentContext).set(instruction.name, value)
      })()


      case 'PUSH': return (() => {
        currentFrame.operandStack.push(instruction.id ? evaluation.instance(instruction.id) : undefined)
      })()


      case 'POP': return (() => {
        currentFrame.operandStack.pop()
      })()


      case 'PUSH_CONTEXT': return (() => {
        currentFrame.pushContext(instruction.exceptionHandlerIndexDelta
          ? currentFrame.nextInstructionIndex + instruction.exceptionHandlerIndexDelta
          : undefined
        )
      })()


      case 'POP_CONTEXT': return (() => {
        currentFrame.popContext()
      })()


      case 'SWAP': return (() => {
        const a = currentFrame.operandStack.pop()
        const bs = new Array(instruction.distance).fill(null).map(() => currentFrame.operandStack.pop()).reverse()
        const c = currentFrame.operandStack.pop()
        currentFrame.operandStack.push(a)
        bs.forEach(b => currentFrame.operandStack.push(b))
        currentFrame.operandStack.push(c)
      })()

      case 'DUP': return (() => {
        const a = currentFrame.operandStack.pop()
        currentFrame.operandStack.push(a)
        currentFrame.operandStack.push(a)
      })()

      case 'INSTANTIATE': return (() => {
        const instance =
          instruction.module === 'wollok.lang.String' ? RuntimeObject.string(evaluation, `${instruction.innerValue}`) :
          instruction.module === 'wollok.lang.Number' ? RuntimeObject.number(evaluation, Number(instruction.innerValue)) :
          instruction.module === 'wollok.lang.List' ? RuntimeObject.list(evaluation, instruction.innerValue as Id[]) :
          instruction.module === 'wollok.lang.Set' ? RuntimeObject.set(evaluation, instruction.innerValue as Id[]) :
          RuntimeObject.object(evaluation, instruction.module)

        currentFrame.operandStack.push(instance)
      })()

      case 'INHERITS': return (() => {
        const self = currentFrame.operandStack.pop()!
        const inherits = self.module.inherits(environment.getNodeByFQN(instruction.module))
        currentFrame.operandStack.push(RuntimeObject.boolean(evaluation, inherits))
      })()

      case 'JUMP': return (() => {
        currentFrame.jump(instruction.count)
      })()

      case 'CONDITIONAL_JUMP': return (() => {
        const check = currentFrame.operandStack.pop()
        if (check?.id !== TRUE_ID && check?.id !== FALSE_ID) throw new Error(`Non-boolean check ${check}`)
        currentFrame.jump(check.id === TRUE_ID ? instruction.count : 0)
      })()


      case 'CALL': return (() => {
        const args = Array.from({ length: instruction.arity }, () => currentFrame.operandStack.pop()!).reverse()
        const argIds = args.map(({ id }) => id)
        const self = currentFrame.operandStack.pop()!

        let lookupStart: Module
        if (instruction.lookupStart) {
          const ownHierarchy = self.module.hierarchy()
          const start = ownHierarchy.findIndex(module => module.fullyQualifiedName() === instruction.lookupStart)
          lookupStart = ownHierarchy[start + 1]
        } else {
          lookupStart = self.module
        }
        const method = lookupStart.lookupMethod(instruction.message, instruction.arity)

        if (!method) {
          log.warn('Method not found:', lookupStart.fullyQualifiedName(), '>>', instruction.message, '/', instruction.arity)

          const messageNotUnderstood = self.module.lookupMethod('messageNotUnderstood', 2)!
          const messageNotUnderstoodArgs = [
            RuntimeObject.string(evaluation, instruction.message),
            RuntimeObject.list(evaluation, argIds),
          ]

          evaluation.frameStack.push(new Frame(
            self,
            evaluation.codeFor(messageNotUnderstood),
            new Map(messageNotUnderstood.parameters.map(({ name }, index) => [name, messageNotUnderstoodArgs[index]]))
          ))
        } else {

          if (method.body === 'native') {
            log.debug('Calling Native:', lookupStart.fullyQualifiedName(), '>>', instruction.message, '/', instruction.arity)
            const fqn = `${method.parent().fullyQualifiedName()}.${method.name}`
            const native: NativeFunction = fqn.split('.').reduce((current, name) => {
              const next = current[name]
              if (!next) throw new Error(`Native not found: ${fqn}`)
              return next
            }, natives as any)

            native(self, ...args)(evaluation)
          } else {
            const locals = new Map(method.parameters.some(({ isVarArg }) => isVarArg)
              ? [
                ...method.parameters.slice(0, -1).map(({ name }, index) => [name, args[index]] as const),
                [last(method.parameters)!.name,
                  RuntimeObject.list(evaluation, argIds.slice(method.parameters.length - 1)),
                ],

              ]
              : method.parameters.map(({ name }, index) => [name, args[index]])
            )

            evaluation.frameStack.push(new Frame(
              instruction.useReceiverContext ? self : self.parent,
              evaluation.codeFor(method),
              locals
            ))
          }
        }
      })()


      case 'INIT': return (() => {
        const self = currentFrame.operandStack.pop()!
        const args = Array.from({ length: instruction.arity }, () => currentFrame.operandStack.pop()!).reverse()
        const argIds = args.map(({ id }) => id)
        const lookupStart: Class = environment.getNodeByFQN(instruction.lookupStart)
        const constructor = lookupStart.lookupConstructor(instruction.arity)

        if (!constructor) {
          if (instruction.optional) return evaluation.frameStack.top?.operandStack.push(self)
          else throw new Error(`Missing constructor/${instruction.arity} on ${lookupStart.fullyQualifiedName()}`)
        }

        const locals = new Map(constructor.parameters.some(({ isVarArg }) => isVarArg)
          ? [
            ...constructor.parameters.slice(0, -1).map(({ name }, index) => [name, args[index]] as const),
            [
              last(constructor.parameters)!.name,
              RuntimeObject.list(evaluation, argIds.slice(constructor.parameters.length - 1)),
            ],
          ]
          : constructor.parameters.map(({ name }, index) => [name, args[index]])
        )

        evaluation.frameStack.push(new Frame(
          self,
          evaluation.codeFor(constructor),
          locals
        ))
      })()

      case 'INIT_NAMED': return (() => {
        const self = currentFrame.operandStack.pop()!

        const fields: List<Field|Variable> = self.module.is('Describe')
          ? self.module.variables()
          : self.module.hierarchy().flatMap(module => module.fields())

        for (const field of fields)
          self.set(field.name, undefined)

        for (const name of [...instruction.argumentNames].reverse())
          self.set(name, currentFrame.operandStack.pop())

        evaluation.frameStack.push(new Frame(self, [
          ...fields
            .filter(field => !instruction.argumentNames.includes(field.name))
            .flatMap(field => [
              ...compile(environment)(field.value),
              STORE(field.name, true),
            ]),
          LOAD('self'),
          RETURN,
        ]))
      })()


      case 'INTERRUPT': return (() => {
        const exception = currentFrame.operandStack.pop()!
        evaluation.raise(exception)
      })()

      case 'RETURN': return (() => {
        const valueId = currentFrame.operandStack.pop()
        evaluation.frameStack.pop()

        const next = evaluation.frameStack.top
        if (!next) throw new Error('Returning from last frame')

        next.operandStack.push(valueId)
      })()

    }
  } catch (error) {
    log.error(error)
    if (!evaluation.frameStack.isEmpty()) {
      const exceptionType = error instanceof WollokError ? error.moduleFQN : 'wollok.lang.EvaluationError'
      evaluation.raise(RuntimeObject.object(evaluation, exceptionType))

    } else throw error
  }

}

/** Takes all possible steps, until the last frame has no pending instructions */
export const stepAll = (natives: Natives) => (evaluation: Evaluation): void => {
  const takeStep = step(natives)
  // TODO: add done() message to check instructions pending
  while (!evaluation.frameStack.top!.isFinished()) {
    log.step(evaluation)
    takeStep(evaluation)
  }
}


function run(evaluation: Evaluation, natives: Natives, sentences: List<Sentence>) {
  const instructions = compile(evaluation.environment)(...sentences)

  // TODO: This should not be run on a context child of the current frame's context. Either receive the context or use the global one.
  evaluation.frameStack.push(new Frame(evaluation.currentContext, instructions))

  stepAll(natives)(evaluation)

  const currentFrame = evaluation.frameStack.pop()!
  return currentFrame.operandStack.isEmpty ? undefined : currentFrame.operandStack.pop()
}

export interface TestResult {
  error?: Error,
  duration: number,
  evaluation: Evaluation,
}

function runTest(evaluation: Evaluation, natives: Natives, test: Test): TestResult {
  log.resetStep()

  const describe = test.parent()
  if (describe.is('Describe')) {
    const describeInstance = RuntimeObject.object(evaluation, describe as unknown as Module) // TODO: Describe is a module?

    evaluation.frameStack.push(new Frame(describeInstance, [
      PUSH(describeInstance.id),
      INIT_NAMED([]),
      ...compile(evaluation.environment)(
        ...describe.fixtures().flatMap(fixture => fixture.body.sentences),
      ),
    ]))

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

  const before = process.hrtime()
  let error: Error | undefined
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GC
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// TODO: Add some unit tests.
const garbageCollect = (evaluation: Evaluation) => {
  const extractIdsFromInstructions = (instructions: List<Instruction>): List<Id> => {
    return instructions.flatMap(instruction => {
      if(instruction.kind === 'PUSH') return instruction.id ? [] : [instruction.id!]
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

  while(pending.length) {
    const next = pending.shift()
    if(next && !marked.has(next)) {
      marked.add(next)

      pending.push(
        ... next.parent ? [next.parent] : [],
        ...next.locals.values(),
      )

      if(next instanceof RuntimeObject && isArray(next?.innerValue)) pending.push(...next!.innerValue.map(id => evaluation.instance(id)))
    }
  }

  for(const instance of evaluation.instances)
    if(!marked.has(instance)) {
      evaluation.freeInstance(instance.id)
    }
}

// TODO: Refactor this interface
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (environment: Environment, natives: Natives) => ({

  buildEvaluation: () => Evaluation.of(environment),

  step: step(natives),

  stepAll: stepAll(natives),

  // TODO: stepThrough
  sendMessage: (message: string, receiver: Id, ...args: Id[]) => (evaluation: Evaluation) => {
    const takeStep = step(natives)
    const initialFrameCount = evaluation.frameStack.depth

    evaluation.frameStack.push(new Frame(evaluation.instance(receiver), [
      PUSH(receiver),
      ...args.map(PUSH),
      CALL(message, args.length),
      RETURN,
    ]))

    // TODO: stepAll?
    do {
      takeStep(evaluation)
    } while (evaluation.frameStack.depth > initialFrameCount)
  },

  runProgram: (fullyQualifiedName: Name, evaluation?: Evaluation): void => {
    const programSentences = environment.getNodeByFQN<'Program'>(fullyQualifiedName).body.sentences

    log.start('Initializing Evaluation')
    const initializedEvaluation = evaluation || Evaluation.of(environment)
    stepAll(natives)(initializedEvaluation)
    log.done('Initializing Evaluation')

    log.info('Running program', fullyQualifiedName)
    run(initializedEvaluation, natives, programSentences)
    log.success('Done!')
  },

  runTest: (evaluation: Evaluation, test: Test): TestResult => runTest(evaluation, natives, test),

  runTests: (tests: List<Test>): Record<Name, TestResult> => {
    log.start('Initializing Evaluation')
    const evaluation = Evaluation.of(environment)
    stepAll(natives)(evaluation)
    evaluation.frameStack.pop()
    log.done('Initializing Evaluation')

    garbageCollect(evaluation)

    return zipObj(
      tests.map(test => test.fullyQualifiedName()),
      tests.map(test => runTest(evaluation.copy(), natives, test))
    )
  },

  garbageCollect,
})