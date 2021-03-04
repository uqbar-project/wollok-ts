import { Body, Environment, Id, is, isNode, List, Method, Module, Name, Node } from '../model'
import { get } from '../extensions'
import { env } from 'yargs'

const { isArray } = Array

export type NativeFunction = (self: RuntimeObject, ...args: RuntimeObject[]) => Generator<Node, RuntimeObject | undefined>
export interface Natives { [name: string]: NativeFunction | Natives }

// const CREATE_OR_RETRIEVE_INSTANCE = Symbol('createOrRetrieveInstance')

// export class Evaluation {
//   protected instances: Map<Id, RuntimeObject> = new Map()

//   allInstances(): IterableIterator<RuntimeObject> { return this.instances.values() }
//   instance(id: Id): RuntimeObject | undefined { return this.instances.get(id) }
//   [CREATE_OR_RETRIEVE_INSTANCE](instance: RuntimeObject) {

//   }
// }

export class Context {
  constructor(
    protected readonly parentContext?: Context,
    protected readonly locals: Map<Name, RuntimeObject | undefined> = new Map(),
  ){}

  get(local: Name): RuntimeObject | undefined {
    return this.locals.get(local) ?? this.parentContext?.get(local)
  }

  set(local: Name, value: RuntimeObject | undefined): void {
    this.locals.set(local, value)
  }
}


export type InnerValue = string | number | RuntimeObject[]

export class RuntimeObject extends Context {

  static * Boolean(environment: Environment, context: Context, value: boolean): Generator<Node, RuntimeObject> {
    return context.get(`${value}`)!
  }

  static * Number(environment: Environment, context: Context, value: number): Generator<Node, RuntimeObject> {
    return new RuntimeObject(environment.getNodeByFQN('wollok.lang.Number'), context, new Map(), value)
  }

  static * String(environment: Environment, context: Context, value: string): Generator<Node, RuntimeObject> {
    return new RuntimeObject(environment.getNodeByFQN('wollok.lang.String'), context, new Map(), value)
  }

  static * List(environment: Environment, context: Context, value: RuntimeObject[]): Generator<Node, RuntimeObject> {
    return new RuntimeObject(environment.getNodeByFQN('wollok.lang.List'), context, new Map(), value)
  }

  static * Set(environment: Environment, context: Context, value: RuntimeObject[]): Generator<Node, RuntimeObject> {
    return new RuntimeObject(environment.getNodeByFQN('wollok.lang.Set'), context, new Map(), value)
  }

  static * Object(module: Module, context: Context, locals: Map<Name, RuntimeObject | undefined> = new Map()): Generator<Node, RuntimeObject> {
    const defaults = module.defaultFieldValues()
    const instance = new RuntimeObject(module, context, locals)
    for(const [field, value] of defaults)
      if(!locals.has(field.name)) instance.set(field.name, yield* exec(value, context))

    yield * invoke(environment, natives)('initialize', instance)

    return instance
  }

  protected constructor(readonly module: Module, parentContext: Context, locals: Map<Name, RuntimeObject | undefined>, public innerValue?: InnerValue) {
    super(parentContext)
    for(const [name, value] of locals) this.set(name, value)
    this.set('self', this)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EXECUTION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

class WollokReturn { constructor(readonly instance?: RuntimeObject){} }
class WollokException { constructor(readonly instance: RuntimeObject){} }

const exec = (environment: Environment, natives: Natives) => function* exec(node: Node, context: Context): Generator<Node, RuntimeObject | undefined> {

  if(node.is('Body')) {
    yield node

    let result: RuntimeObject | undefined
    for(const sentence of node.sentences)
      result = yield* exec(sentence, context)

    return result
  }


  if(node.is('Variable')) {
    yield node
    context.set(node.name, yield * exec(node.value, context))
  }


  if(node.is('Assignment')) {
    const value = yield* exec(node.value, context)
    yield node
    context.set(node.variable.name, value)
  }


  if(node.is('Return')) {
    yield node
    throw new WollokReturn(node.value && (yield * exec(node.value, context)))
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
    if (node.value === null) {
      yield node
      return context.get('null')
    }

    if (typeof node.value === 'boolean') {
      yield node
      return context.get(`${node.value}`)
    }

    if (typeof node.value === 'number') {
      yield node
      return yield* RuntimeObject.Number(environment, context, node.value)
    }

    if (typeof node.value === 'string') {
      yield node
      return yield* RuntimeObject.String(environment, context, node.value)
    }

    if(isArray(node.value)) {
      const [reference, args] = node.value
      const module = reference.target()!

      const values: RuntimeObject[] = []
      for(const arg of args) {
        const value = yield * exec(arg, context)
        if(value === undefined) throw new Error('Unexistent argument')
        values.push(value)
      }

      yield node

      return yield* (module.name === 'List' ? RuntimeObject.List : RuntimeObject.Set)(environment, context, values)
    }

    if (isNode(node.value)) {
      yield node
      return yield* RuntimeObject.Object(node.value, context)
    }
  }


  if(node.is('New')) {
    const args: [Name, RuntimeObject][] = []
    for(const arg of node.args) args.push([arg.name, (yield* exec(arg.value, context))!])

    yield node

    if(!node.instantiated.target()) throw new Error(`Unexistent module ${node.instantiated.name}`)
    return yield* RuntimeObject.Object(node.instantiated.target()!, context, new Map(args))
  }


  if(node.is('Send')) {
    const receiver = yield* exec(node.receiver, context)
    if(!receiver) throw new Error('Unexistent receiver')

    const values: RuntimeObject[] = []
    for(const arg of node.args) {
      const value = yield * exec(arg, context)
      if(value === undefined) throw new Error('Unexistent argument')
      values.push(value)
    }

    yield node

    return yield* invoke(environment, natives)(node.message, receiver, ...values)
  }


  if(node.is('Super')) {
    const values: RuntimeObject[] = []
    for(const arg of node.args) {
      const value = yield * exec(arg, context)
      if(value === undefined) throw new Error('Unexistent argument')
      values.push(value)
    }

    yield node

    const receiver = context.get('self')!
    const currentMethod = node.ancestors().find(is('Method'))!
    const method = receiver.module.lookupMethod(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName())
    return yield* invoke(environment, natives)(method, receiver, ...values)
  }


  if(node.is('If')) {
    const condition = yield* exec(node.condition, context)

    yield node

    return yield* exec(condition === (yield* RuntimeObject.Boolean(environment, context, true)) ? node.thenBody : node.elseBody, new Context(context))
  }

  if(node.is('Throw')) {
    const exception = yield* exec(node.exception, context)
    yield node
    throw new WollokException(exception!)
  }

  if(node.is('Try')) {
    let result: RuntimeObject | undefined

    yield node

    try {
      result = yield* exec(node.body, new Context(context))
    } catch(error) {
      if(!(error instanceof WollokException)) throw error
      const handler = node.catches.find(catcher => error.instance.module.inherits(catcher.parameterType.target()))
      if(handler) result = yield * exec(handler.body, new Context(context, new Map([[handler.parameter.name, error.instance]])))
      else throw error
    } finally {
      yield* exec(node.always, new Context(context))
    }

    return result
  }

  throw new Error(`${node.kind} nodes can't be executed`)
}


const invoke = (environment: Environment, natives: Natives) => function* invoke(methodOrMessage: Method | Name | undefined, receiver: RuntimeObject, ...args: RuntimeObject[]): Generator<Node, RuntimeObject | undefined> {
  const method = methodOrMessage instanceof Method ? methodOrMessage :
    typeof methodOrMessage === 'string' ? receiver.module.lookupMethod(methodOrMessage, args.length) :
    methodOrMessage

  if (!method) return yield* invoke(
    'messageNotUnderstood',
    receiver,
    yield* RuntimeObject.String(environment, context, methodOrMessage),
    yield* RuntimeObject.List(environment, context, args),
  )

  if (method.isAbstract()) throw new Error(`Can't invoke abstract method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)
  if (methodOrMessage instanceof Method && !method.matchesSignature(method.name, args.length)) throw new Error(`Wrong number of arguments (${args.length}) for method ${method.parent().fullyQualifiedName()}.${method.name}/${method.parameters.length}`)

  if(method.body === 'native') {
    const nativeFQN = `${method.parent().fullyQualifiedName()}.${method.name}`
    const native = get<NativeFunction>(natives, nativeFQN)
    if(!native) throw new Error(`Missing native ${nativeFQN}`)
    return yield* native(receiver, ...args)
  } else {
    let result: RuntimeObject | undefined
    try {
      result = yield* exec(environment, natives)(method.body!, new Context(receiver))
    } catch(error) {
      if(!(error instanceof WollokReturn)) throw error
      else result = error.instance
    }
    return result
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class Runner {
  done = false
  generator: Generator<Node, RuntimeObject | undefined>

  constructor(environment: Environment, natives: Natives, node: Node, context: Context = new Context()) {
    this.generator = exec(environment, natives)(node, context)
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