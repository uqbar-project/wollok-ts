import { Environment, is, isNode, Method, Module, Name, Node, Variable, Singleton, Expression, List, Id, Body, Assignment, Return, Reference, Self, Literal, LiteralValue, New, Send, Super, If, Try, Throw, Test, Program } from '../model'
import { get, last } from '../extensions'
import { v4 as uuid } from 'uuid'
import { Interpreter } from './interpreter'

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
// EXCEPTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class WollokReturn extends Error {
  constructor(readonly instance?: RuntimeObject){
    super()
    this.name = this.constructor.name
    this.message = 'Unhandled return on empty stack'
  }
}

export class WollokException extends Error {
  get wollokStack(): string {
    try {
      const fullTrace: string = new Interpreter(this.evaluation).send('getStackTraceAsString', this.instance)!.innerString!
      return fullTrace.slice(fullTrace.indexOf('\n') + 1).trimEnd()
    } catch (error) { return `Could not retrieve Wollok stack due to error: ${error.stack}` }
  }

  get message(): string {
    const error: RuntimeObject = this.instance
    error.assertIsException()
    return `${error.innerValue ? error.innerValue.message : error.get('message')?.innerString ?? ''}\n${this.wollokStack}\n     Derived from TypeScript stack`
  }

  // TODO: Do we need to take this into consideration for Evaluation.copy()? This might be inside Exception objects
  constructor(readonly evaluation: Evaluation, readonly instance: RuntimeObject){
    super()

    instance.assertIsException()

    this.name = instance.innerValue
      ? `${instance.module.fullyQualifiedName()} wrapping TypeScript ${instance.innerValue.name}`
      : instance.module.fullyQualifiedName()
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export abstract class Context {
  readonly id: Id = uuid()
  readonly parentContext?: Context
  readonly locals: Map<Name, RuntimeValue | Execution<RuntimeObject>>

  protected constructor(parentContext?: Context, locals: Map<Name, RuntimeValue | Execution<RuntimeObject>> = new Map()) {
    this.parentContext = parentContext
    this.locals = locals
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

  protected abstract baseCopy(contextCache: Map<Id, Context>): Context
}


export class Frame extends Context {
  readonly node: Node

  constructor(node: Node, parentContext?: Context, locals: Record<Name, RuntimeObject> = {}) {
    super(parentContext, new Map(entries(locals)))
    this.node = node
  }

  get description(): string {
    return this.node.match({
      Entity: node => `${node.fullyQualifiedName()}`,
      // TODO: Add fqn to method
      Method: node => `${node.parent().fullyQualifiedName()}.${node.name}(${node.parameters.map(parameter => parameter.name).join(', ')})`,
      Catch: node => `catch(${node.parameter.name}: ${node.parameterType.name})`,
      Environment: () => 'root',
      Node: node => `${node.kind}`,
    })
  }

  get sourceInfo(): string {
    // TODO: Make singleton an expression and avoid the literal here
    const sourceMap = this.node.sourceMap ?? (this.node.is('Method') && this.node.name === '<apply>' ? this.node.ancestors().find(is('Literal'))?.sourceMap : undefined)
    return `${this.node.sourceFileName() ?? '--'}:${sourceMap ? sourceMap.start.line + ':' + sourceMap.start.column : '--'}`
  }

  protected baseCopy(contextCache: Map<Id, Context>): Frame {
    return new Frame(this.node,  this.parentContext?.copy(contextCache))
  }

  override toString(): string {
    return `${this.description}(${this.sourceInfo})`
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
    if (!this.module.inherits(this.module.environment().getNodeByFQN('wollok.lang.Exception'))) throw new TypeError(`Expected an instance of Exception but got a ${this.module.fullyQualifiedName()} instead`)
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
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Evaluation {
  readonly natives: Map<Method, NativeFunction>
  protected readonly numberCache: Map<number, WeakRef<RuntimeObject>>
  protected readonly stringCache: Map<string, WeakRef<RuntimeObject>>
  console: Console = console

  frameStack: Frame[]

  get rootFrame(): Frame { return this.frameStack[0] }
  get currentFrame(): Frame { return last(this.frameStack)! }
  get currentNode(): Node { return this.currentFrame.node }
  get environment(): Environment { return this.rootFrame.node as Environment }

  static build(environment: Environment, natives: Natives): Evaluation {
    const evaluation = new Evaluation(new Map(), [new Frame(environment)], new Map(), new Map())

    environment.forEach(node => {
      if(node.is('Method') && node.isNative())
        evaluation.natives.set(node, get(natives, `${node.parent()!.fullyQualifiedName()}.${node.name}`)!)
    })

    const globalSingletons = environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)
    for (const module of globalSingletons)
      evaluation.rootFrame.set(module.fullyQualifiedName(), evaluation.instantiate(module))


    const globalConstants = environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
    for (const constant of globalConstants)
      evaluation.rootFrame.set(constant.fullyQualifiedName(), evaluation.exec(constant.value))


    for (const module of globalSingletons) {
      const instance = evaluation.object(module.fullyQualifiedName())
      for (const field of module.defaultFieldValues().keys()) // TODO: Add an allFields method
        instance!.get(field.name)
    }

    for (const constant of globalConstants)
      evaluation.object(constant.fullyQualifiedName())


    return evaluation
  }

  protected constructor(natives: Map<Method, NativeFunction>, frameStack: Frame[], numberCache: Map<number, WeakRef<RuntimeObject>>, stringCache: Map<string, WeakRef<RuntimeObject>>) {
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

  object(fullyQualifiedName: Name): RuntimeObject {
    const instance = this.rootFrame.get(fullyQualifiedName)
    if(!instance) throw new Error(`WKO not found: ${fullyQualifiedName}`)
    return instance
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  exec(node: Expression, frame?: Frame): Execution<RuntimeObject>
  exec(node: Node, frame?: Frame): Execution<undefined>
  *exec(node: Node, frame?: Frame): Execution<RuntimeValue> {
    if(frame) this.frameStack.push(frame)

    try {
      switch(node.kind) {
        case 'Test': yield* this.execTest(node); return
        case 'Program': yield* this.execProgram(node); return
        case 'Method': return yield* this.execMethod(node)
        case 'Body': return yield* this.execBody(node)
        case 'Variable': yield* this.execVariable(node); return
        case 'Assignment': yield* this.execAssignment(node); return
        case 'Return': return yield* this.execReturn(node)
        case 'Reference': return yield* this.execReference(node)
        case 'Self': return yield* this.execSelf(node)
        case 'Literal': return yield* this.execLiteral(node)
        case 'New': return yield* this.execNew(node)
        case 'Send': return yield* this.execSend(node)
        case 'Super': return yield* this.execSuper(node)
        case 'If': return yield* this.execIf(node)
        case 'Try': return yield* this.execTry(node)
        case 'Throw': return yield* this.execThrow(node)
        default: throw new Error(`Can't execute ${node.kind} node`)
      }
    } catch(error) {
      if(error instanceof WollokException || error instanceof WollokReturn) throw error
      const moduleFQN = error instanceof RangeError && error.message === 'Maximum call stack size exceeded'
        ? 'wollok.lang.StackOverflowException'
        : 'wollok.lang.EvaluationError'
      const exceptionInstance = new WollokException(this, yield* this.error(moduleFQN, {}, error))
      throw exceptionInstance
    }
    finally { if(frame) this.frameStack.pop() }
  }

  protected *execTest(node: Test): Execution<void> {
    yield node

    yield* this.exec(node.body, new Frame(node, node.parent().is('Describe')
      ? yield* this.instantiate(node.parent())
      : this.currentFrame,
    ))
  }

  protected *execProgram(node: Program): Execution<void> {
    yield node

    yield* this.exec(node.body, new Frame(node, this.currentFrame))
  }

  protected *execMethod(node: Method): Execution<RuntimeValue> {
    yield node

    if(node.isNative()) {
      const native = this.natives.get(node)
      if(!native) throw new Error(`Missing native for ${node.parent()?.fullyQualifiedName()}.${node.name}`)

      const args = node.parameters.map(parameter => this.currentFrame.get(parameter.name)!)

      return (yield* native.call(this, this.currentFrame.get('self')!, ...args)) ?? undefined
    } else if(node.isConcrete()) {
      try {
        return yield* this.exec(node.body!)
      } catch(error) {
        if(error instanceof WollokReturn) return error.instance
        else throw error
      }
    } else throw new Error(`Can't invoke abstract method ${node.parent().fullyQualifiedName()}.${node.name}/${node.parameters.length}`)
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

    this.currentFrame.set(node.name, value)
  }

  protected *execAssignment(node: Assignment): Execution<void> {
    const value = yield* this.exec(node.value)

    yield node

    if(node.variable.target()?.isConstant) throw new Error(`Can't assign the constant ${node.variable.target()?.name}`)

    this.currentFrame.set(node.variable.name, value, true)
  }

  protected *execReturn(node: Return): Execution<RuntimeValue> {
    const value = node.value && (yield* this.exec(node.value))
    yield node
    throw new WollokReturn(value)
  }

  protected *execReference(node: Reference<Node>): Execution<RuntimeValue> {
    yield node

    if(!node.scope) return this.currentFrame.get(node.name)

    const target = node.target()!

    return this.currentFrame.get(
      target.is('Module') || target.is('Variable') && target.parent().is('Package')
        ? target.fullyQualifiedName()
        : node.name
    )
  }

  protected *execSelf(node: Self): Execution<RuntimeValue> {
    yield node
    return this.currentFrame.get('self')
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
      return yield* this.instantiate(node.value, {})
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

    if((node.message === '&&' || node.message === 'and') && receiver.innerBoolean === false) return receiver
    if((node.message === '||' || node.message === 'or') && receiver.innerBoolean === true) return receiver

    const values: RuntimeObject[] = []
    for(const arg of node.args) values.push(yield * this.exec(arg))

    yield node

    return yield* this.send(node.message, receiver, ...values)
  }

  protected *execSuper(node: Super): Execution<RuntimeValue> {
    const args: RuntimeObject[] = []
    for(const arg of node.args) args.push(yield * this.exec(arg))

    yield node

    const receiver = this.currentFrame.get('self')!
    const currentMethod = node.ancestors().find(is('Method'))!
    //TODO: pass just the parent (not the FQN) to lookup?
    const method = receiver.module.lookupMethod(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName())

    if (!method) return yield* this.send('messageNotUnderstood', receiver, yield* this.reify(currentMethod.name), yield* this.list(...args))

    return yield* this.invoke(method, receiver, ...args)
  }

  protected *execIf(node: If): Execution<RuntimeValue> {
    const condition: RuntimeObject = yield* this.exec(node.condition)
    condition.assertIsBoolean()

    yield node

    return yield* this.exec(condition.innerBoolean ? node.thenBody : node.elseBody, new Frame(node, this.currentFrame))
  }

  protected *execTry(node: Try): Execution<RuntimeValue> {
    yield node

    let result: RuntimeValue
    try {
      result = yield* this.exec(node.body, new Frame(node, this.currentFrame))
    } catch(error) {
      if(!(error instanceof WollokException)) throw error

      const handler = node.catches.find(catcher => error.instance.module.inherits(catcher.parameterType.target()))

      if(handler) {
        result = yield* this.exec(handler.body, new Frame(handler, this.currentFrame, { [handler.parameter.name]: error.instance }))
      } else throw error
    } finally {
      yield* this.exec(node.always, new Frame(node, this.currentFrame))
    }

    return result

  }

  protected *execThrow(node: Throw): Execution<RuntimeValue> {
    const exception = yield* this.exec(node.exception)

    yield node

    throw new WollokException(this, exception)

  }

  *send(message: Name, receiver: RuntimeObject, ...args: RuntimeObject[]): Execution<RuntimeValue> {
    const method = receiver.module.lookupMethod(message, args.length)
    if (!method) return yield* this.send('messageNotUnderstood', receiver, yield* this.reify(message as string), yield* this.list(...args))

    return yield* this.invoke(method, receiver, ...args)
  }

  *invoke(method: Method, receiver: RuntimeObject, ...args: RuntimeObject[]): Execution<RuntimeValue> {
    const locals: Record<string, RuntimeObject> = {}
    for(let index = 0; index < method.parameters.length; index++) {
      const { name, isVarArg } = method.parameters[index]
      locals[name] = isVarArg ? yield* this.list(...args.slice(index)) : args[index]
    }

    return yield* this.exec(method, new Frame(method, receiver, locals))
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // INSTANTIATION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  *reify(value: boolean | number | string | null): Execution<RuntimeObject> {
    if(typeof value === 'boolean'){
      const existing = this.rootFrame.get(`${value}`)
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Boolean'), this.rootFrame, value)
      this.rootFrame.set(`${value}`, instance)
      return instance
    }

    if(typeof value === 'number') {
      const isRound = isInteger(value)
      const preciseValue = isRound ? value : Number(value.toFixed(DECIMAL_PRECISION))

      if(isRound) {
        const existing = this.numberCache.get(preciseValue)?.deref()
        if(existing) return existing
      }

      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Number'), this.rootFrame, preciseValue)
      if(isRound) this.numberCache.set(preciseValue, new WeakRef(instance))
      return instance
    }

    if(typeof value === 'string'){
      const existing = this.stringCache.get(value)?.deref()
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.String'), this.rootFrame, value)
      this.stringCache.set(value, new WeakRef(instance))
      return instance
    }

    const existing = this.rootFrame.get('null')
    if(existing) return existing
    const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Object'), this.rootFrame, value)
    this.rootFrame.set('null', instance)
    return instance
  }

  *list(...value: RuntimeObject[]): Execution<RuntimeObject> {
    return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.List'), this.rootFrame, value)
  }

  *set(...value: RuntimeObject[]): Execution<RuntimeObject> {
    const result = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Set'), this.rootFrame, [])
    for(const elem of value)
      yield* this.send('add', result, elem)
    return result
  }

  *error(moduleOrFQN: Module | Name, locals?: Record<Name, RuntimeObject>, error?: Error): Execution<RuntimeObject> {
    const module = typeof moduleOrFQN === 'string' ? this.environment.getNodeByFQN<Module>(moduleOrFQN) : moduleOrFQN
    const instance = new RuntimeObject(module, this.currentFrame, error)
    yield* this.init(instance, locals)
    return instance
  }

  *instantiate(moduleOrFQN: Module | Name, locals?: Record<Name, RuntimeObject>): Execution<RuntimeObject> {
    const module = typeof moduleOrFQN === 'string' ? this.environment.getNodeByFQN<Module>(moduleOrFQN) : moduleOrFQN
    const instance = new RuntimeObject(module, module.is('Singleton') && !module.name ? this.currentFrame : this.rootFrame)
    yield* this.init(instance, locals)
    return instance
  }

  protected *init(instance: RuntimeObject, locals: Record<Name, RuntimeObject> = {}): Execution<void> {
    const defaultFieldValues = instance.module.defaultFieldValues()
    const allFieldNames = [...defaultFieldValues.keys()].map(({ name }) => name)
    for(const local of keys(locals))
      if(!allFieldNames.includes(local))
        throw new Error(`Can't initialize ${instance.module.fullyQualifiedName()} with value for unexistent field ${local}`)

    for(const [field, defaultValue] of defaultFieldValues) {
      instance.set(field.name, field.name in locals
        ? locals[field.name]
        : defaultValue && this.exec(defaultValue, new Frame(defaultValue, instance))
      )
    }

    yield * this.send('initialize', instance)

    if(!instance.module.name || instance.module.is('Describe'))
      for (const [field] of defaultFieldValues)
        instance.get(field.name)
  }
}