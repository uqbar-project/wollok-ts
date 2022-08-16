import { ConstructorFor, Definition, InstanceOf, is, last, List, mapObject, Mixable, MIXINS, notEmpty } from './extensions'
import { lazy, cached } from './decorators'

const { isArray } = Array
const { entries, values, assign } = Object

export type Name = string
export type Id = string


export interface Scope {
  resolve<N extends Node>(qualifiedName: Name, allowLookup?: boolean): N | undefined
  include(...others: Scope[]): void
  register(...contributions: [Name, Node][]): void
}


export class SourceIndex {
  readonly offset: number
  readonly line: number
  readonly column: number

  constructor(args: {offset: number, line: number, column: number}) {
    this.offset = args.offset
    this.line = args.line
    this.column = args.column
  }

  toString(): string { return `${this.line}:${this.column}` }
}

export class SourceMap {
  readonly start: SourceIndex
  readonly end: SourceIndex

  constructor(args: {start: SourceIndex, end: SourceIndex}) {
    this.start = args.start
    this.end = args.end
  }

  toString(): string { return `[${this.start}, ${this.end}]` }
  covers(offset: number): boolean { return this.start.offset <= offset && this.end.offset >= offset }
}

export class Annotation {
  readonly name: Name
  readonly args: ReadonlyMap<Name, LiteralValue>

  constructor(name: Name, args: Record<Name, LiteralValue> = {}){
    this.name = name
    this.args = new Map(entries(args))
  }
}

export type Code = string
export type Level = 'warning' | 'error'

export interface BaseProblem {
  readonly code: Code
  readonly level: Level
  readonly values: List<string>
  readonly sourceMap?: SourceMap
}

export interface Problem extends BaseProblem {
  readonly node: Node
}


type AttributeKeys<T> = { [K in keyof T]-?: T[K] extends Function ? never : K }[keyof T]
type Payload<T, MandatoryFields extends keyof T = never> =
  Pick<T, MandatoryFields> &
  Partial<Pick<T, AttributeKeys<T>>>

// TODO: Todavía sirve?
export const isNode = (obj: any): obj is Node => obj instanceof Node

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// export type Node
//   = Parameter
//   | ParameterizedType
//   | NamedArgument
//   | Import
//   | Body
//   | Catch
//   | Entity
//   | Field
//   | Method
//   | Sentence
//   | Reference<Node>
//   | Environment


export abstract class Node {
  abstract get kind(): string

  readonly id!: Id
  readonly scope!: Scope
  readonly sourceMap?: SourceMap
  readonly problems?: List<BaseProblem>
  readonly metadata: List<Annotation> = []

  @lazy environment!: Environment

  //TODO: Proper type
  //TODO: Make lazy fail instead of return undefined
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  @lazy parent!: Node

  constructor(payload: Record<string, unknown>) {
    assign(this, payload)
  }

  get categories(): Function[] { return [this.constructor] }
  sourceFileName(): string | undefined { return this.parent.sourceFileName() }
  get sourceInfo(): string { return `${this.sourceFileName ?? '--'}:${this.sourceMap?.start.line ?? '--'}` }
  get label(): string { return `[${this.kind}]{${this.id?.slice(-6) ?? '--'}} at ${this.sourceInfo}` }

  get isSynthetic(): boolean { return !this.sourceMap }
  get hasProblems(): boolean { return notEmpty(this.problems) }

  @cached
  toString(verbose = false): string {
    return !verbose ? this.label : JSON.stringify(this, (key, value) => {
      if('scope' === key) return
      if('sourceMap' === key) return `${value}`
      return value
    }, 2)
  }

  is<Q extends Definition<Node>>(kindOrCategory: Q): this is InstanceOf<Q> { return is(kindOrCategory)(this) }

  copy(delta: Record<string, unknown> = {}): this {
    return new (this.constructor as any)({ ...this, ...delta })
  }

  @cached // TODO: can we make this a property even if it's cached
  children(): List<Node> {
    const extractChildren = (owner: any): List<Node> => {
      if (isNode(owner)) return [owner]
      if (isArray(owner)) return owner.flatMap(extractChildren)
      return []
    }
    return values(this).flatMap(extractChildren)
  }

  @cached
  siblings(): List<Node> { return this.parent.children().filter(node => node !== this) }

  // TODO: Do we need these very specific methods?
  @cached
  previousSiblings(): List<Node> {
    const children = this.parent.children()
    const index = children.indexOf(this)
    return children.slice(0, index)
  }

  // TODO: Do we need these very specific methods?
  @cached
  nextSiblings(): List<Node> {
    const children = this.parent.children()
    const index = children.indexOf(this)
    return children.slice(index + 1, children.length)
  }

  // TODO: Do we need these very specific methods?
  @cached
  nextSibling(): Node | undefined {
    return this.nextSiblings()[0]
  }

  @cached // TODO: Make property even if cached?
  descendants(): List<Node> {
    const pending: Node[] = []
    const response: Node[] = []
    let next: Node | undefined = this
    do {
      const children = next!.children()
      response.push(...children)
      pending.push(...children)
      next = pending.shift()
    } while (next)
    return response
  }

  @cached // TODO: Make property even if cached?
  ancestors(): List<Node> {
    try {
      const parent = this.parent //TODO: Make lazy parent fail instead of returning undefined?
      return [parent, ...parent.ancestors()]
    } catch (_) { return [] }
  }

  transform(tx: (node: Node) => Node): this {
    const applyTransform = (value: any): any => {
      if (isArray(value)) return value.map(applyTransform)
      if (isNode(value)) return value.copy(mapObject(applyTransform, tx(value)))
      return value
    }

    return applyTransform(this)
  }

  forEach(tx: (node: Node, parent?: Node) => void): void {
    this.reduce((_, node, parent) => {
      tx(node, parent)
      return undefined
    }, undefined)
  }

  reduce<T>(tx: (acum: T, node: Node, parent?: Node) => T, initial: T): T {
    const applyReduce = (acum: T, node: Node, parent?: Node): T =>
      node.children().reduce((seed, child) => {
        return applyReduce(seed, child, node)
      }, tx(acum, node, parent))

    return applyReduce(initial, this)
  }

}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export class Parameter extends Node {
  get kind(): 'Parameter' { return 'Parameter' }
  readonly name!: Name
  readonly isVarArg!: boolean

  constructor({ isVarArg = false, ...payload }: Payload<Parameter, 'name'>) {
    super({ isVarArg, ...payload })
  }
}


export class ParameterizedType extends Node {
  get kind(): 'ParameterizedType' {return 'ParameterizedType' }
  readonly reference!: Reference<Module | Class>
  readonly args!: List<NamedArgument>

  constructor({ args = [], ...payload }: Payload<ParameterizedType, 'reference'>) {
    super({ args, ...payload })
  }
}


export class NamedArgument extends Node {
  get kind(): 'NamedArgument' {return 'NamedArgument' }
  readonly name!: Name
  readonly value!: Expression

  constructor(payload: Payload<NamedArgument, 'name' | 'value'>) { super(payload) }
}


export class Import extends Node {
  get kind(): 'Import' {return 'Import' }
  readonly entity!: Reference<Entity>
  readonly isGeneric!: boolean

  override parent!: Package

  constructor({ isGeneric = false, ...payload }: Payload<Import, 'entity'>) {
    super({ isGeneric, ...payload })
  }
}


export class Body extends Node {
  get kind(): 'Body' {return 'Body' }
  readonly sentences!: List<Sentence>

  constructor({ sentences = [], ...payload }: Payload<Body> = {}) {
    super({ sentences, ...payload })
  }

  isEmpty(): boolean {
    return this.isSynthetic || this.parent.is(Method) || notEmpty(this.sentences)
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// export type Entity
//   = Package
//   | Program
//   | Test
//   | Module
//   | Variable

export type Entity = InstanceType<ConstructorFor<typeof Entity>>

// TODO: Remove these ignores once ESLint implements mixin support https://github.com/typescript-eslint/typescript-eslint/issues/2035
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Entity<S extends Mixable<Node>>(supertype: S) {

  abstract class EntityType extends supertype {
    static [MIXINS] = [Entity, ...supertype[MIXINS] ?? []]
    abstract readonly name?: Name // TODO: Make Singleton name be '' instead of ?

    override get label(): string {
      return `${this.fullyQualifiedName()} ${super.label}`
    }

    @cached // TODO: Can this be catched and also be a property?
    fullyQualifiedName(): Name {
      const parent = this.parent
      const label = this.is(Singleton)
        ? this.name ?? `${this.superclass()!.fullyQualifiedName()}#${this.id}`
        : this.name!.replace(/\.#/g, '')

      return parent?.is(Package) || parent?.is(Describe)
        ? `${parent.fullyQualifiedName()}.${label}`
        : label
    }
  }

  return EntityType
}


export class Package extends Entity(Node) {
  get kind(): 'Package' { return 'Package' }
  readonly name!: Name
  readonly imports!: List<Import>
  readonly members!: List<Entity>
  readonly fileName?: string

  override parent!: Package | Environment

  constructor({ name, imports = [], members = [], ...payload }: Payload<Package, 'name'>) {
    super({ imports, members, ...payload })

    const [packageName, ...ancestorNames] = name.split('.').reverse()

    this.name = packageName

    return ancestorNames.reduce<Package>((member, name) =>
      new Package({ name, members: [member] })
    , this)
  }

  @cached // TODO: Property and cached
  sourceFileName(): string | undefined { return this.fileName ?? super.sourceFileName() }

  getNodeByQN<N extends Entity>(this: Package, qualifiedName: Name): N {
    const node = this.getNodeOrUndefinedByQN<N>(qualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${qualifiedName} from ${this.name}`)
    return node
  }

  @cached
  getNodeOrUndefinedByQN<N extends Entity>(this: Package, qualifiedName: Name): N | undefined {
    return this.scope.resolve<N>(qualifiedName)
  }

}


export class Program extends Entity(Node) {
  get kind(): 'Program' { return 'Program' }
  readonly name!: Name
  readonly body!: Body

  constructor(payload: Payload<Program, 'name' | 'body'>) { super(payload) }

  @cached
  sentences(): List<Sentence> { return this.body.sentences }
}


export class Test extends Entity(Node) {
  get kind(): 'Test' { return 'Test' }
  readonly isOnly!: boolean
  readonly name!: Name
  readonly body!: Body

  override parent!: Describe

  constructor({ isOnly = false, ...payload }: Payload<Test, 'name' | 'body'>) {
    super({ isOnly, ...payload })
  }

  @cached
  sentences(): List<Sentence> { return this.body.sentences }
}


export class Variable extends Entity(Sentence(Node)) {
  get kind(): 'Variable' { return 'Variable' }
  readonly name!: Name
  readonly isConstant!: boolean
  readonly value!: Expression

  constructor({ value = new Literal({ value: null }), ...payload }: Payload<Variable, 'name' | 'isConstant'>) {
    super({ value, ...payload })
  }

  // TODO: Rename to isEntity
  isGlobal(): boolean { return this.parent.is(Package) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// export type Module = Class | Singleton | Mixin | Describe

export type Module = InstanceType<ConstructorFor<typeof Module>>
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Module<S extends Mixable<Node>>(supertype: S) {
  abstract class ModuleType extends Entity(supertype) {
    static [MIXINS] = [Module, ...supertype[MIXINS] ?? []]

    abstract readonly name?: Name
    abstract readonly supertypes: List<ParameterizedType>
    abstract readonly members: List<Field | Method | Variable | Test>
    abstract superclass(): Class | undefined

    override parent!: Package

    constructor(...args: any[]) {
      const { members, ...payload }: Payload<ModuleType> & Record<Name, unknown> = args[0]
      const methods = members?.filter(is(Method)) ?? []
      const fields = members?.filter(is(Field)) ?? []
      const properties = fields.filter(field => field.isProperty)

      const propertyGetters = properties
        .filter(field => !methods.some(method => method.matchesSignature(field.name, 0)))
        .map(({ name }: Field) => new Method({
          name,
          isOverride: false,
          parameters: [],
          body: new Body({ sentences: [new Return({ value: new Reference({ name }) })] }),
        }))

      const propertySetters = properties
        .filter(field => !field.isConstant && !methods.some(method => method.matchesSignature(field.name, 1)))
        .map(({ name }: Field) => new Method({
          name,
          isOverride: false,
          parameters: [new Parameter({ name: '<value>', isVarArg: false })],
          body: new Body({
            sentences: [
              new Assignment({
                variable: new Reference({ name }),
                value: new Reference({ name: '<value>' }),
              }),
            ],
          }),
        }))

      super({ ...payload, members: members && [...members, ...propertyGetters, ...propertySetters] })
    }

    @cached
    mixins(): List<Mixin> {
      return this.supertypes
        .flatMap(supertype => supertype.reference.target() ? [supertype.reference.target()!] : [])
        .filter(is(Mixin))
    }

    methods(): List<Method> { return this.members.filter(is(Method)) }
    fields(): List<Field> { return this.members.filter(is(Field)) }
    allFields(): List<Field> { return this.hierarchy().flatMap(parent => parent.fields()) }
    allMethods(): List<Method> { return this.hierarchy().flatMap(parent => parent.methods()) }
    lookupField(name: string): Field | undefined { return this.allFields().find(field => field.name === name) }

    @cached
    hierarchy(): List<ModuleType> {
      const hierarchyExcluding = (node: Module, exclude: List<Module> = []): List<Module> => {
        if (exclude.includes(node)) return []

        const modules = [
          ...node.mixins(),
          ...!node.superclass() ? [] : [node.superclass()!],
        ]

        return modules.reduce<[List<Module>, List<Module>]>(([hierarchy, excluded], module) => {
          const inheritedHierarchy = hierarchyExcluding(module, excluded)
          const filteredHierarchy = hierarchy.filter(node => !inheritedHierarchy.includes(node))
          return [
            [...filteredHierarchy, ...inheritedHierarchy],
            [module, ...excluded],
          ]
        }, [[node], [node, ...exclude]])[0]
      }

      return hierarchyExcluding(this)
    }

    inherits(other: ModuleType): boolean {
      return this.hierarchy().some(({ id }) => other.id === id)
    }

    @cached
    lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method | undefined {
      let startReached = !options?.lookupStartFQN
      for (const module of this.hierarchy()) {
        if (startReached) {
          const found = module.methods().find(member => (options?.allowAbstractMethods || !member.isAbstract()) && member.matchesSignature(name, arity))
          if (found) return found
        }
        if (module.fullyQualifiedName() === options?.lookupStartFQN) startReached = true
      }

      return undefined
    }

    @cached
    defaultFieldValues(): Map<Field, Expression | undefined> {
      return new Map(this.hierarchy().flatMap(module => module.fields()).map(field => [
        field,
        this.hierarchy().reduceRight((defaultValue, module) =>
          module.supertypes.flatMap(supertype => supertype.args).find(arg => arg.name === field.name)?.value ?? defaultValue
        , field.value),
      ]))
    }
  }

  return ModuleType
}


export class Class extends Module(Node) {
  get kind(): 'Class' { return 'Class' }
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Class, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  @cached
  superclass(): Class | undefined {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target()?.is(Class))?.reference
    if(superclassReference) return superclassReference.target() as Class
    else {
      const objectClass = this.environment.objectClass
      return this === objectClass ? undefined : objectClass
    }
  }

  @cached
  isAbstract(this: Class): boolean {
    const abstractMethods = this.hierarchy().flatMap(module => module.methods().filter(method => method.isAbstract()))
    return abstractMethods.some(method => !this.lookupMethod(method.name, method.parameters.length))
  }
}


export class Singleton extends Expression(Module(Node)) {
  get kind(): 'Singleton' { return 'Singleton' }
  readonly name?: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Singleton>) {
    super({ supertypes, members, ...payload })
  }

  superclass(): Class {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target()?.is(Class))?.reference
    if(superclassReference) return superclassReference.target() as Class
    else return this.environment.objectClass
  }

  isClosure(parametersCount = 0): boolean {
    return !!this.lookupMethod('<apply>', parametersCount)
  }
}


export class Mixin extends Module(Node) {
  get kind(): 'Mixin' { return 'Mixin' }
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Mixin, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  superclass(): undefined { return undefined }
}


export class Describe extends Module(Node) {
  get kind(): 'Describe' { return 'Describe' }
  readonly name!: Name
  readonly members!: List<Field | Method | Test>
  readonly supertypes: List<ParameterizedType> = [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Object' }) })]

  constructor({ members = [], ...payload }: Payload<Describe, 'name'>) {
    super({ members, ...payload })
  }

  superclass(): Class { return this.supertypes[0].reference.target()! as Class }

  tests(): List<Test> { return this.members.filter(is(Test)) }
}

// // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // MEMBERS
// // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────


export class Field extends Node {
  get kind(): 'Field' { return 'Field' }
  readonly name!: Name
  readonly isConstant!: boolean
  readonly isProperty!: boolean
  readonly value!: Expression

  constructor({ value = new Literal({ value: null }), isProperty = false, ...payload }: Payload<Field, 'name' | 'isConstant'>) {
    super({ value, isProperty, ...payload })
  }

  override parent!: Module

  override get label(): string {
    return `${this.parent.fullyQualifiedName()}.${this.name} ${super.label}`
  }
}


export class Method extends Node {
  get kind(): 'Method' { return 'Method' }
  readonly name!: Name
  readonly isOverride!: boolean
  readonly parameters!: List<Parameter>
  readonly body?: Body | 'native'

  override parent!: Module

  constructor({ isOverride = false, parameters = [], ...payload }: Payload<Method, 'name'>) {
    super({ isOverride, parameters, ...payload })
  }

  override get label(): string {
    return `${this.parent.fullyQualifiedName()}.${this.name}/${this.parameters.length} ${super.label}`
  }

  isAbstract(): this is this & {body: undefined} { return !this.body }
  isNative(): this is {body?: Body} { return this.body === 'native' }
  isConcrete(): this is {body: Body} {return !this.isAbstract() && !this.isNative()}

  @cached
  hasVarArgs(): boolean {
    return !!last(this.parameters)?.isVarArg
  }

  @cached
  sentences(): List<Sentence> {
    return this.isConcrete() ? this.body.sentences : []
  }

  @cached
  matchesSignature(name: Name, arity: number): boolean {
    return this.name == name && (
      this.hasVarArgs() && this.parameters.length - 1 <= arity ||
      this.parameters.length === arity
    )
  }

}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// export type Sentence = Variable | Return | Assignment | Expression

export type Sentence = InstanceType<ConstructorFor<typeof Sentence>>
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Sentence<S extends Mixable<Node>>(supertype: S) {
  abstract class SentenceType extends supertype {
    static [MIXINS] = [Sentence, ...supertype[MIXINS] ?? []]
  }
  return SentenceType
}


export class Return extends Sentence(Node) {
  get kind(): 'Return' { return 'Return' }
  readonly value?: Expression

  constructor(payload: Payload<Return> = {}) { super(payload) }
}


export class Assignment extends Sentence(Node) {
  get kind(): 'Assignment' { return 'Assignment' }
  readonly variable!: Reference<Variable | Field>
  readonly value!: Expression

  constructor(payload: Payload<Assignment, 'variable' | 'value'>) { super(payload) }
}

// // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // EXPRESSIONS
// // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// export type Expression
//   = Reference<Field | Variable | Parameter | NamedArgument | Singleton>
//   | Self
//   | Literal<LiteralValue>
//   | Send
//   | Super
//   | New
//   | If
//   | Throw
//   | Try
//   | Singleton

export type Expression = InstanceType<ConstructorFor<typeof Expression>>
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Expression<S extends Mixable<Node>>(supertype: S) {
  abstract class ExpressionType extends Sentence(supertype) {
    static [MIXINS] = [Expression, ...supertype[MIXINS] ?? []]
  }

  return ExpressionType
}


export class Reference<N extends Node> extends Expression(Node) {
  get kind(): 'Reference' { return 'Reference' }
  readonly name!: Name

  constructor(payload: Payload<Reference<N>, 'name'>) { super(payload) }

  @cached
  target(): N | undefined { return this.scope.resolve(this.name) }
}


export class Self extends Expression(Node) {
  get kind(): 'Self' { return 'Self' }

  constructor(payload: Payload<Self> = {}) { super(payload) }
}


export type LiteralValue = number | string | boolean | null | readonly [Reference<Class>, List<Expression> ]
export class Literal<T extends LiteralValue = LiteralValue> extends Expression(Node) {
  get kind(): 'Literal' { return 'Literal' }
  readonly value!: T

  constructor(payload: Payload<Literal<T>, 'value'>) { super(payload) }
}


export class Send extends Expression(Node) {
  get kind(): 'Send' { return 'Send' }
  readonly receiver!: Expression
  readonly message!: Name
  readonly args!: List<Expression>

  constructor({ args = [], ...payload }: Payload<Send, 'receiver' | 'message'>) {
    super({ args, ...payload })
  }
}


export class Super extends Expression(Node) {
  get kind(): 'Super' { return 'Super' }
  readonly args!: List<Expression>

  constructor({ args = [], ...payload }: Payload<Super> = {}) {
    super({ args, ...payload })
  }
}


export class New extends Expression(Node) {
  get kind(): 'New' { return 'New' }
  readonly instantiated!: Reference<Class>
  readonly args!: List<NamedArgument>

  constructor({ args = [], ...payload }: Payload<New, 'instantiated'>) {
    super({ args, ...payload })
  }
}


export class If extends Expression(Node) {
  get kind(): 'If' { return 'If' }
  readonly condition!: Expression
  readonly thenBody!: Body
  readonly elseBody!: Body

  constructor({ elseBody = new Body(), ...payload }: Payload<If, 'condition' | 'thenBody'>) {
    super({ elseBody, ...payload })
  }
}


export class Throw extends Expression(Node) {
  get kind(): 'Throw' { return 'Throw' }
  readonly exception!: Expression

  constructor(payload: Payload<Throw, 'exception'>) { super(payload) }
}


export class Try extends Expression(Node) {
  get kind(): 'Try' { return 'Try' }
  readonly body!: Body
  readonly catches!: List<Catch>
  readonly always!: Body

  constructor({ catches = [], always = new Body(), ...payload }: Payload<Try, 'body'>) {
    super({ catches, always, ...payload })
  }
}


export class Catch extends Node {
  get kind(): 'Catch' { return 'Catch' }
  readonly parameter!: Parameter
  readonly parameterType!: Reference<Module>
  readonly body!: Body

  constructor({ parameterType = new Reference({ name: 'wollok.lang.Exception' }), ...payload }: Payload<Catch, 'parameter'| 'body'>) {
    super({ parameterType, ...payload })
  }
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type ClosurePayload = {
  parameters?: List<Parameter>
  sentences?: List<Sentence>
  code?: string
  sourceMap?: SourceMap
  metadata?: List<Annotation>
}

export const Closure = ({ sentences, parameters, code, ...payload }: ClosurePayload): Singleton => {
  const initialSentences = sentences?.slice(0, -1) ?? []
  const lastSentence = sentences?.slice(-1).map(value => value.is(Expression) ? new Return({ value }) : value) ?? []

  return new Singleton({
    supertypes: [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Closure' }) })],
    members: [
      new Method({ name: '<apply>', parameters, body: new Body({ sentences: [...initialSentences, ...lastSentence] }) }),
      ...code ? [
        new Field({ name: '<toString>', isConstant: true, value: new Literal({ value: code }) }),
      ] : [],
    ],
    ...payload,
  })
}

export class Environment extends Node {
  get kind(): 'Environment' { return 'Environment'}

  readonly members!: List<Package>
  @lazy nodeCache!: ReadonlyMap<Id, Node>

  constructor(payload: Payload<Environment, 'members'>) { super(payload) }

  sourceFileName(): string | undefined { return undefined }

  getNodeById<N extends Node>(id: Id): N {
    const node = this.nodeCache.get(id)
    if(!node) throw new Error(`Missing node with id ${id}`)
    return node as N
  }

  @cached
  getNodeOrUndefinedByFQN<N extends Node>(this: Environment, fullyQualifiedName: Name): N | undefined {
    const [, id] = fullyQualifiedName.split('#')
    if (id) return this.getNodeById<N>(id)

    return this.scope.resolve<N>(fullyQualifiedName)
  }

  getNodeByFQN<N extends Node>(this: Environment, fullyQualifiedName: Name): N {
    const node = this.getNodeOrUndefinedByFQN<N>(fullyQualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
    return node
  }

  get objectClass(): Class {
    return this.getNodeByFQN('wollok.lang.Object')
  }
}