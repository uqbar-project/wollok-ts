import { Index } from 'parsimmon'

export type Stage = 'Raw' | 'Filled' | 'Linked'

export type Kind = Node<Stage>['kind']
export type KindOf<N extends Node<Stage>> = N['kind']
export type NodeOfKind<K extends Kind, S extends Stage> = Extract<Node<S>, { kind: K }>


export type Name = string
export type Id = string
export type List<T> = ReadonlyArray<T>

export type Fillable<T, S extends Stage> = S extends 'Filled' | 'Linked' ? T : T | undefined
export type Linkable<T, S extends Stage> = S extends 'Linked' ? T : T | undefined


export interface Source {
  readonly file?: string
  readonly start: Index
  readonly end: Index
}


export type Node<S extends Stage>
  = Parameter<S>
  | Import<S>
  | Body<S>
  | Catch<S>
  | Entity<S>
  | ClassMember<S>
  | Sentence<S>
  | (S extends 'Linked' ? Environment : never)


type BaseNode<K extends Kind, S extends Stage> = {
  readonly kind: K
  readonly id: Linkable<Id, S>
  readonly source?: Source
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Parameter<S extends Stage> = BaseNode<'Parameter', S> & {
  readonly name: Name
  readonly isVarArg: boolean
}

export type Import<S extends Stage> = BaseNode<'Import', S> & {
  readonly reference: Reference<S>
  readonly isGeneric: boolean
}

export type Body<S extends Stage> = BaseNode<'Body', S> & {
  readonly sentences: List<Sentence<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity<S extends Stage> = Package<S> | Program<S> | Test<S> | Describe<S> | Module<S>
export type Module<S extends Stage> = Class<S> | Singleton<S> | Mixin<S>

export type Package<S extends Stage> = BaseNode<'Package', S> & {
  readonly name: Name
  readonly imports: List<Import<S>>
  readonly members: List<Entity<S>>
}

export type Program<S extends Stage> = BaseNode<'Program', S> & {
  readonly name: Name
  readonly body: Body<S>
}

export type Test<S extends Stage> = BaseNode<'Test', S> & {
  readonly name: string
  readonly body: Body<S>
}

export type Describe<S extends Stage> = BaseNode<'Describe', S> & {
  readonly name: string
  readonly members: List<Test<S>>
}

export type Class<S extends Stage> = BaseNode<'Class', S> & {
  readonly name: Name
  readonly superclass?: Fillable<Reference<S>, S>
  readonly mixins: List<Reference<S>>
  readonly members: List<ClassMember<S>>
}

// TODO: Inline this in Singleton?
export interface SuperCall<S extends Stage> { superclass: Reference<S>, args: List<Expression<S>> }
export type Singleton<S extends Stage> = BaseNode<'Singleton', S> & {
  readonly name?: Name // TODO: assign name after linking. superclass.fqn#id
  readonly superCall: Fillable<SuperCall<S>, S>
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
}

export type Mixin<S extends Stage> = BaseNode<'Mixin', S> & {
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage> = Field<S> | Method<S>
export type ClassMember<S extends Stage> = Constructor<S> | ObjectMember<S>

export type Field<S extends Stage> = BaseNode<'Field', S> & {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fillable<Expression<S>, S>
}

export type Method<S extends Stage> = BaseNode<'Method', S> & {
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean
  readonly parameters: List<Parameter<S>>
  readonly body?: Body<S>
}

// TODO: Inline this in Constructor?
export interface BaseCall<S extends Stage> { callsSuper: boolean, args: List<Expression<S>> }
export type Constructor<S extends Stage> = BaseNode<'Constructor', S> & {
  readonly parameters: List<Parameter<S>>
  readonly baseCall: Fillable<BaseCall<S>, S>
  readonly body: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage> = Variable<S> | Return<S> | Assignment<S> | Expression<S>

export type Variable<S extends Stage> = BaseNode<'Variable', S> & {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fillable<Expression<S>, S>
}

export type Return<S extends Stage> = BaseNode<'Return', S> & {
  readonly value?: Expression<S>
}

export type Assignment<S extends Stage> = BaseNode<'Assignment', S> & {
  readonly reference: Reference<S>
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

export type Reference<S extends Stage> = BaseNode<'Reference', S> & {
  readonly name: Name
  readonly target: Linkable<Id, S>
}

export type Self<S extends Stage> = BaseNode<'Self', S> & {}

export type LiteralValue<S extends Stage> = number | string | boolean | null | New<S> | Singleton<S>
export type Literal<S extends Stage, T extends LiteralValue<S> = LiteralValue<S>> = BaseNode<'Literal', S> & {
  readonly value: T
}

export type Send<S extends Stage> = BaseNode<'Send', S> & {
  readonly receiver: Expression<S>
  readonly message: Name
  readonly args: List<Expression<S>>
}

export type Super<S extends Stage> = BaseNode<'Super', S> & {
  readonly args: List<Expression<S>>
}

export type New<S extends Stage> = BaseNode<'New', S> & {
  // TODO: Rename to instantiatedClass ?
  readonly className: Reference<S>
  readonly args: List<Expression<S>>
}

export type If<S extends Stage> = BaseNode<'If', S> & {
  readonly condition: Expression<S>
  readonly thenBody: Body<S>
  readonly elseBody: Fillable<Body<S>, S>
}

export type Throw<S extends Stage> = BaseNode<'Throw', S> & {
  // TODO: Rename to exception ?
  readonly arg: Expression<S>
}

export type Try<S extends Stage> = BaseNode<'Try', S> & {
  readonly body: Body<S>
  readonly catches: List<Catch<S>>
  readonly always: Fillable<Body<S>, S>
}

export type Catch<S extends Stage> = BaseNode<'Catch', S> & {
  readonly parameter: Parameter<S>
  readonly parameterType: Fillable<Reference<S>, S>
  readonly body: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Environment = BaseNode<'Environment', 'Linked'> & {
  readonly source?: undefined
  readonly members: List<Package<'Linked'>>
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const isNode = <S extends Stage>(obj: any): obj is Node<S> => obj && obj.kind

export const isEntity = <S extends Stage>(obj: any): obj is Entity<S> => isNode(obj) &&
  ['Package', 'Class', 'Singleton', 'Mixin', 'Program', 'Test'].includes(obj.kind)

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

export const is = <K extends Kind>(k: K) => <S extends Stage>(node: Node<S>): node is NodeOfKind<K, S> => node.kind === k

// TODO: Export pre-set node types for every stage? Like RawIf, FilledIf, etc?