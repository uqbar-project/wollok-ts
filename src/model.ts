import { Index } from 'parsimmon'

// TODO: Use Linked as default stage for all types

export type Stage = Raw | Filled | Linked
export abstract class Raw { protected rawTag = 'Raw' }
export abstract class Filled extends Raw { protected filledTag = 'Filled' }
export abstract class Linked extends Filled { protected linkedTag = 'Linked' }

type Fillable<S extends Stage, T> = S extends Filled ? T : T | undefined
type Linkable<S extends Stage, T> = S extends Linked ? T : T | undefined


export type Kind = Node<Linked>['kind']
export type KindOf<N extends Node<Stage>> = N['kind']
export type NodeOfKind<K extends Kind, S extends Stage> = Extract<Node<S>, { kind: K }>
export type OnStage<N extends Node<Stage>, S extends Stage> = NodeOfKind<KindOf<N>, S>

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

export interface BaseNode<S extends Stage> {
  readonly source?: Source
  readonly id: Linkable<S, Id>

  children: <N extends Node<S> = Node<S>>() => List<N>
  descendants: <N extends Node<S>>(filter?: (obj: any) => obj is N) => List<N>
  transform: <R extends S = S>(tx: (node: Node<S>) => Node<R>) => OnStage<this & Node<Stage>, R>
  transformByKind: <R extends S = S, C extends S = S, E extends Node<R> = Node<R>>(
    tx: Partial<{ [N in Kind]:
      (afterChildPropagation: NodeOfKind<N, R>, beforeChildPropagation: NodeOfKind<N, C>) => NodeOfKind<N, R>
    }>,
  ) => E
  reduce: <T, R extends S = S>(tx: (acum: T, node: Node<R>) => T, initial: T) => T
  environment: Linkable<S, () => Environment>
  parent: Linkable<S, <N extends Node<S>>() => N> // TODO: declare for each node with the right parent type instead of with generic ?
  // TODO: would it be too slow to replace this with ancestors().find?
  closestAncestor: Linkable<S, <N extends Node<S>>(filter: (obj: any) => obj is N) => N | undefined>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Parameter<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Parameter'
  readonly name: Name
  readonly isVarArg: boolean
}

export interface NamedArgument<S extends Stage> extends BaseNode<S> {
  readonly kind: 'NamedArgument'
  readonly name: Name
  readonly value: Expression<S>
}

export interface Import<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Import'
  readonly entity: Reference<S>
  readonly isGeneric: boolean
}

export interface Body<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Body'
  readonly sentences: List<Sentence<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity<S extends Stage> = Package<S> | Program<S> | Test<S> | Describe<S> | Module<S>
export interface BaseEntity<S extends Stage> extends BaseNode<S> {
  fullyQualifiedName: Linkable<S, () => Name>
}

export interface Package<S extends Stage> extends BaseEntity<S> {
  readonly kind: 'Package'
  readonly name: Name
  readonly imports: List<Import<S>>
  readonly members: List<Entity<S>>
}

export interface Program<S extends Stage> extends BaseEntity<S> {
  readonly kind: 'Program'
  readonly name: Name
  readonly body: Body<S>
}

export interface Test<S extends Stage> extends BaseEntity<S> {
  readonly kind: 'Test'
  readonly name: string
  readonly body: Body<S>
}

export interface Describe<S extends Stage> extends BaseEntity<S> {
  readonly kind: 'Describe'
  readonly name: string
  readonly members: List<DescribeMember<S>>

  tests: () => List<Test<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Module<S extends Stage> = Class<S> | Singleton<S> | Mixin<S>
export interface BaseModule<S extends Stage> extends BaseEntity<S> {
  methods: () => List<Method<S>>
  fields: () => List<Field<S>>
  hierarchy: Linkable<S, () => List<Module<S>>>
  inherits: Linkable<S, (other: Module<Linked>) => boolean>
  lookupMethod: Linkable<S, (name: Name, arity: number) => Method<Linked> | undefined>
}

export interface Class<S extends Stage> extends BaseModule<S> {
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

export interface Singleton<S extends Stage> extends BaseModule<S> {
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

export interface Mixin<S extends Stage> extends BaseModule<S> {
  readonly kind: 'Mixin'
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage> = Field<S> | Method<S>
export type ClassMember<S extends Stage> = Constructor<S> | ObjectMember<S>
export type DescribeMember<S extends Stage> = Variable<S> | Fixture<S> | Test<S> | Method<S>

export interface Field<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Field'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly isProperty: boolean
  readonly value: Fillable<S, Expression<S>>
}

export interface Method<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Method'
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean // TODO: Represent abstractness and nativeness as body types?
  readonly parameters: List<Parameter<S>>
  readonly body?: Body<S>
}

export interface Constructor<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Constructor'
  readonly parameters: List<Parameter<S>>
  readonly body: Body<S>
  readonly baseCall: Fillable<S, { callsSuper: boolean, args: List<Expression<S>> }>
}

export interface Fixture<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Fixture'
  readonly body?: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage> = Variable<S> | Return<S> | Assignment<S> | Expression<S>

export interface Variable<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Variable'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fillable<S, Expression<S>>
}

export interface Return<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Return'
  readonly value?: Expression<S>
}

export interface Assignment<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Assignment'
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

export interface Reference<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Reference'
  readonly name: Name
  readonly targetId: Linkable<S, Id>

  target: Linkable<S, <N extends Node<Linked>>() => N>
}

export interface Self<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Self'
}

export type LiteralValue<S extends Stage> = number | string | boolean | null | New<S> | Singleton<S>
export interface Literal<S extends Stage, T extends LiteralValue<S> = LiteralValue<S>> extends BaseNode<S> {
  readonly kind: 'Literal'
  readonly value: T
}

export interface Send<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Send'
  readonly receiver: Expression<S>
  readonly message: Name
  readonly args: List<Expression<S>>
}

export interface Super<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Super'
  readonly args: List<Expression<S>>
}

export interface New<S extends Stage> extends BaseNode<S> {
  readonly kind: 'New'
  readonly instantiated: Reference<S>
  readonly args: List<Expression<S>> | List<NamedArgument<S>>
}

export interface If<S extends Stage> extends BaseNode<S> {
  readonly kind: 'If'
  readonly condition: Expression<S>
  readonly thenBody: Body<S>
  readonly elseBody: Fillable<S, Body<S>>
}

export interface Throw<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Throw'
  readonly exception: Expression<S>
}

export interface Try<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Try'
  readonly body: Body<S>
  readonly catches: List<Catch<S>>
  readonly always: Fillable<S, Body<S>>
}

export interface Catch<S extends Stage> extends BaseNode<S> {
  readonly kind: 'Catch'
  readonly parameter: Parameter<S>
  readonly body: Body<S>
  readonly parameterType: Fillable<S, Reference<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// TODO: Maybe environment shouldn't be a Node, like Evaluation is not a node...
export interface Environment extends BaseNode<Linked> {
  readonly kind: 'Environment'
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