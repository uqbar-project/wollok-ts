import { Index } from 'parsimmon'
import { chain as flatMap, mapObjIndexed } from 'ramda'

const { isArray } = Array

// TODO: Add Maybe monads to optional fields. https://github.com/cbowdon/tsmonad (?)

export type Node = Parameter | Import | Body | Catch | Entity | ClassMember | Sentence
export type NodeKind = Node['kind']
export type NodeOfKind<K extends NodeKind> = Extract<Node, { kind: K }>
export type NodePayload<N extends Node> = Pick<N, Exclude<keyof N, 'kind'>>

export type Id = string
export interface Scope { [name: string]: Id }
export type Linked<T extends {}> = { [K in keyof T]: LinkedField<T[K]> } & {
  id: Id,
  scope: Scope,
}
type LinkedField<T> =
  T extends string | number | boolean ? T :
  T extends ReadonlyArray<infer U> ? U extends {} ? ReadonlyArray<Linked<U>> : ReadonlyArray<U> :
  T extends {} | undefined ? T extends {} ? Linked<T> : Linked<Exclude<T, undefined>> | undefined :
  T


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

export interface Body extends Traceable {
  readonly kind: 'Body'
  readonly sentences: ReadonlyArray<Sentence>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity = Package | Program | Test | Module
export type Module = Class | Singleton | Mixin

export interface Package extends Traceable {
  readonly kind: 'Package'
  readonly name: Name
  readonly imports: ReadonlyArray<Import>
  readonly members: ReadonlyArray<Entity>
}

export interface Program extends Traceable {
  readonly kind: 'Program'
  readonly name: Name
  readonly body: Body
}

export interface Test extends Traceable {
  readonly kind: 'Test'
  readonly name: string
  readonly body: Body
}

export interface Class extends Traceable {
  readonly kind: 'Class'
  readonly name: Name
  readonly superclass?: Reference
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<ClassMember>
}

export interface Singleton extends Traceable {
  readonly kind: 'Singleton'
  readonly name?: Name
  readonly superCall?: { superclass: Reference, args: ReadonlyArray<Expression> }
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<ObjectMember>
}

export interface Mixin extends Traceable {
  readonly kind: 'Mixin'
  readonly name: Name
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<ObjectMember>
}


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ObjectMember = Field | Method
export type ClassMember = Constructor | ObjectMember

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
  readonly body?: Body
}

export interface Constructor extends Traceable {
  readonly kind: 'Constructor'
  readonly parameters: ReadonlyArray<Parameter>
  readonly baseCall?: { callsSuper: boolean, args: ReadonlyArray<Expression> }
  readonly body: Body
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
  readonly thenBody: Body
  readonly elseBody: Body
}

export interface Throw extends Traceable {
  readonly kind: 'Throw'
  readonly arg: Expression
}

export interface Try extends Traceable {
  readonly kind: 'Try'
  readonly body: Body
  readonly catches: ReadonlyArray<Catch>
  readonly always: Body
}

export interface Catch extends Traceable {
  readonly kind: 'Catch'
  parameter: Parameter
  parameterType?: Reference
  body: Body
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Environment {
  readonly members: ReadonlyArray<Linked<Package>>
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODE BUILDER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const makeNode = <K extends NodeKind, N extends NodeOfKind<K>>(kind: K) => (payload: NodePayload<N>): N => (
  { ...payload as {}, kind }
) as N

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const isNode = (obj: any): obj is Node => !!obj.kind

export const isEntity = (obj: any): obj is Entity => isNode(obj) &&
  ['Package', 'Class', 'Singleton', 'Mixin', 'Program', 'Test'].includes(obj.kind)

export const isModule = (obj: any): obj is Module => isNode(obj) &&
  ['Singleton', 'Mixin', 'Class'].includes(obj.kind)

export const isObjectMember = (obj: any): obj is ObjectMember => isNode(obj) &&
  ['Field', 'Method'].includes(obj.kind)

export const isClassMember = (obj: any): obj is ClassMember => isNode(obj) &&
  (['Constructor'].includes(obj.kind) || isObjectMember(obj))

export const isExpression = (obj: any): obj is Expression => isNode(obj) &&
  ['Reference', 'Self', 'Literal', 'Send', 'Super', 'New', 'If', 'Throw', 'Try'].includes(obj.kind)

export const isSentence = (obj: any): obj is Sentence => isNode(obj) &&
  (['Variable', 'Return', 'Assignment'].includes(obj.kind) || isExpression(obj))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TRANSFORMATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// TODO: Define by comprehension?
// TODO: Test
export const children = (node: Linked<Node>): ReadonlyArray<Linked<Node>> => {
  switch (node.kind) {
    case 'Body':
      return node.sentences
    case 'Import':
      return [node.reference]
    case 'Package':
      return [...node.imports, ...node.members]
    case 'Class':
      return [...node.superclass ? [node.superclass] : [], ...node.mixins, ...node.members]
    case 'Singleton':
      return [...node.superCall ? [node.superCall.superclass, ...node.superCall.args] : [], ...node.mixins, ...node.members]
    case 'Mixin':
      return [...node.mixins, ...node.members]
    case 'Program':
      return [node.body]
    case 'Test':
      return [node.body]
    case 'Field':
      return node.value ? [node.value] : []
    case 'Method':
      return [...node.parameters, ...node.body ? [node.body] : []]
    case 'Constructor':
      return [...node.baseCall ? node.baseCall.args : [], ...node.parameters, node.body]
    case 'Variable':
      return node.value ? [node.value] : []
    case 'Return':
      return [node.value]
    case 'Assignment':
      return [node.reference, node.value]
    case 'Literal':
      return isNode(node.value) ? [node.value] : []
    case 'Send':
      return [node.receiver, ...node.args]
    case 'Super':
      return node.args
    case 'New':
      return [node.className, ...node.args]
    case 'If':
      return [node.condition, node.thenBody, node.elseBody]
    case 'Throw':
      return [node.arg]
    case 'Try':
      return [node.body, ...node.catches, node.always]
    case 'Catch':
      return [node.parameter, node.body, ...node.parameterType ? [node.parameterType] : []]
    case 'Parameter':
    case 'Reference':
    case 'Self':
      return []
    default:
      // TODO: use either a function like https://github.com/dividab/ts-exhaustive-check or modeling node types as enums.
      const exhaustiveCheck: never = node
      return exhaustiveCheck
  }
}

// TODO: Test
// TODO: I don't think this will work for non-node objects like base-calls
export const transform = <T extends Node, U extends T>(tx: (node: Node) => Node) => (node: T): U => {
  const applyTransform = (obj: any): any =>
    isNode(obj) ? tx(obj) :
      isArray(obj) ? obj.map(applyTransform) :
        obj

  return mapObjIndexed(applyTransform, tx(node) as any) as U
}

export const reduce = <T>(tx: (acum: T, node: Linked<Node>) => T) => (initial: T, node: Linked<Node>): T =>
  children(node).reduce(reduce(tx), tx(initial, node))

export const descendants = (node: Linked<Node>): ReadonlyArray<Linked<Node>> => {
  const directChildren = children(node)
  return [...directChildren, ...flatMap(child => descendants(child), directChildren)]
}

export const parentOf = (environment: Environment) => (node: Linked<Node>): Linked<Node> => {
  const parent = [...environment.members, ...flatMap(descendants, environment.members)].find(descendant =>
    children(descendant).includes(node)
  )
  if (!parent) throw new Error(`Node ${node.id} is not on the environment`)
  return parent
}

export const getNodeById = <T extends Linked<Node>>(environment: Environment, id: Id): T => {
  const response = environment.members.reduce<Linked<Node> | null>(
    reduce((found, node) => found || node.id === id ? node : null)
    , null)

  if (!response) throw new Error(`Missing node ${id}`)

  return response as T
}