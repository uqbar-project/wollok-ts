import { alt, index, lazy, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { Closure as buildClosure, ListOf, Literal as buildLiteral, SetOf, Singleton as buildSingleton } from './builders'
import { last } from './extensions'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember as ClassMemberNode, Constructor as ConstructorNode, Describe as DescribeNode, DescribeMember as DescribeMemberNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, Fixture as FixtureNode, If as IfNode, Import as ImportNode, isExpression, Kind, List, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Name as NameType, NamedArgument as NamedArgumentNode, New as NewNode, Node, NodeOfKind, ObjectMember as ObjectMemberNode, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Raw, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Source, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode } from './model'

const { keys } = Object

type Drop<T, K> = Pick<T, Exclude<keyof T, K>>

export type NodePayload<N extends Node<Raw>> = Drop<N, 'kind' | 'id'>

const ASSIGNATION_OPERATORS = ['=', '+=', '-=', '*=', '/=', '%=', '||=', '&&=']
const PREFIX_OPERATORS = ['!', '-', '+']
const LAZY_OPERATORS = ['||', '&&']
const INFIX_OPERATORS = [
  ['||'],
  ['&&'],
  ['===', '!==', '==', '!='],
  ['>=', '<=', '>', '<'],
  ['..<', '>..', '..', '->', '>>>', '>>', '<<<', '<<', '<=>', '<>', '?:'],
  ['+', '-'],
  ['**'], // TODO: remove this line.
  ['*', '/'],
  ['**', '%'],
]
const OPERATORS = INFIX_OPERATORS.reduce((all, ops) => [...all, ...ops], PREFIX_OPERATORS.map(op => `${op}_`))

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
  N extends NodeOfKind<K, Raw> = NodeOfKind<K, Raw>,
  P extends NodePayload<N> = NodePayload<N>,
  C extends { [F in keyof P]: Parser<P[F]> } = { [F in keyof P]: Parser<P[F]> },
  >(kind: K) => (fieldParserSeq: C): Parser<N> => {
    const subparsers = keys(fieldParserSeq).map(fieldName =>
      [fieldName, fieldParserSeq[fieldName as keyof C]] as any)
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

export const Parameter: Parser<ParameterNode<Raw>> = lazy(() =>
  node('Parameter')({
    name: Name,
    isVarArg: maybeString('...'),
  }).thru(sourced)
)

export const Parameters: Parser<List<ParameterNode<Raw>>> = lazy(() =>
  Parameter.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Arguments: Parser<List<ExpressionNode<Raw>>> = lazy(() =>
  Expression.sepBy(key(',')).wrap(key('('), key(')'))
)

export const NamedArguments: Parser<List<NamedArgumentNode<Raw>>> = lazy(() =>
  node('NamedArgument')({
    name: Name,
    value: key('=').then(Expression),
  }).thru(sourced).sepBy(key(',')).wrap(key('('), key(')'))
)

export const Body: Parser<BodyNode<Raw>> = lazy(() =>
  node('Body')({
    sentences: Sentence.skip(optional(alt(key(';'), _))).many(),
  }).wrap(key('{'), string('}')).thru(sourced)
)

export const SingleExpressionBody: Parser<BodyNode<Raw>> = lazy(() =>
  node('Body')({
    sentences: Sentence.times(1),
  }).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Entity: Parser<EntityNode<Raw>> = lazy(() => alt(Package, Class, Singleton, Mixin, Program, Describe, Test))

export const Import: Parser<ImportNode<Raw>> = lazy(() =>
  key('import').then(node('Import')({
    reference: node('Reference')({
      name: Name.sepBy1(key('.')).tieWith('.'),
      target: of(undefined),
    }).thru(sourced),
    isGeneric: maybeString('.*'),
  })).thru(sourced).skip(optional(alt(key(';'), _)))
)

export const File = (fileName: string): Parser<PackageNode<Raw>> => {
  SOURCE_FILE = fileName
  return lazy(() =>
    node('Package')({
      name: of(fileName.split('.')[0]),
      imports: Import.sepBy(optional(_)).skip(optional(_)),
      members: Entity.sepBy(optional(_)),
    }).thru(sourced).skip(optional(_))
  )
}

export const Package: Parser<PackageNode<Raw>> = lazy(() =>
  key('package').then(node('Package')({
    name: Name.skip(key('{')),
    imports: Import.sepBy(optional(_)).skip(optional(_)),
    members: Entity.sepBy(optional(_)).skip(key('}')),
  })).thru(sourced)
)

export const Program: Parser<ProgramNode<Raw>> = lazy(() =>
  key('program').then(node('Program')({
    name: Name,
    body: Body,
  })).thru(sourced)
)

export const Describe: Parser<DescribeNode<Raw>> = lazy(() =>
  key('describe').then(node('Describe')({
    name: String,
    members: DescribeMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const Fixture: Parser<FixtureNode<Raw>> = lazy(() =>
  key('fixture').then(node('Fixture')({
    body: Body,
  })).thru(sourced)
)

export const Test: Parser<TestNode<Raw>> = lazy(() =>
  key('test').then(node('Test')({
    name: String,
    body: Body,
  })).thru(sourced)
)

const MixinLinearization = lazy(() =>
  key('mixed with').then(Reference.sepBy1(key('and'))).map(mixins => mixins.reverse())
)

export const Class: Parser<ClassNode<Raw>> = lazy(() =>
  key('class').then(node('Class')({
    name: Name,
    superclass: optional(key('inherits').then(Reference)),
    mixins: MixinLinearization.or(of([])),
    members: ClassMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const Singleton: Parser<SingletonNode<Raw>> = lazy(() => {
  const SuperCall = key('inherits').then(seqMap(
    Reference,
    alt(Arguments, NamedArguments, of([])),
    (superclass, args) => ({ superclass, args }))
  )

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

    ({ name, superCall, mixins }, members) => ({ kind: 'Singleton' as const, name, superCall, mixins, members })
  )).thru(sourced)
})

export const Mixin: Parser<MixinNode<Raw>> = lazy(() =>
  key('mixin').then(node('Mixin')({
    name: Name,
    mixins: MixinLinearization.or(of([])),
    members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const DescribeMember: Parser<DescribeMemberNode<Raw>> = lazy(() => alt(Variable, Fixture, Test, Method))

export const ClassMember: Parser<ClassMemberNode<Raw>> = lazy(() => alt(Constructor, ObjectMember))

export const ObjectMember: Parser<ObjectMemberNode<Raw>> = lazy(() => alt(Method, Field))

export const Field: Parser<FieldNode<Raw>> = lazy(() =>
  node('Field')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    isProperty: optional(key('property')).map(val => !!val),
    name: Name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced)
)

export const Method: Parser<MethodNode<Raw>> = lazy(() => seqMap(
  key('override').result(true).or(of(false)),
  key('method').then(alt(Name, ...OPERATORS.map(key))),
  Parameters,
  alt(
    key('=').then(
      Expression.map(value => ({
        isNative: false, body: {
          kind: 'Body', sentences: [{ kind: 'Return', value }], source: value.source,
        },
      }))
    ),
    key('native').result({ isNative: true }),
    Body.map(body => ({ isNative: false, body })),
    of({ isNative: false })
  ),
  (isOverride, name, parameters, { isNative, body }) => (
    { kind: 'Method' as 'Method', isOverride, name, parameters, isNative, body }
  )
).thru(sourced))

export const Constructor: Parser<ConstructorNode<Raw>> = lazy(() =>
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

export const Sentence: Parser<SentenceNode<Raw>> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<VariableNode<Raw>> = lazy(() =>
  node('Variable')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name: Name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced)
)

export const Return: Parser<ReturnNode<Raw>> = lazy(() =>
  key('return').then(node('Return')({
    value: optional(Expression),
  })).thru(sourced)
)

export const Assignment: Parser<AssignmentNode<Raw>> = lazy(() =>
  seqMap(
    Reference,
    alt(...ASSIGNATION_OPERATORS.map(key)),
    Expression,
    (reference, operator, value) => ({
      kind: 'Assignment' as const,
      reference,
      value: operator === '='
        ? value
        : ({
          kind: 'Send' as const,
          receiver: reference,
          message: operator.slice(0, -1),
          args: LAZY_OPERATORS.includes(operator.slice(0, -1))
            ? [makeClosure([], [value])]
            : [value],
        }),
    })
  ).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<ExpressionNode<Raw>> = lazy(() => Operation)

export const PrimaryExpression: Parser<ExpressionNode<Raw>> = lazy(() => alt(
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

export const Self: Parser<SelfNode<Raw>> = lazy(() =>
  key('self').then(node('Self')({})).thru(sourced)
)

export const Reference: Parser<ReferenceNode<Raw>> = lazy(() =>
  node('Reference')({
    name: Name,
    target: of(undefined),
  }).thru(sourced)
)

export const Super: Parser<SuperNode<Raw>> = lazy(() =>
  key('super').then(
    node('Super')({
      args: Arguments,
    })
  ).thru(sourced)
)

export const New: Parser<NewNode<Raw> | LiteralNode<Raw, SingletonNode<Raw>>> = lazy(() =>
  alt(
    key('new').then(
      seqMap(
        Reference,
        alt(Arguments, NamedArguments),
        // TODO: Convince the world we need a single linearization syntax
        (key('with').then(Reference)).atLeast(1).map(mixins => [...mixins].reverse()),
        (superclass, args, mixins) => buildLiteral(buildSingleton(undefined, {
          superCall: { superclass, args },
          mixins,
        })())
      )
    ),

    key('new').then(
      node('New')({
        instantiated: Reference,
        args: alt(Arguments, NamedArguments),
      })
    ).thru(sourced),
  )
)

export const If: Parser<IfNode<Raw>> = lazy(() =>
  key('if').then(
    node('If')({
      condition: Expression.wrap(key('('), key(')')),
      thenBody: alt(Body, SingleExpressionBody),
      elseBody: optional(key('else').then(alt(Body, SingleExpressionBody))),
    })
  ).thru(sourced)
)

export const Throw: Parser<ThrowNode<Raw>> = lazy(() =>
  key('throw').then(
    node('Throw')({ exception: Expression })
  ).thru(sourced)
)

export const Try: Parser<TryNode<Raw>> = lazy(() =>
  key('try').then(node('Try')({
    body: alt(Body, SingleExpressionBody),
    catches: Catch.many(),
    always: optional(key('then always').then(alt(Body, SingleExpressionBody))),
  })).thru(sourced)
)

export const Catch: Parser<CatchNode<Raw>> = lazy(() =>
  key('catch').then(node('Catch')({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: alt(Body, SingleExpressionBody),
  })).thru(sourced)
)

export const Send: Parser<SendNode<Raw>> = lazy(() =>
  seqMap(
    index,
    PrimaryExpression,
    seq(
      key('.').then(Name),
      alt(Arguments, Closure.thru(sourced).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
      ({ kind: 'Send' as 'Send', receiver, message, args, source: { start, end } })
      , initial) as SendNode<Raw>
  )
)

export const Operation: Parser<ExpressionNode<Raw>> = lazy(() => {
  const prefixOperation = seqMap(
    seq(index, alt(...PREFIX_OPERATORS.map(key))).many(),
    alt(Send, PrimaryExpression),
    index,
    (calls, initial, end) => calls.reduceRight<ExpressionNode<Raw>>((receiver, [start, message]) =>
      ({ kind: 'Send', receiver, message: `${message}_`, args: [], source: { start, end } })
      , initial)
  )

  const infixOperation = (precedenceLevel: number): Parser<ExpressionNode<Raw>> => {
    const argument = precedenceLevel < INFIX_OPERATORS.length - 1
      ? infixOperation(precedenceLevel + 1)
      : prefixOperation

    return seqMap(
      index,
      argument,
      seq(alt(...INFIX_OPERATORS[precedenceLevel].map(key)), argument.times(1), index).many(),
      (start, initial, calls) => calls.reduce((receiver, [message, args, end]) => ({
        kind: 'Send' as const,
        receiver,
        message,
        args: LAZY_OPERATORS.includes(message)
          ? [makeClosure([], args)]
          : args,
        source: { start, end },
      })
        , initial)
    )
  }

  return infixOperation(0)
}
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<LiteralNode<Raw>> = lazy(() =>
  alt(
    Closure,
    node('Literal')({
      value: alt(
        key('null').result(null),
        key('true').result(true),
        key('false').result(false),
        regex(/-?\d+(\.\d+)?/).map(Number),
        Expression.sepBy(key(',')).wrap(key('['), key(']')).map(elems => ListOf(...elems)),
        Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(elems => SetOf(...elems)),
        String,
        Singleton,
      ),
    })
  ).thru(sourced)
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

const Closure: Parser<LiteralNode<Raw, SingletonNode<Raw>>> = lazy(() =>
  seqMap(
    Parameter.sepBy(key(',')).skip(key('=>')).or(of([])),
    Sentence.skip(optional(alt(key(';'), _))).many(),
    makeClosure
  ).wrap(key('{'), key('}'))
)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeClosure = (parameters: List<ParameterNode<Raw>>, rawSentences: List<SentenceNode<Raw>>):
  LiteralNode<Raw, SingletonNode<Raw>> => {

  const sentences: List<SentenceNode<Raw>> = rawSentences
    .some(sentence => sentence.kind === 'Return') || !isExpression(last(rawSentences))
    ? [...rawSentences, { kind: 'Return', value: undefined }]
    : [...rawSentences.slice(0, -1), { kind: 'Return', value: last(rawSentences) as ExpressionNode<Raw> }]

  return buildClosure(...parameters)(...sentences)
}