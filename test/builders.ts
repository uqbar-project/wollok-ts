import {merge } from 'ramda'
import { Catch as CatchNode, Class as ClassNode, ClassMember, Constructor as ConstructorNode, Entity, Expression, Field as FieldNode, Import as ImportNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name, NodeKind, NodeOfKind, NodePayload, ObjectMember, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Sentence, Singleton as SingletonNode, Test as TestNode, Unlinked, Variable as VariableNode } from '../src/model'

const { keys } = Object

const makeNode = <K extends NodeKind, N extends NodeOfKind<K>>(kind: K) => (payload: NodePayload<N>): Unlinked<N> =>
  merge(payload, { kind }) as any

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Reference = (name: Name) => makeNode('Reference')({ name })

export const Parameter = (name: Name, payload?: Partial<NodePayload<ParameterNode>>) => makeNode('Parameter')({
  name,
  isVarArg: false,
  ...payload,
})

export const Import = (reference: Unlinked<ReferenceNode>, payload?: Partial<NodePayload<ImportNode>>) => makeNode('Import')({
  reference,
  isGeneric: false,
  ...payload,
})

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Package = (name: Name, payload?: Partial<NodePayload<PackageNode>>) =>
  (...members: Unlinked<Entity>[]) => makeNode('Package')({
    name,
    members,
    imports: [],
    ...payload,
  })


export const Class = (name: Name, payload?: Partial<NodePayload<ClassNode>>) =>
  (...members: Unlinked<ClassMember>[]) =>
    makeNode('Class')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Singleton = (name?: Name, payload?: Partial<NodePayload<SingletonNode>>) =>
  (...members: Unlinked<ObjectMember>[]) =>
    makeNode('Singleton')({
      members,
      mixins: [],
      ...name ? {name} : {},
      ...payload,
    })

export const Mixin = (name: Name, payload?: Partial<NodePayload<MixinNode>>) =>
  (...members: Unlinked<ObjectMember>[]) =>
    makeNode('Mixin')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Program = (name: Name, payload?: Partial<NodePayload<ProgramNode>>) =>
  (...sentences: Unlinked<Sentence>[]) =>
    makeNode('Program')({
      name,
      body: makeNode('Body')({ sentences }),
      ...payload,
    })

export const Test = (name: string, payload?: Partial<NodePayload<TestNode>>) =>
  (...sentences: Unlinked<Sentence>[]) =>
    makeNode('Test')({
      name,
      body: makeNode('Body')({ sentences }),
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field = (name: Name, payload?: Partial<NodePayload<FieldNode>>) => makeNode('Field')({
  name,
  isReadOnly: false,
  ...payload,
})

export const Method = (name: Name, payload?: Partial<NodePayload<MethodNode>>) =>
  (...sentences: Unlinked<Sentence>[]) => {
    const { body, ...otherPayload } = payload || { body: undefined }

    return makeNode('Method')({
      name,
      isOverride: false,
      isNative: false,
      parameters: [],
      ...payload && keys(payload).includes('body') && body === undefined ? {} : {
        body: makeNode('Body')({ sentences }),
      },
      ...otherPayload,
    })
  }

export const Constructor = (payload?: Partial<NodePayload<ConstructorNode>>) =>
  (...sentences: Unlinked<Sentence>[]) => makeNode('Constructor')({
    body: makeNode('Body')({ sentences }),
    parameters: [],
    ...payload,
  })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Variable = (name: Name, payload?: Partial<NodePayload<VariableNode>>) => makeNode('Variable')({
  name,
  isReadOnly: false,
  ...payload,
})

export const Return = (value: Unlinked<Expression>) => makeNode('Return')({ value })

export const Assignment = (reference: Unlinked<ReferenceNode>, value: Unlinked<Expression>) => makeNode('Assignment')({ reference, value })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Self = makeNode('Self')({})

export const Literal = (value: Unlinked<LiteralValue>) => makeNode('Literal')({ value })

export const Send = (receiver: Unlinked<Expression>, message: Name, args: ReadonlyArray<Unlinked<Expression>> = []) => makeNode('Send')({
  receiver,
  message,
  args,
})

export const Super = (args: ReadonlyArray<Unlinked<Expression>> = []) => makeNode('Super')({ args })

export const New = (className: Unlinked<ReferenceNode>, args: ReadonlyArray<Unlinked<Expression>>) => makeNode('New')({ className, args })

export const If = (condition: Unlinked<Expression>,
                   thenBody: ReadonlyArray<Unlinked<Sentence>>,
                   elseBody: ReadonlyArray<Unlinked<Sentence>> = []) => makeNode('If')({
  condition,
  thenBody: makeNode('Body')({ sentences: thenBody }),
  elseBody: makeNode('Body')({ sentences: elseBody }),
})

export const Throw = (arg: Unlinked<Expression>) => makeNode('Throw')({ arg })

export const Try = (sentences: ReadonlyArray<Unlinked<Sentence>>,
                    payload: { catches?: Unlinked<CatchNode>[],
                    always?: Unlinked<Sentence>[] }) =>
  makeNode('Try')({
    body: makeNode('Body')({ sentences }),
    catches: payload.catches || [],
    always: makeNode('Body')({ sentences: payload.always || [] }),
  })

export const Catch = (parameter: Unlinked<ParameterNode>, payload?: Partial<NodePayload<CatchNode>>) =>
(...sentences: Unlinked<Sentence>[]) =>
  makeNode('Catch')({
    body: makeNode('Body')({ sentences }),
    parameter,
    ...payload,
  })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Closure = (...parameters: Unlinked<ParameterNode>[]) => (...body: Unlinked<Sentence>[]) =>
  Singleton(undefined, { superCall: { superclass: Reference('wollok.Closure'), args: [] } })(
    Method('apply', { parameters })(
      ...body
    )
  )