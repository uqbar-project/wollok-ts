import { Catch as CatchNode, Class as ClassNode, ClassMember, Constructor as ConstructorNode, Entity, Expression, Field as FieldNode, Import as ImportNode, LiteralValue, makeNode, Method as MethodNode, Mixin as MixinNode, Name, NodePayload, ObjectMember, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Sentence, Singleton as SingletonNode, Test as TestNode, Variable as VariableNode } from '../src/model'

const { keys } = Object

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Reference = (name: Name) => makeNode('Reference')({ name })

export const Parameter = (name: Name, payload?: Partial<NodePayload<ParameterNode>>) => makeNode('Parameter')({
  name,
  isVarArg: false,
  ...payload,
})

export const Import = (reference: ReferenceNode, payload?: Partial<NodePayload<ImportNode>>) => makeNode('Import')({
  reference,
  isGeneric: false,
  ...payload,
})

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Package = (name: Name, payload?: Partial<NodePayload<PackageNode>>) =>
  (...members: Entity[]) => makeNode('Package')({
    name,
    members,
    imports: [],
    ...payload,
  })


export const Class = (name: Name, payload?: Partial<NodePayload<ClassNode>>) =>
  (...members: ClassMember[]) =>
    makeNode('Class')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Singleton = (name?: Name, payload?: Partial<NodePayload<SingletonNode>>) =>
  (...members: ObjectMember[]) =>
    makeNode('Singleton')({
      members,
      mixins: [],
      ...(name ? { name } : {}),
      ...payload,
    })

export const Mixin = (name: Name, payload?: Partial<NodePayload<MixinNode>>) =>
  (...members: ObjectMember[]) =>
    makeNode('Mixin')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Program = (name: Name, payload?: Partial<NodePayload<ProgramNode>>) =>
  (...sentences: Sentence[]) =>
    makeNode('Program')({
      name,
      body: makeNode('Body')({ sentences }),
      ...payload,
    })

export const Test = (name: string, payload?: Partial<NodePayload<TestNode>>) =>
  (...sentences: Sentence[]) =>
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
  (...sentences: Sentence[]) => {
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
  (...sentences: Sentence[]) => makeNode('Constructor')({
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

export const Return = (value: Expression) => makeNode('Return')({ value })

export const Assignment = (reference: ReferenceNode, value: Expression) => makeNode('Assignment')({ reference, value })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Self = makeNode('Self')({})

export const Literal = (value: LiteralValue) => makeNode('Literal')({ value })

export const Send = (receiver: Expression, message: Name, args: ReadonlyArray<Expression> = []) => makeNode('Send')({
  receiver,
  message,
  args,
})

export const Super = (args: ReadonlyArray<Expression> = []) => makeNode('Super')({ args })

export const New = (className: ReferenceNode, args: ReadonlyArray<Expression>) => makeNode('New')({ className, args })

export const If = (condition: Expression, thenBody: ReadonlyArray<Sentence>, elseBody: ReadonlyArray<Sentence> = []) => makeNode('If')({
  condition,
  thenBody: makeNode('Body')({ sentences: thenBody }),
  elseBody: makeNode('Body')({ sentences: elseBody }),
})

export const Throw = (arg: Expression) => makeNode('Throw')({ arg })

export const Try = (sentences: ReadonlyArray<Sentence>, payload: { catches?: CatchNode[], always?: Sentence[] }) =>
  makeNode('Try')({
    body: makeNode('Body')({ sentences }),
    catches: payload.catches || [],
    always: makeNode('Body')({ sentences: payload.always || [] }),
  })

export const Catch = (parameter: ParameterNode, payload?: Partial<NodePayload<CatchNode>>) => (...sentences: Sentence[]) =>
  makeNode('Catch')({
    body: makeNode('Body')({ sentences }),
    parameter,
    ...payload,
  })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Closure = (...parameters: ParameterNode[]) => (...body: Sentence[]) =>
  Singleton(undefined, { superCall: { superclass: Reference('wollok.Closure'), args: [] } })(
    Method('apply', { parameters })(
      ...body
    )
  )