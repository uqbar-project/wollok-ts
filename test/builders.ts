import { Class as ClassNode, Constructor as ConstructorNode, Entity, Environment as EnvironmentNode, Expression, Field as FieldNode, Import as ImportNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name, node, NodePayload, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Sentence, Singleton as SingletonNode, Test as TestNode, Try as TryNode, Variable as VariableNode } from '../src/model'

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Reference = (name: Name) => node('Reference')({ name })

export const Parameter = (name: Name, payload?: Partial<NodePayload<ParameterNode>>) => node('Parameter')({
  name,
  isVarArg: false,
  ...payload,
})

export const Import = (reference: ReferenceNode, payload?: Partial<NodePayload<ImportNode>>) => node('Import')({
  reference,
  isGeneric: false,
  ...payload,
})

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Package = (name: Name, payload?: Partial<NodePayload<PackageNode>>) =>
  (...members: Entity[]) => node('Package')({
    name,
    members,
    imports: [],
    ...payload,
  })


export const Class = (name: Name, payload?: Partial<NodePayload<ClassNode>>) =>
  (...members: (FieldNode | MethodNode | ConstructorNode)[]) =>
    node('Class')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Singleton = (name?: Name, payload?: Partial<NodePayload<SingletonNode>>) =>
  (...members: (FieldNode | MethodNode)[]) =>
    node('Singleton')({
      members,
      mixins: [],
      ...(name ? { name } : {}),
      ...payload,
    })

export const Mixin = (name: Name, payload?: Partial<NodePayload<MixinNode>>) =>
  (...members: (FieldNode | MethodNode)[]) =>
    node('Mixin')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Program = (name: Name, payload?: Partial<NodePayload<ProgramNode>>) =>
  (...body: Sentence[]) =>
    node('Program')({
      name,
      body,
      ...payload,
    })

export const Test = (description: string, payload?: Partial<NodePayload<TestNode>>) =>
  (...body: Sentence[]) =>
    node('Test')({
      description,
      body,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field = (name: Name, payload?: Partial<NodePayload<FieldNode>>) => node('Field')({
  name,
  isReadOnly: false,
  ...payload,
})

export const Method = (name: Name, payload?: Partial<NodePayload<MethodNode>>) =>
  (...body: Sentence[]) => node('Method')({
    name,
    body,
    isOverride: false,
    isNative: false,
    parameters: [],
    ...payload,
  })

export const Constructor = (payload?: Partial<NodePayload<ConstructorNode>>) =>
  (...body: Sentence[]) => node('Constructor')({
    body,
    parameters: [],
    ...payload,
  })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Variable = (name: Name, payload?: Partial<NodePayload<VariableNode>>) => node('Variable')({
  name,
  isReadOnly: false,
  ...payload,
})

export const Return = (value: Expression) => node('Return')({ value })

export const Assignment = (reference: ReferenceNode, value: Expression) => node('Assignment')({ reference, value })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Self = node('Self')({})

export const Literal = (value: LiteralValue) => node('Literal')({ value })

export const Send = (receiver: Expression, message: Name, args: ReadonlyArray<Expression> = []) => node('Send')({
  receiver,
  message,
  args,
})

export const Super = (args: ReadonlyArray<Expression> = []) => node('Super')({ args })

export const New = (className: ReferenceNode, args: ReadonlyArray<Expression>) => node('New')({ className, args })

export const If = (condition: Expression, thenBody: ReadonlyArray<Sentence>, elseBody: ReadonlyArray<Sentence> = []) => node('If')({
  condition,
  thenBody,
  elseBody,
})

export const Throw = (arg: Expression) => node('Throw')({ arg })

export const Try = (body: ReadonlyArray<Sentence>, payload?: Partial<NodePayload<TryNode>>) => node('Try')({
  body,
  catches: [],
  always: [],
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

export const Environment = (...members: Entity[]): EnvironmentNode => ({ members })