import { Environment, is, isNode, Method, Module, Name, Node, Variable, Singleton, Expression } from '../model'
import { get } from '../extensions'

const { isArray } = Array
const { entries } = Object


export type NativeFunction = (this: Runner, self: RuntimeObject, ...args: RuntimeObject[]) => Generator<Node, RuntimeObject | undefined>
export interface Natives { [name: string]: NativeFunction | Natives }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Context {
  readonly parentContext?: Context
  protected readonly locals: Map<Name, RuntimeObject | Generator<Node, RuntimeObject> | undefined> = new Map()

  constructor(parentContext?: Context, locals: Record<Name, RuntimeObject> = {}) {
    this.parentContext = parentContext
    for(const [name, value] of entries(locals)) this.locals.set(name, value)
  }

  get(local: Name): RuntimeObject | undefined {
    const found = this.locals.get(local) ?? this.parentContext?.get(local)
    if (!found || found instanceof RuntimeObject) return found
    let lazy = found.next()
    while(!lazy.done) lazy = found.next()
    this.set(local, lazy.value)
    return lazy.value
  }

  set(local: Name, value: RuntimeObject | Generator<Node, RuntimeObject>  | undefined): void {
    this.locals.set(local, value)
  }
}


export type InnerValue = string | number | RuntimeObject[]

export class RuntimeObject extends Context {
  readonly module: Module
  readonly innerValue?: InnerValue

  constructor(module: Module, parentContext: Context, innerValue?: InnerValue) {
    super(parentContext)
    this.module = module
    this.innerValue = innerValue
    this.set('self', this)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

class WollokReturn { constructor(readonly instance?: RuntimeObject){} }
class WollokException { constructor(readonly instance: RuntimeObject){} }

export class Runner {
  readonly environment: Environment
  readonly natives: Natives
  readonly rootContext: Context
  readonly generator: Generator<Node, RuntimeObject | undefined>
  done = false

  constructor(environment: Environment, natives: Natives, node: Node, rootContext?: Context) {
    this.environment = environment
    this.natives = natives

    this.rootContext = rootContext ?? new Context()
    while(this.rootContext.parentContext) this.rootContext = this.rootContext.parentContext

    this.generator = this.exec(node, this.rootContext)

    if(!rootContext) {
      this.rootContext.set('null', new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Object'), this.rootContext))
      this.rootContext.set('true', new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Boolean'), this.rootContext))
      this.rootContext.set('false', new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Boolean'), this.rootContext))

      const globalConstants = this.environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
      const globalSingletons = this.environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)

      for (const module of globalSingletons)
        this.rootContext.set(module.fullyQualifiedName(), this.instantiate(module, this.rootContext))

      for (const constant of globalConstants)
        this.rootContext.set(constant.fullyQualifiedName(), this.exec(constant.value, this.rootContext) as Generator<Node, RuntimeObject>)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // CONTROLS
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  resume(breakpoints: Node[] = []): RuntimeObject | undefined {
    if(this.done) throw new Error('Evaluation is already finished')

    let next = this.generator.next()
    while(!next.done) {
      if(breakpoints.includes(next.value)) return
      next = this.generator.next()
    }

    this.done = true
    return next.value
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  exec(node: Expression, context: Context): Generator<Node, RuntimeObject>
  exec(node: Node, context: Context): Generator<Node, undefined>
  *exec(node: Node, context: Context): Generator<Node, RuntimeObject | undefined> {

    if(node.is('Body')) {
      yield node
      for(const sentence of node.sentences) yield* this.exec(sentence, context)
      return
    }


    if(node.is('Variable')) {
      yield node
      context.set(node.name, yield * this.exec(node.value, context))
      return
    }


    if(node.is('Assignment')) {
      const value = yield* this.exec(node.value, context)
      yield node
      context.set(node.variable.name, value)
      return
    }


    if(node.is('Return')) {
      yield node
      throw new WollokReturn(node.value && (yield* this.exec(node.value, context)))
    }


    if(node.is('Reference')) {
      yield node
      return context.get(node.name)
    }


    if(node.is('Self')) {
      yield node
      return context.get('self')
    }


    if(node.is('Literal')) {
      if(isArray(node.value)) {
        const [reference, args] = node.value
        const module = reference.target()!

        const values: RuntimeObject[] = []
        for(const arg of args) {
          const value = yield * this.exec(arg, context)
          if(value === undefined) throw new Error('Unexistent argument')
          values.push(value)
        }

        yield node

        return yield* module.name === 'List' ? this.list(values) : this.set(values)

      }

      if (isNode(node.value)) {
        yield node
        return yield* this.instantiate(node.value, context)

      }

      yield node
      return yield* this.reify(node.value as any)
    }


    if(node.is('New')) {
      const args: Record<Name, RuntimeObject> = {}
      for(const arg of node.args) args[arg.name] = yield* this.exec(arg.value, context)

      yield node

      if(!node.instantiated.target()) throw new Error(`Unexistent module ${node.instantiated.name}`)
      return yield* this.instantiate(node.instantiated.target()!, context, args)
    }


    if(node.is('Send')) {
      const receiver = yield* this.exec(node.receiver, context)
      if(!receiver) {
        throw new Error('Unexistent receiver')
      }

      const values: RuntimeObject[] = []
      for(const arg of node.args) {
        const value = yield * this.exec(arg, context)
        if(value === undefined) throw new Error('Unexistent argument')
        values.push(value)
      }

      yield node

      return yield* this.invoke(node.message, receiver, ...values)
    }


    if(node.is('Super')) {
      const values: RuntimeObject[] = []
      for(const arg of node.args) {
        const value = yield * this.exec(arg, context)
        if(value === undefined) throw new Error('Unexistent argument')
        values.push(value)
      }

      yield node

      const receiver = context.get('self')!
      const currentMethod = node.ancestors().find(is('Method'))!
      const method = receiver.module.lookupMethod(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName())
      return yield* this.invoke(method, receiver, ...values)
    }


    if(node.is('If')) {
      const condition = yield* this.exec(node.condition, context)

      yield node

      return yield* this.exec(condition === (yield* this.reify(true)) ? node.thenBody : node.elseBody, new Context(context))
    }

    if(node.is('Throw')) {
      const exception = yield* this.exec(node.exception, context)
      yield node
      throw new WollokException(exception!)
    }

    if(node.is('Try')) {
      let result: RuntimeObject | undefined

      yield node

      try {
        result = yield* this.exec(node.body, new Context(context))
      } catch(error) {
        if(!(error instanceof WollokException)) throw error
        const handler = node.catches.find(catcher => error.instance.module.inherits(catcher.parameterType.target()))
        if(handler) result = yield * this.exec(handler.body, new Context(context, { [handler.parameter.name]: error.instance }))
        else throw error
      } finally {
        yield* this.exec(node.always, new Context(context))
      }

      return result
    }

    throw new Error(`${node.kind} nodes can't be executed`)
  }


  *invoke(methodOrMessage: Method | Name | undefined, receiver: RuntimeObject, ...args: RuntimeObject[]): Generator<Node, RuntimeObject | undefined> {
    const method = methodOrMessage instanceof Method ? methodOrMessage :
      typeof methodOrMessage === 'string' ? receiver.module.lookupMethod(methodOrMessage, args.length) :
      methodOrMessage

    if (!method) return yield* this.invoke('messageNotUnderstood', receiver, yield* this.reify(methodOrMessage as string), yield* this.list(args))

    if (method.isAbstract()) throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
    if (methodOrMessage instanceof Method && !method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

    if(method.body === 'native') {
      const nativeFQN = `${method.parent().fullyQualifiedName()}.${method.name}`
      const native = get<NativeFunction>(this.natives, nativeFQN)
      if(!native) throw new Error(`Missing native ${nativeFQN}`)
      return yield* native.bind(this)(receiver, ...args)
    } else {
      let result: RuntimeObject | undefined
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

  *reify(value: boolean | number | string | null): Generator<Node, RuntimeObject> {
    if(value === null) return this.rootContext.get(`${value}`)!
    if(typeof value === 'boolean') return this.rootContext.get(`${value}`)!
    if(typeof value === 'number') return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Number'), this.rootContext, value)
    if(typeof value === 'string') return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.String'), this.rootContext, value)
    throw new Error(`Unreifiable value ${value}`)
  }

  *list(value: RuntimeObject[]): Generator<Node, RuntimeObject> {
    return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.List'), this.rootContext, value)
  }

  *set(value: RuntimeObject[]): Generator<Node, RuntimeObject> {
    return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Set'), this.rootContext, value)
  }

  *instantiate(module: Module, context: Context, locals: Record<Name, RuntimeObject> = {}): Generator<Node, RuntimeObject> {
    const defaults = module.defaultFieldValues()
    const instance = new RuntimeObject(module, context)
    for(const [field, defaultValue] of defaults)
      instance.set(field.name, field.name in locals ? locals[field.name] : defaultValue && (yield* this.exec(defaultValue, instance)))

    yield * this.invoke('initialize', instance)

    return instance
  }
}