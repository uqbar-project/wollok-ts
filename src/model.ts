import { Index } from 'parsimmon'

export type Node = Parameter | Import | Entity | Member | Sentence
export type NodeKind = Node['kind']
export type NodeOfKind<K extends NodeKind> = Extract<Node, { kind: K }>
export type NodePayload<N extends Node> = Pick<N, Exclude<keyof N, 'kind'>>


interface Traceable {
  source?: {
    file?: string
    start: Index
    end: Index
  }
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Name = string

export interface Reference extends Traceable {
  readonly kind: 'Reference'
  readonly name: Name
}

export interface Parameter extends Traceable {
  readonly kind: 'Parameter'
  readonly name: Name
  readonly isVarArg: boolean
}

export interface Import extends Traceable {
  readonly kind: 'Import'
  readonly reference: Reference
  readonly isGeneric: boolean
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity = Package | Class | Singleton | Mixin | Program | Test

export interface Package extends Traceable {
  readonly kind: 'Package'
  readonly name: Name
  readonly imports: ReadonlyArray<Import>
  readonly members: ReadonlyArray<Package | Class | Singleton | Mixin | Program | Test>
}

export interface Class extends Traceable {
  readonly kind: 'Class'
  readonly name: Name
  readonly superclass: Reference
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<Method | Field | Constructor>
}

export interface Singleton extends Traceable {
  readonly kind: 'Singleton'
  readonly name: Name
  readonly superclass: Reference
  readonly superArgs: ReadonlyArray<Expression>
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<Method | Field>
}

export interface Mixin extends Traceable {
  readonly kind: 'Mixin'
  readonly name: Name
  readonly mixins: ReadonlyArray<Mixin>
  readonly members: ReadonlyArray<Method | Field>
}

export interface Program extends Traceable {
  readonly kind: 'Program'
  readonly name: Name
  readonly body: ReadonlyArray<Sentence>
}

export interface Test extends Traceable {
  readonly kind: 'Test'
  readonly description: Literal<string>
  readonly body: ReadonlyArray<Sentence>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Member = Field | Method | Constructor

export interface Field extends Traceable {
  readonly kind: 'Field'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value?: Expression
}

export interface Method extends Traceable {
  readonly kind: 'Method'
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean
  readonly parameters: ReadonlyArray<Parameter>
  readonly body?: ReadonlyArray<Sentence>
}

export interface Constructor extends Traceable {
  readonly kind: 'Constructor'
  readonly parameters: ReadonlyArray<Parameter>
  readonly baseArgs: ReadonlyArray<Expression>
  readonly callsSuper: boolean
  readonly body?: ReadonlyArray<Sentence>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence = Variable | Return | Assignment | Expression

export interface Variable extends Traceable {
  readonly kind: 'Variable'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value?: Expression
}

export interface Return extends Traceable {
  readonly kind: 'Return'
  readonly value: Expression
}

export interface Assignment extends Traceable {
  readonly kind: 'Assignment'
  readonly reference: Reference
  readonly value: Expression
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Expression = Reference | Self | Literal<LiteralValue> | Send | Super | New | If | Throw | Try

export interface Self extends Traceable {
  readonly kind: 'Self'
}

export type LiteralValue = number | string | boolean | null | New | Singleton
export interface Literal<T extends LiteralValue> extends Traceable {
  readonly kind: 'Literal'
  readonly value: T
}

export interface Send extends Traceable {
  readonly kind: 'Send'
  readonly receiver: Expression
  readonly message: Name
  readonly args: ReadonlyArray<Expression>
}

export interface Super extends Traceable {
  readonly kind: 'Super'
  readonly args: ReadonlyArray<Expression>
}

export interface New extends Traceable {
  readonly kind: 'New'
  readonly className: Reference
  readonly args: ReadonlyArray<Expression>
}

export interface If extends Traceable {
  readonly kind: 'If'
  readonly condition: Expression
  readonly thenBody: ReadonlyArray<Sentence>
  readonly elseBody: ReadonlyArray<Sentence>
}

export interface Throw extends Traceable {
  readonly kind: 'Throw'
  readonly arg: Expression
}

export interface Try extends Traceable {
  readonly kind: 'Try'
  readonly body: ReadonlyArray<Sentence>
  readonly catches: ReadonlyArray<{ parameter: Parameter, parameterType?: Reference, body: ReadonlyArray<Sentence> }>
  readonly always: ReadonlyArray<Sentence>
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODE BUILDER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const node = <K extends NodeKind, N extends NodeOfKind<K>>(kind: K) => (payload: NodePayload<N>): N => (
  { ...payload as {}, kind }
) as N