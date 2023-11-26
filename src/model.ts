import { cached, getPotentiallyUninitializedLazy, lazy } from './decorators'
import { ConstructorFor, InstanceOf, is, last, List, mapObject, Mixable, MixinDefinition, MIXINS, notEmpty, TypeDefinition } from './extensions'
import { TypeRegistry, WollokType } from './typeSystem/wollokTypes'

const { isArray } = Array
const { values, assign } = Object

export type Name = string
export type Id = string


export interface Scope {
  resolve<N extends Node>(qualifiedName: Name, allowLookup?: boolean): N | undefined
  include(...others: Scope[]): void
  register(...contributions: [Name, Node][]): void
  localContributions(): [Name, Node][]
}


export class SourceIndex {
  readonly offset: number
  readonly line: number
  readonly column: number

  constructor(args: { offset: number, line: number, column: number }) {
    this.offset = args.offset
    this.line = args.line
    this.column = args.column
  }

  toString(): string { return `${this.line}:${this.column}` }
}

export class SourceMap {
  readonly start: SourceIndex
  readonly end: SourceIndex

  constructor(args: { start: SourceIndex, end: SourceIndex }) {
    this.start = args.start
    this.end = args.end
  }

  toString(): string { return `[${this.start}, ${this.end}]` }
  covers(offset: number): boolean { return this.start.offset <= offset && this.end.offset >= offset }
  includes(other: SourceMap): boolean { return this.start.offset <= other.start.offset && this.end.offset >= other.end.offset }
}

export class Annotation {
  readonly name: Name
  readonly args: Record<Name, LiteralValue>

  constructor(name: Name, args: Record<Name, LiteralValue> = {}) {
    this.name = name
    this.args = args
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export abstract class Node {
  abstract get kind(): string

  readonly id!: Id
  readonly scope!: Scope
  readonly sourceMap?: SourceMap
  readonly problems?: List<BaseProblem>
  readonly metadata: List<Annotation> = []

  @lazy environment!: Environment

  @lazy parent!: Node

  constructor(payload: Record<string, unknown>) {
    assign(this, payload)
  }

  get categories(): Function[] { return [this.constructor] }
  get sourceFileName(): string | undefined {
    const parent = getPotentiallyUninitializedLazy(this, 'parent')
    return parent?.sourceFileName
  }
  get sourceInfo(): string { return `${this.sourceFileName ?? '--'}:${this.sourceMap?.start.line ?? '--'}` }
  get label(): string { return `[${this.kind}]{${this.id?.slice(-6) ?? '--'}} at ${this.sourceInfo}` }

  get isSynthetic(): boolean { return !this.sourceMap }
  get hasProblems(): boolean { return notEmpty(this.problems) }

  get type(): WollokType { return this.environment.typeRegistry.getType(this) }

  @cached
  toString(verbose = false): string {
    return !verbose ? this.label : JSON.stringify(this, (key, value) => {
      if ('scope' === key) return
      if ('sourceMap' === key) return `${value}`
      return value
    }, 2)
  }

  is<Q extends TypeDefinition<Node>>(kindOrCategory: Q): this is InstanceOf<Q> { return is(kindOrCategory)(this) }

  copy(delta: Record<string, unknown> = {}): this {
    return new (this.constructor as any)({ ...this, ...delta })
  }

  @cached
  get children(): List<Node> {
    const extractChildren = (owner: any): List<Node> => {
      if (owner instanceof Node) return [owner]
      if (isArray(owner)) return owner.flatMap(extractChildren)
      return []
    }
    return values(this).flatMap(extractChildren)
  }

  @cached
  siblings(): List<Node> { return this.parent.children.filter(node => node !== this) }

  @cached
  get descendants(): List<Node> {
    const pending: Node[] = []
    const response: Node[] = []
    let next: Node | undefined = this
    do {
      const children = next!.children
      response.push(...children)
      pending.push(...children)
      next = pending.shift()
    } while (next)
    return response
  }

  @cached
  get ancestors(): List<Node> { return [this.parent, ...this.parent.ancestors] }

  transform(tx: (node: Node) => Node): this {
    const applyTransform = (value: any): any => {
      if (isArray(value)) return value.map(applyTransform)
      if (value instanceof Node) return value.copy(mapObject(applyTransform, tx(value)))
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
      node.children.reduce((seed, child) => {
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

  override parent!: Method | Catch

  constructor({ isVarArg = false, ...payload }: Payload<Parameter, 'name'>) {
    super({ isVarArg, ...payload })
  }
}


export class ParameterizedType extends Node {
  get kind(): 'ParameterizedType' { return 'ParameterizedType' }
  readonly reference!: Reference<Module | Class>
  readonly args!: List<NamedArgument>

  override parent!: Module

  constructor({ args = [], ...payload }: Payload<ParameterizedType, 'reference'>) {
    super({ args, ...payload })
  }
}


export class NamedArgument extends Node {
  get kind(): 'NamedArgument' { return 'NamedArgument' }
  readonly name!: Name
  readonly value!: Expression

  override parent!: ParameterizedType | New

  constructor(payload: Payload<NamedArgument, 'name' | 'value'>) { super(payload) }
}


export class Import extends Node {
  get kind(): 'Import' { return 'Import' }
  readonly entity!: Reference<Entity>
  readonly isGeneric!: boolean

  override parent!: Package

  constructor({ isGeneric = false, ...payload }: Payload<Import, 'entity'>) {
    super({ isGeneric, ...payload })
  }
}


export class Body extends Node {
  get kind(): 'Body' { return 'Body' }
  readonly sentences!: List<Sentence>

  constructor({ sentences = [], ...payload }: Payload<Body> = {}) {
    super({ sentences, ...payload })
  }

  override parent!: Program | Test | Method | If | Try | Catch

  isEmpty(): boolean {
    return this.isSynthetic || this.parent.is(Method) || notEmpty(this.sentences)
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity = InstanceType<ConstructorFor<typeof Entity>>

// TODO: Remove these ignores once ESLint implements mixin support https://github.com/typescript-eslint/typescript-eslint/issues/2035
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Entity<S extends Mixable<Node>>(supertype: S) {

  abstract class EntityType extends supertype {
    #isEntity: any
    static [MIXINS] = [Entity, ...supertype[MIXINS] ?? []]

    abstract readonly name?: Name

    override get label(): string { return `${this.fullyQualifiedName} ${super.label}` }

    @cached
    get fullyQualifiedName(): Name {
      const parent = getPotentiallyUninitializedLazy(this, 'parent')
      const label = this.is(Singleton)
        ? this.name ?? `${this.superclass!.fullyQualifiedName}#${this.id}`
        : this.name!.replace(/\.#/g, '')

      return parent?.is(Package) || parent?.is(Describe)
        ? `${parent.fullyQualifiedName}.${label}`
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

  @cached
  get sourceFileName(): string | undefined { return this.fileName ?? super.sourceFileName }

  getNodeByQN<N extends Entity>(qualifiedName: Name): N {
    const node = this.getNodeOrUndefinedByQN<N>(qualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${qualifiedName} from ${this.name}`)
    return node
  }

  @cached
  getNodeOrUndefinedByQN<N extends Entity>(qualifiedName: Name): N | undefined {
    return this.scope.resolve<N>(qualifiedName)
  }

}


export class Program extends Entity(Node) {
  get kind(): 'Program' { return 'Program' }
  readonly name!: Name
  readonly body!: Body

  override parent!: Package

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
  get sentences(): List<Sentence> { return this.body.sentences }
}


export class Variable extends Sentence(Entity(Node)) {
  get kind(): 'Variable' { return 'Variable' }
  readonly name!: Name
  readonly isConstant!: boolean
  readonly value!: Expression

  override parent!: Package | Body

  constructor({ value = new Literal({ value: null }), ...payload }: Payload<Variable, 'name' | 'isConstant'>) {
    super({ value, ...payload })
  }

  get isAtPackageLevel(): boolean { return this.parent.is(Package) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module = InstanceType<ConstructorFor<typeof Module>>
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Module<S extends Mixable<Node>>(supertype: S) {
  abstract class ModuleType extends Entity(supertype) {
    #isModule: any
    static [MIXINS]: MixinDefinition<Node>[] = [Module, ...Entity(supertype)[MIXINS] ?? []]

    abstract readonly name?: Name
    abstract readonly supertypes: List<ParameterizedType>
    abstract readonly members: List<Field | Method | Variable | Test>

    abstract get superclass(): Class | undefined

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
    get hierarchy(): List<ModuleType> {
      const hierarchyExcluding = (node: Module, exclude: List<Module> = []): List<Module> => {
        if (exclude.includes(node)) return []

        const modules = [
          ...node.mixins,
          ...!node.superclass ? [] : [node.superclass!],
        ]

        return modules.reduce(([hierarchy, excluded], module) => {
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

    @cached
    get mixins(): List<Mixin> { return this.supertypes.map(supertype => supertype.reference.target).filter(is(Mixin)) }
    @cached
    get methods(): List<Method> { return this.members.filter(is(Method)) }
    @cached
    get fields(): List<Field> { return this.members.filter(is(Field)) }
    @cached
    get allMembers(): this['members'] { return this.hierarchy.flatMap(parent => parent.members) }
    @cached
    get allFields(): List<Field> { return this.allMembers.filter(is(Field)) }
    @cached
    get allMethods(): List<Method> { return this.allMembers.filter(is(Method)) }

    @cached
    lookupField(name: string): Field | undefined { return this.allFields.find(field => field.name === name) }

    @cached
    lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method | undefined {
      let startReached = !options?.lookupStartFQN
      for (const module of this.hierarchy) {
        if (startReached) {
          const found = module.methods.find(member => (options?.allowAbstractMethods || !member.isAbstract()) && member.matchesSignature(name, arity))
          if (found) return found
        }
        if (module.fullyQualifiedName === options?.lookupStartFQN) startReached = true
      }

      return undefined
    }

    @cached
    get isAbstract(): boolean {
      return this.abstractMethods.some(method => !this.lookupMethod(method.name, method.parameters.length))
    }

    @cached
    get abstractMethods(): List<Method> {
      return this.hierarchy.flatMap(module => module.methods.filter(method => method.isAbstract()))
    }

    @cached
    defaultValueFor(field: Field): Expression {
      if (!this.allFields.includes(field)) throw new Error('Field does not belong to the module')

      return this.hierarchy.reduceRight((defaultValue, module) =>
        module.supertypes.flatMap(_ => _.args).find(({ name }) => name === field.name)?.value ?? defaultValue
      , field.value)
    }

    inherits(other: ModuleType): boolean { return this.hierarchy.includes(other) }
  }

  return ModuleType
}


export class Class extends Module(Node) {
  get kind(): 'Class' { return 'Class' }
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  override parent!: Package

  constructor({ supertypes = [], members = [], ...payload }: Payload<Class, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  @cached
  get superclass(): Class | undefined {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target?.is(Class))?.reference
    if (superclassReference) return superclassReference.target as Class
    else {
      const objectClass = this.environment.objectClass
      return this === objectClass ? undefined : objectClass
    }
  }
}


export class Singleton extends Expression(Module(Node)) {
  get kind(): 'Singleton' { return 'Singleton' }
  readonly name?: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  override parent!: Package | Body

  constructor({ supertypes = [], members = [], ...payload }: Payload<Singleton>) {
    super({ supertypes, members, ...payload })
  }

  get superclass(): Class {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target?.is(Class))?.reference
    if (superclassReference) return superclassReference.target as Class
    else return this.environment.objectClass
  }

  @cached
  isClosure(arity?: number): boolean {
    return arity === undefined
      ? this.methods.some(_ => _.name === '<apply>')
      : !!this.lookupMethod('<apply>', arity)
  }
}


export class Mixin extends Module(Node) {
  get kind(): 'Mixin' { return 'Mixin' }
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  override parent!: Package

  constructor({ supertypes = [], members = [], ...payload }: Payload<Mixin, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  get superclass(): undefined { return undefined }
}


export class Describe extends Module(Node) {
  get kind(): 'Describe' { return 'Describe' }
  readonly name!: Name
  readonly members!: List<Field | Method | Test>
  readonly supertypes: List<ParameterizedType> = [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Object' }) })]

  override parent!: Package

  constructor({ members = [], ...payload }: Payload<Describe, 'name'>) {
    super({ members, ...payload })
  }

  get superclass(): Class { return this.supertypes[0].reference.target! as Class }

  get tests(): List<Test> { return this.members.filter(is(Test)) }
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
    return `${this.parent.fullyQualifiedName}.${this.name} ${super.label}`
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
    return `${this.parent.fullyQualifiedName}.${this.name}/${this.parameters.length} ${super.label}`
  }

  isAbstract(): this is { body: undefined } { return !this.body }
  isNative(): this is { body?: Body } { return this.body === 'native' }
  isConcrete(): this is { body: Body } { return !this.isAbstract() && !this.isNative() }

  @cached
  get hasVarArgs(): boolean { return !!last(this.parameters)?.isVarArg }

  @cached
  get sentences(): List<Sentence> {
    return this.isConcrete() ? this.body.sentences : []
  }

  @cached
  matchesSignature(name: Name, arity: number): boolean {
    return this.name == name && (
      this.hasVarArgs && this.parameters.length - 1 <= arity ||
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
    #isSentence: any
    static [MIXINS] = [Sentence, ...supertype[MIXINS] ?? []]
  }
  return SentenceType
}


export class Return extends Sentence(Node) {
  get kind(): 'Return' { return 'Return' }
  readonly value?: Expression

  override parent!: Body

  constructor(payload: Payload<Return> = {}) { super(payload) }
}


export class Assignment extends Sentence(Node) {
  get kind(): 'Assignment' { return 'Assignment' }
  readonly variable!: Reference<Variable | Field>
  readonly value!: Expression

  override parent!: Body

  constructor(payload: Payload<Assignment, 'variable' | 'value'>) { super(payload) }
}

// // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // EXPRESSIONS
// // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Expression = InstanceType<ConstructorFor<typeof Expression>>
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function Expression<S extends Mixable<Node>>(supertype: S) {
  abstract class ExpressionType extends Sentence(supertype) {
    #isExpression: any

    static [MIXINS]: MixinDefinition<Node>[] = [Expression, ...Sentence(supertype)[MIXINS] ?? []]
  }

  return ExpressionType
}


export class Reference<N extends Node> extends Expression(Node) {
  get kind(): 'Reference' { return 'Reference' }
  readonly name!: Name

  constructor(payload: Payload<Reference<N>, 'name'>) { super(payload) }

  get target(): N | undefined { return this.scope.resolve(this.name) }
}


export class Self extends Expression(Node) {
  get kind(): 'Self' { return 'Self' }

  constructor(payload: Payload<Self> = {}) { super(payload) }
}


export type LiteralValue = number | string | boolean | null | readonly [Reference<Class>, List<Expression>]
export class Literal<T extends LiteralValue = LiteralValue> extends Expression(Node) {
  get kind(): 'Literal' { return 'Literal' }
  readonly value!: T

  constructor(payload: Payload<Literal<T>, 'value'>) { super(payload) }

  isNumeric(): this is { value: number } { return typeof this.value === 'number' }
  isString(): this is { value: string } { return typeof this.value === 'string' }
  isBoolean(): this is { value: boolean } { return typeof this.value === 'boolean' }
  isNull(): this is { value: null } { return this.value === null }
  isCollection(): this is { value: readonly [Reference<Class>, List<Expression>] } { return isArray(this.value) }
}


export class Send extends Expression(Node) {
  get kind(): 'Send' { return 'Send' }
  readonly receiver!: Expression
  readonly message!: Name
  readonly args!: List<Expression>

  constructor({ args = [], ...payload }: Payload<Send, 'receiver' | 'message'>) {
    super({ args, ...payload })
  }

  get signature(): string {
    return `${this.message}/${this.args.length}`
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
  readonly instantiated!: Reference<Module>
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

  isIfExpression(): boolean {
    return !!last(this.thenBody.sentences)?.is(Expression) && !!last(this.elseBody.sentences)?.is(Expression)
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

  override parent!: Try

  constructor({ parameterType = new Reference({ name: 'wollok.lang.Exception' }), ...payload }: Payload<Catch, 'parameter' | 'body'>) {
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
  const lastSentence = sentences?.slice(-1).map(value => value.is(Expression) && (!value.is(If) || value.isIfExpression()) ? new Return({ value }) : value) ?? []

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
  get kind(): 'Environment' { return 'Environment' }

  readonly members!: List<Package>
  @lazy readonly nodeCache!: ReadonlyMap<Id, Node>
  @lazy readonly typeRegistry!: TypeRegistry

  override parent!: never

  constructor(payload: Payload<Environment, 'members'>) { super(payload) }

  get sourceFileName(): undefined { return undefined }

  override get ancestors(): List<Node> { return [] }

  getNodeById<N extends Node>(id: Id): N {
    const node = this.nodeCache.get(id)
    if (!node) throw new Error(`Missing node with id ${id}`)
    return node as N
  }

  @cached
  getNodeOrUndefinedByFQN<N extends Node>(fullyQualifiedName: Name): N | undefined {
    const [, id] = fullyQualifiedName.split('#')
    if (id) return this.getNodeById<N>(id)

    return this.scope.resolve<N>(fullyQualifiedName)
  }

  getNodeByFQN<N extends Node>(fullyQualifiedName: Name): N {
    const node = this.getNodeOrUndefinedByFQN<N>(fullyQualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
    return node
  }
  get objectClass(): Class { return this.getNodeByFQN('wollok.lang.Object') }
  get numberClass(): Class { return this.getNodeByFQN('wollok.lang.Number') }
  get stringClass(): Class { return this.getNodeByFQN('wollok.lang.String') }
  get booleanClass(): Class { return this.getNodeByFQN('wollok.lang.Boolean') }
}