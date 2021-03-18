import { Index } from 'parsimmon'
import { keys, mapObject, last } from './extensions'
import * as Models from './model'

const { isArray } = Array
const { values, assign } = Object

export type Name = string
export type Id = string
export type List<T> = ReadonlyArray<T>
export type Cache = Map<string, any>

export interface Scope {
  resolve<N extends Node>(qualifiedName: Name, allowLookup?: boolean): N | undefined
  include(...others: Scope[]): void
  register(...contributions: [Name, Node][]): void
}

export interface Source {
  readonly file?: string
  readonly start: Index
  readonly end: Index
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
// CACHE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const cached = (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod: Function = descriptor.value
  descriptor.value = function (this: { cache: Cache }, ...args: any[]) {
    const key = `${propertyKey}(${[...args]})`
    if (this.cache.has(key)) return this.cache.get(key)
    const result = originalMethod.apply(this, args)
    this.cache.set(key, result)
    return result
  }
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
  | DescribeMember
  | ModuleMember
  | Sentence
  | Reference<any>
  | Environment


abstract class $Node {
  protected abstract readonly kind: Kind

  readonly id!: Id
  readonly scope!: Scope
  readonly source?: Source
  readonly problems?: List<Problem>

  readonly #cache: Cache = new Map()
  get cache() { return this.#cache }

  constructor(payload: Record<string, unknown>) {
    assign(this, payload)
  }

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Node' || this.kind === kindOrCategory
  }

  copy(delta: Record<string, unknown>): Node {
    return new (this.constructor as any)({ ...this, ...delta })
  }

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
  parent():
    this extends Module | Describe | Import ? Package :
    this extends ModuleMember ? Module :
    Node {
    throw new Error(`Missing parent in cache for node ${this.id}`)
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
      const parent = this.parent()
      return [parent, ...parent.ancestors()]
    } catch (_) { return [] }
  }

  @cached
  environment(): Environment { throw new Error('Unlinked node has no Environment') }

  match<T>(this: Node, cases: Partial<{ [Q in Kind | Category]: (node: NodeOfKindOrCategory<Q>) => T }>): T {
    const matched = keys(cases).find(key => this.is(key))
    if (!matched) throw new Error(`Unmatched kind ${this.kind}`)
    return (cases[matched] as (node: Node) => T)(this)
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
  | Describe
  | Module
  | Variable


abstract class $Entity extends $Node {
  abstract readonly name?: Name

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Entity' || super.is(kindOrCategory)
  }

  fullyQualifiedName(this: Entity): Name {
    const parent = this.parent()
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

  constructor({ imports = [], members = [], ...payload }: Payload<Package, 'name'>) {
    super({ imports, members, ...payload })
  }

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


export class Describe extends $Entity {
  readonly kind = 'Describe'
  readonly name!: Name
  readonly members!: List<DescribeMember>

  constructor({ members = [], ...payload }: Payload<Describe, 'name'>) {
    super({ members, ...payload })
  }

  tests(): List<Test> { return this.members.filter(is('Test')) }
  methods(): List<Method> { return this.members.filter(is('Method')) }
  variables(): List<Variable> { return this.members.filter(is('Variable')) }

  // TODO: Describe is a Module?
  @cached
  lookupMethod(this: Describe, name: Name, arity: number): Method | undefined {
    return this.methods().find(method => method.matchesSignature(name, arity))
    ?? this.environment().getNodeByFQN<Class>('wollok.lang.Object').lookupMethod(name, arity)
  }

  // TODO: Describe is a Module?
  @cached
  defaultFieldValues(): Map<Field, Expression | undefined> {
    return new Map(this.variables().map(variable => [
      variable as unknown as Field,
      variable.value,
    ]))
  }
}


export class Variable extends $Entity {
  readonly kind = 'Variable'
  readonly name!: Name
  readonly isReadOnly!: boolean
  readonly value!: Expression

  constructor({ value = new Literal({ value: null }), ...payload }: Payload<Variable, 'name' | 'isReadOnly'>) {
    super({ value, ...payload })
  }

  // TODO: Can we prevent repeating this here?
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return [this.kind, 'Node', 'Sentence', 'Entity'].includes(kindOrCategory)
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module = Class | Singleton | Mixin

abstract class $Module extends $Entity {
  abstract supertypes: List<ParameterizedType>
  abstract members: List<ModuleMember | DescribeMember>

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
        body: new Body({
          sentences: [
            new Return({ value: new Reference({ name }) }),
          ],
        }),
      }))

    const propertySetters = properties
      .filter(field => !field.isReadOnly && !methods.some(method => method.matchesSignature(field.name, 1)))
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

  @cached
  hierarchy(this: Module): List<Module> {
    const hierarchyExcluding = (node: Module, exclude: List<Id> = []): List<Module> => {
      if (exclude.includes(node.id!)) return []
      const modules = [
        ...node.mixins(),
        ...node.is('Mixin') || !node.superclass() ? [] : [node.superclass()!],
      ]
      return modules.reduce<[List<Module>, List<Id>]>(([hierarchy, excluded], module) => [
        [...hierarchy, ...hierarchyExcluding(module, excluded)],
        [module.id, ...excluded],
      ], [[node], [node.id, ...exclude]])[0]
    }

    return hierarchyExcluding(this)
  }

  inherits(this: Module, other: Module): boolean {
    return this.hierarchy().some(({ id }) => other.id === id)
  }

  @cached
  lookupMethod(this: Module, name: Name, arity: number, lookupStartFQN?: Name): Method | undefined {
    let startReached = !lookupStartFQN
    for (const module of this.hierarchy()) {
      if (startReached) {
        const found = module.methods().find(member => !member.isAbstract() && member.matchesSignature(name, arity))
        if (found) return found
      }
      if (module.fullyQualifiedName() === lookupStartFQN) startReached = true
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
  readonly members!: List<ModuleMember>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Class, 'name'>) {
    super({ supertypes, members, ...payload })
  }

  superclass(this: Module): Class | undefined
  @cached
  superclass(this: Class): Class | undefined {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target()?.is('Class'))?.reference
    if(superclassReference) return superclassReference.target() as Class
    else {
      const objectClass = this.environment().getNodeByFQN<Class>('wollok.lang.Object')
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
  readonly members!: List<ModuleMember>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Singleton>) {
    super({ supertypes, members, ...payload })
  }

  superclass(this: Singleton): Class
  superclass(this: Module): Class
  superclass(this: Singleton): Class {
    const superclassReference = this.supertypes.find(supertype => supertype.reference.target()?.is('Class'))?.reference
    if(superclassReference) return superclassReference.target() as Class
    else return this.environment().getNodeByFQN<Class>('wollok.lang.Object')
  }

}


export class Mixin extends $Module {
  readonly kind = 'Mixin'
  readonly name!: Name
  readonly supertypes!: List<ParameterizedType>
  readonly members!: List<ModuleMember>

  constructor({ supertypes = [], members = [], ...payload }: Payload<Mixin, 'name'>) {
    super({ supertypes, members, ...payload })
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ModuleMember = Field | Method
export type DescribeMember = Variable | Test | Method


export class Field extends $Node {
  readonly kind = 'Field'
  readonly name!: Name
  readonly isReadOnly!: boolean
  readonly isProperty!: boolean
  readonly value!: Expression

  constructor({ value = new Literal({ value: null }), isProperty = false, ...payload }: Payload<Field, 'name' | 'isReadOnly'>) {
    super({ value, isProperty, ...payload })
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

  isAbstract(): boolean { return !this.body }

  @cached
  hasVarArgs(): boolean {
    return !!last(this.parameters)?.isVarArg
  }

  @cached
  sentences(): List<Sentence> {
    return !this.body || this.body === 'native' ? [] : this.body.sentences
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

abstract class $Expression extends $Node {
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q> {
    return kindOrCategory === 'Expression' || kindOrCategory === 'Sentence' || super.is(kindOrCategory)
  }
}


export class Reference<N extends Node> extends $Expression {
  readonly kind = 'Reference'
  readonly name!: Name

  constructor(payload: Payload<Reference<N>, 'name'>) { super(payload) }

  @cached
  target(this: Reference<any>): N | undefined {
    return this.scope.resolve(this.name)
  }
}


export class Self extends $Expression {
  readonly kind = 'Self'

  constructor(payload: Payload<Self> = {}) { super(payload) }
}


export type LiteralValue = number | string | boolean | null | Singleton | readonly [Reference<Class>, List<Expression> ]
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
  readonly parameterType!: Reference<Module> // TODO: use NamedParameter instead
  readonly body!: Body

  constructor({ parameterType = new Reference({ name: 'wollok.lang.Exception' }), ...payload }: Payload<Catch, 'parameter'| 'body'>) {
    super({ parameterType, ...payload })
  }
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type ClosurePayload = {
  parameters?: List<Parameter>,
  sentences?: List<Sentence>,
  code?: string,
  source?: Source
}

export const Closure = ({ sentences: baseSentences, parameters, code, ...payload }: ClosurePayload): Literal<Singleton> => {
  const initialSentences = (baseSentences ?? []).slice(0, -1)
  const lastSentence = last(baseSentences ?? [])
  const sentences =
    lastSentence?.is('Expression') ? [...initialSentences, new Return({ value: lastSentence })] :
    lastSentence?.is('Return') ? [...initialSentences, lastSentence] :
    [...initialSentences, ...lastSentence ? [lastSentence] : [], new Return()]

  return new Literal<Singleton>({
    value: new Singleton({
      supertypes: [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Closure' }) })],
      members: [
        new Method({ name: '<apply>', parameters, body: new Body({ sentences }) }),
        ...code ? [
          new Field({ name: '<toString>', isReadOnly: true, value: new Literal({ value: code }) }),
        ] : [],
      ],
    }),
    ...payload,
  })
}

export class Environment extends $Node {
  readonly kind = 'Environment'
  readonly members!: List<Package>

  constructor(payload: Payload<Environment, 'members'>) { super(payload) }

  @cached
  getNodeById<N extends Node>(this: Environment, id: Id): N {
    throw new Error(`Missing node in node cache with id ${id}`)
  }

  //TODO: as function to use as safe cast instead of all the crapy casts in many methods ?
  @cached
  getNodeByFQN<N extends Node>(this: Environment, fullyQualifiedName: Name): N {
    const [, id] = fullyQualifiedName.split('#')
    if (id) return this.getNodeById(id)

    const node = this.scope.resolve<N>(fullyQualifiedName)
    if (!node) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
    return node
  }

}