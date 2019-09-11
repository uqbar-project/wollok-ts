import { Index } from 'parsimmon'

// TODO: Use Linked as default stage for all types

export type Stage = Raw | Filled | Linked
export abstract class Raw { protected rawTag = 'Raw' }
export abstract class Filled extends Raw { protected filledTag = 'Filled' }
export abstract class Linked extends Filled { protected linkedTag = 'Linked' }

type Fill<S extends Stage, T> = S extends Filled ? T : T | undefined
type Link<S extends Stage, T> = S extends Linked ? T : T | undefined


export type Kind = Node<Linked>['kind']
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


export type Node<S extends Stage>
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


export interface BaseNode<K extends Kind, S extends Stage> {
  readonly kind: K
  readonly source?: Source
  readonly id: Link<S, Id>

  children: <N extends Node<S> = Node<S>>() => List<N>
  descendants: <N extends Node<S>>(filter?: (obj: any) => obj is N) => List<N>
  transform: <R extends Stage = S>(tx: (node: Node<S>) => Node<R>) => NodeOfKind<K, R>
  // transformByKind<R extends Stage = S>(
  //   tx: Partial<{ [N in Kind]: (after: NodeOfKind<N, R>, before: NodeOfKind<N, S>) => NodeOfKind<N, R> }>,
  // ): NodeOfKind<K, R>

  environment: Link<S, () => Environment>
  parent: Link<S, <N extends Node<S>>() => N> // TODO: declare for each node with the right parent type instead of with generic ?
  // TODO: would it be too slow to replace this with ancestors().find?
  closestAncestor: Link<S, <N extends Node<S>>(filter: (obj: any) => obj is N) => N | undefined>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Parameter<S extends Stage> extends BaseNode<'Parameter', S> {
  readonly name: Name
  readonly isVarArg: boolean
}

export interface NamedArgument<S extends Stage> extends BaseNode<'NamedArgument', S> {
  readonly name: Name
  readonly value: Expression<S>
}

export interface Import<S extends Stage> extends BaseNode<'Import', S> {
  readonly entity: Reference<S>
  readonly isGeneric: boolean
}

export interface Body<S extends Stage> extends BaseNode<'Body', S> {
  readonly sentences: List<Sentence<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity<S extends Stage> = Package<S> | Program<S> | Test<S> | Describe<S> | Module<S>

export interface Package<S extends Stage> extends BaseNode<'Package', S> {
  readonly name: Name
  readonly imports: List<Import<S>>
  readonly members: List<Entity<S>>

  fullyQualifiedName: Link<S, () => Name>
}

export interface Program<S extends Stage> extends BaseNode<'Program', S> {
  readonly name: Name
  readonly body: Body<S>

  fullyQualifiedName: Link<S, () => Name>
}

export interface Test<S extends Stage> extends BaseNode<'Test', S> {
  readonly name: string
  readonly body: Body<S>

  fullyQualifiedName: Link<S, () => Name>
}

export interface Describe<S extends Stage> extends BaseNode<'Describe', S> {
  readonly name: string
  readonly members: List<DescribeMember<S>>

  tests: () => List<Test<S>>
  fullyQualifiedName: Link<S, () => Name>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module<S extends Stage> = Class<S> | Singleton<S> | Mixin<S>

export interface Class<S extends Stage> extends BaseNode<'Class', S> {
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ClassMember<S>>
  // TODO: rename this and rename superclassNode to superclass (in Singleton too)
  readonly superclass: Fill<S, Reference<S> | null>

  methods: () => List<Method<S>>
  fields: () => List<Field<S>>
  constructors: () => List<Constructor<S>>
  superclassNode: Link<S, () => Class<S> | null>
  fullyQualifiedName: Link<S, () => Name>
  hierarchy: Link<S, () => List<Module<S>>>
  inherits: Link<S, (other: Module<Linked>) => boolean>
  lookupMethod: Link<S, (name: Name, arity: number) => Method<Linked> | undefined>
  lookupConstructor: Link<S, (arity: number) => Constructor<Linked> | undefined>
}

export interface Singleton<S extends Stage> extends BaseNode<'Singleton', S> {
  readonly name?: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
  readonly superCall: Fill<S, {
    superclass: Reference<S>,
    args: List<Expression<S>> | List<NamedArgument<S>>
  }>

  methods: () => List<Method<S>>
  fields: () => List<Field<S>>
  superclassNode: Link<S, () => Class<S> | null>
  fullyQualifiedName: Link<S, () => Name>
  hierarchy: Link<S, () => List<Module<S>>>
  inherits: Link<S, (other: Module<Linked>) => boolean>
  lookupMethod: Link<S, (name: Name, arity: number) => Method<Linked> | undefined>
}

export interface Mixin<S extends Stage> extends BaseNode<'Mixin', S> {
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>

  methods: () => List<Method<S>>
  fields: () => List<Field<S>>
  fullyQualifiedName: Link<S, () => Name>
  hierarchy: Link<S, () => List<Module<S>>>
  inherits: Link<S, (other: Module<Linked>) => boolean>
  lookupMethod: Link<S, (name: Name, arity: number) => Method<Linked> | undefined>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage> = Field<S> | Method<S>
export type ClassMember<S extends Stage> = Constructor<S> | ObjectMember<S>
export type DescribeMember<S extends Stage> = Variable<S> | Fixture<S> | Test<S> | Method<S>

export interface Field<S extends Stage> extends BaseNode<'Field', S> {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly isProperty: boolean
  readonly value: Fill<S, Expression<S>>
}

export interface Method<S extends Stage> extends BaseNode<'Method', S> {
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean // TODO: Represent abstractness and nativeness as body types?
  readonly parameters: List<Parameter<S>>
  readonly body?: Body<S>
}

export interface Constructor<S extends Stage> extends BaseNode<'Constructor', S> {
  readonly parameters: List<Parameter<S>>
  readonly body: Body<S>
  readonly baseCall: Fill<S, { callsSuper: boolean, args: List<Expression<S>> }>
}

export interface Fixture<S extends Stage> extends BaseNode<'Fixture', S> {
  readonly body?: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage> = Variable<S> | Return<S> | Assignment<S> | Expression<S>

export interface Variable<S extends Stage> extends BaseNode<'Variable', S> {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fill<S, Expression<S>>
}

export interface Return<S extends Stage> extends BaseNode<'Return', S> {
  readonly value?: Expression<S>
}

export interface Assignment<S extends Stage> extends BaseNode<'Assignment', S> {
  readonly variable: Reference<S>
  readonly value: Expression<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Expression<S extends Stage>
  = Reference<S>
  | Self<S>
  | Literal<S, LiteralValue<S>>
  | Send<S>
  | Super<S>
  | New<S>
  | If<S>
  | Throw<S>
  | Try<S>

export interface Reference<S extends Stage> extends BaseNode<'Reference', S> {
  readonly name: Name
  readonly targetId: Link<S, Id>

  target: Link<S, <N extends Node<Linked>>() => N>
}

export interface Self<S extends Stage> extends BaseNode<'Self', S> { }

export type LiteralValue<S extends Stage> = number | string | boolean | null | New<S> | Singleton<S>
export interface Literal<S extends Stage, T extends LiteralValue<S> = LiteralValue<S>> extends BaseNode<'Literal', S> {
  readonly value: T
}

export interface Send<S extends Stage> extends BaseNode<'Send', S> {
  readonly receiver: Expression<S>
  readonly message: Name
  readonly args: List<Expression<S>>
}

export interface Super<S extends Stage> extends BaseNode<'Super', S> {
  readonly args: List<Expression<S>>
}

export interface New<S extends Stage> extends BaseNode<'New', S> {
  readonly instantiated: Reference<S>
  readonly args: List<Expression<S>> | List<NamedArgument<S>>
}

export interface If<S extends Stage> extends BaseNode<'If', S> {
  readonly condition: Expression<S>
  readonly thenBody: Body<S>
  readonly elseBody: Fill<S, Body<S>>
}

export interface Throw<S extends Stage> extends BaseNode<'Throw', S> {
  readonly exception: Expression<S>
}

export interface Try<S extends Stage> extends BaseNode<'Try', S> {
  readonly body: Body<S>
  readonly catches: List<Catch<S>>
  readonly always: Fill<S, Body<S>>
}

export interface Catch<S extends Stage> extends BaseNode<'Catch', S> {
  readonly parameter: Parameter<S>
  readonly body: Body<S>
  readonly parameterType: Fill<S, Reference<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Environment extends BaseNode<'Environment', Linked> {
  readonly source?: undefined
  readonly members: List<Package<Linked>>

  getNodeById<N extends Node<Linked>>(id: Id): N
  getNodeByFQN<N extends Node<Linked>>(fullyQualifiedName: Name): N
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const isNode = <S extends Stage>(obj: any): obj is Node<S> => !!(obj && obj.kind)

export const isEntity = <S extends Stage>(obj: any): obj is Entity<S> => isNode(obj) &&
  ['Package', 'Class', 'Singleton', 'Mixin', 'Program', 'Describe', 'Test'].includes(obj.kind)

export const isModule = <S extends Stage>(obj: any): obj is Module<S> => isNode(obj) &&
  ['Singleton', 'Mixin', 'Class'].includes(obj.kind)

export const isObjectMember = <S extends Stage>(obj: any): obj is ObjectMember<S> => isNode(obj) &&
  ['Field', 'Method'].includes(obj.kind)

export const isClassMember = <S extends Stage>(obj: any): obj is ClassMember<S> => isNode(obj) &&
  ('Constructor' === obj.kind || isObjectMember(obj))

export const isExpression = <S extends Stage>(obj: any): obj is Expression<S> => isNode(obj) &&
  ['Reference', 'Self', 'Literal', 'Send', 'Super', 'New', 'If', 'Throw', 'Try'].includes(obj.kind)

export const isSentence = <S extends Stage>(obj: any): obj is Sentence<S> => isNode(obj) &&
  (['Variable', 'Return', 'Assignment'].includes(obj.kind) || isExpression(obj))

export const is = <N extends NodeOfKind<K, Stage>, K extends Kind = KindOf<N>>(k: K) => (obj: any): obj is N =>
  isNode(obj) && obj.kind === k