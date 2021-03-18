import { Environment, is, isNode, Method, Module, Name, Node, Variable, Singleton, Expression, List, Class } from '../model'
import { get, last } from '../extensions'
import { v4 as uuid } from 'uuid'

const { isArray } = Array
const { keys, entries } = Object

const DECIMAL_PRECISION = 5


export type NativeFunction = (this: Runner, self: RuntimeObject, ...args: RuntimeObject[]) => Generator<Node, RuntimeObject | undefined>
export interface Natives { [name: string]: NativeFunction | Natives }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTEXTS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Context {
  readonly parentContext?: Context
  protected readonly locals: Map<Name, RuntimeObject | Generator<Node, RuntimeObject> | undefined> = new Map()

  constructor(parentContext?: Context, locals: Record<Name, RuntimeObject | Generator<Node, RuntimeObject>> = {}) {
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

  set(local: Name, value: RuntimeObject | Generator<Node, RuntimeObject>  | undefined, lookup = false): void {
    if(!lookup || this.locals.has(local)) this.locals.set(local, value)
    else this.parentContext?.set(local, value, lookup)
  }
}


export type InnerValue = boolean | string | number | RuntimeObject[] | Error

export class RuntimeObject extends Context {
  readonly id = uuid()
  readonly module: Module
  readonly innerValue?: InnerValue

  constructor(module: Module, parentContext: Context, innerValue?: InnerValue) {
    super(parentContext)
    this.module = module
    this.innerValue = innerValue
    this.set('self', this)
  }

  assertIsException(): asserts this is RuntimeObject & { innerValue?: Error } {
    if(this.innerValue && !(this.innerValue instanceof Error)) throw new TypeError('Malformed Runtime Object: Exception inner value, if defined, should be an Error')
  }

  assertIsBoolean(): asserts this is RuntimeObject & { innerValue: boolean } { this.assertIs('wollok.lang.Boolean', 'boolean') }

  assertIsNumber(): asserts this is RuntimeObject & { innerValue: number } { this.assertIs('wollok.lang.Number', 'number') }

  assertIsString(): asserts this is RuntimeObject & { innerValue: string } { this.assertIs('wollok.lang.String', 'string') }

  assertIsCollection(): asserts this is RuntimeObject & { innerValue: RuntimeObject[] } {
    if (!isArray(this.innerValue) || this.innerValue.length && !(this.innerValue[0] instanceof RuntimeObject))
      throw new TypeError(`Malformed Runtime Object: Collection inner value should be a List<RuntimeObject> but was ${this.innerValue}`)
  }

  protected assertIs(moduleFQN: Name, innerValueType: string): void {
    if (this.module.fullyQualifiedName() !== moduleFQN)
      throw new TypeError(`Expected an instance of ${moduleFQN} but got a ${this.module.fullyQualifiedName()} instead`)
    if (typeof this.innerValue !== innerValueType)
      throw new TypeError(`Malformed Runtime Object: invalid inner value ${this.innerValue} for ${moduleFQN} instance`)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNNER CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

class RunnerController {
  generator: Generator<Node, RuntimeObject | undefined>
  done = false

  constructor(runner: Runner, node: Node) {
    this.generator = runner.exec(node)
  }

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
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class WollokReturn extends Error { constructor(readonly instance?: RuntimeObject){ super() } }
export class WollokException extends Error { constructor(readonly frameStack: List<Frame>, readonly instance: RuntimeObject){ super() } }


export default class Interpreter {
  readonly environment: Environment
  readonly natives: Natives

  constructor(environment: Environment, natives: Natives) {
    this.environment = environment
    this.natives = natives
  }
}


export class Frame {
  readonly node: Node
  readonly context: Context

  constructor(node: Node, context: Context) {
    this.node = node
    this.context = context
  }
}


export class Runner {
  readonly natives: Natives
  readonly frameStack: Frame[] = []

  get currentContext(): Context { return last(this.frameStack)!.context }
  get rootContext(): Context { return this.frameStack[0].context }
  get environment(): Environment { return this.frameStack[0].node as Environment }

  constructor(environment: Environment, natives: Natives) {
    this.natives = natives
    this.frameStack.push(new Frame(environment, new Context()))

    this.rootContext.set('null', this.instantiate(this.environment.getNodeByFQN('wollok.lang.Object')))

    const globalSingletons = this.environment.descendants().filter((node: Node): node is Singleton => node.is('Singleton') && !!node.name)
    for (const module of globalSingletons)
      this.rootContext.set(module.fullyQualifiedName(), this.instantiate(module))


    const globalConstants = this.environment.descendants().filter((node: Node): node is Variable => node.is('Variable') && node.parent().is('Package'))
    for (const constant of globalConstants)
      this.rootContext.set(constant.fullyQualifiedName(), this.exec(constant.value, this.rootContext))
  }

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  exec(node: Expression, context?: Context): Generator<Node, RuntimeObject>
  exec(node: Node, context?: Context): Generator<Node, undefined>
  *exec(node: Node, context: Context = this.currentContext): Generator<Node, RuntimeObject | undefined> {
    this.frameStack.push(new Frame(node, context))

    try {
      if(node.is('Body')) {
        yield node

        let result: RuntimeObject | undefined
        for(const sentence of node.sentences) result = yield* this.exec(sentence)
        return result
      }


      if(node.is('Variable')) {
        const value = yield * this.exec(node.value)
        yield node
        context.set(node.name, value)
        return
      }


      if(node.is('Assignment')) {
        const value = yield* this.exec(node.value)
        yield node
        if(node.variable.target()?.isReadOnly) throw new Error(`Can't assign the constant ${node.variable.target()?.name}`)
        context.set(node.variable.name, value, true)
        return
      }


      if(node.is('Return')) {
        const value = node.value && (yield* this.exec(node.value))
        yield node
        throw new WollokReturn(value)
      }


      if(node.is('Reference')) {
        yield node

        const target = node.target()

        return context.get(
          target.is('Module') || target.is('Variable') && target.parent().is('Package')
            ? target.fullyQualifiedName()
            : node.name
        )
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


      if(node.is('New')) {
        const args: Record<Name, RuntimeObject> = {}
        for(const arg of node.args) args[arg.name] = yield* this.exec(arg.value)

        yield node

        if(!node.instantiated.target()) throw new Error(`Unexistent module ${node.instantiated.name}`)

        return yield* this.instantiate(node.instantiated.target()!, args)
      }


      if(node.is('Send')) {
        const receiver = yield* this.exec(node.receiver)
        const values: RuntimeObject[] = []
        for(const arg of node.args) values.push(yield * this.exec(arg))

        yield node

        return yield* this.invoke(node.message, receiver, ...values)
      }


      if(node.is('Super')) {
        const values: RuntimeObject[] = []
        for(const arg of node.args) values.push(yield * this.exec(arg))

        yield node

        const receiver = context.get('self')!
        const currentMethod = node.ancestors().find(is('Method'))!
        const method = receiver.module.lookupMethod(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName())
        return yield* this.invoke(method, receiver, ...values)
      }


      if(node.is('If')) {
        const condition: RuntimeObject = yield* this.exec(node.condition)
        condition.assertIsBoolean()

        yield node

        return yield* this.exec(condition.innerValue ? node.thenBody : node.elseBody, new Context(context))
      }

      if(node.is('Throw')) {
        const exception = yield* this.exec(node.exception)

        yield node

        throw new WollokException([...this.frameStack], exception)
      }

      if(node.is('Try')) {
        yield node

        let result: RuntimeObject | undefined
        try {
          result = yield* this.exec(node.body, new Context(context))
        } catch(error) {
          if(!(error instanceof WollokException)) throw error

          const handler = node.catches.find(catcher => error.instance.module.inherits(catcher.parameterType.target()))

          if(handler) result = yield* this.exec(handler.body, new Context(context, { [handler.parameter.name]: error.instance }))
          else throw error
        } finally {
          yield* this.exec(node.always, new Context(context))
        }

        return result
      }

    } catch(error) {
      if(error instanceof WollokException || error instanceof WollokReturn) throw error
      else {
        const module = this.environment.getNodeByFQN<Class>(error.message === 'Maximum call stack size exceeded'
          ? 'wollok.lang.StackOverflowException'
          : 'wollok.lang.EvaluationError'
        )
        throw new WollokException([...this.frameStack], new RuntimeObject(module, context, error))
      }
    } finally {
      this.frameStack.pop()
    }

    throw new Error(`${node.kind} nodes can't be executed`)
  }


  *invoke(methodOrMessage: Method | Name | undefined, receiver: RuntimeObject, ...args: RuntimeObject[]): Generator<Node, RuntimeObject | undefined> {
    const method = methodOrMessage instanceof Method ? methodOrMessage :
      typeof methodOrMessage === 'string' ? receiver.module.lookupMethod(methodOrMessage, args.length) :
      methodOrMessage

    if (!method) return yield* this.invoke('messageNotUnderstood', receiver, yield* this.reify(methodOrMessage as string), yield* this.list(args))
    if (method.isAbstract()) throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
    if (!method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

    if(method.body === 'native') {
      const nativeFQN = `${method.parent().fullyQualifiedName()}.${method.name}`
      const native = get<NativeFunction>(this.natives, nativeFQN)
      if(!native) throw new Error(`Missing native ${nativeFQN}`)

      this.frameStack.push(new Frame(method, new Context(receiver)))
      try {
        return yield* native.bind(this)(receiver, ...args)
      } finally { this.frameStack.pop() }
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

    if(typeof value === 'boolean'){
      const existing = this.rootContext.get(`${value}`)
      if(existing) return existing
      const instance = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Boolean'), this.rootContext, value)
      this.rootContext.set(`${value}`, instance)
      return instance
    }

    return this.rootContext.get(`${value}`)!
  }

  *list(value: RuntimeObject[]): Generator<Node, RuntimeObject> {
    return new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.List'), this.currentContext, value)
  }

  *set(value: RuntimeObject[]): Generator<Node, RuntimeObject> {
    const result = new RuntimeObject(this.environment.getNodeByFQN('wollok.lang.Set'), this.currentContext, [])
    for(const elem of value)
      yield* this.invoke('add', result, elem)
    return result
  }

  *instantiate(module: Module, locals: Record<Name, RuntimeObject> = {}): Generator<Node, RuntimeObject> {
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

    if(!module.name)
      for (const [field] of defaultFieldValues)
        instance.get(field.name)

    return instance
  }
}