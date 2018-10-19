import { Index } from 'parsimmon'
import { chain as flatMap, mapObjIndexed } from 'ramda'

const { isArray } = Array

type Drop<T, K> = Pick<T, Exclude<keyof T, K>>

export type Node = Parameter | Import | Body | Catch | Entity | ClassMember | Sentence | Environment
export type NodeKind = Node['kind']
export type NodeOfKind<K extends NodeKind> = Extract<Node, { kind: K }>
export type NodePayload<N extends Node> = Drop<Unlinked<N>, 'kind'>

export type Id = string
export interface Scope { [name: string]: Id }


export type Unlinked<T> =
  T extends string | number | boolean | null | undefined | never ? T :
  T extends ReadonlyArray<infer U> ? UnlinkedArray<U> :
  T extends {} ? (
    Drop<{ [K in keyof T]: Unlinked<T[K]> }, keyof BasicNode> & {
      source?: Source
    }) :
  T

export interface UnlinkedArray<T> extends ReadonlyArray<Unlinked<T>> { }

export interface Source {
  file?: string
  start: Index
  end: Index
}

export interface BasicNode {
  id: Id,
  scope: Scope,
  source?: Source,
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Name = string

export interface Reference extends BasicNode {
  readonly kind: 'Reference'
  readonly name: Name
}

export interface Parameter extends BasicNode {
  readonly kind: 'Parameter'
  readonly name: Name
  readonly isVarArg: boolean
}

export interface Import extends BasicNode {
  readonly kind: 'Import'
  readonly reference: Reference
  readonly isGeneric: boolean
}

export interface Body extends BasicNode {
  readonly kind: 'Body'
  readonly sentences: ReadonlyArray<Sentence>
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Entity = Package | Program | Test | Module
export type Module = Class | Singleton | Mixin

export interface Package extends BasicNode {
  readonly kind: 'Package'
  readonly name: Name
  readonly imports: ReadonlyArray<Import>
  readonly members: ReadonlyArray<Entity>
}

export interface Program extends BasicNode {
  readonly kind: 'Program'
  readonly name: Name
  readonly body: Body
}

export interface Test extends BasicNode {
  readonly kind: 'Test'
  readonly name: string
  readonly body: Body
}

export interface Class extends BasicNode {
  readonly kind: 'Class'
  readonly name: Name
  readonly superclass?: Reference
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<ClassMember>
}

export interface Singleton extends BasicNode {
  readonly kind: 'Singleton'
  readonly name?: Name
  readonly superCall?: { superclass: Reference, args: ReadonlyArray<Expression> }
  readonly mixins: ReadonlyArray<Reference>
  readonly members: ReadonlyArray<ObjectMember>
}

export interface Mixin extends BasicNode {
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

export interface Field extends BasicNode {
  readonly kind: 'Field'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value?: Expression
}

export interface Method extends BasicNode {
  readonly kind: 'Method'
  readonly name: Name
  readonly isOverride: boolean
  readonly isNative: boolean
  readonly parameters: ReadonlyArray<Parameter>
  readonly body?: Body
}

export interface Constructor extends BasicNode {
  readonly kind: 'Constructor'
  readonly parameters: ReadonlyArray<Parameter>
  readonly baseCall?: { callsSuper: boolean, args: ReadonlyArray<Expression> }
  readonly body: Body
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Sentence = Variable | Return | Assignment | Expression

export interface Variable extends BasicNode {
  readonly kind: 'Variable'
  readonly name: Name
  readonly isReadOnly: boolean
  readonly value?: Expression
}

export interface Return extends BasicNode {
  readonly kind: 'Return'
  readonly value: Expression
}

export interface Assignment extends BasicNode {
  readonly kind: 'Assignment'
  readonly reference: Reference
  readonly value: Expression
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Expression = Reference | Self | Literal<LiteralValue> | Send | Super | New | If | Throw | Try

export interface Self extends BasicNode {
  readonly kind: 'Self'
}

export type LiteralValue = number | string | boolean | null | New | Singleton
export interface Literal<T extends LiteralValue> extends BasicNode {
  readonly kind: 'Literal'
  readonly value: T
}

export interface Send extends BasicNode {
  readonly kind: 'Send'
  readonly receiver: Expression
  readonly message: Name
  readonly args: ReadonlyArray<Expression>
}

export interface Super extends BasicNode {
  readonly kind: 'Super'
  readonly args: ReadonlyArray<Expression>
}

export interface New extends BasicNode {
  readonly kind: 'New'
  readonly className: Reference
  readonly args: ReadonlyArray<Expression>
}

export interface If extends BasicNode {
  readonly kind: 'If'
  readonly condition: Expression
  readonly thenBody: Body
  readonly elseBody: Body
}

export interface Throw extends BasicNode {
  readonly kind: 'Throw'
  readonly arg: Expression
}

export interface Try extends BasicNode {
  readonly kind: 'Try'
  readonly body: Body
  readonly catches: ReadonlyArray<Catch>
  readonly always: Body
}

export interface Catch extends BasicNode {
  readonly kind: 'Catch'
  readonly parameter: Parameter
  readonly parameterType?: Reference
  readonly body: Body
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Environment extends BasicNode {
  readonly kind: 'Environment'
  readonly members: ReadonlyArray<Package>
}

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
export const children = (node: Node): ReadonlyArray<Node> => {
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
    case 'Environment':
      return node.members
    case 'Parameter':
    case 'Reference':
    case 'Self':
      return []
  }
}

// TODO: Test
// TODO: I don't think this will work for non-node objects like base-calls
export const transform = (tx: (node: Node) => Node) => <T extends Node, U extends T>(node: T): U => {
  const applyTransform = (obj: any): any =>
    isNode(obj) ? mapObjIndexed(applyTransform, tx(obj) as any) :
      isArray(obj) ? obj.map(applyTransform) :
        obj instanceof Object ? mapObjIndexed(applyTransform, obj) :
          obj

  return applyTransform(node) as U
}

export const reduce = <T>(tx: (acum: T, node: Node) => T) => (initial: T, node: Node): T =>
  children(node).reduce(reduce(tx), tx(initial, node))

// TODO: memoize this?
export const descendants = (node: Node): ReadonlyArray<Node> => {
  const directChildren = children(node)
  return [...directChildren, ...flatMap(child => descendants(child), directChildren)]
}

// TODO: memoize this?
export const parentOf = (environment: Environment) => (node: Node): Node => {
  const parent = [environment, ...descendants(environment)].find(descendant => children(descendant).includes(node))
  if (!parent) throw new Error(`Node ${JSON.stringify(node)} has not part of the environment`)
  return parent
}

// TODO: memoize this?
export const getNodeById = <T extends Node>(environment: Environment, id: Id): T => {
  const response = [environment, ...descendants(environment)].find(node => node.id === id)
  if (!response) throw new Error(`Missing node ${id}`)
  return response as T
}