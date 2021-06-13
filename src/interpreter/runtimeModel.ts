import { Environment, is, isNode, Method, Module, Name, Node, Variable, Singleton, Expression, List, Class, Id, Body, Assignment, Return, Reference, Self, Literal, LiteralValue, New, Send, Super, If, Try, Throw, Test, Program } from '../model'
import { get, last } from '../extensions'
import { v4 as uuid } from 'uuid'

const { isArray } = Array
const { keys, entries } = Object


const DECIMAL_PRECISION = 5


export type Execution<T> = Generator<Node, T>

export type RuntimeValue = RuntimeObject | undefined

export type NativeFunction = (this: Evaluation, self: RuntimeObject, ...args: RuntimeObject[]) => Execution<RuntimeValue>
export interface Natives { [name: string]: NativeFunction | Natives }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Context {
  readonly id: Id = uuid()
  readonly parentContext?: Context
  readonly locals: Map<Name, RuntimeValue | Execution<RuntimeObject>> = new Map()

  constructor(parentContext?: Context, locals: Record<Name, RuntimeObject | Execution<RuntimeObject>> = {}) {
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


export type InnerValue = null | boolean | string | number | RuntimeObject[] | Error

export class RuntimeObject extends Context {
  readonly module: Module
  readonly innerValue?: InnerValue

  constructor(module: Module, parentContext: Context, innerValue?: InnerValue) {
    super(parentContext)
    this.module = module
    this.innerValue = innerValue
    this.set('self', this)
  }


  protected baseCopy(contextCache: Map<Id, Context>): RuntimeObject {
    return new RuntimeObject(
      this.module,
      this.parentContext!.copy(contextCache),
      isArray(this.innerValue) ? this.innerValue.map(elem => elem.copy(contextCache)) : this.innerValue
    )
  }

  assertIsBoolean(): asserts this is RuntimeObject & { innerValue: boolean } { this.assertIs('wollok.lang.Boolean', 'boolean') }

  assertIsNumber(): asserts this is RuntimeObject & { innerValue: number } { this.assertIs('wollok.lang.Number', 'number') }

  assertIsString(): asserts this is RuntimeObject & { innerValue: string } { this.assertIs('wollok.lang.String', 'string') }

  assertIsCollection(): asserts this is RuntimeObject & { innerValue: RuntimeObject[] } {
    if (!isArray(this.innerValue) || this.innerValue.length && !(this.innerValue[0] instanceof RuntimeObject))
      throw new TypeError(`Malformed Runtime Object: Collection inner value should be a List<RuntimeObject> but was ${this.innerValue}`)
  }

  assertIsException(): asserts this is RuntimeObject & { innerValue?: Error } {
    if(this.innerValue && !(this.innerValue instanceof Error)) throw new TypeError('Malformed Runtime Object: Exception inner value, if defined, should be an Error')
  }

  assertIsNotNull(): asserts this is RuntimeObject & { innerValue?: Exclude<InnerValue, null> } {
    if(this.innerValue === null) throw new TypeError('Malformed Runtime Object: Object was expected to not be null')
  }

  protected assertIs(moduleFQN: Name, innerValueType: string): void {
    if (this.module.fullyQualifiedName() !== moduleFQN)
      throw new TypeError(`Expected an instance of ${moduleFQN} but got a ${this.module.fullyQualifiedName()} instead`)
    if (typeof this.innerValue !== innerValueType)
      throw new TypeError(`Malformed Runtime Object: invalid inner value ${this.innerValue} for ${moduleFQN} instance`)
  }
}


export class Frame {
  readonly node: Node
  readonly context: Context

  constructor(node: Node, context: Context) {
    this.node = node
    this.context = context
  }

  copy(contextCache: Map<Id, Context>): Frame {
    return new Frame(this.node, this.context.copy(contextCache))
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
  readonly execution: Execution<RuntimeValue>
  readonly breakpoints: Node[] = []

  constructor(evaluation: Evaluation, execution: Execution<RuntimeValue>) {
    this.evaluation = evaluation
    this.execution = execution
  }

  addBreakpoint(breakpoint: Node): void {
    this.breakpoints.push(breakpoint)
  }

  removeBreakpoint(breakpoint: Node): void {
    const nextBreakpoints = this.breakpoints.filter(node => node !== breakpoint)
    this.breakpoints.splice(0, this.breakpoints.length)
    this.breakpoints.push(...nextBreakpoints)
  }

  fork(continuation: (evaluation: Evaluation) => Execution<RuntimeValue>): ExecutionDirector {
    const copyEvaluation = this.evaluation.copy()
    return new ExecutionDirector(copyEvaluation, continuation(copyEvaluation))
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
      return { done: true, evaluation: this.evaluation, result: next.value }
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

export class WollokReturn extends Error { constructor(readonly instance?: RuntimeObject){ super() } }
export class WollokException extends Error { constructor(readonly frameStack: List<Frame>, readonly instance: RuntimeObject){ super(`WollokException: ${instance.module.name}`) } }


export default class Interpreter {
  readonly environment: Environment
  readonly natives: Natives

  constructor(environment: Environment, natives: Natives) {
    this.environment = environment
    this.natives = natives
  }
}


export class Evaluation {
  readonly natives: Natives
  readonly frameStack: Frame[]
  console: Console = console

  get currentContext(): Context { return last(this.frameStack)!.context }
  get currentNode(): Node { return last(this.frameStack)!.node }
  get rootContext(): Context { return this.frameStack[0].context }
  get environment(): Environment { return this.frameStack[0].node as Environment }

  static build(environment: Environment, natives: Natives): Evaluation {
    const evaluation = new Evaluation(natives, [new Frame(environment, new Context())])

    const globalSingletons = environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)
    for (const module of globalSingletons)
      evaluation.rootContext.set(module.fullyQualifiedName(), evaluation.instantiate(module))


    const globalConstants = environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
    for (const constant of globalConstants)
      evaluation.rootContext.set(constant.fullyQualifiedName(), evaluation.exec(constant.value, evaluation.rootContext))


    for (const module of globalSingletons) {
      const instance = evaluation.rootContext.get(module.fullyQualifiedName())
      for (const field of module.defaultFieldValues().keys())
        instance!.get(field.name)
    }

    for (const constant of globalConstants)
      evaluation.rootContext.get(constant.fullyQualifiedName())


    return evaluation
  }

  protected constructor(natives: Natives, frameStack: Frame[]) {
    this.natives = natives
    this.frameStack = frameStack
  }

  copy(contextCache: Map<Id, Context> = new Map()): Evaluation {
    return new Evaluation(this.natives, this.frameStack.map(frame => frame.copy(contextCache)))
  }

  allInstances(): Set<RuntimeObject> {
    const visitedContexts: Id[] = []

    function contextInstances(context?: Context): List<RuntimeObject> {
      if(!context || visitedContexts.includes(context.id)) return []
      visitedContexts.push(context.id)
      const localInstances = [...context.locals.values()].filter((value): value is RuntimeObject => value instanceof RuntimeObject)
      return [
        ...contextInstances(context.parentContext),
        ...context instanceof RuntimeObject ? [context, ...isArray(context.innerValue) ? context.innerValue.flatMap(contextInstances) : []] : [],
        ...localInstances.flatMap(contextInstances),
      ]
    }

    return new Set(this.frameStack.flatMap(frame => contextInstances(frame.context)))
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  exec(node: Expression, context?: Context): Execution<RuntimeObject>
  exec(node: Node, context?: Context): Generator<Node, undefined>
  *exec(node: Node, context: Context = this.currentContext): Execution<RuntimeValue> {
    this.frameStack.push(new Frame(node, context))

    try {
      return yield* node.match({
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
      })
    } catch(error) {
      if(error instanceof WollokException || error instanceof WollokReturn) throw error
      else {
        const module = this.environment.getNodeByFQN<Class>(
          error.message === 'Maximum call stack size exceeded'
            ? 'wollok.lang.StackOverflowException'
            : 'wollok.lang.EvaluationError'
        )

        throw new WollokException([...this.frameStack], new RuntimeObject(module, context, error))
      }
    } finally {
      this.frameStack.pop()
    }
  }


  protected *execTest(node: Test): Execution<undefined> {
    yield node

    yield* this.exec(node.body, node.parent().is('Describe')
      ? yield* this.instantiate(node.parent())
      : new Context(this.currentContext)
    )

    return undefined
  }

  protected *execProgram(node: Program): Execution<undefined> {
    yield node

    yield* this.exec(node.body)

    return undefined
  }

  protected *execBody(node: Body): Execution<RuntimeValue> {
    yield node

    let result: RuntimeValue
    for(const sentence of node.sentences) result = yield* this.exec(sentence)

    return result
  }

  protected *execVariable(node: Variable): Execution<RuntimeValue> {
    const value = yield* this.exec(node.value)

    yield node

    this.currentContext.set(node.name, value)

    return
  }

  protected *execAssignment(node: Assignment): Execution<RuntimeValue> {
    const value = yield* this.exec(node.value)

    yield node

    if(node.variable.target()?.isConstant) throw new Error(`Can't assign the constant ${node.variable.target()?.name}`)

    this.currentContext.set(node.variable.name, value, true)

    return
  }

  protected *execReturn(node: Return): Execution<RuntimeValue> {
    const value = node.value && (yield* this.exec(node.value))
    yield node
    throw new WollokReturn(value)
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

      return yield* module.name === 'List' ? this.list(values) : this.set(values)
    }

    if (isNode(node.value)) {
      yield node
      return yield* this.instantiate(node.value)
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

    return yield* this.exec(condition.innerValue ? node.thenBody : node.elseBody, new Context(this.currentContext))
  }

  protected *execTry(node: Try): Execution<RuntimeValue> {
    yield node

    let result: RuntimeValue
    try {
      result = yield* this.exec(node.body, new Context(this.currentContext))
    } catch(error) {
      if(!(error instanceof WollokException)) throw error

      const handler = node.catches.find(catcher => error.instance.module.inherits(catcher.parameterType.target()))

      if(handler) result = yield* this.exec(handler.body, new Context(this.currentContext, { [handler.parameter.name]: error.instance }))
      else throw error
    } finally {
      yield* this.exec(node.always, new Context(this.currentContext))
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

    if (!method) return yield* this.invoke('messageNotUnderstood', receiver, yield* this.reify(methodOrMessage as string), yield* this.list(args))
    if (method.isAbstract()) throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
    if (!method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

    if(method.body === 'native') { //TODO: method.isNative(): this & {body: 'native'}
      const nativeFQN = `${method.parent().fullyQualifiedName()}.${method.name}`
      const native = get<NativeFunction>(this.natives, nativeFQN)
      if(!native) throw new Error(`Missing native ${nativeFQN}`)

      this.frameStack.push(new Frame(method, new Context(receiver)))
      try {
        return yield* native.call(this, receiver, ...args)
      } finally { this.frameStack.pop() }
    } else {
      let result: RuntimeValue
      const locals: Record<Name, RuntimeObject> = {}
      for(let index = 0; index < method.parameters.length; index++){
        const { name, isVarArg } = method.parameters[index]
        locals[name] = isVarArg ? yield* this.list(args.slice(index)) : args[index]
      }

      try {
        result = yield* this.exec(method.body!, new Context(receiver, locals))
      } catch(error) {
        if(!(error instanceof WollokReturn)) throw error
        else result = error.instance
      }
      return result
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // INSTANCIATION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  *reify(value: boolean | number | string | null): Execution<RuntimeObject> {
    if(typeof value === 'boolean'){
      const existing = this.rootContext.get(`${value}`)
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Boolean'), this.rootContext, value)
      this.rootContext.set(`${value}`, instance)
      return instance
    }

    if(typeof value === 'number') {
      const stringValue = value.toFixed(DECIMAL_PRECISION)
      const existing = this.rootContext.get(`N!${stringValue}`)
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Number'), this.rootContext, Number(stringValue))
      this.rootContext.set(`N!${stringValue}`, instance)
      return instance
    }

    if(typeof value === 'string'){
      const existing = this.rootContext.get(`S!${value}`)
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.String'), this.rootContext, value)
      this.rootContext.set(`S!${value}`, instance)
      return instance
    }

    const existing = this.rootContext.get('null')
    if(existing) return existing
    const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Object'), this.rootContext, value)
    this.rootContext.set('null', instance)
    return instance
  }

  *list(value: RuntimeObject[]): Execution<RuntimeObject> {
    return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.List'), this.currentContext, value)
  }

  *set(value: RuntimeObject[]): Execution<RuntimeObject> {
    const result = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Set'), this.currentContext, [])
    for(const elem of value)
      yield* this.invoke('add', result, elem)
    return result
  }

  *instantiate(module: Module, locals: Record<Name, RuntimeObject> = {}): Execution<RuntimeObject> {
    const defaultFieldValues = module.defaultFieldValues()

    const allFieldNames = [...defaultFieldValues.keys()].map(({ name }) => name)
    for(const local of keys(locals))
      if(!allFieldNames.includes(local))
        throw new Error(`Can't instantiate ${module.fullyQualifiedName()} with value for unexistent field ${local}`)

    const instance = new RuntimeObject(module, this.currentContext)

    for(const [field, defaultValue] of defaultFieldValues) {
      instance.set(field.name, field.name in locals ? locals[field.name] : defaultValue && this.exec(defaultValue, instance))
    }

    yield * this.invoke('initialize', instance)

    if(!module.name || module.is('Describe'))
      for (const [field] of defaultFieldValues)
        instance.get(field.name)

    return instance
  }
}