import { alt, index, lazy, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { concat, toPairs } from 'ramda'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember as ClassMemberNode, Constructor as ConstructorNode, Describe as DescribeNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, If as IfNode, Import as ImportNode, Kind, List, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Name as NameType, New as NewNode, Node, NodeOfKind, ObjectMember as ObjectMemberNode, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Source, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode } from './model'

type Drop<T, K> = Pick<T, Exclude<keyof T, K>>

export type NodePayload<N extends Node<'Raw'>> = Drop<N, 'kind' | 'id'>

const ASSIGNATION_OPERATORS = ['=', '+=', '-=', '*=', '/=', '%=', '||=', '&&=']
const PREFIX_OPERATORS = ['!', '-', '+']
const INFIX_OPERATORS = [
  ['||'],
  ['&&'],
  ['===', '!==', '==', '!='],
  ['>=', '<=', '>', '<'],
  ['..<', '>..', '..', '->', '>>>', '>>', '<<<', '<<', '<=>', '<>', '?:'],
  ['+', '-'],
  ['**', '%'],
  ['*', '/'],
]
const OPERATORS = INFIX_OPERATORS.reduce(concat, PREFIX_OPERATORS.map(op => `${op}_`))

// TODO: Resolve this without effect
let SOURCE_FILE: string | undefined

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const comment = regex(/\/\*(.|[\r\n])*?\*\//).or(regex(/\/\/.*/))
const _ = comment.or(whitespace).many()
const key = (str: string) => string(str).trim(_)
const optional = <T>(parser: Parser<T>): Parser<T | undefined> => parser.or(of(undefined))
const maybeString = (str: string) => string(str).atMost(1).map(([head]) => !!head)

const node = <
  K extends Kind,
  N extends NodeOfKind<K, 'Raw'> = NodeOfKind<K, 'Raw'>,
  P extends NodePayload<N> = NodePayload<N>,
  C extends { [F in keyof P]: Parser<P[F]> } = { [F in keyof P]: Parser<P[F]> },
  >(kind: K) => (fieldParserSeq: C): Parser<N> => {
    const subparsers: [keyof P, Parser<P[keyof P]>][] = toPairs(fieldParserSeq) as unknown as [keyof P, Parser<P[keyof P]>][]
    return (subparsers.length ? seqObj<P>(...subparsers) : of({})).map(payload => ({ kind, ...payload as any }))
  }

const sourced = <T>(parser: Parser<T>): Parser<T & { source: Source }> => seq(
  optional(_).then(index),
  parser,
  index
).map(([start, payload, end]) => ({ ...payload as any, source: { start, end, ...SOURCE_FILE ? { file: SOURCE_FILE } : {} } }))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Name: Parser<NameType> = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)

export const Parameter: Parser<ParameterNode<'Raw'>> = lazy(() =>
  node('Parameter')({
    name: Name,
    isVarArg: maybeString('...'),
  }).thru(sourced)
)

export const Parameters: Parser<List<ParameterNode<'Raw'>>> = lazy(() =>
  Parameter.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Arguments: Parser<List<ExpressionNode<'Raw'>>> = lazy(() =>
  Expression.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Body: Parser<BodyNode<'Raw'>> = lazy(() =>
  node('Body')({
    sentences: Sentence.skip(optional(alt(key(';'), _))).many(),
  }).wrap(key('{'), string('}')).thru(sourced)
)

export const SingleExpressionBody: Parser<BodyNode<'Raw'>> = lazy(() =>
  node('Body')({
    sentences: Sentence.times(1),
  }).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Entity: Parser<EntityNode<'Raw'>> = lazy(() => alt(Package, Class, Singleton, Mixin, Program, Describe, Test))

export const Import: Parser<ImportNode<'Raw'>> = lazy(() =>
  key('import').then(node('Import')({
    reference: node('Reference')({
      name: Name.sepBy1(key('.')).tieWith('.'),
      target: of(undefined),
    }).thru(sourced),
    isGeneric: maybeString('.*'),
  })).thru(sourced).skip(optional(alt(key(';'), _)))
)

export const File = (fileName: string): Parser<PackageNode<'Raw'>> => {
  SOURCE_FILE = fileName
  return lazy(() =>
    node('Package')({
      name: of(fileName.split('.')[0]),
      imports: Import.sepBy(optional(_)).skip(optional(_)),
      members: Entity.sepBy(optional(_)),
    }).thru(sourced).skip(optional(_))
  )
}

export const Package: Parser<PackageNode<'Raw'>> = lazy(() =>
  key('package').then(node('Package')({
    name: Name.skip(key('{')),
    imports: Import.sepBy(optional(_)).skip(optional(_)),
    members: Entity.sepBy(optional(_)).skip(key('}')),
  })).thru(sourced)
)

export const Program: Parser<ProgramNode<'Raw'>> = lazy(() =>
  key('program').then(node('Program')({
    name: Name,
    body: Body,
  })).thru(sourced)
)

export const Describe: Parser<DescribeNode<'Raw'>> = lazy(() =>
  key('describe').then(node('Describe')({
    name: String,
    members: Test.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const Test: Parser<TestNode<'Raw'>> = lazy(() =>
  key('test').then(node('Test')({
    name: String,
    body: Body,
  })).thru(sourced)
)

const MixinLinearization = lazy(() =>
  key('mixed with').then(Reference.sepBy1(key('and')))
)

export const Class: Parser<ClassNode<'Raw'>> = lazy(() =>
  key('class').then(node('Class')({
    name: Name,
    superclass: optional(key('inherits').then(Reference)),
    mixins: MixinLinearization.or(of([])),
    members: ClassMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const Singleton: Parser<SingletonNode<'Raw'>> = lazy(() => {
  const SuperCall = key('inherits').then(seqMap(Reference, Arguments.or(of([])), (superclass, args) => ({ superclass, args })))

  return key('object').then(seqMap(
    alt(
      MixinLinearization.map(mixins => ({ mixins, name: undefined })),

      seqMap(
        SuperCall,
        MixinLinearization.or(of([])),
        (superCall, mixins) => ({ superCall, mixins })
      ),

      seqMap(
        notFollowedBy(key('inherits').or(key('mixed with'))).then(Name),
        optional(SuperCall),
        MixinLinearization.or(of([])),
        (name, superCall, mixins) => ({ name, superCall, mixins })
      ),

      of({ mixins: [] }),
    ),

    ObjectMember.sepBy(optional(_)).wrap(key('{'), key('}')),

    ({ name, superCall, mixins }, members) => ({ kind: 'Singleton' as 'Singleton', id: undefined, name, superCall, mixins, members })
  )).thru(sourced)
})

export const Mixin: Parser<MixinNode<'Raw'>> = lazy(() =>
  key('mixin').then(node('Mixin')({
    name: Name,
    mixins: MixinLinearization.or(of([])),
    members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const ClassMember: Parser<ClassMemberNode<'Raw'>> = lazy(() => alt(Constructor, ObjectMember))

export const ObjectMember: Parser<ObjectMemberNode<'Raw'>> = lazy(() => alt(Method, Field))

export const Field: Parser<FieldNode<'Raw'>> = lazy(() =>
  node('Field')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name: Name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced)
)

export const Method: Parser<MethodNode<'Raw'>> = lazy(() => seqMap(
  key('override').result(true).or(of(false)),
  key('method').then(alt(Name, ...OPERATORS.map(key))),
  Parameters,
  alt(
    key('native').result({ isNative: true, body: undefined }),
    key('=').then(
      SingleExpressionBody.map(body => ({ isNative: false, body }))
    ),
    Body.map(body => ({ isNative: false, body })),
    of({ isNative: false, body: undefined })
  ),
  (isOverride, name, parameters, { isNative, body }) => (
    { kind: 'Method' as 'Method', id: undefined, isOverride, name, parameters, isNative, body }
  )
).thru(sourced))

export const Constructor: Parser<ConstructorNode<'Raw'>> = lazy(() =>
  key('constructor').then(node('Constructor')({
    parameters: Parameters,
    baseCall: optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      Arguments,
      (callsSuper, args) => ({ callsSuper, args }))
    )),
    body: Body.or(node('Body')({ sentences: of([]) })),
  })).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Sentence: Parser<SentenceNode<'Raw'>> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<VariableNode<'Raw'>> = lazy(() =>
  node('Variable')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name: Name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced)
)

export const Return: Parser<ReturnNode<'Raw'>> = lazy(() =>
  key('return').then(node('Return')({
    value: optional(Expression),
  })).thru(sourced)
)

export const Assignment: Parser<AssignmentNode<'Raw'>> = lazy(() =>
  seqMap(
    Reference,
    alt(...ASSIGNATION_OPERATORS.map(key)),
    Expression,
    (reference, operator, value) => ({
      kind: 'Assignment' as 'Assignment',
      id: undefined,
      reference,
      value: operator === '='
        ? value
        : ({ kind: 'Send' as 'Send', id: undefined, receiver: reference, message: operator.slice(0, -1), args: [value] }),
    })
  ).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<ExpressionNode<'Raw'>> = lazy(() => Operation)

export const PrimaryExpression: Parser<ExpressionNode<'Raw'>> = lazy(() => alt(
  Self,
  Super,
  If,
  New,
  Throw,
  Try,
  Literal,
  Reference,
  Expression.wrap(key('('), key(')'))
))

export const Self: Parser<SelfNode<'Raw'>> = lazy(() =>
  key('self').then(node('Self')({})).thru(sourced)
)

export const Reference: Parser<ReferenceNode<'Raw'>> = lazy(() =>
  node('Reference')({
    name: Name,
    target: of(undefined),
  }).thru(sourced)
)

export const Super: Parser<SuperNode<'Raw'>> = lazy(() =>
  key('super').then(
    node('Super')({
      args: Arguments,
    })
  ).thru(sourced)
)

export const New: Parser<NewNode<'Raw'>> = lazy(() =>
  key('new').then(
    node('New')({
      className: Reference,
      args: Arguments,
    })
  ).thru(sourced)
)

export const If: Parser<IfNode<'Raw'>> = lazy(() =>
  key('if').then(
    node('If')({
      condition: Expression.wrap(key('('), key(')')),
      thenBody: alt(Body, SingleExpressionBody),
      elseBody: optional(key('else').then(alt(Body, SingleExpressionBody))),
    })
  ).thru(sourced)
)

export const Throw: Parser<ThrowNode<'Raw'>> = lazy(() =>
  key('throw').then(
    node('Throw')({ arg: Expression })
  ).thru(sourced)
)

export const Try: Parser<TryNode<'Raw'>> = lazy(() =>
  key('try').then(node('Try')({
    body: alt(Body, SingleExpressionBody),
    catches: Catch.many(),
    always: optional(key('then always').then(alt(Body, SingleExpressionBody))),
  })).thru(sourced)
)

export const Catch: Parser<CatchNode<'Raw'>> = lazy(() =>
  key('catch').then(node('Catch')({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: alt(Body, SingleExpressionBody),
  })).thru(sourced)
)

export const Send: Parser<SendNode<'Raw'>> = lazy(() =>
  seqMap(
    index,
    PrimaryExpression,
    seq(
      key('.').then(Name),
      alt(Arguments, node('Literal')({ value: Closure }).thru(sourced).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
      ({ kind: 'Send', receiver, message, args, source: { start, end } }) as SendNode<'Raw'>
      , initial) as SendNode<'Raw'>
  )
)

export const Operation: Parser<ExpressionNode<'Raw'>> = lazy(() => {
  const prefixOperation = seqMap(
    seq(index, alt(...PREFIX_OPERATORS.map(key))).many(),
    alt(Send, PrimaryExpression),
    index,
    (calls, initial, end) => calls.reduceRight<ExpressionNode<'Raw'>>((receiver, [start, message]) =>
      ({ kind: 'Send', id: undefined, receiver, message, args: [], source: { start, end } })
      , initial)
  )

  const infixOperation = (precedenceLevel: number): Parser<ExpressionNode<'Raw'>> => {
    const argument = precedenceLevel < INFIX_OPERATORS.length - 1
      ? infixOperation(precedenceLevel + 1)
      : prefixOperation

    return seqMap(
      index,
      argument,
      seq(alt(...INFIX_OPERATORS[precedenceLevel].map(key)), argument.times(1), index).many(),
      (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
        ({ kind: 'Send', id: undefined, receiver, message, args, source: { start, end } }) as SendNode<'Raw'>
        , initial)
    )
  }

  return infixOperation(0)
}
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<LiteralNode<'Raw'>> = lazy(() =>
  node('Literal')({
    value: alt(
      key('null').result(null),
      key('true').result(true),
      key('false').result(false),
      regex(/-?\d+(\.\d+)?/).map(Number),
      Expression.sepBy(key(',')).wrap(key('['), key(']')).map(makeList),
      Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(makeSet),
      String,
      Closure,
      Singleton,
    ),
  }).thru(sourced)
)

const EscapedChar = alt(
  regex(/\\\\/).result('\\'),
  regex(/\\b/).result('\b'),
  regex(/\\t/).result('\t'),
  regex(/\\n/).result('\n'),
  regex(/\\f/).result('\f'),
  regex(/\\r/).result('\r'),
)

const SingleQuoteString: Parser<string> = alt(
  EscapedChar,
  regex(/\\'/).result('\''),
  regex(/[^\\']/)
).many().tie().wrap(string('\''), string('\''))

const DoubleQuoteString: Parser<string> = alt(
  EscapedChar,
  regex(/\\"/).result('"'),
  regex(/[^\\"]/)
).many().tie().wrap(string('"'), string('"'))

const String: Parser<string> = alt(SingleQuoteString, DoubleQuoteString)

const Closure: Parser<SingletonNode<'Raw'>> = lazy(() =>
  seqMap(
    Parameter.sepBy(key(',')).skip(key('=>')).or(of([])),
    Sentence.skip(optional(alt(key(';'), _))).many(),
    makeClosure
  ).wrap(key('{'), key('}'))
)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeClosure = (parameters: List<ParameterNode<'Raw'>>, sentences: List<SentenceNode<'Raw'>>): SingletonNode<'Raw'> =>
  ({
    kind: 'Singleton',
    id: undefined,
    superCall: {
      superclass: {
        kind: 'Reference',
        id: undefined,
        target: undefined,
        name: 'wollok.lang.Closure',
      },
      args: [],
    },
    mixins: [],
    name: undefined,
    members: [
      {
        kind: 'Method',
        id: undefined,
        name: 'apply', isOverride: false, isNative: false, parameters,
        body: { kind: 'Body', id: undefined, sentences },
      },
    ],
  })

const makeList = (args: List<ExpressionNode<'Raw'>>): NewNode<'Raw'> => ({
  kind: 'New',
  id: undefined,
  className: {
    kind: 'Reference',
    id: undefined,
    name: 'wollok.lang.List',
    target: undefined,
  },
  args,
})

const makeSet = (args: List<ExpressionNode<'Raw'>>): NewNode<'Raw'> => ({
  kind: 'New',
  id: undefined,
  className: {
    kind: 'Reference',
    id: undefined,
    name: 'wollok.lang.Set',
    target: undefined,
  },
  args,
})