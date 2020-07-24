import { Index } from 'parsimmon'
import { keys, divideOn, mapObject } from './extensions'

const { isArray } = Array
const { values, assign } = Object

export type Name = string
export type Id = string
export type List<T> = ReadonlyArray<T>
export type Cache = Map<string, any>

type AttributeKeys<T> = { [K in keyof T]-?: T[K] extends Function ? never : K }[keyof T]
type OptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T]
export type Payload<T> = Omit<
  Pick<T, Exclude<AttributeKeys<T>, OptionalKeys<T>>> &
  Partial<Pick<T, AttributeKeys<T> & OptionalKeys<T>>>,
  'kind' | '_stage'
>

export const isNode = <S extends Stage>(obj: any): obj is Node<S> => !!(obj && obj.kind)

export const is = <Q extends Kind | Category>(kindOrCategory: Q) =>
  <S extends Stage>(node: Node<S>): node is NodeOfKindOrCategory<Q, S> =>
    node.is(kindOrCategory)


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CACHE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const cached = (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod: Function = descriptor.value
  descriptor.value = function (this: {_cache(): Cache}, ...args: any[]) {
    const key = `${propertyKey}(${[...args]})`
    // TODO: Could we optimize this if we avoid returning undefined in cache methods?
    if (this._cache().has(key)) return this._cache().get(key)
    const result = originalMethod.apply(this, args)
    this._cache().set(key, result)
    return result
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STAGES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Stage = Raw | Filled | Linked
export abstract class Raw { protected readonly rawTag = 'Raw' }
export abstract class Filled extends Raw { protected readonly filledTag = 'Filled' }
export abstract class Linked extends Filled { protected readonly linkedTag = 'Linked' }
export type Final = Linked

export type Fillable<S extends Stage, T> = S extends Filled ? T : T | undefined
export type Linkable<S extends Stage, T> = S extends Linked ? T : T | undefined

export type OnStage<N, S extends Stage> = N extends NodeOfKind<infer K, infer _> ? NodeOfKind<K, S> : never

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Kind = Node['kind']

export type KindOf<N extends Node<any>> = N['kind']

export type Category = 'Entity' | 'Module' | 'Sentence' | 'Expression' | 'Node'

export type NodeOfKind<K extends Kind, S extends Stage> = Extract<Node<S>, { kind: K }>

export type NodeOfCategory<C extends Category, S extends Stage> =
  C extends 'Entity' ? Entity<S> :
  C extends 'Module' ? Module<S> :
  C extends 'Sentence' ? Sentence<S> :
  C extends 'Expression' ? Expression<S> :
  C extends 'Node' ? Node<S> :
  never

export type NodeOfKindOrCategory<Q extends Kind | Category, S extends Stage> =
  Q extends Kind ? NodeOfKind<Q, S> :
  Q extends Category ? NodeOfCategory<Q, S> :
  never

export interface Source {
  readonly file?: string
  readonly start: Index
  readonly end: Index
}

export type Scope = Record<Name, Id>


export type Node<S extends Stage = Final>
  = Parameter<S>
  | NamedArgument<S>
  | Import<S>
  | Body<S>
  | Catch<S>
  | Entity<S>
  | DescribeMember<S>
  | ClassMember<S>
  | Sentence<S>
  | Environment<S>


abstract class $Node<S extends Stage> {
  protected readonly _stage?: S

  abstract readonly kind: Kind

  readonly id!: Linkable<S, Id>
  readonly scope!: Linkable<S, Scope>
  readonly source?: Source
  // TODO: Represent this better and, hopefully, avoid optionality?
  // Errors don't convert to JSON. We need a field for the source, a description and likely to separate
  // by cause, such as ParseError, LinkError, ...
  // Are all of these ERROR errors, or can they be less severe?
  readonly errors?: List<Error>
  
  // TODO: Replace with #cache once TS version is updated
  // readonly #cache: Cache = new Map()
  _cache(): Cache { throw new Error('uninitialized cache') }

  constructor(payload: Record<string, unknown>) {
    const cache = new Map()
    this._cache = () => cache
    assign(this, payload)
  }
 
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q, S> {
    return kindOrCategory === 'Node' || this.kind === kindOrCategory
  }

  copy(delta: Record<string, unknown>): Node<S> {
    return new (this.constructor as any)({ ...this, ...delta })
  }

  @cached
  children(): List<Node<S>> {
    const extractChildren = (owner: any): List<Node<S>> => {
      if (isNode<S>(owner)) return [owner]
      if (isArray(owner)) return owner.flatMap(extractChildren)
      if (owner instanceof Object) return values(owner).flatMap(extractChildren)
      return []
    }

    return values(this).flatMap(extractChildren)
  }

  parent<R extends Linked>(this: Module<R> | Describe<R>): Package<R>
  parent<R extends Linked>(this: Field<R> | Method<R>): Module<R>
  parent<R extends Linked>(this: Constructor<R>): Class<R>
  parent<R extends Linked>(this: Node<R>): Node<R>
  @cached
  parent(): never {
    throw new Error(`Missing parent in cache for node ${this.id}`)
  }
  
  @cached
  descendants(this: Node<S>): List<Node<S>> {
    const pending: Node<S>[] = []
    const response: Node<S>[] = []
    let next: Node<S> | undefined = this
    do {
      const children = next!.children()
      response.push(...children)
      pending.push(...children)
      next = pending.shift()
    } while (next)
    return response
  }

  @cached
  ancestors<R extends Linked>(this: Node<R>): List<Node<R>> {
    try {
      const parent = this.parent()
      return [parent, ...parent.ancestors()]
    } catch (_) { return [] }
  }

  @cached
  environment<R extends Linked>(this: Node<R>): Environment<R> { throw new Error('Unlinked node has no Environment') }

  match<T>(this: Node<S>, cases: Partial<{ [Q in Kind | Category]: (node: NodeOfKindOrCategory<Q, S>) => T }>): T {
    const matched = keys(cases).find(key => this.is(key))
    if(!matched) throw new Error(`Unmatched kind ${this.kind}`)
    return (cases[matched] as (node: Node<S>) => T)(this)
  }
  
  transform<R extends Stage = S>(tx: (node: Node<R>) => Node<R>): OnStage<this, R>
  transform<R extends Stage = S>(tx: (node: Node<R>) => Node<R>): Node<R>
  transform<R extends Stage = S>(tx: (node: Node<R>) => Node<R>) {
    const applyTransform = (value: any): any => {
      if (typeof value === 'function') return value
      if (isArray(value)) return value.map(applyTransform)
      if (isNode<S>(value)) return value.copy(mapObject(applyTransform, tx(value as any)))
      if (value instanceof Object) return mapObject(applyTransform, value)
      return value
    }
  
    return applyTransform(this)
  }

  forEach(this: Node<S>, tx: (node: Node<S>, parent?: Node<S>) => void): void {
    this.reduce((_, node, parent) => {
      tx(node, parent)
      return undefined
    }, undefined)
  }

  reduce<T>(this: Node<S>, tx: (acum: T, node: Node<S>, parent?: Node<S>) => T, initial: T): T {
    const applyReduce = (acum: T, node: Node<S>, parent?: Node<S>): T =>
      node.children().reduce((seed, child) => {
        return applyReduce(seed, child, node)
      }, tx(acum, node, parent))
    
    return applyReduce(initial, this)
  }

}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export class Parameter<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Parameter'
  readonly name!: Name
  readonly isVarArg!: boolean

  constructor(payload: Payload<Parameter<S>>) { super(payload) }
}


export class NamedArgument<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'NamedArgument'
  readonly name!: Name
  readonly value!: Expression<S>

  constructor(payload: Payload<NamedArgument<S>>) { super(payload) }
}


export class Import<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Import'
  readonly entity!: Reference<S>
  readonly isGeneric!: boolean

  constructor(payload: Payload<Import<S>>) { super(payload) }
}


export class Body<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Body'
  readonly sentences!: List<Sentence<S>>

  constructor(payload: Payload<Body<S>>) { super(payload) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity<S extends Stage = Final>
  = Package<S>
  | Program<S>
  | Test<S>
  | Describe<S>
  | Module<S>
  | Variable<S>


abstract class $Entity<S extends Stage> extends $Node<S> {
  abstract readonly name: Name | undefined

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q, S> {
    return kindOrCategory === 'Entity' || super.is(kindOrCategory)
  }

  fullyQualifiedName<R extends Linked>(this: Entity<R>): Name {
    const parent = this.parent()
    const label = this.is('Singleton')
      ? this.name || `${this.superCall.superclassRef.target<'Module'>().fullyQualifiedName()}#${this.id}`
      : this.name.replace(/\.#/g, '')

    return parent.is('Package') || parent.is('Describe')
      ? `${parent.fullyQualifiedName()}.${label}`
      : label
  }

}


export class Package<S extends Stage = Final> extends $Entity<S> {
  readonly kind = 'Package'
  readonly name!: Name
  readonly imports!: List<Import<S>>
  readonly members!: List<Entity<S>>

  constructor(data: Payload<Package<S>>) { super(data) }

  @cached
  getNodeByQN<R extends Linked = Final>(this: Package<R>, qualifiedName: Name): Entity<R> {
    const [, id] = qualifiedName.split('#')
    if (id) return this.environment().getNodeById(id)
    return qualifiedName.split('.').reduce((current: Entity<R>, step) => {
      const next = current.children().find((child): child is Entity<R> => child.is('Entity') && child.name === step)
      if (!next) throw new Error(`Could not resolve reference to ${qualifiedName} from ${this.name} among ${JSON.stringify(current.children())}`)
      return next
    }, this)
  }

}


export class Program<S extends Stage = Final> extends $Entity<S> {
  readonly kind = 'Program'
  readonly name!: Name
  readonly body!: Body<S>

  constructor(data: Payload<Program<S>>) { super(data) }

  @cached
  sentences(): List<Sentence<S>> { return this.body.sentences }
}


export class Test<S extends Stage = Final> extends $Entity<S> {
  readonly kind = 'Test'
  readonly name!: Name
  readonly body!: Body<S>

  constructor(data: Payload<Test<S>>) { super(data) }

  @cached
  sentences(): List<Sentence<S>> { return this.body.sentences }
}


export class Describe<S extends Stage = Final> extends $Entity<S> {
  readonly kind = 'Describe'
  readonly name!: Name
  readonly members!: List<DescribeMember<S>>

  constructor(data: Payload<Describe<S>>) { super(data) }

  tests(): List<Test<S>> { return this.members.filter(is('Test')) }
  methods(): List<Method<S>> { return this.members.filter(is('Method')) }
  variables(): List<Variable<S>> { return this.members.filter(is('Variable')) }
  fixtures(): List<Fixture<S>> { return this.members.filter(is('Fixture')) }

  @cached
  lookupMethod<R extends Linked>(this: Describe<R>, name: Name, arity: number): Method<R> | undefined {
    return this.methods().find(member =>
      (!!member.body || member.body === 'native') && member.name === name && (
        member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
        member.parameters.length === arity
      ))
  }
}


export class Variable<S extends Stage = Final> extends $Entity<S> {
  readonly kind = 'Variable'
  readonly name!: Name
  readonly isReadOnly!: boolean
  readonly value!: Fillable<S, Expression<S>>

  constructor(data: Payload<Variable<S>>) { super(data) }

  // TODO: Can we prevent repeating this here?
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q, S> {
    return [this.kind, 'Sentence', 'Entity'].includes(kindOrCategory)
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module<S extends Stage = Final> = Class<S> | Singleton<S> | Mixin<S>

abstract class $Module<S extends Stage> extends $Entity<S> {
  abstract members: List<ClassMember<S> | DescribeMember<S>>

  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q, S> {
    return kindOrCategory === 'Module' || super.is(kindOrCategory)
  }

  methods(): List<Method<S>> { return this.members.filter(is('Method')) }
  fields(): List<Field<S>> { return this.members.filter(is('Field')) }

  @cached
  hierarchy<R extends Linked>(this: Module<R>): List<Module<R>> {
    const hierarchyExcluding = (module: Module<R>, exclude: List<Id> = []): List<Module<R>> => {
      if (exclude.includes(module.id!)) return []
      const modules = [
        ...module.mixins.map(mixin => mixin.target<'Module', R>()),
        ...module.kind === 'Mixin' ? [] : module.superclass() ? [module.superclass()!] : [],
      ]
      return modules.reduce(({ mods, exs }, mod) => (
        { mods: [...mods, ...hierarchyExcluding(mod, exs)], exs: [mod.id, ...exs] }
      ), { mods: [module], exs: [module.id, ...exclude] }).mods
    }

    return hierarchyExcluding(this)
  }

  inherits<R extends Linked>(this: Module<R>, other: Module<R>): boolean {
    return this.hierarchy().some(({ id }) => other.id === id)
  }

  @cached
  lookupMethod<R extends Linked>(this: Module<R>, name: Name, arity: number): Method<R> | undefined {
    for (const module of this.hierarchy()) {
      const found = module.methods().find(member => (!!member.body || member.body === 'native') && member.matchesSignature(name, arity))
      if (found) return found
    }
    return undefined
  }

}


export class Class<S extends Stage = Final> extends $Module<S> {
  readonly kind = 'Class'
  readonly name!: Name
  readonly mixins!: List<Reference<S>>
  readonly members!: List<ClassMember<S>>
  readonly superclassRef!: Fillable<S, Reference<S> | null>

  constructor(data: Payload<Class<S>>) { super(data) }

  constructors(): List<Constructor<S>> { return this.members.filter<Constructor<S>>(is('Constructor')) }

  superclass<R extends Linked>(this: Module<R>): Class<R> | null
  superclass<R extends Linked>(this: Class<R>): Class<R> | null {
    return this.superclassRef?.target<'Class', R>() ?? null
  }

  @cached
  lookupConstructor<R extends Linked>(this: Class<R>, arity: number): Constructor<R> | undefined {
    const ownConstructor = this.constructors().find(member => member.matchesSignature(arity))

    if (ownConstructor) return ownConstructor

    const isNotDefaultConstructor = (constructor: Constructor<R>) => constructor.body.sentences.length !== 0 || constructor.baseCall
    return this.constructors().filter(isNotDefaultConstructor).length
      ? undefined
      : this.superclass?.()?.lookupConstructor?.(arity)
  }
}


export class Singleton<S extends Stage = Final> extends $Module<S> {
  readonly kind = 'Singleton'
  readonly name: Name | undefined
  readonly mixins!: List<Reference<S>>
  readonly members!: List<ObjectMember<S>>
  readonly superCall!: Fillable<S, {
    superclassRef: Reference<S>,
    args: List<Expression<S>> | List<NamedArgument<S>>
  }>

  constructor(data: Payload<Singleton<S>>) { super(data) }

  superclass<R extends Linked>(this: Singleton<R>): Class<R>
  superclass<R extends Linked>(this: Module<R>): Class<R> | null 
  superclass<R extends Linked>(this: Singleton<R>): Class<R> {
    return this.superCall.superclassRef.target()
  }
}


export class Mixin<S extends Stage = Final> extends $Module<S> {
  readonly kind = 'Mixin'
  readonly name!: Name
  readonly mixins!: List<Reference<S>>
  readonly members!: List<ObjectMember<S>>

  constructor(data: Payload<Mixin<S>>) { super(data) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage = Final> = Field<S> | Method<S>
export type ClassMember<S extends Stage = Final> = Constructor<S> | ObjectMember<S>
export type DescribeMember<S extends Stage = Final> = Variable<S> | Fixture<S> | Test<S> | Method<S>


export class Field<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Field'
  readonly name!: Name
  readonly isReadOnly!: boolean
  readonly isProperty!: boolean
  readonly value!: Fillable<S, Expression<S>>

  constructor(data: Payload<Field<S>>) { super(data) }
}


export class Method<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Method'
  readonly name!: Name
  readonly isOverride!: boolean
  readonly parameters!: List<Parameter<S>>
  readonly body?: Body<S> | 'native'

  constructor(data: Payload<Method<S>>) { super(data) }

  @cached
  sentences(): List<Sentence<S>> {
    return (!this.body || this.body === 'native') ? [] : this.body.sentences
  }
  
  @cached
  matchesSignature(name: Name, arity: number): boolean {
    return this.name === name && (
      this.parameters.some(({ isVarArg }) => isVarArg) && this.parameters.length - 1 <= arity ||
      this.parameters.length === arity
    )
  }

}

export class Constructor<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Constructor'
  readonly parameters!: List<Parameter<S>>
  readonly body!: Body<S>
  readonly baseCall?: { callsSuper: boolean, args: List<Expression<S>> }

  constructor(data: Payload<Constructor<S>>) { super(data) }

  matchesSignature<R extends Linked>(this: Constructor<R>, arity: number): boolean {
    return this.parameters.some(({ isVarArg }) => isVarArg) && this.parameters.length - 1 <= arity ||
      this.parameters.length === arity
  }
}


export class Fixture<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Fixture'
  readonly body!: Body<S>

  constructor(data: Payload<Fixture<S>>) { super(data) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage = Final> = Variable<S> | Return<S> | Assignment<S> | Expression<S>


abstract class $Sentence<S extends Stage> extends $Node<S> {
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q, S> {
    return kindOrCategory === 'Sentence' || super.is(kindOrCategory)
  }
}


export class Return<S extends Stage = Final> extends $Sentence<S> {
  readonly kind = 'Return'
  readonly value?: Expression<S>

  constructor(data: Payload<Return<S>>) { super(data) }
}


export class Assignment<S extends Stage = Final> extends $Sentence<S> {
  readonly kind = 'Assignment'
  readonly variable!: Reference<S>
  readonly value!: Expression<S>

  constructor(data: Payload<Assignment<S>>) { super(data) }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Expression<S extends Stage = Final>
  = Reference<S>
  | Self<S>
  | Literal<S, LiteralValue<S>>
  | Send<S>
  | Super<S>
  | New<S>
  | If<S>
  | Throw<S>
  | Try<S>

abstract class $Expression<S extends Stage> extends $Node<S> {
  is<Q extends Kind | Category>(kindOrCategory: Q): this is NodeOfKindOrCategory<Q, S> {
    return kindOrCategory === 'Expression' || super.is(kindOrCategory)
  }
}


export class Reference<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Reference'
  readonly name!: Name

  constructor(data: Payload<Reference<S>>) { super(data) }

  @cached
  target<Q extends Kind | Category = 'Node', R extends Linked = Final>(this: Reference<R>): NodeOfKindOrCategory<Q, R> {
    const [start, rest] = divideOn('.')(this.name)
    const root: Package<R> = this.environment().getNodeById(this.scope[start])
    return (rest.length ? root.getNodeByQN(rest) : root) as NodeOfKindOrCategory<Q, R>
  }

}


export class Self<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Self'

  constructor(data: Payload<Self<S>>) { super(data) }
}


export type LiteralValue<S extends Stage = Final> = number | string | boolean | null | New<S> | Singleton<S>
export class Literal<S extends Stage = Final, T extends LiteralValue<S> = LiteralValue<S>> extends $Expression<S> {
  readonly kind = 'Literal'
  readonly value!: T

  constructor(data: Payload<Literal<S, T>>) { super(data) }
}


export class Send<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Send'
  readonly receiver!: Expression<S>
  readonly message!: Name
  readonly args!: List<Expression<S>>

  constructor(data: Payload<Send<S>>) { super(data) }
}


export class Super<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Super'
  readonly args!: List<Expression<S>>

  constructor(data: Payload<Super<S>>) { super(data) }
}


export class New<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'New'
  readonly instantiated!: Reference<S>
  readonly args!: List<Expression<S>> | List<NamedArgument<S>>

  constructor(data: Payload<New<S>>) { super(data) }
}


export class If<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'If'
  readonly condition!: Expression<S>
  readonly thenBody!: Body<S>
  readonly elseBody!: Fillable<S, Body<S>>

  constructor(data: Payload<If<S>>) { super(data) }
}


export class Throw<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Throw'
  readonly exception!: Expression<S>

  constructor(data: Payload<Throw<S>>) { super(data) }
}


export class Try<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Try'
  readonly body!: Body<S>
  readonly catches!: List<Catch<S>>
  readonly always!: Fillable<S, Body<S>>

  constructor(data: Payload<Try<S>>) { super(data) }
}


export class Catch<S extends Stage = Final> extends $Expression<S> {
  readonly kind = 'Catch'
  readonly parameter!: Parameter<S>
  readonly body!: Body<S>
  readonly parameterType!: Fillable<S, Reference<S>>

  constructor(data: Payload<Catch<S>>) { super(data) }
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export class Environment<S extends Stage = Final> extends $Node<S> {
  readonly kind = 'Environment'
  readonly members!: Linkable<S, List<Package<S>>>

  constructor(data: Payload<Environment<S>>) { super(data) }

  @cached
  getNodeById<Q extends Kind | Category, R extends Linked = Final>(this: Environment<R>, id: Id): NodeOfKindOrCategory<Q, R> {
    throw new Error(`Missing node in node cache with id ${id}`)
  }

  @cached
  getNodeByFQN<Q extends Kind | Category, R extends Linked = Final>(this: Environment<R>, fullyQualifiedName: Name): NodeOfKindOrCategory<Q, R> {
    const [start, rest] = divideOn('.')(fullyQualifiedName)
    const root = this.members.find(child => child.name === start)
    if (!root) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
    return (rest ? root.getNodeByQN(rest) : root) as NodeOfKindOrCategory<Q, R>
  }

}

// TODO:  CLASSES FIXES
//   - References could have an (optional ?) type parameter for the target
//   - Mixin-pattern for abstract classes to fix Variable case
//   - Scope como método cacheado en lugar de campo?
//   - as function to use as safe cast instead of all the crapy casts in many methods ?