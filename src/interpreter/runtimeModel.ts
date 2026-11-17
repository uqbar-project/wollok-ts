import { v4 as uuid } from '@lukeed/uuid'
import { compile } from '../compiler'
import {
  BOOLEAN_MODULE,
  CLOSURE_EVALUATE_METHOD,
  CLOSURE_MODULE,
  DATE_MODULE,
  DICTIONARY_MODULE,
  EXCEPTION_MODULE,
  INITIALIZE_METHOD,
  KEYWORDS,
  LIST_MODULE,
  NUMBER_MODULE,
  OBJECT_MODULE,
  PAIR_MODULE,
  RANGE_MODULE,
  SET_MODULE,
  STRING_MODULE,
  TO_STRING_METHOD,
  VOID_WKO,
  WOLLOK_BASE_PACKAGE,
  WOLLOK_EXTRA_STACK_TRACE_HEADER,
} from '../constants'
import {
  get,
  is,
  last,
  List,
  match,
  otherwise,
  raise,
  when,
} from '../extensions'
import {
  assertArgumentNotVoid,
  assertNewArgumentNotVoid,
  assertNotVoid,
  assertReceiverNotVoid,
  getExpressionFor,
  getMethodContainer,
  getUninitializedAttributesForInstantiation,
  hasMoreThanOneSuperclass,
  isInsideGlobalVariable,
  isNamedSingleton,
  isVoid,
  loopInAssignment,
  shortCircuits,
  showParameter,
  superclassIsLastInLinearization,
  superMethodDefinition,
  targetName,
} from '../helpers'
import {
  Assignment,
  Body,
  Catch,
  Class,
  Describe,
  Entity,
  Environment,
  Expression,
  Field,
  Id,
  If,
  Literal,
  LiteralValue,
  Method,
  Module,
  Name,
  New,
  Node,
  Program,
  Reference,
  Return,
  Self,
  Send,
  Singleton,
  Super,
  Test,
  Throw,
  Try,
  Variable,
} from '../model'
import { Interpreter } from './interpreter'

const { isArray } = Array
const { keys, entries } = Object
const { isInteger } = Number

const DECIMAL_PRECISION = 5

export type Execution<T> = Generator<Node, T>
export type ExecutionDefinition<T> = (this: Evaluation) => Execution<T>
export type RuntimeValue = RuntimeObject | undefined

export interface Natives {
  [name: string]: NativeFunction | Natives
}

export type NativeFunction = (
  this: Evaluation,
  self: RuntimeObject,
  ...args: RuntimeObject[]
) => Execution<RuntimeValue | void>


export class WollokReturn extends Error {
  private static _instance = new WollokReturn()

  static of(instance?: RuntimeObject): WollokReturn {
    WollokReturn._instance._instance = instance
    WollokReturn._instance.name = this.name
    WollokReturn._instance.message = 'Unhandled return on empty stack'
    return WollokReturn._instance
  }

  private _instance?: RuntimeObject

  get instance(): RuntimeObject | undefined {
    return this._instance
  }

  private constructor() {
    super()
  }
}

export class WollokException extends Error {
  get wollokStack(): string {
    try {
      const fullTrace: string = new Interpreter(this.evaluation).send(
        'getStackTraceAsString',
        this.instance,
      )!.innerString!
      return fullTrace.slice(fullTrace.indexOf('\n') + 1).trimEnd()
    } catch (error) {
      return `Could not retrieve Wollok stack due to error: ${error instanceof Error ? error.stack : error}`
    }
  }

  get message(): string {
    const error: RuntimeObject = this.instance
    assertIsException(error)
    const errorMessage = error.innerValue
      ? error.innerValue.message
      : error.get('message')?.innerString ?? ''
    return `${errorMessage}\n${this.wollokStack}\n${WOLLOK_EXTRA_STACK_TRACE_HEADER}`
  }

  constructor(
    readonly evaluation: Evaluation,
    readonly instance: RuntimeObject,
  ) {
    super()
    assertIsException(instance)
    this.name = instance.innerValue
      ? `${instance.module.fullyQualifiedName}: ${instance.innerValue.name}`
      : instance.module.fullyQualifiedName
  }
}


export abstract class Context {
  readonly id: Id = uuid()
  readonly parentContext?: Context
  readonly locals: Map<Name, RuntimeValue | Execution<RuntimeObject>>

  protected constructor(
    parentContext?: Context,
    locals: Map<Name, RuntimeValue | Execution<RuntimeObject>> = new Map(),
  ) {
    this.parentContext = parentContext
    this.locals = locals
  }

  get(local: Name): RuntimeValue {
    const found = this.locals.get(local) ?? this.parentContext?.get(local)
    if (!found || found instanceof RuntimeObject) return found
    let lazy = found.next()
    while (!lazy.done) lazy = found.next()
    this.set(local, lazy.value)
    return lazy.value
  }

  set(
    local: Name,
    value: RuntimeValue | Execution<RuntimeObject>,
    lookup = false,
  ): void {
    if (!lookup || this.locals.has(local)) this.locals.set(local, value)
    else this.parentContext?.set(local, value, lookup)
  }

  contextHierarchy(): List<Context> {
    return [this, ...(this.parentContext?.contextHierarchy() ?? [])]
  }

  copy(contextCache: Map<Id, Context>): this {
    if (contextCache.has(this.id)) return contextCache.get(this.id) as this
    const copy = this.baseCopy(contextCache) as this
    contextCache.set(this.id, copy)
    for (const [name, value] of this.locals.entries())
      copy.set(
        name,
        value instanceof RuntimeObject
          ? value.copy(contextCache)
          : value
            ? this.get(name)
            : value,
      )
    return copy
  }

  protected abstract baseCopy(contextCache: Map<Id, Context>): Context

  abstract get description(): string
}

export class Frame extends Context {
  readonly node: Node
  currentNode: Node

  constructor(
    node: Node,
    parentContext?: Context,
    locals: Record<Name, RuntimeObject> = {},
  ) {
    super(parentContext, new Map(entries(locals)))
    this.node = node
    this.currentNode = node
  }

  get description(): string {
    return match(this.node)(
      [Entity, (node: Entity) => `${node.fullyQualifiedName}`],
      // TODO: Add fqn to method
      when(Method)(
        node =>
          `${node.parent.fullyQualifiedName}.${node.name}(${node.parameters.map(parameter => parameter.name).join(', ')})`,
      ),
      when(Send)(node => `${node.message}/${node.args.length}`),
      when(Catch)(
        node => `catch (${node.parameter.name}: ${node.parameterType.name})`,
      ),
      when(Environment)(() => 'root'),
      otherwise((node: Node) => `${node.kind}`),
    )
  }

  get sourceInfo(): string {
    const target =
      this.node.is(Method) && this.node.name === CLOSURE_EVALUATE_METHOD
        ? this.currentNode.parent
        : this.currentNode
    return target.sourceInfo
  }

  protected baseCopy(contextCache: Map<Id, Context>): Frame {
    return new Frame(this.node, this.parentContext?.copy(contextCache))
  }

  override toString(): string {
    return `${this.description} (${this.sourceInfo})`
  }

  isCustom(): boolean {
    const module = this.node.ancestors.find(ancestor =>
      ancestor.is(Module),
    ) as Module
    return (
      !module?.fullyQualifiedName?.startsWith(WOLLOK_BASE_PACKAGE) &&
      !this.node.is(Environment)
    )
  }
}

export type InnerValue =
  | null
  | boolean
  | string
  | number
  | RuntimeObject[]
  | Error

export type BasicRuntimeObject<T extends InnerValue | undefined> =
  RuntimeObject & { innerValue: T }

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
    if (typeof this.innerValue !== 'number') return undefined
    return this.innerValue
  }

  get innerString(): this['innerValue'] & (string | undefined) {
    if (typeof this.innerValue !== 'string') return undefined
    return this.innerValue
  }

  get innerBoolean(): this['innerValue'] & (boolean | undefined) {
    if (typeof this.innerValue !== 'boolean') return undefined
    return this.innerValue
  }

  get innerCollection(): this['innerValue'] & (RuntimeObject[] | undefined) {
    if (!isArray(this.innerValue)) return undefined
    return this.innerValue
  }

  get description(): string {
    return this.module.label
  }

  protected baseCopy(contextCache: Map<Id, Context>): RuntimeObject {
    return new RuntimeObject(
      this.module,
      this.parentContext!.copy(contextCache),
      isArray(this.innerValue)
        ? this.innerValue.map(elem => elem.copy(contextCache))
        : this.innerValue,
    )
  }

  protected assertIs(moduleFQN: Name, innerValue?: InnerValue): void {
    if (this.module.fullyQualifiedName !== moduleFQN)
      throw new TypeError(
        `Expected a ${moduleFQN} but got a ${this.module.fullyQualifiedName} instead`,
      )
    if (innerValue === undefined)
      throw new TypeError(
        `Malformed Runtime Object: invalid inner value ${this.innerValue} for ${moduleFQN} instance`,
      )
  }

  isConstant(localName: string): boolean {
    return this.module.lookupField(localName)?.isConstant ?? false
  }

  getLabel(interpreter: Interpreter): string {
    if (this.innerValue === null) return 'null'
    if (this.shouldShortenRepresentation()) {
      return (
        interpreter.send(TO_STRING_METHOD, this)?.getShortRepresentation() ?? ''
      )
    }
    if (this.shouldShowShortValue()) return this.showShortValue(interpreter)
    return this.module.name ?? 'Object'
  }

  getShortLabel(): string {
    if (!this.innerValue) return `a ${this.module.fullyQualifiedName}`
    return this.innerString !== undefined
      ? `"${this.getShortRepresentation()}"`
      : this.getShortRepresentation()
  }

  getShortRepresentation(): string {
    return this.innerValue?.toString().trim() ?? ''
  }

  shouldShortenRepresentation(): boolean {
    const moduleName = this.module.fullyQualifiedName
    return (
      [DATE_MODULE, PAIR_MODULE, RANGE_MODULE, DICTIONARY_MODULE].includes(
        moduleName,
      ) || moduleName.startsWith(CLOSURE_MODULE)
    )
  }

  shouldShowShortValue(): boolean {
    const moduleName = this.module.fullyQualifiedName
    return [STRING_MODULE, NUMBER_MODULE, BOOLEAN_MODULE].includes(moduleName)
  }

  showShortValue(interpreter: Interpreter): string {
    if (this.innerValue === null) return 'null'
    return typeof this.innerValue === 'string'
      ? `"${this.innerValue}"`
      : interpreter.send(TO_STRING_METHOD, this)!.innerString!
  }
}


export function assertIsNumber(
  obj: RuntimeObject,
  message: string,
  variableName: string,
  validateValue = true,
): asserts obj is BasicRuntimeObject<number> {
  if (validateValue) assertIsNotNull(obj, message, variableName)
  if (obj.innerNumber === undefined)
    throw new TypeError(
      `Message ${message}: parameter ${showParameter(obj)} should be a number`,
    )
}

export function assertIsBoolean(
  obj: RuntimeObject,
  message: string,
  variableName: string,
): asserts obj is BasicRuntimeObject<boolean> {
  if (!obj)
    throw new TypeError(`Message ${message}: ${variableName} should be a boolean`)
  if (obj.innerBoolean === undefined)
    throw new TypeError(
      `Message ${message}: parameter ${showParameter(obj)} should be a boolean`,
    )
}

export function assertIsString(
  obj: RuntimeObject | undefined,
  message: string,
  variableName: string,
  validateValue = true,
): asserts obj is BasicRuntimeObject<string> {
  if (!obj)
    throw new TypeError(`Message ${message}: ${variableName} should be a string`)
  if (validateValue) assertIsNotNull(obj, message, variableName)
  if (obj.innerString === undefined)
    throw new TypeError(
      `Message ${message}: parameter ${showParameter(obj)} should be a string`,
    )
}

export function assertIsCollection(
  obj: RuntimeObject,
): asserts obj is BasicRuntimeObject<RuntimeObject[]> {
  if (!obj.innerCollection)
    throw new TypeError(`Expected a List of values but was ${obj.innerValue}`)
}

export function assertIsException(
  obj: RuntimeObject,
): asserts obj is BasicRuntimeObject<Error | undefined> {
  if (!obj.module.inherits(obj.module.environment.getNodeByFQN(EXCEPTION_MODULE)))
    throw new TypeError(
      `Expected an exception but got a ${obj.module.fullyQualifiedName} instead`,
    )
  if (obj.innerValue && !(obj.innerValue instanceof Error)) {
    throw obj.innerValue 
  }
}

export function assertIsNotNull(
  obj: RuntimeObject,
  message: string,
  variableName: string,
): asserts obj is BasicRuntimeObject<Exclude<InnerValue, null>> {
  if (!obj || obj.innerValue === null)
    throw new RangeError(
      `Message ${message} does not support parameter '${variableName}' to be null`,
    )
}


export class Evaluation {
  readonly natives: Map<Method, NativeFunction>
  protected readonly numberCache: Map<number, WeakRef<RuntimeObject>>
  protected readonly stringCache: Map<string, WeakRef<RuntimeObject>>
  console: Console = console
  pausable = false
  frameStack: Frame[]

  get rootFrame(): Frame {
    return this.frameStack[0]
  }

  get currentFrame(): Frame {
    return last(this.frameStack)!
  }

  get currentNode(): Node {
    return this.currentFrame.node
  }

  get environment(): Environment {
    return this.rootFrame.node as Environment
  }

  static build(environment: Environment, natives: Natives): Evaluation {
    const evaluation = new Evaluation(
      new Map(),
      [new Frame(environment)],
      new Map(),
      new Map(),
    )

    environment.forEach(node => {
      if (node.is(Method))
        if (node.isNative())
          evaluation.natives.set(
            node,
            get(natives, `${node.parent.fullyQualifiedName}.${node.name}`)!,
          )
        else {
          const native = compile(node)
          if (native) {
            evaluation.natives.set(node, native)
            node.compiled = true
          }
        }
    })

    const globalSingletons = environment.descendants.filter(
      (node: Node): node is Singleton => isNamedSingleton(node),
    )
    for (const module of globalSingletons)
      evaluation.rootFrame.set(
        module.fullyQualifiedName,
        evaluation.instantiate(module),
      )

    const globalConstants = environment.descendants.filter(
      (node: Node): node is Variable =>
        node.is(Variable) && node.isAtPackageLevel,
    )
    for (const constant of globalConstants)
      evaluation.rootFrame.set(
        constant.fullyQualifiedName,
        evaluation.exec(constant.value),
      )

    for (const module of globalSingletons) {
      const instance = evaluation.object(module.fullyQualifiedName)
      for (const field of module.allFields) {
        const value = instance.get(field.name)
        if (value?.innerValue === null && field.value?.isSynthetic) {
          raise(
            new Error(
              `Error in ${module.name}: '${field.name}' attribute uninitialized`,
            ),
          )
        }
      }
    }

    for (const constant of globalConstants) {
      const instance = evaluation.object(constant.fullyQualifiedName)
      for (const local of instance.locals) instance.get(local[0])
    }

    return evaluation
  }

  protected constructor(
    natives: Map<Method, NativeFunction>,
    frameStack: Frame[],
    numberCache: Map<number, WeakRef<RuntimeObject>>,
    stringCache: Map<string, WeakRef<RuntimeObject>>,
  ) {
    this.natives = natives
    this.frameStack = frameStack
    this.numberCache = numberCache
    this.stringCache = stringCache
  }

  copy(contextCache: Map<Id, Context> = new Map()): Evaluation {
    return new Evaluation(
      this.natives,
      this.frameStack.map(frame => frame.copy(contextCache)),
      new Map(
        [...this.numberCache.entries()].flatMap(([key, value]) => {
          const instanceCopy = value.deref()?.copy(contextCache)
          return instanceCopy ? [[key, new WeakRef(instanceCopy)]] : []
        }),
      ),
      new Map(
        [...this.stringCache.entries()].flatMap(([key, value]) => {
          const instanceCopy = value.deref()?.copy(contextCache)
          return instanceCopy ? [[key, new WeakRef(instanceCopy)]] : []
        }),
      ),
    )
  }

  allInstances(): Set<RuntimeObject> {
    const visitedContexts: Id[] = []
    function contextInstances(context?: Context): List<RuntimeObject> {
      if (!context || visitedContexts.includes(context.id)) return []
      visitedContexts.push(context.id)
      const localInstances = [...context.locals.values()].filter(
        (value): value is RuntimeObject => value instanceof RuntimeObject,
      )
      return [
        ...contextInstances(context.parentContext),
        ...(context instanceof RuntimeObject
          ? [
            context,
            ...(context.innerCollection?.flatMap(contextInstances) ?? []),
          ]
          : []),
        ...localInstances.flatMap(contextInstances),
      ]
    }
    return new Set(this.frameStack.flatMap(frame => contextInstances(frame)))
  }

  object(fullyQualifiedName: Name): RuntimeObject {
    const instance = this.rootFrame.get(fullyQualifiedName)
    if (!instance) throw new Error(`WKO not found: ${fullyQualifiedName}`)
    return instance
  }

  exec(node: Expression, frame?: Frame): Execution<RuntimeObject>
  exec(node: Node, frame?: Frame): Execution<undefined>
  *exec(node: Node, frame?: Frame): Execution<RuntimeValue> {
    if (frame) this.frameStack.push(frame)
    this.currentFrame.currentNode = node
    try {
      switch (node.kind) {
        case 'Test':
          yield* this.execTest(node as Test)
          return
        case 'Program':
          yield* this.execProgram(node as Program)
          return
        case 'Method':
          return yield* this.execMethod(node as Method)
        case 'Body':
          return yield* this.execBody(node as Body)
        case 'Variable':
          yield* this.execVariable(node as Variable)
          return
        case 'Assignment':
          yield* this.execAssignment(node as Assignment)
          return
        case 'Return':
          return yield* this.execReturn(node as Return)
        case 'Reference':
          return yield* this.execReference(node as Reference<any>)
        case 'Self':
          return yield* this.execSelf(node as Self)
        case 'Literal':
          return yield* this.execLiteral(node as Literal)
        case 'New':
          return yield* this.execNew(node as New)
        case 'Send':
          return yield* this.execSend(node as Send)
        case 'Super':
          return yield* this.execSuper(node as Super)
        case 'If':
          return yield* this.execIf(node as If)
        case 'Try':
          return yield* this.execTry(node as Try)
        case 'Throw':
          return yield* this.execThrow(node as Throw)
        case 'Singleton':
          return yield* this.execSingleton(node as Singleton)
        default:
          throw new Error(`Can't execute ${node.kind} node`)
      }
    } catch (error) {
      if (error instanceof WollokException || error instanceof WollokReturn)
        throw error

      const moduleFQN =
        error instanceof RangeError &&
        error.message === 'Maximum call stack size exceeded'
          ? 'wollok.lang.StackOverflowException'
          : 'wollok.lang.EvaluationError'
      const exceptionInstance = new WollokException(
        this,
        yield* this.error(moduleFQN, {}, error as Error),
      )
      throw exceptionInstance
    } finally {
      if (frame) this.frameStack.pop()
    }
  }

  instantiateSingleton(newDefinition: Singleton): void {
    this.rootFrame.set(
      newDefinition.fullyQualifiedName,
      this.instantiate(newDefinition),
    )
  }

  protected *execTest(node: Test): Execution<void> {
    if (this.pausable) yield node
    yield* this.exec(
      node.body,
      new Frame(
        node,
        node.parent.is(Describe)
          ? yield* this.instantiate(node.parent)
          : this.currentFrame,
      ),
    )
  }

  protected *execProgram(node: Program): Execution<void> {
    if (this.pausable) yield node
    yield* this.exec(node.body, new Frame(node, this.currentFrame))
  }

  protected *execMethod(node: Method): Execution<RuntimeValue> {
    if (this.pausable) yield node
    if (
      node.hasNativeImplementation &&
      !(this.pausable && node.compiled && !node.fromProperty)
    ) {
      const native = this.natives.get(node)
      if (!native)
        throw new Error(
          `Missing native for ${node.parent.fullyQualifiedName}.${node.name}`,
        )
      const args = node.parameters.map(
        parameter => this.currentFrame.get(parameter.name)!,
      )
      return (
        (yield* native.call(
          this,
          this.currentFrame.get(KEYWORDS.SELF)!,
          ...args,
        )) ?? (yield* this.reifyVoid())
      )
    } else if (node.isConcrete()) {
      try {
        yield* this.exec(node.body!)
        return
      } catch (error) {
        if (error instanceof WollokReturn) return error.instance
        else throw error
      }
    } else
      throw new Error(
        `Can't invoke abstract method ${node.parent.fullyQualifiedName}.${node.name}/${node.parameters.length}`,
      )
  }

  protected *execBody(node: Body): Execution<RuntimeValue> {
    if (this.pausable) yield node
    let result: RuntimeValue
    for (const sentence of node.sentences) result = yield* this.exec(sentence)
    return isVoid(result) ? yield* this.reifyVoid() : result
  }

  protected *execVariable(node: Variable): Execution<void> {
    const variableFullName = targetName(node, node.name)
    if (this.currentFrame.locals.get(variableFullName)) {
      throw new Error('Can\'t redefine a variable')
    }
    const value = yield* this.exec(node.value)
    assertNotVoid(
      value,
      `Cannot assign to variable '${node.name}': ${getExpressionFor(node.value)} produces no value, cannot assign it to a variable`,
    )
    if (this.pausable) yield node
    this.currentFrame.set(variableFullName, value)
  }

  protected *execAssignment(node: Assignment): Execution<void> {
    const variableName = node.variable.target?.name
    const value = yield* this.exec(node.value)
    assertNotVoid(
      value,
      `${value.getShortLabel()} produces no value, cannot assign it to reference ${variableName}`,
    )
    if (this.pausable) yield node
    if (node.variable.target?.isConstant)
      throw new Error(`Can't assign the constant ${variableName}`)
    const target = node.variable.target
    this.currentFrame.set(targetName(target, node.variable.name), value, true)
  }

  protected *execReturn(node: Return): Execution<RuntimeValue> {
    const value = node.value && (yield* this.exec(node.value))
    if (this.pausable) yield node
    throw WollokReturn.of(value)
  }

  protected *execReference(node: Reference<Node>): Execution<RuntimeValue> {
    if (this.pausable) yield node
    if (!node.scope)
      return (
        this.currentFrame.get(node.name) ??
        raise(new Error(`Could not resolve unlinked reference to ${node.name}`))
      )
    const target = node.target
    if (target?.is(Field) && loopInAssignment(target.value, target.name)) {
      raise(
        new Error(`Error initializing field ${target.name}: stack overflow`),
      )
    }
    return (
      this.currentFrame.get(targetName(target, node.name)) ??
      raise(new Error(`Could not resolve reference to ${node.name}`))
    )
  }

  protected *execSelf(node: Self): Execution<RuntimeValue> {
    if (this.pausable) yield node
    return this.currentFrame.get(KEYWORDS.SELF)
  }

  protected *execLiteral(node: Literal<LiteralValue>): Execution<RuntimeValue> {
    if (isArray(node.value)) {
      const [reference, args] = node.value
      const module = reference.target!
      const values: RuntimeObject[] = []
      for (const arg of args) values.push(yield* this.exec(arg))
      if (this.pausable) yield node
      return yield* module.name === 'List'
        ? this.list(...values)
        : this.set(...values)
    }
    if (this.pausable) yield node
    return yield* this.reify(node.value as any)
  }

  protected *execNew(node: New): Execution<RuntimeValue> {
    const args: Record<Name, RuntimeValue | Execution<RuntimeObject>> = {}
    const isGlobal = isInsideGlobalVariable(node)
    for (const arg of node.args) {
      const valueExecution = this.execNewArgument(arg.value)
      const value = isGlobal ? valueExecution : yield* valueExecution
      if (value instanceof RuntimeObject)
        assertNewArgumentNotVoid(node, arg.name, value)
      args[arg.name] = value
    }

    if (this.pausable) yield node

    const target =
      node.instantiated.target ??
      raise(
        new Error(
          `Could not resolve reference to instantiated module ${node.instantiated.name}`,
        ),
      )

    const name = node.instantiated.name
    if (!target.is(Class))
      raise(
        new Error(`${name} is not a class, you cannot generate instances of it`),
      )
    if (target.isAbstract)
      raise(
        new Error(
          `${name} is an abstract class, you cannot generate instances`,
        ),
      )

    const uninitializedAttributes =
      getUninitializedAttributesForInstantiation(node)
    if (uninitializedAttributes.length) {
      raise(
        new Error(
          `${name} cannot be instantiated, you must pass values to the following attributes: ${uninitializedAttributes.join(', ')}`,
        ),
      )
    }

    if (target.fullyQualifiedName === LIST_MODULE) return yield* this.list()
    if (target.fullyQualifiedName === SET_MODULE) return yield* this.set()

    return yield* this.instantiate(target, args)
  }

  execNewArgument(node: Expression): Execution<RuntimeObject> {
    return this.exec(node, new Frame(node, this.currentFrame))
  }

  protected *execSend(node: Send): Execution<RuntimeValue> {
    const receiver = yield* this.exec(node.receiver)

    if (shortCircuits(node.message, receiver)) return receiver

    assertReceiverNotVoid(node, receiver)

    const values: RuntimeObject[] = []
    for (const [i, arg] of node.args.entries()) {
      const value = yield* this.exec(arg)
      assertArgumentNotVoid(node, receiver, value, i)
      values.push(value)
    }

    if (this.pausable) yield node

    const result = yield* this.send(node.message, receiver, ...values)
    return result === undefined ? yield* this.reifyVoid() : result
  }

  protected *execSuper(node: Super): Execution<RuntimeValue> {
    const currentMethod = node.ancestors.find(is(Method))!
    const args: RuntimeObject[] = []
    for (const [i, arg] of node.args.entries())