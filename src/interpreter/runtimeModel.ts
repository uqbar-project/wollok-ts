import { Environment, is, isNode, Method, Module, Name, Node, Variable, Singleton, Expression, List, Class, Id, Body, Assignment, Return, Reference, Self, Literal, LiteralValue, New, Send, Super, If, Try, Throw, Test, Program } from '../model'
import { get, last } from '../extensions'
import { v4 as uuid } from 'uuid'

const { isArray } = Array
const { keys, entries } = Object
const { isInteger } = Number

const DECIMAL_PRECISION = 5

export type Execution<T> = Generator<Node, T>
export type ExecutionDefinition<T> = (this: Evaluation) => Execution<T>

export type RuntimeValue = RuntimeObject | undefined

export interface Natives { [name: string]: NativeFunction | Natives }
export type NativeFunction = (this: Evaluation, self: RuntimeObject, ...args: RuntimeObject[]) => Execution<RuntimeValue | void>

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Context {
  readonly id: Id = uuid()
  readonly parentContext?: Context
  readonly locals: Map<Name, RuntimeValue | Execution<RuntimeObject>> = new Map()

  protected constructor(parentContext?: Context, locals: Record<Name, RuntimeObject | Execution<RuntimeObject>> = {}) {
    this.parentContext = parentContext
    for(const [name, value] of entries(locals)) this.locals.set(name, value)
  }

  get(local: Name): RuntimeValue {
    const found = this.locals.get(local) ?? this.parentContext?.get(local)
    if (!found || found instanceof RuntimeObject) return found
    let lazy = found.next()
    while(!lazy.done) lazy = found.next()
    this.set(local, lazy.value)
    return lazy.value
  }

  set(local: Name, value: RuntimeValue | Execution<RuntimeObject>, lookup = false): void {
    if(!lookup || this.locals.has(local)) this.locals.set(local, value)
    else this.parentContext?.set(local, value, lookup)
  }

  contextHierarchy(): List<Context> {
    return [this, ...this.parentContext?.contextHierarchy() ?? []]
  }

  copy(contextCache: Map<Id, Context>): this {
    if(contextCache.has(this.id)) return contextCache.get(this.id) as this

    const copy = this.baseCopy(contextCache) as this
    contextCache.set(this.id, copy)

    for(const [name, value] of this.locals.entries())
      copy.set(name,
        value instanceof RuntimeObject ? value.copy(contextCache) :
        value ? this.get(name) :
        value
      )

    return copy
  }

  protected baseCopy(contextCache: Map<Id, Context>): Context {
    return new Context(this.parentContext?.copy(contextCache))
  }
}

export class Frame extends Context {
  readonly label: string
  readonly node: Node

  constructor(label: string, node: Node, parentContext?: Context, locals: Record<Name, RuntimeObject> = {}) {
    super(parentContext, locals)
    this.label = label
    this.node = node
  }

  protected baseCopy(contextCache: Map<Id, Context>): Frame {
    return new Frame(this.label, this.node, this.parentContext?.copy(contextCache))
  }

  override toString(): string {
    const sourceInfo = `${this.node.sourceFileName() ?? '--'}:${this.node.sourceMap ? this.node.sourceMap.start.line + ':' + this.node.sourceMap.start.column : '--'}`
    return `${this.label}[${this.node.kind}](${sourceInfo})`
  }
}

export type InnerValue = null | boolean | string | number | RuntimeObject[] | Error
export type BasicRuntimeObject<T extends InnerValue | undefined> = RuntimeObject & { innerValue: T }

export class RuntimeObject extends Context {
  readonly module: Module
  readonly innerValue?: InnerValue


  constructor(module: Module, parentContext: Context, innerValue?: InnerValue) {
    super(parentContext)
    this.module = module
    this.innerValue = innerValue
    this.set('self', this)
  }

  get innerNumber(): this['innerValue'] & (number | undefined) {
    if(typeof this.innerValue !== 'number') return undefined
    return this.innerValue
  }

  get innerString(): this['innerValue'] & (string | undefined) {
    if(typeof this.innerValue !== 'string') return undefined
    return this.innerValue
  }

  get innerBoolean(): this['innerValue'] & (boolean | undefined) {
    if(typeof this.innerValue !== 'boolean') return undefined
    return this.innerValue
  }

  get innerCollection(): this['innerValue'] & (RuntimeObject[] | undefined) {
    if (!isArray(this.innerValue)) return undefined
    return this.innerValue
  }


  protected baseCopy(contextCache: Map<Id, Context>): RuntimeObject {
    return new RuntimeObject(
      this.module,
      this.parentContext!.copy(contextCache),
      isArray(this.innerValue) ? this.innerValue.map(elem => elem.copy(contextCache)) : this.innerValue
    )
  }

  assertIsNumber(): asserts this is BasicRuntimeObject<number> {
    this.assertIs('wollok.lang.Number', this.innerNumber)
  }

  assertIsBoolean(): asserts this is BasicRuntimeObject<boolean> {
    this.assertIs('wollok.lang.Boolean', this.innerBoolean)
  }

  assertIsString(): asserts this is BasicRuntimeObject<string> {
    this.assertIs('wollok.lang.String', this.innerString)
  }

  assertIsCollection(): asserts this is BasicRuntimeObject<RuntimeObject[]> {
    if (!this.innerCollection) throw new TypeError(`Malformed Runtime Object: Collection inner value should be a List<RuntimeObject> but was ${this.innerValue}`)
  }

  assertIsException(): asserts this is BasicRuntimeObject<Error | undefined> {
    if(this.innerValue && !(this.innerValue instanceof Error)) throw new TypeError('Malformed Runtime Object: Exception inner value, if defined, should be an Error')
  }

  assertIsNotNull(): asserts this is BasicRuntimeObject<Exclude<InnerValue, null>> {
    if(this.innerValue === null) throw new TypeError('Malformed Runtime Object: Object was expected to not be null')
  }

  protected assertIs(moduleFQN: Name, innerValue?: InnerValue): void {
    if (this.module.fullyQualifiedName() !== moduleFQN) throw new TypeError(`Expected an instance of ${moduleFQN} but got a ${this.module.fullyQualifiedName()} instead`)
    if (innerValue === undefined) throw new TypeError(`Malformed Runtime Object: invalid inner value ${this.innerValue} for ${moduleFQN} instance`)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNNER CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type ExecutionState = Readonly<
  { done: false, evaluation: Evaluation, next: Node, error?: undefined } |
  { done: true, evaluation: Evaluation, error: WollokException } |
  { done: true, evaluation: Evaluation, result: RuntimeValue, error?: undefined }
>

// TODO:
// - track history
// - conditional breakpoints?
// - break on exception

export class ExecutionDirector {
  readonly evaluation: Evaluation
  readonly execution: Execution<RuntimeValue | void>
  readonly breakpoints: Node[] = []

  constructor(evaluation: Evaluation, execution: ExecutionDefinition<RuntimeValue | void>) {
    this.evaluation = evaluation
    this.execution = execution.call(evaluation)
  }

  addBreakpoint(breakpoint: Node): void {
    this.breakpoints.push(breakpoint)
  }

  removeBreakpoint(breakpoint: Node): void {
    const nextBreakpoints = this.breakpoints.filter(node => node !== breakpoint)
    this.breakpoints.splice(0, this.breakpoints.length)
    this.breakpoints.push(...nextBreakpoints)
  }

  finish(): ExecutionState & {done: true} {
    let result = this.resume()
    while(!result.done) result = this.resume()
    return result
  }

  resume(shouldHalt: (next: Node, evaluation: Evaluation) => boolean = () => false): ExecutionState {
    try {
      let next = this.execution.next()
      while(!next.done) {
        if(this.breakpoints.includes(next.value) || shouldHalt(next.value, this.evaluation))
          return { done: false, evaluation: this.evaluation, next: next.value }

        next = this.execution.next()
      }
      return { done: true, evaluation: this.evaluation, result: next.value ?? undefined }
    } catch (error) {
      if (error instanceof WollokException) return { done: true, evaluation: this.evaluation, error }
      throw error
    }
  }

  stepIn(): ExecutionState {
    return this.resume(() => true)
  }

  stepOut(): ExecutionState {
    const currentHeight = this.evaluation.frameStack.length
    return this.resume((_, evaluation) => evaluation.frameStack.length < currentHeight)
  }

  stepOver(): ExecutionState {
    const currentHeight = this.evaluation.frameStack.length
    return this.resume((_, evaluation) => evaluation.frameStack.length <= currentHeight)
  }

  stepThrough(): ExecutionState {
    const currentHeight = this.evaluation.frameStack.length
    const currentContext = this.evaluation.currentContext
    return this.resume((_, evaluation) =>
      evaluation.frameStack.length <= currentHeight ||
      evaluation.currentContext.contextHierarchy().includes(currentContext)
    )
  }

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class WollokReturn extends Error { constructor(readonly frameStack: List<Frame>, readonly instance?: RuntimeObject){ super('Unhandled Wollok Return') } }
export class WollokException extends Error {
  constructor(readonly frameStack: List<Frame>, readonly instance: RuntimeObject){
    super(`WollokException: ${instance.module.name}`)

    instance.assertIsException() // TODO: implement innerError instead ?

    const header = instance.innerValue
      ? `Unhandled TypeScript Exception Within Wollok: ${instance.innerValue}`
      : `Unhandled Wollok Exception: ${instance.module.fullyQualifiedName()}: "${instance.get('message')?.innerString}"`
    const wollokStack = [...this.frameStack].reverse().map(frame => `at ${frame}`).join('\n\t')

    this.stack = `${header}\n\t${wollokStack}\nDuring TypeScript ${this.stack ?? ''}`
  }
}


export default (environment: Environment, natives: Natives): Interpreter => new Interpreter(Evaluation.build(environment, natives))

export class Interpreter {
  readonly evaluation: Evaluation

  constructor(evaluation: Evaluation) {
    this.evaluation = evaluation
  }

  fork(): Interpreter {
    return new Interpreter(this.evaluation.copy())
  }

  do<T>(executionDefinition: ExecutionDefinition<T>): T {
    const execution = executionDefinition.call(this.evaluation)
    let next = execution.next()
    while(!next.done) next = execution.next()
    return next.value
  }

  exec(node: Expression): RuntimeObject
  exec(node: Node): void
  exec(node: Node): RuntimeObject | void {
    return this.do(function*() { return yield* this.exec(node) })
  }

  invoke(methodOrMessage: Method | Name, receiver: RuntimeObject, ...args: RuntimeObject[]): RuntimeValue {
    return this.do(function*() { return yield* this.invoke(methodOrMessage, receiver, ...args) })
  }

  object(fullyQualifiedName: Name): RuntimeObject {
    return this.evaluation.object(fullyQualifiedName)
  }

  reify(value: boolean | number | string | null): RuntimeObject {
    return this.do(function*() { return yield* this.reify(value) })
  }

  list(...value: RuntimeObject[]): RuntimeObject {
    return this.do(function*() { return yield* this.list(...value) })
  }

  set(...value: RuntimeObject[]): RuntimeObject {
    return this.do(function*() { return yield* this.set(...value) })
  }

  instantiate(module: Module, locals: Record<Name, RuntimeObject> = {}, retainContext = false): RuntimeObject {
    return this.do(function*() { return yield* this.instantiate(module, locals, retainContext) })
  }

}

export class Evaluation {
  readonly natives: Natives
  readonly frameStack: Frame[]
  console: Console = console
  protected readonly numberCache: Map<number, WeakRef<RuntimeObject>>
  protected readonly stringCache: Map<string, WeakRef<RuntimeObject>>

  get currentContext(): Frame { return last(this.frameStack)! }
  get currentNode(): Node { return last(this.frameStack)!.node }
  get rootContext(): Frame { return this.frameStack[0] }
  get environment(): Environment { return this.frameStack[0].node as Environment }

  static build(environment: Environment, natives: Natives): Evaluation {
    const evaluation = new Evaluation(natives, [new Frame('root', environment)], new Map(), new Map())

    const globalSingletons = environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)
    for (const module of globalSingletons)
      evaluation.rootContext.set(module.fullyQualifiedName(), evaluation.instantiate(module))


    const globalConstants = environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
    for (const constant of globalConstants)
      evaluation.rootContext.set(constant.fullyQualifiedName(), evaluation.exec(constant.value, evaluation.rootContext))


    for (const module of globalSingletons) {
      const instance = evaluation.object(module.fullyQualifiedName())
      for (const field of module.defaultFieldValues().keys())
        instance!.get(field.name)
    }

    for (const constant of globalConstants)
      evaluation.object(constant.fullyQualifiedName())


    return evaluation
  }

  protected constructor(natives: Natives, frameStack: Frame[], numberCache: Map<number, WeakRef<RuntimeObject>>, stringCache: Map<string, WeakRef<RuntimeObject>>) {
    this.natives = natives
    this.frameStack = frameStack
    this.numberCache = numberCache
    this.stringCache = stringCache
  }

  copy(contextCache: Map<Id, Context> = new Map()): Evaluation {
    return new Evaluation(
      this.natives,
      this.frameStack.map(frame => frame.copy(contextCache)),
      new Map([...this.numberCache.entries()].flatMap(([key, value]) => {
        const instanceCopy = value.deref()?.copy(contextCache)
        return instanceCopy ? [[key, new WeakRef(instanceCopy)]] : []
      })),
      new Map([...this.stringCache.entries()].flatMap(([key, value]) => {
        const instanceCopy = value.deref()?.copy(contextCache)
        return instanceCopy ? [[key, new WeakRef(instanceCopy)]] : []
      })),
    )
  }

  allInstances(): Set<RuntimeObject> {
    const visitedContexts: Id[] = []

    function contextInstances(context?: Context): List<RuntimeObject> {
      if(!context || visitedContexts.includes(context.id)) return []
      visitedContexts.push(context.id)
      const localInstances = [...context.locals.values()].filter((value): value is RuntimeObject => value instanceof RuntimeObject)

      return [
        ...contextInstances(context.parentContext),
        ...context instanceof RuntimeObject ? [context, ...context.innerCollection?.flatMap(contextInstances) ?? []] : [],
        ...localInstances.flatMap(contextInstances),
      ]
    }

    return new Set(this.frameStack.flatMap(frame => contextInstances(frame)))
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  exec(node: Expression, frame?: Frame): Execution<RuntimeObject>
  exec(node: Node, frame?: Frame): Generator<Node, undefined>
  *exec(node: Node, frame?: Frame): Execution<RuntimeValue> {
    if(frame) this.frameStack.push(frame)

    try {
      return (yield* node.match<Execution<RuntimeValue | void>>({
        Test: node => this.execTest(node),
        Program: node => this.execProgram(node),
        Body: node => this.execBody(node),
        Variable: node => this.execVariable(node),
        Assignment: node => this.execAssignment(node),
        Return: node => this.execReturn(node),
        Reference: node => this.execReference(node),
        Self: node => this.execSelf(node),
        Literal: node => this.execLiteral(node),
        New: node => this.execNew(node),
        Send: node => this.execSend(node),
        Super: node => this.execSuper(node),
        If: node => this.execIf(node),
        Try: node => this.execTry(node),
        Throw: node => this.execThrow(node),
      })) ?? undefined
    } catch(error) {
      if(error instanceof WollokException || error instanceof WollokReturn) throw error
      else {
        const module = this.environment.getNodeByFQN<Class>(
          error.message === 'Maximum call stack size exceeded'
            ? 'wollok.lang.StackOverflowException'
            : 'wollok.lang.EvaluationError'
        )

        throw new WollokException([...this.frameStack], new RuntimeObject(module, this.rootContext, error))
      }
    } finally {
      if(frame) this.frameStack.pop()
    }
  }


  protected *execTest(node: Test): Execution<void> {
    yield node

    yield* this.exec(node.body, new Frame(`${node.fullyQualifiedName()}`, node, node.parent().is('Describe')
      ? yield* this.instantiate(node.parent())
      : this.currentContext
    ))
  }

  protected *execProgram(node: Program): Execution<void> {
    yield node

    yield* this.exec(node.body)
  }

  protected *execBody(node: Body): Execution<RuntimeValue> {
    yield node

    let result: RuntimeValue
    for(const sentence of node.sentences)
      result = yield* this.exec(sentence)

    return result
  }

  protected *execVariable(node: Variable): Execution<void> {
    const value = yield* this.exec(node.value)

    yield node

    this.currentContext.set(node.name, value)
  }

  protected *execAssignment(node: Assignment): Execution<void> {
    const value = yield* this.exec(node.value)

    yield node

    if(node.variable.target()?.isConstant) throw new Error(`Can't assign the constant ${node.variable.target()?.name}`)

    this.currentContext.set(node.variable.name, value, true)
  }

  protected *execReturn(node: Return): Execution<RuntimeValue> {
    const value = node.value && (yield* this.exec(node.value))
    yield node
    throw new WollokReturn(this.frameStack, value)
  }

  protected *execReference(node: Reference<Node>): Execution<RuntimeValue> {
    yield node

    if(!node.scope) return this.currentContext.get(node.name)

    const target = node.target()!

    return this.currentContext.get(
      target.is('Module') || target.is('Variable') && target.parent().is('Package')
        ? target.fullyQualifiedName()
        : node.name
    )
  }

  protected *execSelf(node: Self): Execution<RuntimeValue> {
    yield node
    return this.currentContext.get('self')
  }

  protected *execLiteral(node: Literal<LiteralValue>): Execution<RuntimeValue> {
    if(isArray(node.value)) {
      const [reference, args] = node.value
      const module = reference.target()!

      const values: RuntimeObject[] = []
      for(const arg of args) values.push(yield * this.exec(arg))

      yield node

      return yield* module.name === 'List' ? this.list(...values) : this.set(...values)
    }

    if (isNode(node.value)) {
      yield node
      return yield* this.instantiate(node.value, {}, true)
    }

    yield node

    return yield* this.reify(node.value as any)
  }

  protected *execNew(node: New): Execution<RuntimeValue> {
    const args: Record<Name, RuntimeObject> = {}
    for(const arg of node.args) args[arg.name] = yield* this.exec(arg.value)

    yield node

    if(!node.instantiated.target()) throw new Error(`Unexistent module ${node.instantiated.name}`)

    return yield* this.instantiate(node.instantiated.target()!, args)
  }

  protected *execSend(node: Send): Execution<RuntimeValue> {
    const receiver = yield* this.exec(node.receiver)
    const values: RuntimeObject[] = []
    for(const arg of node.args) values.push(yield * this.exec(arg))

    yield node

    return yield* this.invoke(node.message, receiver, ...values)
  }

  protected *execSuper(node: Super): Execution<RuntimeValue> {
    const values: RuntimeObject[] = []
    for(const arg of node.args) values.push(yield * this.exec(arg))

    yield node

    const receiver = this.currentContext.get('self')!
    const currentMethod = node.ancestors().find(is('Method'))!
    const method = receiver.module.lookupMethod(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName())

    return yield* this.invoke(method, receiver, ...values)
  }

  protected *execIf(node: If): Execution<RuntimeValue> {
    const condition: RuntimeObject = yield* this.exec(node.condition)
    condition.assertIsBoolean()

    yield node

    const continuation = condition.innerBoolean ? node.thenBody : node.elseBody
    return yield* this.exec(continuation, new Frame(`${this.currentContext.label}>if(${condition.innerBoolean})`, continuation, this.currentContext))
  }

  protected *execTry(node: Try): Execution<RuntimeValue> {
    yield node

    let result: RuntimeValue
    try {
      result = yield* this.exec(node.body, new Frame(`${this.currentContext.label}>try`, node, this.currentContext))
    } catch(error) {
      if(!(error instanceof WollokException)) throw error

      const handler = node.catches.find(catcher => error.instance.module.inherits(catcher.parameterType.target()))

      if(handler) result = yield* this.exec(handler.body, new Frame(`${this.currentContext.label}>catch(${handler.parameter.name}: ${handler.parameterType.name})`, handler, this.currentContext, { [handler.parameter.name]: error.instance }))
      else throw error
    } finally {
      yield* this.exec(node.always, new Frame(`${this.currentContext.label}>then always`, node.always, this.currentContext))
    }

    return result

  }

  protected *execThrow(node: Throw): Execution<RuntimeValue> {
    const exception = yield* this.exec(node.exception)

    yield node

    throw new WollokException([...this.frameStack], exception)

  }


  *invoke(methodOrMessage: Method | Name | undefined, receiver: RuntimeObject, ...args: RuntimeObject[]): Execution<RuntimeValue> {
    const method = methodOrMessage instanceof Method ? methodOrMessage :
      typeof methodOrMessage === 'string' ? receiver.module.lookupMethod(methodOrMessage, args.length) :
      methodOrMessage

    if (!method) return yield* this.invoke('messageNotUnderstood', receiver, yield* this.reify(methodOrMessage as string), yield* this.list(...args))
    if (!method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

    const methodFQN = `${method.parent().fullyQualifiedName()}.${method.name}`

    if(method.isNative()) {
      const native = get<NativeFunction>(this.natives, methodFQN)
      if(!native) throw new Error(`Missing native ${methodFQN}`)

      this.frameStack.push(new Frame(`${methodFQN}/${args.length}`, method, receiver))
      try {
        return (yield* native.call(this, receiver, ...args)) ?? undefined
      } finally { this.frameStack.pop() }
    } else if(method.isConcrete()) {
      let result: RuntimeValue
      const locals: Record<Name, RuntimeObject> = {}
      for(let index = 0; index < method.parameters.length; index++){
        const { name, isVarArg } = method.parameters[index]
        locals[name] = isVarArg ? yield* this.list(...args.slice(index)) : args[index]
      }

      try {
        result = yield* this.exec(method.body!, new Frame(`${methodFQN}/${args.length}`, method, receiver, locals))
      } catch(error) {
        if(!(error instanceof WollokReturn)) throw error
        else result = error.instance
      }
      return result
    } else throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // INSTANTIATION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  object(fullyQualifiedName: Name): RuntimeObject {
    const instance = this.rootContext.get(fullyQualifiedName)
    if(!instance) throw new Error(`WKO not found: ${fullyQualifiedName}`)
    return instance
  }

  *reify(value: boolean | number | string | null): Execution<RuntimeObject> {
    if(typeof value === 'boolean'){
      const existing = this.rootContext.get(`${value}`)
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Boolean'), this.rootContext, value)
      this.rootContext.set(`${value}`, instance)
      return instance
    }

    if(typeof value === 'number') {
      const isRound = isInteger(value)
      const preciseValue = isRound ? value : Number(value.toFixed(DECIMAL_PRECISION))

      if(isRound) {
        const existing = this.numberCache.get(preciseValue)?.deref()
        if(existing) return existing
      }

      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Number'), this.rootContext, preciseValue)
      if(isRound) this.numberCache.set(preciseValue, new WeakRef(instance))
      return instance
    }

    if(typeof value === 'string'){
      const existing = this.stringCache.get(value)?.deref()
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.String'), this.rootContext, value)
      this.stringCache.set(value, new WeakRef(instance))
      return instance
    }

    const existing = this.rootContext.get('null')
    if(existing) return existing
    const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Object'), this.rootContext, value)
    this.rootContext.set('null', instance)
    return instance
  }

  *list(...value: RuntimeObject[]): Execution<RuntimeObject> {
    return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.List'), this.rootContext, value)
  }

  *set(...value: RuntimeObject[]): Execution<RuntimeObject> {
    const result = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Set'), this.rootContext, [])
    for(const elem of value)
      yield* this.invoke('add', result, elem)
    return result
  }

  *instantiate(module: Module, locals: Record<Name, RuntimeObject> = {}, retainContext = false): Execution<RuntimeObject> {
    const defaultFieldValues = module.defaultFieldValues()

    const allFieldNames = [...defaultFieldValues.keys()].map(({ name }) => name)
    for(const local of keys(locals))
      if(!allFieldNames.includes(local))
        throw new Error(`Can't instantiate ${module.fullyQualifiedName()} with value for unexistent field ${local}`)

    const instance = new RuntimeObject(module, retainContext ? this.currentContext : this.rootContext)
    const initializationFrame = new Frame(`new ${module.fullyQualifiedName()}`, this.currentNode, instance)

    for(const [field, defaultValue] of defaultFieldValues) {
      instance.set(field.name, field.name in locals
        ? locals[field.name]
        : defaultValue && this.exec(defaultValue, initializationFrame)
      )
    }

    yield * this.invoke('initialize', instance)

    if(!module.name || module.is('Describe'))
      for (const [field] of defaultFieldValues)
        instance.get(field.name)

    return instance
  }
}