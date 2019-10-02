import { Index } from 'parsimmon'

export type Stage = Raw | Filled | Linked
export abstract class Raw { protected rawTag = 'Raw' }
export abstract class Filled extends Raw { protected filledTag = 'Filled' }
export abstract class Linked extends Filled { protected linkedTag = 'Linked' }
export type Final = Linked

type Fillable<S extends Stage, T> = S extends Filled ? T : T | undefined
type Linkable<S extends Stage, T> = S extends Linked ? T : T | undefined


export type Kind = Node['kind']
export type Category = 'Entity' | 'Module' | 'Sentence' | 'Expression'
export type KindOf<N extends Node<Stage>> = N['kind']
export type NodeOfKind<K extends Kind, S extends Stage> = Extract<Node<S>, { kind: K }>

export type Name = string
export type Id = string
export type List<T> = ReadonlyArray<T>

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
  | (S extends Linked ? Environment : never)

export interface BaseNode<S extends Stage> {
  readonly source?: Source
  readonly id: Linkable<S, Id>
  readonly scope: Linkable<S, Scope>

  is<K extends Kind>(kind: K): this is { kind: K }
  is(kind: 'Entity'): this is { kind: KindOf<Entity> }
  is(kind: 'Module'): this is { kind: KindOf<Module> }
  is(kind: 'Sentence'): this is { kind: KindOf<Sentence> }
  is(kind: 'Expression'): this is { kind: KindOf<Expression> }

  children: <N extends Node<S> = Node<S>>() => List<N>
  descendants: <N extends Node<S>>(kind?: Kind | Category) => List<N>
  forEach: <C extends S = S>(
    tx: ((node: Node<S>, parent?: Node<S>) => void) | Partial<{ [N in Kind]: (node: NodeOfKind<N, C>) => void }>,
    parent?: Node<C>
  ) => void
  transform: <R extends S = S, E extends Node<R> = Node<R>>(
    tx: ((node: Node<S>) => Node<R>) | Partial<{ [N in Kind]: (node: NodeOfKind<N, S>) => NodeOfKind<N, R> }>
  ) => E
  reduce: <T, R extends S = S>(tx: (acum: T, node: Node<R>) => T, initial: T) => T
  environment: Linkable<S, () => Environment>
  parent: Linkable<S, () => Node<S>>
  // TODO: would it be too slow to replace this with ancestors().find?
  closestAncestor: Linkable<S, <N extends Node<S>>(kind: Kind) => N | undefined>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Parameter<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Parameter'
  readonly name: Name
  readonly isVarArg: boolean
}

export interface NamedArgument<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'NamedArgument'
  readonly name: Name
  readonly value: Expression<S>
}

export interface Import<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Import'
  readonly entity: Reference<S>
  readonly isGeneric: boolean
}

export interface Body<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Body'
  readonly sentences: List<Sentence<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity<S extends Stage = Final> = Package<S> | Program<S> | Test<S> | Describe<S> | Module<S>
export interface BaseEntity<S extends Stage> extends BaseNode<S> {
  fullyQualifiedName: Linkable<S, () => Name>
}

export interface Package<S extends Stage = Final> extends BaseEntity<S> {
  readonly kind: 'Package'
  readonly name: Name
  readonly imports: List<Import<S>>
  readonly members: List<Entity<S>>

  getNodeByQN<N extends Node<S>>(qualifiedName: Name): N
}

export interface Program<S extends Stage = Final> extends BaseEntity<S> {
  readonly kind: 'Program'
  readonly name: Name
  readonly body: Body<S>
}

export interface Test<S extends Stage = Final> extends BaseEntity<S> {
  readonly kind: 'Test'
  readonly name: string
  readonly body: Body<S>
}

export interface Describe<S extends Stage = Final> extends BaseEntity<S> {
  readonly kind: 'Describe'
  readonly name: string
  readonly members: List<DescribeMember<S>>

  tests: () => List<Test<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module<S extends Stage = Final> = Class<S> | Singleton<S> | Mixin<S>
export interface BaseModule<S extends Stage> extends BaseEntity<S> {
  methods: () => List<Method<S>>
  fields: () => List<Field<S>>
  parent: Linkable<S, () => Package<S>>
  hierarchy: Linkable<S, () => List<Module<S>>>
  inherits: Linkable<S, (other: Module<Linked>) => boolean>
  lookupMethod: Linkable<S, (name: Name, arity: number) => Method<Linked> | undefined>
}

export interface Class<S extends Stage = Final> extends BaseModule<S> {
  readonly kind: 'Class'
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ClassMember<S>>
  // TODO: rename this and rename superclassNode to superclass (in Singleton too)
  readonly superclass: Fillable<S, Reference<S> | null>

  constructors: () => List<Constructor<S>>
  superclassNode: Linkable<S, () => Class<S> | null>
  lookupConstructor: Linkable<S, (arity: number) => Constructor<Linked> | undefined>
}

export interface Singleton<S extends Stage = Final> extends BaseModule<S> {
  readonly kind: 'Singleton'
  readonly name?: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
  readonly superCall: Fillable<S, {
    superclass: Reference<S>,
    args: List<Expression<S>> | List<NamedArgument<S>>
  }>

  superclassNode: Linkable<S, () => Class<S> | null>
}

export interface Mixin<S extends Stage = Final> extends BaseModule<S> {
  readonly kind: 'Mixin'
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage = Final> = Field<S> | Method<S>
export type ClassMember<S extends Stage = Final> = Constructor<S> | ObjectMember<S>
export type DescribeMember<S extends Stage = Final> = Variable<S> | Fixture<S> | Test<S> | Method<S>

export interface Field<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Field'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly isProperty: boolean
  readonly value: Fillable<S, Expression<S>>

  parent: Linkable<S, () => Module<S>>
}

export interface Method<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Method'
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean // TODO: Represent abstractness and nativeness as body types?
  readonly parameters: List<Parameter<S>>
  readonly body?: Body<S>

  parent: Linkable<S, () => Module<S>>
}

export interface Constructor<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Constructor'
  readonly parameters: List<Parameter<S>>
  readonly body: Body<S>
  readonly baseCall: Fillable<S, { callsSuper: boolean, args: List<Expression<S>> }>

  parent: Linkable<S, () => Class<S>>
}

export interface Fixture<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Fixture'
  readonly body: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage = Final> = Variable<S> | Return<S> | Assignment<S> | Expression<S>

export interface Variable<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Variable'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fillable<S, Expression<S>>
}

export interface Return<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Return'
  readonly value?: Expression<S>
}

export interface Assignment<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Assignment'
  readonly variable: Reference<S>
  readonly value: Expression<S>
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

// TODO: Add extra parameter with the type of referenced node?
export interface Reference<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Reference'
  readonly name: Name

  target: Linkable<S, <N extends Node<Linked>>() => N>
}

export interface Self<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Self'
}

export type LiteralValue<S extends Stage = Final> = number | string | boolean | null | New<S> | Singleton<S>
export interface Literal<S extends Stage = Final, T extends LiteralValue<S> = LiteralValue<S>> extends BaseNode<S> {
  readonly kind: 'Literal'
  readonly value: T
}

export interface Send<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Send'
  readonly receiver: Expression<S>
  readonly message: Name
  readonly args: List<Expression<S>>
}

export interface Super<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Super'
  readonly args: List<Expression<S>>
}

export interface New<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'New'
  readonly instantiated: Reference<S>
  readonly args: List<Expression<S>> | List<NamedArgument<S>>
}

export interface If<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'If'
  readonly condition: Expression<S>
  readonly thenBody: Body<S>
  readonly elseBody: Fillable<S, Body<S>>
}

export interface Throw<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Throw'
  readonly exception: Expression<S>
}

export interface Try<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Try'
  readonly body: Body<S>
  readonly catches: List<Catch<S>>
  readonly always: Fillable<S, Body<S>>
}

export interface Catch<S extends Stage = Final> extends BaseNode<S> {
  readonly kind: 'Catch'
  readonly parameter: Parameter<S>
  readonly body: Body<S>
  readonly parameterType: Fillable<S, Reference<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Environment<S extends Linked = Final> extends BaseNode<S> {
  readonly kind: 'Environment'
  readonly source?: undefined
  readonly members: List<Package<S>>

  getNodeById<N extends Node<S>>(id: Id): N
  getNodeByFQN<N extends Node<S>>(fullyQualifiedName: Name): N
}