import { Index } from 'parsimmon'

export type Stage = 'Raw' | 'Complete' | 'Linked'

export type Kind = Node<Stage>['kind']
export type NodeOfKind<K extends Kind, S extends Stage> = Extract<Node<S>, { kind: K }>


export type Name = string

export type Id<S extends Stage> = S extends 'Linked' ? string : string | undefined

export type Fillable<T, S extends Stage> = S extends 'Complete' | 'Linked' ? T : T | undefined

export type List<T> = ReadonlyArray<T>

// TODO: Move this to Linker
export interface Scope { readonly [name: string]: string /*id*/ }

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
  | Environment<S>


export interface BaseNode<K extends Kind, S extends Stage> {
  readonly kind: K
  readonly id: Id<S>
  readonly source?: Source
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Parameter<S extends Stage> extends BaseNode<'Parameter', S> {
  readonly name: Name
  readonly isVarArg: boolean
}

export interface Import<S extends Stage> extends BaseNode<'Import', S> {
  readonly reference: Reference<S>
  readonly isGeneric: boolean
}

export interface Body<S extends Stage> extends BaseNode<'Body', S> {
  readonly sentences: List<Sentence<S>>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity<S extends Stage> = Package<S> | Program<S> | Test<S> | Describe<S> | Module<S>
export type Module<S extends Stage> = Class<S> | Singleton<S> | Mixin<S>

export interface Package<S extends Stage> extends BaseNode<'Package', S> {
  readonly name: Name
  readonly imports: List<Import<S>>
  readonly members: List<Entity<S>>
}

export interface Program<S extends Stage> extends BaseNode<'Program', S> {
  readonly name: Name
  readonly body: Body<S>
}

export interface Test<S extends Stage> extends BaseNode<'Test', S> {
  readonly name: string
  readonly body: Body<S>
}

export interface Describe<S extends Stage> extends BaseNode<'Describe', S> {
  readonly name: string
  readonly members: List<Test<S>>
}

export interface Class<S extends Stage> extends BaseNode<'Class', S> {
  readonly name: Name
  readonly superclass: Fillable<Reference<S>, S>
  readonly mixins: List<Reference<S>>
  readonly members: List<ClassMember<S>>
}

// TODO: Inline this in Singleton?
interface SuperCall<S extends Stage> { superclass: Reference<S>, args: List<Expression<S>> }
export interface Singleton<S extends Stage> extends BaseNode<'Singleton', S> {
  readonly name?: Name
  readonly superCall: Fillable<SuperCall<S>, S>
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
}

export interface Mixin<S extends Stage> extends BaseNode<'Mixin', S> {
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage> = Field<S> | Method<S>
export type ClassMember<S extends Stage> = Constructor<S> | ObjectMember<S>

export interface Field<S extends Stage> extends BaseNode<'Field', S> {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fillable<Expression<S>, S>
}

export interface Method<S extends Stage> extends BaseNode<'Method', S> {
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean
  readonly parameters: List<Parameter<S>>
  readonly body?: Body<S>
}

// TODO: Inline this in Constructor?
interface BaseCall<S extends Stage> { callsSuper: boolean, args: List<Expression<S>> }
export interface Constructor<S extends Stage> extends BaseNode<'Constructor', S> {
  readonly parameters: List<Parameter<S>>
  readonly baseCall?: Fillable<BaseCall<S>, S>
  readonly body: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage> = Variable<S> | Return<S> | Assignment<S> | Expression<S>

export interface Variable<S extends Stage> extends BaseNode<'Variable', S> {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value: Fillable<Expression<S>, S>
}

export interface Return<S extends Stage> extends BaseNode<'Return', S> {
  readonly value: Expression<S> | null
}

export interface Assignment<S extends Stage> extends BaseNode<'Assignment', S> {
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

export interface Reference<S extends Stage> extends BaseNode<'Reference', S> {
  readonly name: Name
  // readonly target: Id<S>
}

type RR<S extends Stage> = BaseNode<'Reference', S> & {
  name: Name
  x?: RR<S>
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
  readonly className: Reference<S>
  readonly args: List<Expression<S>>
}

export interface If<S extends Stage> extends BaseNode<'If', S> {
  readonly condition: Expression<S>
  readonly thenBody: Body<S>
  readonly elseBody: Fillable<Body<S>, S>
}

export interface Throw<S extends Stage> extends BaseNode<'Throw', S> {
  readonly arg: Expression<S>
}

export interface Try<S extends Stage> extends BaseNode<'Try', S> {
  readonly body: Body<S>
  readonly catches: List<Catch<S>>
  readonly always: Fillable<Body<S>, S>
}

export interface Catch<S extends Stage> extends BaseNode<'Catch', S> {
  readonly parameter: Parameter<S>
  readonly parameterType: Fillable<Reference<S>, S>
  readonly body: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// TODO: Can't we just use a package node here?
export interface Environment<S extends Stage> extends BaseNode<'Environment', S> {
  readonly members: List<Package<S>>
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const isNode = (obj: any): obj is Node<Stage> => obj && obj.kind

export const isEntity = (obj: any): obj is Entity<Stage> => isNode(obj) &&
  ['Package', 'Class', 'Singleton', 'Mixin', 'Program', 'Test'].includes(obj.kind)

export const isModule = (obj: any): obj is Module<Stage> => isNode(obj) &&
  ['Singleton', 'Mixin', 'Class'].includes(obj.kind)

export const isObjectMember = (obj: any): obj is ObjectMember<Stage> => isNode(obj) &&
  ['Field', 'Method'].includes(obj.kind)

export const isClassMember = (obj: any): obj is ClassMember<Stage> => isNode(obj) &&
  (['Constructor'].includes(obj.kind) || isObjectMember(obj))

export const isExpression = (obj: any): obj is Expression<Stage> => isNode(obj) &&
  ['Reference', 'Self', 'Literal', 'Send', 'Super', 'New', 'If', 'Throw', 'Try'].includes(obj.kind)

export const isSentence = (obj: any): obj is Sentence<Stage> => isNode(obj) &&
  (['Variable', 'Return', 'Assignment'].includes(obj.kind) || isExpression(obj))

// TODO: Export pre-set node types for every stage? Like RawIf, CompleteIf, etc?