import { mapObject, keys, last } from './extensions'
import { Context, Evaluation as EvaluationType, Frame as FrameType, RuntimeObject as RuntimeObjectType } from './interpreter'
import * as Model from './model'
import { Source, Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember, Constructor as ConstructorNode, Describe as DescribeNode, DescribeMember, Entity, Environment as EnvironmentNode, Expression, Field as FieldNode, Filled, Fixture as FixtureNode, Id, If as IfNode, Import as ImportNode, isNode, Linked, List, Literal as LiteralNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, Node, ObjectMember, Package as PackageNode, Parameter as ParameterNode, Payload, Program as ProgramNode, Raw, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode, Category, Kind } from './model'

const { isArray } = Array

type BuildPayload<T> = Partial<Payload<T>>

// TODO: Be able to build nodes on different stages
// TODO: Maybe we don't need these if we make constructors a bit better with defaults and stuff?

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function asNode<N extends Node<Raw>>(payload: Payload<N> & Pick<N, 'kind'>): N {
  const constructor: new (payload: Payload<N>) => N = Model[payload.kind] as any
  return new constructor(payload)
}

export function fromJSON<T>(json: any): T {
  const propagate = (data: any) => {
    if (isNode(data)) return asNode(mapObject(fromJSON, data) as any)
    if (isArray(data)) return data.map(fromJSON)
    if (data instanceof Object) return mapObject(fromJSON, data)
    return data
  }
  return propagate(json) as T
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Reference = <Q extends Kind|Category>(name: Name): ReferenceNode<Q, Raw> => new ReferenceNode<Q, Raw>({ name })

export const Parameter = (name: Name, payload?: BuildPayload<ParameterNode<Raw>>): ParameterNode<Raw> => new ParameterNode<Raw>({
  name,
  isVarArg: false,
  ...payload,
})

export const NamedArgument = (name: Name, value: Expression<Raw>): NamedArgumentNode<Raw> => new NamedArgumentNode<Raw>({
  name,
  value,
})

export const Import = (reference: ReferenceNode<'Entity', Raw>, payload?: BuildPayload<ImportNode<Raw>>): ImportNode<Raw> => new ImportNode<Raw>({
  entity: reference,
  isGeneric: false,
  ...payload,
})

export const Body = (...sentences: Sentence<Raw>[]): BodyNode<Raw> => new BodyNode<Raw>({ sentences })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Package = (name: Name, payload?: BuildPayload<PackageNode<Raw>>) =>
  (...members: Entity<Raw>[]): PackageNode<Raw> => new PackageNode<Raw>({
    name,
    imports: [],
    ...payload,
    members,
  })


export const Class = (name: Name, payload?: BuildPayload<ClassNode<Raw>>) =>
  (...members: ClassMember<Raw>[]): ClassNode<Raw> =>
    new ClassNode<Raw>({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Singleton = (name?: Name, payload?: BuildPayload<SingletonNode<Raw>>) =>
  (...members: ObjectMember<Raw>[]): SingletonNode<Raw> =>
    new SingletonNode<Raw>({
      members,
      mixins: [],
      ...name ? { name } : {},
      supercallArgs: [],
      ...payload,
    })

export const Mixin = (name: Name, payload?: BuildPayload<MixinNode<Raw>>) =>
  (...members: ObjectMember<Raw>[]): MixinNode<Raw> =>
    new MixinNode<Raw>({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Program = (name: Name, payload?: BuildPayload<ProgramNode<Raw>>) =>
  (...sentences: Sentence<Raw>[]): ProgramNode<Raw> =>
    new ProgramNode<Raw>({
      name,
      body: Body(...sentences),
      ...payload,
    })

export const Test = (name: string, payload?: BuildPayload<TestNode<Raw>>) =>
  (...sentences: Sentence<Raw>[]): TestNode<Raw> =>
    new TestNode<Raw>({
      name,
      body: Body(...sentences),
      ...payload,
    })

export const Describe = (name: string, payload?: BuildPayload<DescribeNode<Raw>>) =>
  (...members: DescribeMember<Raw>[]): DescribeNode<Raw> =>
    new DescribeNode<Raw>({
      name,
      members,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field = (name: Name, payload?: BuildPayload<FieldNode<Raw>>): FieldNode<Raw> => new FieldNode<Raw>({
  name,
  isReadOnly: false,
  isProperty: false,
  ...payload,
})

export const Method = (name: Name, payload?: BuildPayload<MethodNode<Raw>>) =>
  (...sentences: Sentence<Raw>[]): MethodNode<Raw> => {
    const { body, ...otherPayload } = payload || { body: undefined }

    return new MethodNode<Raw>({
      name,
      isOverride: false,
      parameters: [],
      ...payload && 'body' in payload && body === undefined ? {} : { body: body || Body(...sentences) },
      ...otherPayload,
    })
  }

export const Constructor = (payload?: BuildPayload<ConstructorNode<Raw>>) =>
  (...sentences: Sentence<Raw>[]): ConstructorNode<Raw> => new ConstructorNode<Raw>({
    body: Body(...sentences),
    parameters: [],
    ...payload,
  })

export const Fixture = (_?: BuildPayload<FixtureNode<Raw>>) =>
  (...sentences: Sentence<Raw>[]): FixtureNode<Raw> =>
    new FixtureNode<Raw>({ body: Body(...sentences) })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Variable = (name: Name, payload?: BuildPayload<VariableNode<Raw>>): VariableNode<Raw> => new VariableNode<Raw>({
  name,
  isReadOnly: false,
  ...payload,
})

export const Return = (value: Expression<Raw> | undefined = undefined, payload?: BuildPayload<ReturnNode<Raw>>): ReturnNode<Raw> => new ReturnNode<Raw>({ ...payload, value })

export const Assignment = (reference: ReferenceNode<'Variable'|'Field', Raw>, value: Expression<Raw>): AssignmentNode<Raw> =>
  new AssignmentNode<Raw>({ variable: reference, value })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Self = (payload?: BuildPayload<SelfNode<Raw>>): SelfNode<Raw> => new SelfNode<Raw>({ ...payload })

export const Literal = (value: LiteralValue<Raw>): LiteralNode<Raw> => new LiteralNode<Raw, LiteralValue<Raw>>({ value })

export const Send = (receiver: Expression<Raw>, message: Name, args: List<Expression<Raw>> = [], payload?: BuildPayload<SendNode<Raw>>): SendNode<Raw> =>
  new SendNode<Raw>({
    receiver,
    message,
    args,
    ...payload,
  })

export const Super = (args: List<Expression<Raw>> = [], payload?: BuildPayload<SuperNode<Raw>>): SuperNode<Raw> => new SuperNode<Raw>({ ...payload, args })

export const New = (className: ReferenceNode<'Class', Raw>, args: List<Expression<Raw>> | List<NamedArgumentNode<Raw>>): NewNode<Raw> =>
  new NewNode<Raw>({ instantiated: className, args })

export const If = (condition: Expression<Raw>, thenBody: List<Sentence<Raw>>, elseBody?: List<Sentence<Raw>>): IfNode<Raw> => new IfNode<Raw>({
  condition,
  thenBody: Body(...thenBody),
  elseBody: elseBody && Body(...elseBody),
})

export const Throw = (arg: Expression<Raw>): ThrowNode<Raw> => new ThrowNode<Raw>({ exception: arg })

export const Try = (sentences: List<Sentence<Raw>>, payload: { catches?: List<CatchNode<Raw>>, always?: List<Sentence<Raw>> }): TryNode<Raw> =>
  new TryNode<Raw>({
    body: Body(...sentences),
    catches: payload.catches || [],
    always: payload.always && Body(...payload.always),
  })

export const Catch = (parameter: ParameterNode<Raw>, payload?: BuildPayload<CatchNode<Raw>>) =>
  (...sentences: Sentence<Raw>[]): CatchNode<Raw> =>
    new CatchNode<Raw>({
      body: Body(...sentences),
      parameter,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Closure = (payload: { parameters?: List<ParameterNode<Raw>>, sentences?: List<Sentence<Raw>>, code?: string, source?: Source }): LiteralNode<Raw, SingletonNode<Raw>> => {
  const initialSentences = (payload.sentences ?? []).slice(0, -1)
  const lastSentence = last(payload.sentences ?? [])
  const sentences =
    lastSentence?.is('Expression') ? [...initialSentences, Return(lastSentence)] :
    lastSentence?.is('Return') ? [...initialSentences, lastSentence] :
    [...initialSentences, ...lastSentence ? [lastSentence] : [], Return()]

  return new LiteralNode<Raw, SingletonNode<Raw>>({
    value: new SingletonNode<Raw>({
      superclassRef: new ReferenceNode({ name: 'wollok.lang.Closure' }),
      supercallArgs: [],
      mixins: [],
      members: [
        new MethodNode<Raw>({
          name: '<apply>',
          isOverride: false,
          parameters: payload.parameters ?? [],
          body: new BodyNode<Raw>({ sentences: sentences ?? [] }),
        }),
        ...payload.code ? [new FieldNode<Raw>({
          name: '<toString>',
          isReadOnly: true,
          isProperty: false,
          value: new LiteralNode<Raw>({ value: payload.code }),
        })] : [],
      ],
    }),
    source: payload.source,
  })
}

export const Environment = (...members: PackageNode<Linked>[]): EnvironmentNode<Linked> => {
  return new EnvironmentNode<Linked>({ members, id: '', scope: null as any })
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const getter = (name: Name): MethodNode<Filled> => new MethodNode({
  name,
  isOverride: false,
  parameters: [],
  body: new BodyNode({
    sentences: [
      new ReturnNode({ value: new ReferenceNode<'Field' | 'Variable' | 'Parameter' | 'NamedArgument' | 'Singleton', Filled>({ name }) }),
    ],
  }),
})

export const setter = (name: Name): MethodNode<Filled> => new MethodNode({
  name,
  isOverride: false,
  parameters: [new ParameterNode<Filled>({ name: '<value>', isVarArg: false })],
  body: new BodyNode({
    sentences: [
      new AssignmentNode<Filled>({
        variable: new ReferenceNode<'Variable' | 'Field', Filled>({ name }),
        value: new ReferenceNode<'Field' | 'Variable' | 'Parameter' | 'NamedArgument' | 'Singleton', Filled>({ name: '<value>' }),
      }),
    ],
  }),
})


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const Evaluation = (
  environment: EnvironmentNode,
  instances: Record<Id, RuntimeObjectType> = {},
  contexts: Record<Id, Context> = {}
) =>
  (...frameStack: FrameType[]): EvaluationType => {
    const evaluation = new EvaluationType(
      environment,
      [...frameStack].reverse(),
      new Map(),
      new Map(keys(contexts).map(key => [key, contexts[key]])),
      new Map(),
    )

    // TODO: Improve this
    mapObject((instance, key) => evaluation.setInstance(key, instance.copy(evaluation)), instances)

    return evaluation
  }

export const Frame = (payload: Partial<FrameType>): FrameType => new FrameType(
    payload.id!,
    payload.instructions ?? [],
    payload.context!,
    payload.nextInstruction ?? 0,
    payload.operandStack ?? [],
)

export const RuntimeObject = (id: Id, moduleFQN: Name, innerValue?: string | number | Id[]): RuntimeObjectType =>
  new RuntimeObjectType(
    undefined as any,
    moduleFQN,
    id,
    innerValue,
  )