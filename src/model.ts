import { Index } from 'parsimmon'

// TODO: Use Linked as default stage for all types

export type Stage = Raw | Filled | Linked
export type Raw = 'Raw'
export type Filled = 'Filled'
export type Linked = 'Linked'

type Fillable<S extends Stage, T> = S extends Filled | Linked ? T : { [K in keyof T]+?: T[K] }
type Linkable<S extends Stage, T> = S extends Linked ? T : { [K in keyof T]+?: T[K] }


export type Kind = Node<Linked>['kind']
export type KindOf<N extends Node<any>> = N['kind']
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


type BaseNode<K extends Kind, S extends Stage> = {
  readonly kind: K
  readonly source?: Source
} & Linkable<S, {
  readonly id: Id
}>

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Parameter<S extends Stage> = BaseNode<'Parameter', S> & {
  readonly name: Name
  readonly isVarArg: boolean
}

export type NamedArgument<S extends Stage> = BaseNode<'NamedArgument', S> & {
  readonly name: Name
  readonly value: Expression<S>
}

export type Import<S extends Stage> = BaseNode<'Import', S> & {
  readonly entity: Reference<S>
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
  readonly members: List<DescribeMember<S>>

  tests(): List<Test<S>>
}

export type Class<S extends Stage> = BaseNode<'Class', S> & {
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ClassMember<S>>

  methods(): List<Method<S>>
  fields(): List<Field<S>>
  constructors(): List<Constructor<S>>
} & Fillable<S, {
  readonly superclass: Reference<S> | null
}>

export type Singleton<S extends Stage> = BaseNode<'Singleton', S> & {
  readonly name?: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>

  methods(): List<Method<S>>
  fields(): List<Field<S>>
} & Fillable<S, {
  readonly superCall: {
    superclass: Reference<S>,
    args: List<Expression<S>> | List<NamedArgument<S>>
  }
}>

export type Mixin<S extends Stage> = BaseNode<'Mixin', S> & {
  readonly name: Name
  readonly mixins: List<Reference<S>>
  readonly members: List<ObjectMember<S>>

  methods(): List<Method<S>>
  fields(): List<Field<S>>
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember<S extends Stage> = Field<S> | Method<S>
export type ClassMember<S extends Stage> = Constructor<S> | ObjectMember<S>
export type DescribeMember<S extends Stage> = Variable<S> | Fixture<S> | Test<S> | Method<S>

export type Field<S extends Stage> = BaseNode<'Field', S> & {
  readonly name: Name
  readonly isReadOnly: boolean
  readonly isProperty: boolean
} & Fillable<S, {
  readonly value: Expression<S>
}>

export type Method<S extends Stage> = BaseNode<'Method', S> & {
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean // TODO: Represent abstractness and nativeness as body types?
  readonly parameters: List<Parameter<S>>
  readonly body?: Body<S>
}

export type Constructor<S extends Stage> = BaseNode<'Constructor', S> & {
  readonly parameters: List<Parameter<S>>
  readonly body: Body<S>
} & Fillable<S, {
  readonly baseCall: { callsSuper: boolean, args: List<Expression<S>> }
}>

export type Fixture<S extends Stage> = BaseNode<'Fixture', S> & {
  readonly body?: Body<S>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence<S extends Stage> = Variable<S> | Return<S> | Assignment<S> | Expression<S>

export type Variable<S extends Stage> = BaseNode<'Variable', S> & {
  readonly name: Name
  readonly isReadOnly: boolean
} & Fillable<S, {
  readonly value: Expression<S>
}>

export type Return<S extends Stage> = BaseNode<'Return', S> & {
  readonly value?: Expression<S>
}

export type Assignment<S extends Stage> = BaseNode<'Assignment', S> & {
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

export type Reference<S extends Stage> = BaseNode<'Reference', S> & {
  readonly name: Name
} & Linkable<S, {
  readonly target: Id
}>

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
  readonly instantiated: Reference<S>
  readonly args: List<Expression<S>> | List<NamedArgument<S>>
}

export type If<S extends Stage> = BaseNode<'If', S> & {
  readonly condition: Expression<S>
  readonly thenBody: Body<S>
} & Fillable<S, {
  readonly elseBody: Body<S>
}>

export type Throw<S extends Stage> = BaseNode<'Throw', S> & {
  readonly exception: Expression<S>
}

export type Try<S extends Stage> = BaseNode<'Try', S> & {
  readonly body: Body<S>
  readonly catches: List<Catch<S>>
} & Fillable<S, {
  readonly always: Body<S>
}>

export type Catch<S extends Stage> = BaseNode<'Catch', S> & {
  readonly parameter: Parameter<S>
  readonly body: Body<S>
} & Fillable<S, {
  readonly parameterType: Reference<S>
}>

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Environment = BaseNode<'Environment', Linked> & {
  readonly source?: undefined
  readonly members: List<Package<Linked>>
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const isNode = <S extends Stage>(obj: any): obj is Node<S> => !!(obj && obj.kind)

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

export const is = <K extends Kind>(k: K) => <S extends Stage>(obj: any): obj is NodeOfKind<K, S> => isNode(obj) && obj.kind === k