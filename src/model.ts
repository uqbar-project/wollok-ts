import { last, mapObject, notEmpty } from './extensions'
import { lazy, cached } from './decorators'
import * as Models from './model'

const { isArray } = Array
const { entries, values, assign } = Object

export type Name = string
export type Id = string
export type List<T> = ReadonlyArray<T>

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

// TODO: Unify with Validator's problems
export abstract class Problem { abstract code: Name }

type AttributeKeys<T> = { [K in keyof T]-?: T[K] extends Function ? never : K }[keyof T]

type Payload<T, MandatoryFields extends keyof T = never> =
  Pick<T, MandatoryFields> &
  Partial<Pick<T, Exclude<AttributeKeys<T>, 'kind'>>>

export const isNode = (obj: any): obj is Node => !!(obj && obj.kind)

export const is = <Q extends Kind | Category>(kindOrCategory: Q) => (node: Node): node is NodeOfKindOrCategory<Q> =>
  node.is(kindOrCategory)

export function fromJSON<T>(json: any): T {
  const propagate = (data: any) => {
    if (isNode(data)) {
      const payload = mapObject(fromJSON, data) as {kind: Kind}
      const constructor = Models[payload.kind] as any
      return new constructor(payload)
    }
    if (isArray(data)) return data.map(fromJSON)
    if (data instanceof Object) return mapObject(fromJSON, data)
    return data
  }
  return propagate(json) as T
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// KINDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Kind = Node['kind']
export type KindOf<N extends Node> = N['kind']
export type NodeOfKind<K extends Kind> = Extract<Node, { kind: K }>

export type Category = 'Entity' | 'Module' | 'Sentence' | 'Expression' | 'Node'
export type NodeOfCategory<C extends Category> =
  C extends 'Entity' ? Entity :
  C extends 'Module' ? Module :
  C extends 'Sentence' ? Sentence :
  C extends 'Expression' ? Expression :
  C extends 'Node' ? Node :
  never

export type NodeOfKindOrCategory<Q extends Kind | Category> =
  Q extends Kind ? NodeOfKind<Q> :
  Q extends Category ? NodeOfCategory<Q> :
  never

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Node
  = Parameter
  | ParameterizedType
  | NamedArgument
  | Import
  | Body
  | Catch
  | Entity
  | Field
  | Method
  | Sentence
  | Reference<Node>
  | Environment


abstract class $Node {
  protected abstract readonly kind: Kind

  readonly id!: Id
  readonly scope!: Scope
  readonly sourceMap?: SourceMap
  readonly problems?: List<Problem>
  readonly metadata: List<Annotation> = []

  @lazy environment!: Environment
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  @lazy parent!: this extends Package ? Environment :
                 this extends Module | Import ? Package :
                 this extends Method ? Module :
                 this extends Field ? Class | Mixin | Singleton | Describe :
                 this extends Test ? Describe :
                 Node

  constructor(payload: Record<string, unknown>) {
    assign(this, payload)
  }

  label(): string { return `[${this.kind}]{${this.id?.slice(-6) ?? '--'}} at ${this.sourceInfo()}` }

  @cached
  toString(verbose = false): string {
    return !verbose ? this.label() : JSON.stringify(this, (key, value) => {
      if('scope' === key) return
      if('sourceMap' === key) return `${value}`
      return value
    }, 2)
  }

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Node' || this.kind === kindOrCategory
  }

  copy(delta: Record<string, unknown>): this {
    return new (this.constructor as any)({ ...this, ...delta })
  }

  isSynthetic(): this is this & { sourceMap: undefined } { return !this.sourceMap }

  hasProblems(): boolean { return notEmpty(this.problems) }

  sourceInfo(): string { return `${this.sourceFileName() ?? '--'}:${this.sourceMap?.start.line ?? '--'}` }

  sourceFileName(): string | undefined { return this.parent.sourceFileName() }

  @cached
  children(): List<Node> {
    const extractChildren = (owner: any): List<Node> => {
      if (isNode(owner)) return [owner]
      if (isArray(owner)) return owner.flatMap(extractChildren)
      return []
    }
    return values(this).flatMap(extractChildren)
  }

  @cached
  siblings(this: Node): List<Node> { return this.parent.children().filter(node => node !== this) }

  @cached
  nextSibling(this: Node): Node | undefined {
    const siblings = this.parent.children()
    const currentIndex = siblings.indexOf(this)
    return currentIndex === -1 ? undefined : siblings[currentIndex + 1]
  }

  @cached
  descendants(this: Node): List<Node> {
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

  @cached
  ancestors(): List<Node> {
    try {
      const parent = this.parent
      return [parent, ...parent.ancestors()]
    } catch (_) { return [] }
  }

  match<T>(this: Node, cases: Partial<{ [Q in Kind | Category]: (node: NodeOfKindOrCategory<Q>) => T }>): T {
    for(const [key, handler] of entries(cases))
      if(this.is(key as Kind)) return (handler as (node: Node) => T)(this)
    throw new Error(`Unmatched kind ${this.kind}`)
  }

  transform(tx: (node: Node) => Node): this {
    const applyTransform = (value: any): any => {
      if (isArray(value)) return value.map(applyTransform)
      if (isNode(value)) return value.copy(mapObject(applyTransform, tx(value as any)))
      return value
    }

    return applyTransform(this)
  }

  forEach(this: Node, tx: (node: Node, parent?: Node) => void): void {
    this.reduce((_, node, parent) => {
      tx(node, parent)
      return undefined
    }, undefined)
  }

  reduce<T>(this: Node, tx: (acum: T, node: Node, parent?: Node) => T, initial: T): T {
    const applyReduce = (acum: T, node: Node, parent?: Node): T =>
      node.children().reduce((seed, child) => {
        return applyReduce(seed, child, node)
      }, tx(acum, node, parent))

    return applyReduce(initial, this)
  }

  isGlobal() { return this.parent.is('Package') }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export class Parameter extends $Node {
  readonly kind = 'Parameter'
  readonly name!: Name
  readonly isVarArg!: boolean

  constructor({ isVarArg = false, ...payload }: Payload<Parameter, 'name'>) {
    super({ isVarArg, ...payload })
  }
}


export class ParameterizedType extends $Node {
  readonly kind = 'ParameterizedType'
  readonly reference!: Reference<Module | Class>
  readonly args!: List<NamedArgument>

  constructor({ args = [], ...payload }: Payload<ParameterizedType, 'reference'>) {
    super({ args, ...payload })
  }
}


export class NamedArgument extends $Node {
  readonly kind = 'NamedArgument'
  readonly name!: Name
  readonly value!: Expression

  constructor(payload: Payload<NamedArgument, 'name' | 'value'>) { super(payload) }
}


export class Import extends $Node {
  readonly kind = 'Import'
  readonly entity!: Reference<Entity>
  readonly isGeneric!: boolean

  constructor({ isGeneric = false, ...payload }: Payload<Import, 'entity'>) {
    super({ isGeneric, ...payload })
  }
}


export class Body extends $Node {
  readonly kind = 'Body'
  readonly sentences!: List<Sentence>

  constructor({ sentences = [], ...payload }: Payload<Body> = {}) {
    super({ sentences, ...payload })
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity
  = Package
  | Program
  | Test
  | Module
  | Variable


abstract class $Entity extends $Node {
  abstract readonly name?: Name // TODO: Make Singleton name be '' instead of ?

  override label(this: Entity): string {
    return `${this.fullyQualifiedName()} ${super.label()}`
  }

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Entity' || super.is(kindOrCategory)
  }

  @cached
  fullyQualifiedName(this: Entity): Name {
    const parent = this.parent
    const label = this.is('Singleton')
      ? this.name ?? `${this.superclass()!.fullyQualifiedName()}#${this.id}`
      : this.name.replace(/\.#/g, '')

    return parent.is('Package') || parent.is('Describe')
      ? `${parent.fullyQualifiedName()}.${label}`
      : label
  }

}


export class Package extends $Entity {
  readonly kind = 'Package'
  readonly name!: Name
  readonly imports!: List<Import>
  readonly members!: List<Entity>
  readonly fileName?: string

  constructor({ imports = [], members = [], ...payload }: Payload<Package, 'name'>) {
    super({ imports, members, ...payload })
  }

  @cached
  sourceFileName(): string | undefined { return this.fileName ?? super.sourceFileName() }

  @cached
  getNodeByQN<N extends Entity>(this: Package, qualifiedName: Name): N {
    const node = this.scope.resolve<N>(qualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${qualifiedName} from ${this.name}`)
    return node
  }

}


export class Program extends $Entity {
  readonly kind = 'Program'
  readonly name!: Name
  readonly body!: Body

  constructor(payload: Payload<Program, 'name' | 'body'>) { super(payload) }

  @cached
  sentences(): List<Sentence> { return this.body.sentences }
}


export class Test extends $Entity {
  readonly kind = 'Test'
  readonly isOnly!: boolean
  readonly name!: Name
  readonly body!: Body

  constructor({ isOnly = false, ...payload }: Payload<Test, 'name' | 'body'>) {
    super({ isOnly, ...payload })
  }

  @cached
  sentences(): List<Sentence> { return this.body.sentences }
}


export class Variable extends $Entity {
  readonly kind = 'Variable'
  readonly name!: Name
  readonly isConstant!: boolean
  readonly value!: Expression

  constructor({ value = new Literal({ value: null }), ...payload }: Payload<Variable, 'name' | 'isConstant'>) {
    super({ value, ...payload })
  }

  // TODO: Maybe use mixins to avoid these ugly redefinitions
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Sentence' || super.is(kindOrCategory)
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module = Class | Singleton | Mixin | Describe

abstract class $Module extends $Entity {
  abstract readonly name?: Name
  abstract readonly supertypes: List<ParameterizedType>
  abstract readonly members: List<Field | Method | Variable | Test>
  abstract superclass(this: Module): Class | undefined

  constructor({ members, ...payload }: Payload<$Module> & Record<Name, unknown>) {
    const methods = members?.filter(is('Method')) ?? []
    const fields = members?.filter(is('Field')) ?? []
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

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Module' || super.is(kindOrCategory)
  }

  @cached
  mixins(): List<Mixin> {
    return this.supertypes
      .flatMap(supertype => supertype.reference.target() ? [supertype.reference.target()!] : [])
      .filter(is('Mixin'))
  }

  methods(): List<Method> { return this.members.filter(is('Method')) }
  fields(): List<Field> { return this.members.filter(is('Field')) }
  allFields(this: Module): List<Field> { return this.hierarchy().flatMap(parent => parent.fields()) }
  allMethods(this: Module): List<Method> { return this.hierarchy().flatMap(parent => parent.methods()) }
  lookupField(this: Module, name: string): Field | undefined { return this.allFields().find(field => field.name === name) }

  @cached
  hierarchy(this: Module): List<Module> {
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

  inherits(this: Module, other: Module): boolean {
    return this.hierarchy().some(({ id }) => other.id === id)
  }

  @cached
  lookupMethod(this: Module, name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method | undefined {
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
  defaultFieldValues(this: Module): Map<Field, Expression | undefined> {
    return new Map(this.hierarchy().flatMap(module => module.fields()).map(field => [
      field,
      this.hierarchy().reduceRight((defaultValue, module) =>
        module.supertypes.flatMap(supertype => supertype.args).find(arg => arg.name === field.name)?.value ?? defaultValue
      , field.value),
    ]))
  }
}


export class Class extends $Module {
  readonly kind = 'Class'
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Class, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  @cached
  superclass(): Class | undefined {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target()?.is('Class'))?.reference
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


export class Singleton extends $Module {
  readonly kind = 'Singleton'
  readonly name?: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Singleton>) {
    super({ supertypes, members, ...payload })
  }

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Expression' || super.is(kindOrCategory)
  }

  superclass(): Class {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target()?.is('Class'))?.reference
    if(superclassReference) return superclassReference.target() as Class
    else return this.environment.objectClass
  }

  isClosure(parametersCount = 0): boolean {
    return !!this.lookupMethod('<apply>', parametersCount)
  }
}


export class Mixin extends $Module {
  readonly kind = 'Mixin'
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<Field | Method>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Mixin, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  superclass(): undefined { return undefined }
}


export class Describe extends $Module {
  readonly kind = 'Describe'
  readonly name!: Name
  readonly members!: List<Field | Method | Test>
  readonly supertypes: List<ParameterizedType> = [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Object' }) })]

  constructor({ members = [], ...payload }: Payload<Describe, 'name'>) {
    super({ members, ...payload })
  }

  superclass(): Class { return this.supertypes[0].reference.target()! as Class }

  tests(): List<Test> { return this.members.filter(is('Test')) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────


export class Field extends $Node {
  readonly kind = 'Field'
  readonly name!: Name
  readonly isConstant!: boolean
  readonly isProperty!: boolean
  readonly value!: Expression

  constructor({ value = new Literal({ value: null }), isProperty = false, ...payload }: Payload<Field, 'name' | 'isConstant'>) {
    super({ value, isProperty, ...payload })
  }

  override label(): string {
    return `${this.parent.fullyQualifiedName()}.${this.name} ${super.label()}`
  }
}


export class Method extends $Node {
  readonly kind = 'Method'
  readonly name!: Name
  readonly isOverride!: boolean
  readonly parameters!: List<Parameter>
  readonly body?: Body | 'native'

  constructor({ isOverride = false, parameters = [], ...payload }: Payload<Method, 'name'>) {
    super({ isOverride, parameters, ...payload })
  }

  override label(): string {
    return `${this.parent.fullyQualifiedName()}.${this.name}/${this.parameters.length} ${super.label()}`
  }

  isAbstract(): this is {body: undefined} { return !this.body }
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
    return this.name === name && (
      this.hasVarArgs() && this.parameters.length - 1 <= arity ||
      this.parameters.length === arity
    )
  }

}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence = Variable | Return | Assignment | Expression


abstract class $Sentence extends $Node {
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Sentence' || super.is(kindOrCategory)
  }
}


export class Return extends $Sentence {
  readonly kind = 'Return'
  readonly value?: Expression

  constructor(payload: Payload<Return> = {}) { super(payload) }
}


export class Assignment extends $Sentence {
  readonly kind = 'Assignment'
  readonly variable!: Reference<Variable | Field>
  readonly value!: Expression

  constructor(payload: Payload<Assignment, 'variable' | 'value'>) { super(payload) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Expression
  = Reference<Field | Variable | Parameter | NamedArgument | Singleton>
  | Self
  | Literal<LiteralValue>
  | Send
  | Super
  | New
  | If
  | Throw
  | Try
  | Singleton

abstract class $Expression extends $Sentence {
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Expression' || super.is(kindOrCategory)
  }
}


export class Reference<N extends Node> extends $Expression {
  readonly kind = 'Reference'
  readonly name!: Name

  constructor(payload: Payload<Reference<N>, 'name'>) { super(payload) }

  @cached
  target(): N | undefined {
    return this.scope.resolve(this.name)
  }
}


export class Self extends $Expression {
  readonly kind = 'Self'

  constructor(payload: Payload<Self> = {}) { super(payload) }
}


export type LiteralValue = number | string | boolean | null | readonly [Reference<Class>, List<Expression> ]
export class Literal<T extends LiteralValue = LiteralValue> extends $Expression {
  readonly kind = 'Literal'
  readonly value!: T

  constructor(payload: Payload<Literal<T>, 'value'>) { super(payload) }
}


export class Send extends $Expression {
  readonly kind = 'Send'
  readonly receiver!: Expression
  readonly message!: Name
  readonly args!: List<Expression>

  constructor({ args = [], ...payload }: Payload<Send, 'receiver' | 'message'>) {
    super({ args, ...payload })
  }
}


export class Super extends $Expression {
  readonly kind = 'Super'
  readonly args!: List<Expression>

  constructor({ args = [], ...payload }: Payload<Super> = {}) {
    super({ args, ...payload })
  }
}


export class New extends $Expression {
  readonly kind = 'New'
  readonly instantiated!: Reference<Class>
  readonly args!: List<NamedArgument>

  constructor({ args = [], ...payload }: Payload<New, 'instantiated'>) {
    super({ args, ...payload })
  }
}


export class If extends $Expression {
  readonly kind = 'If'
  readonly condition!: Expression
  readonly thenBody!: Body
  readonly elseBody!: Body

  constructor({ elseBody = new Body(), ...payload }: Payload<If, 'condition' | 'thenBody'>) {
    super({ elseBody, ...payload })
  }
}


export class Throw extends $Expression {
  readonly kind = 'Throw'
  readonly exception!: Expression

  constructor(payload: Payload<Throw, 'exception'>) { super(payload) }
}


export class Try extends $Expression {
  readonly kind = 'Try'
  readonly body!: Body
  readonly catches!: List<Catch>
  readonly always!: Body

  constructor({ catches = [], always = new Body(), ...payload }: Payload<Try, 'body'>) {
    super({ catches, always, ...payload })
  }
}


export class Catch extends $Expression {
  readonly kind = 'Catch'
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
  const lastSentence = sentences?.slice(-1).map(value => value.is('Expression') ? new Return({ value }) : value) ?? []

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

export class Environment extends $Node {
  readonly kind = 'Environment'
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
  getNodeByFQN<N extends Node>(this: Environment, fullyQualifiedName: Name): N {
    const [, id] = fullyQualifiedName.split('#')
    if (id) return this.getNodeById(id)

    const node = this.scope.resolve<N>(fullyQualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
    return node
  }

  get objectClass(): Class {
    return this.getNodeByFQN('wollok.lang.Object')
  }
}