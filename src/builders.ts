import { mapObject } from './extensions'
import * as Model from './model'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember, Constructor as ConstructorNode, Describe as DescribeNode, DescribeMember, Entity, Environment as EnvironmentNode, Expression, Field as FieldNode, Fixture as FixtureNode, If as IfNode, Import as ImportNode, isNode, List, Literal as LiteralNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, ObjectMember, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode, Category, Kind } from './model'

const { isArray } = Array

type BuildPayload<T> = Partial<T>

// TODO: Be able to build nodes on different stages
// TODO: Maybe we don't need these if we make constructors a bit better with defaults and stuff?

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Reference = <Q extends Kind | Category>(name: Name): ReferenceNode<Q> => new ReferenceNode<Q>({ name })

export const Parameter = (name: Name, payload?: BuildPayload<ParameterNode>): ParameterNode => new ParameterNode({
  name,
  isVarArg: false,
  ...payload,
})

export const NamedArgument = (name: Name, value: Expression): NamedArgumentNode => new NamedArgumentNode({
  name,
  value,
})

export const Import = (reference: ReferenceNode<'Entity'>, payload?: BuildPayload<ImportNode>): ImportNode => new ImportNode({
  entity: reference,
  isGeneric: false,
  ...payload,
})

export const Body = (...sentences: Sentence[]): BodyNode => new BodyNode({ sentences })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Package = (name: Name, payload?: BuildPayload<PackageNode>) =>
  (...members: Entity[]): PackageNode => new PackageNode({
    name,
    imports: [],
    ...payload,
    members,
  })


export const Class = (name: Name, payload?: BuildPayload<ClassNode>) =>
  (...members: ClassMember[]): ClassNode =>
    new ClassNode({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Singleton = (name?: Name, payload?: BuildPayload<SingletonNode>) =>
  (...members: ObjectMember[]): SingletonNode =>
    new SingletonNode({
      members,
      mixins: [],
      ...name ? { name } : {},
      supercallArgs: [],
      ...payload,
    })

export const Mixin = (name: Name, payload?: BuildPayload<MixinNode>) =>
  (...members: ObjectMember[]): MixinNode =>
    new MixinNode({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Program = (name: Name, payload?: BuildPayload<ProgramNode>) =>
  (...sentences: Sentence[]): ProgramNode =>
    new ProgramNode({
      name,
      body: Body(...sentences),
      ...payload,
    })

export const Test = (name: string, payload?: BuildPayload<TestNode>) =>
  (...sentences: Sentence[]): TestNode =>
    new TestNode({
      isOnly: false,
      name,
      body: Body(...sentences),
      ...payload,
    })

export const Describe = (name: string, payload?: BuildPayload<DescribeNode>) =>
  (...members: DescribeMember[]): DescribeNode =>
    new DescribeNode({
      name,
      members,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field = (name: Name, payload?: BuildPayload<FieldNode>): FieldNode => new FieldNode({
  name,
  isReadOnly: false,
  isProperty: false,
  ...payload,
})

export const Method = (name: Name, payload?: BuildPayload<MethodNode>) =>
  (...sentences: Sentence[]): MethodNode => {
    const { body, ...otherPayload } = payload || { body: undefined }

    return new MethodNode({
      name,
      isOverride: false,
      parameters: [],
      ...payload && 'body' in payload && body === undefined ? {} : { body: body || Body(...sentences) },
      ...otherPayload,
    })
  }

export const Constructor = (payload?: BuildPayload<ConstructorNode>) =>
  (...sentences: Sentence[]): ConstructorNode => new ConstructorNode({
    body: Body(...sentences),
    parameters: [],
    ...payload,
  })

export const Fixture = (_?: BuildPayload<FixtureNode>) =>
  (...sentences: Sentence[]): FixtureNode =>
    new FixtureNode({ body: Body(...sentences) })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Variable = (name: Name, payload?: BuildPayload<VariableNode>): VariableNode => new VariableNode({
  name,
  isReadOnly: false,
  ...payload,
})

export const Return = (value: Expression | undefined = undefined, payload?: BuildPayload<ReturnNode>): ReturnNode => new ReturnNode({ ...payload, value })

export const Assignment = (reference: ReferenceNode<'Variable' | 'Field'>, value: Expression): AssignmentNode =>
  new AssignmentNode({ variable: reference, value })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Self = (payload?: BuildPayload<SelfNode>): SelfNode => new SelfNode({ ...payload })

export const Literal = (value: LiteralValue): LiteralNode => new LiteralNode<LiteralValue>({ value })

export const Send = (receiver: Expression, message: Name, args: List<Expression> = [], payload?: BuildPayload<SendNode>): SendNode =>
  new SendNode({
    receiver,
    message,
    args,
    ...payload,
  })

export const Super = (args: List<Expression> = [], payload?: BuildPayload<SuperNode>): SuperNode => new SuperNode({ ...payload, args })

export const New = (className: ReferenceNode<'Class'>, args: List<Expression> | List<NamedArgumentNode>): NewNode =>
  new NewNode({ instantiated: className, args })

export const If = (condition: Expression, thenBody: List<Sentence>, elseBody?: List<Sentence>): IfNode => new IfNode({
  condition,
  thenBody: Body(...thenBody),
  elseBody: elseBody && Body(...elseBody),
})

export const Throw = (arg: Expression): ThrowNode => new ThrowNode({ exception: arg })

export const Try = (sentences: List<Sentence>, payload: { catches?: List<CatchNode>, always?: List<Sentence> }): TryNode =>
  new TryNode({
    body: Body(...sentences),
    catches: payload.catches || [],
    always: payload.always && Body(...payload.always),
  })

export const Catch = (parameter: ParameterNode, payload?: BuildPayload<CatchNode>) =>
  (...sentences: Sentence[]): CatchNode =>
    new CatchNode({
      body: Body(...sentences),
      parameter,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Environment = (...members: PackageNode[]): EnvironmentNode => {
  return new EnvironmentNode({ members, id: '', scope: null as any })
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const getter = (name: Name): MethodNode => new MethodNode({
  name,
  isOverride: false,
  parameters: [],
  body: new BodyNode({
    sentences: [
      new ReturnNode({ value: new ReferenceNode<'Field' | 'Variable' | 'Parameter' | 'NamedArgument' | 'Singleton'>({ name }) }),
    ],
  }),
})

export const setter = (name: Name): MethodNode => new MethodNode({
  name,
  isOverride: false,
  parameters: [new ParameterNode({ name: '<value>', isVarArg: false })],
  body: new BodyNode({
    sentences: [
      new AssignmentNode({
        variable: new ReferenceNode<'Variable' | 'Field'>({ name }),
        value: new ReferenceNode<'Field' | 'Variable' | 'Parameter' | 'NamedArgument' | 'Singleton'>({ name: '<value>' }),
      }),
    ],
  }),
})