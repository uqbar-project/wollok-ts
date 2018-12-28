import { merge } from 'ramda'
import { Evaluation as EvaluationType, Frame as FrameType, Locals, RuntimeObject as RuntimeObjectType } from '../src/interpreter'
import { Catch as CatchNode, Class as ClassNode, ClassMember, Constructor as ConstructorNode, Describe as DescribeNode, Entity, Environment as EnvironmentNode, Expression, Field as FieldNode, Id, Import as ImportNode, Kind, List, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name, NodeOfKind, ObjectMember, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Sentence, Singleton as SingletonNode, Test as TestNode, Variable as VariableNode } from '../src/model'
import { NodePayload } from '../src/parser'

const { keys } = Object

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NODES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeNode = <K extends Kind, N extends NodeOfKind<K, 'Raw'>>(kind: K) => (payload: NodePayload<N>): N =>
  merge(payload, { kind, id: undefined }) as any

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Reference = (name: Name) => makeNode('Reference')({ name, target: undefined })

export const Parameter = (name: Name, payload?: Partial<NodePayload<ParameterNode<'Raw'>>>) => makeNode('Parameter')({
  name,
  isVarArg: false,
  ...payload,
})

export const Import = (reference: ReferenceNode<'Raw'>, payload?: Partial<NodePayload<ImportNode<'Raw'>>>) => makeNode('Import')({
  reference,
  isGeneric: false,
  ...payload,
})

export const Body = (...sentences: Sentence<'Raw'>[]) => makeNode('Body')({ sentences })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Package = (name: Name, payload?: Partial<NodePayload<PackageNode<'Raw'>>>) =>
  (...members: Entity<'Raw'>[]) => makeNode('Package')({
    name,
    members,
    imports: [],
    ...payload,
  })


export const Class = (name: Name, payload?: Partial<NodePayload<ClassNode<'Raw'>>>) =>
  (...members: ClassMember<'Raw'>[]) =>
    makeNode('Class')({
      name,
      members,
      mixins: [],
      superclass: undefined,
      ...payload,
    })

export const Singleton = (name?: Name, payload?: Partial<NodePayload<SingletonNode<'Raw'>>>) =>
  (...members: ObjectMember<'Raw'>[]) =>
    makeNode('Singleton')({
      members,
      mixins: [],
      ...name ? { name } : {},
      superCall: undefined,
      ...payload,
    })

export const Mixin = (name: Name, payload?: Partial<NodePayload<MixinNode<'Raw'>>>) =>
  (...members: ObjectMember<'Raw'>[]) =>
    makeNode('Mixin')({
      name,
      members,
      mixins: [],
      ...payload,
    })

export const Program = (name: Name, payload?: Partial<NodePayload<ProgramNode<'Raw'>>>) =>
  (...sentences: Sentence<'Raw'>[]) =>
    makeNode('Program')({
      name,
      body: Body(...sentences),
      ...payload,
    })

export const Test = (name: string, payload?: Partial<NodePayload<TestNode<'Raw'>>>) =>
  (...sentences: Sentence<'Raw'>[]) =>
    makeNode('Test')({
      name,
      body: Body(...sentences),
      ...payload,
    })

export const Describe = (name: string, payload?: Partial<NodePayload<DescribeNode<'Raw'>>>) =>
  (...members: TestNode<'Raw'>[]) =>
    makeNode('Describe')({
      name,
      members,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field = (name: Name, payload?: Partial<NodePayload<FieldNode<'Raw'>>>) => makeNode('Field')({
  name,
  isReadOnly: false,
  value: undefined,
  ...payload,
})

export const Method = (name: Name, payload?: Partial<NodePayload<MethodNode<'Raw'>>>) =>
  (...sentences: Sentence<'Raw'>[]) => {
    const { body, ...otherPayload } = payload || { body: undefined }

    return makeNode('Method')({
      name,
      isOverride: false,
      isNative: false,
      parameters: [],
      ...payload && keys(payload).includes('body') && body === undefined ? {} : {
        body: Body(...sentences),
      },
      ...otherPayload,
    })
  }

export const Constructor = (payload?: Partial<NodePayload<ConstructorNode<'Raw'>>>) =>
  (...sentences: Sentence<'Raw'>[]) => makeNode('Constructor')({
    body: Body(...sentences),
    baseCall: undefined,
    parameters: [],
    ...payload,
  })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Variable = (name: Name, payload?: Partial<NodePayload<VariableNode<'Raw'>>>) => makeNode('Variable')({
  name,
  isReadOnly: false,
  value: undefined,
  ...payload,
})

export const Return = (value: Expression<'Raw'> | undefined = undefined) => makeNode('Return')({ value })

export const Assignment = (reference: ReferenceNode<'Raw'>, value: Expression<'Raw'>) => makeNode('Assignment')({ reference, value })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Self = makeNode('Self')({})

export const Literal = (value: LiteralValue<'Raw'>) => makeNode('Literal')({ value })

export const Send = (receiver: Expression<'Raw'>, message: Name, args: ReadonlyArray<Expression<'Raw'>> = []) => makeNode('Send')({
  receiver,
  message,
  args,
})

export const Super = (args: List<Expression<'Raw'>> = []) => makeNode('Super')({ args })

export const New = (className: ReferenceNode<'Raw'>, args: List<Expression<'Raw'>>) => makeNode('New')({ className, args })

export const If = (condition: Expression<'Raw'>, thenBody: List<Sentence<'Raw'>>, elseBody?: List<Sentence<'Raw'>>) => makeNode('If')({
  condition,
  thenBody: Body(...thenBody),
  elseBody: elseBody && Body(...elseBody),
})

export const Throw = (arg: Expression<'Raw'>) => makeNode('Throw')({ arg })

export const Try = (sentences: List<Sentence<'Raw'>>, payload: {
  catches?: List<CatchNode<'Raw'>>,
  always?: List<Sentence<'Raw'>>
}) =>
  makeNode('Try')({
    body: Body(...sentences),
    catches: payload.catches || [],
    always: payload.always && Body(...payload.always),
  })

export const Catch = (parameter: ParameterNode<'Raw'>, payload?: Partial<NodePayload<CatchNode<'Raw'>>>) =>
  (...sentences: Sentence<'Raw'>[]) =>
    makeNode('Catch')({
      body: Body(...sentences),
      parameter,
      parameterType: undefined,
      ...payload,
    })

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SYNTHETICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Closure = (...parameters: ParameterNode<'Raw'>[]) => (...body: Sentence<'Raw'>[]) =>
  Literal(Singleton(undefined, { superCall: { superclass: Reference('wollok.lang.Closure'), args: [] } })(
    Method('apply', { parameters })(
      ...body
    )
  ))

export const Environment = (...members: PackageNode<'Raw'>[]): EnvironmentNode<'Raw'> => makeNode('Environment')({
  members,
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVALUATION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const evaluationBuilders = (environment: EnvironmentNode<'Linked'>) => {


  const RuntimeObject = (id: Id<'Linked'>, module: Name, fields: Locals = {}, innerValue: any = undefined): RuntimeObjectType => ({
    id,
    module,
    fields,
    innerValue,
  })

  const Frame = (payload: Partial<FrameType>): FrameType => ({
    locals: {},
    pc: 0,
    pending: [],
    resume: [],
    operandStack: [],
    ...payload,
  })

  const Evaluation = (instances: { [id: string]: RuntimeObjectType } = {}) =>
    (...frameStack: FrameType[]): EvaluationType => ({
      environment,
      instances,
      frameStack,
    })

  return {
    RuntimeObject,
    Frame,
    Evaluation,
  }
}