// tslint:disable:no-shadowed-variable
// tslint:disable:variable-name
import { alt, index, lazy, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { concat, toPairs } from 'ramda'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember as ClassMemberNode, Constructor as ConstructorNode, Describe as DescribeNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, If as IfNode, Import as ImportNode, Literal as LiteralNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name as NameType, New as NewNode, NodeKind, NodeOfKind, NodePayload, ObjectMember as ObjectMemberNode, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Source, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Unlinked, Variable as VariableNode } from './model'

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const comment = regex(/\/\*(.|[\r\n])*?\*\//).or(regex(/\/\/.*/))
const _ = comment.or(whitespace).many()
const key = (str: string) => string(str).trim(_)
const optional = <T>(parser: Parser<T>): Parser<T | undefined> => parser.or(of(undefined))
const maybeString = (s: string) => string(s).atMost(1).map(([s]) => !!s)

const node = <
  K extends NodeKind,
  N extends NodeOfKind<K> = NodeOfKind<K>,
  P extends NodePayload<N> = NodePayload<N>,
  C extends { [K in keyof P]: Parser<P[K]> } = { [K in keyof P]: Parser<P[K]> },
  >(kind: K) => (fieldParserSeq: C): Parser<Unlinked<N>> => {
    const subparsers: [keyof P, Parser<P[keyof P]>][] = toPairs(fieldParserSeq) as unknown as [keyof P, Parser<P[keyof P]>][]
    return (subparsers.length ? seqObj<P>(...subparsers) : of({})).map(payload => ({ kind, ...payload as any }))
  }

const sourced = <T>(parser: Parser<T>): Parser<T & { source: Source }> => seq(
  optional(_).then(index),
  parser,
  index
).map(([start, payload, end]) => ({ ...payload as any, source: { start, end } }))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Name: Parser<NameType> = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)

export const Parameter: Parser<Unlinked<ParameterNode>> = lazy(() =>
  node('Parameter')({
    name: Name,
    isVarArg: maybeString('...'),
  }).thru(sourced)
)

export const Parameters: Parser<Unlinked<ParameterNode>[]> = lazy(() =>
  Parameter.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Arguments: Parser<Unlinked<ExpressionNode>[]> = lazy(() =>
  Expression.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Body: Parser<Unlinked<BodyNode>> = lazy(() =>
  node('Body')({
    sentences: Sentence.skip(optional(alt(key(';'), _))).many(),
  }).wrap(key('{'), string('}')).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Entity: Parser<Unlinked<EntityNode>> = lazy(() => alt(Package, Class, Singleton, Mixin, Program, Describe, Test))

export const Import: Parser<Unlinked<ImportNode>> = lazy(() =>
  key('import').then(node('Import')({
    reference: node('Reference')({ name: Name.sepBy1(key('.')).tieWith('.') }).thru(sourced),
    isGeneric: maybeString('.*'),
  })).thru(sourced).skip(optional(alt(key(';'), _)))
)

export const File = (fileName: string): Parser<Unlinked<PackageNode>> => lazy(() =>
  node('Package')({
    name: of(fileName),
    imports: Import.sepBy(optional(_)).skip(optional(_)),
    members: Entity.sepBy(optional(_)),
  }).thru(sourced).skip(optional(_))
)

export const Package: Parser<Unlinked<PackageNode>> = lazy(() =>
  key('package').then(node('Package')({
    name: Name.skip(key('{')),
    imports: Import.sepBy(optional(_)).skip(optional(_)),
    members: Entity.sepBy(optional(_)).skip(key('}')),
  })).thru(sourced)
)

export const Program: Parser<Unlinked<ProgramNode>> = lazy(() =>
  key('program').then(node('Program')({
    name: Name,
    body: Body,
  })).thru(sourced)
)

export const Describe: Parser<Unlinked<DescribeNode>> = lazy(() =>
  key('describe').then(node('Describe')({
    name: String,
    members: Test.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const Test: Parser<Unlinked<TestNode>> = lazy(() =>
  key('test').then(node('Test')({
    name: String,
    body: Body,
  })).thru(sourced)
)

const MixinLinearization = lazy(() =>
  key('mixed with').then(Reference.sepBy1(key('and')))
)

export const Class: Parser<Unlinked<ClassNode>> = lazy(() =>
  key('class').then(node('Class')({
    name: Name,
    superclass: optional(key('inherits').then(Reference)),
    mixins: MixinLinearization.or(of([])),
    members: ClassMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const Singleton: Parser<Unlinked<SingletonNode>> = lazy(() => {
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
    ({ name, superCall, mixins }, members) => ({ kind: 'Singleton' as 'Singleton', name, superCall, mixins, members })
  )).thru(sourced)
})

export const Mixin: Parser<Unlinked<MixinNode>> = lazy(() =>
  key('mixin').then(node('Mixin')({
    name: Name,
    mixins: MixinLinearization.or(of([])),
    members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const ClassMember: Parser<Unlinked<ClassMemberNode>> = lazy(() => alt(Constructor, ObjectMember))

export const ObjectMember: Parser<Unlinked<ObjectMemberNode>> = lazy(() => alt(Method, Field))

export const Field: Parser<Unlinked<FieldNode>> = lazy(() =>
  node('Field')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name: Name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced)
)

export const Method: Parser<Unlinked<MethodNode>> = lazy(() => seqMap(
  key('override').result(true).or(of(false)),
  key('method').then(alt(Name, ...OPERATORS.map(key))),
  Parameters,
  alt(
    key('native').result({ isNative: true, body: undefined }),
    key('=').then(
      // TODO: Extract?
      node('Body')({ sentences: Sentence.times(1) }).thru(sourced).map(body => ({ isNative: false, body }))
    ),
    Body.map(body => ({ isNative: false, body })),
    of({ isNative: false, body: undefined })
  ),
  (isOverride, name, parameters, { isNative, body }) => ({ kind: 'Method' as 'Method', isOverride, name, parameters, isNative, body })
).thru(sourced))

export const Constructor: Parser<Unlinked<ConstructorNode>> = lazy(() =>
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

export const Sentence: Parser<Unlinked<SentenceNode>> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<Unlinked<VariableNode>> = lazy(() =>
  node('Variable')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name: Name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced)
)

export const Return: Parser<Unlinked<ReturnNode>> = lazy(() =>
  key('return').then(node('Return')({ value: Expression })).thru(sourced)
)

export const Assignment: Parser<Unlinked<AssignmentNode>> = lazy(() =>
  seqMap(
    Reference,
    alt(...ASSIGNATION_OPERATORS.map(key)),
    Expression,
    (reference, operator, value) => ({
      kind: 'Assignment' as 'Assignment',
      reference,
      value: operator === '='
        ? value
        : ({ kind: 'Send' as 'Send', receiver: reference, message: operator.slice(0, -1), args: [value] }),
    })
  ).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<Unlinked<ExpressionNode>> = lazy(() => Operation)

export const PrimaryExpression: Parser<Unlinked<ExpressionNode>> = lazy(() => alt(
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

export const Self: Parser<Unlinked<SelfNode>> = lazy(() =>
  key('self').then(node('Self')({})).thru(sourced)
)

export const Reference: Parser<Unlinked<ReferenceNode>> = lazy(() =>
  node('Reference')({
    name: Name,
  }).thru(sourced)
)

export const Super: Parser<Unlinked<SuperNode>> = lazy(() =>
  key('super').then(
    node('Super')({
      args: Arguments,
    })
  ).thru(sourced)
)

export const New: Parser<Unlinked<NewNode>> = lazy(() =>
  key('new').then(
    node('New')({
      className: Reference,
      args: Arguments,
    })
  ).thru(sourced)
)

export const If: Parser<Unlinked<IfNode>> = lazy(() =>
  key('if').then(
    node('If')({
      condition: Expression.wrap(key('('), key(')')),
      thenBody: alt(
        Body,
        node('Body')({ sentences: Sentence.times(1) }).thru(sourced)
      ),
      elseBody: key('else').then(alt(
        Body,
        node('Body')({ sentences: Sentence.times(1) }).thru(sourced)
      )).or(node('Body')({ sentences: of([]) }).thru(sourced)),
    })
  ).thru(sourced)
)

export const Throw: Parser<Unlinked<ThrowNode>> = lazy(() =>
  key('throw').then(
    node('Throw')({ arg: Expression })
  ).thru(sourced)
)

export const Try: Parser<Unlinked<TryNode>> = lazy(() =>
  key('try').then(node('Try')({
    body: alt(
      Body,
      node('Body')({ sentences: Sentence.times(1) }).thru(sourced)
    ),
    catches: Catch.many(),
    always: key('then always').then(
      alt(
        Body,
        node('Body')({ sentences: Sentence.times(1) }).thru(sourced)
      )
    ).or(node('Body')({ sentences: of([]) }).thru(sourced)),
  })).thru(sourced)
)

export const Catch: Parser<Unlinked<CatchNode>> = lazy(() =>
  key('catch').then(node('Catch')({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: alt(
      Body,
      node('Body')({ sentences: Sentence.times(1) }).thru(sourced),
    ),
  })).thru(sourced)
)

export const Send: Parser<Unlinked<SendNode>> = lazy(() =>
  seqMap(
    index,
    PrimaryExpression,
    seq(
      key('.').then(Name),
      alt(Arguments, node('Literal')({ value: Closure }).thru(sourced).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
      ({ kind: 'Send', receiver, message, args, source: { start, end } }) as Unlinked<SendNode>
      , initial) as Unlinked<SendNode>
  )
)

export const Operation: Parser<Unlinked<ExpressionNode>> = lazy(() => {
  const prefixOperation = seqMap(
    seq(index, alt(...PREFIX_OPERATORS.map(key))).many(),
    alt(Send, PrimaryExpression),
    index,
    (calls, initial, end) => calls.reduceRight<Unlinked<ExpressionNode>>((receiver, [start, message]) =>
      ({ kind: 'Send', receiver, message, args: [], source: { start, end } })
      , initial)
  )

  const infixOperation = (precedenceLevel: number): Parser<Unlinked<ExpressionNode>> => {
    const argument = precedenceLevel < INFIX_OPERATORS.length - 1
      ? infixOperation(precedenceLevel + 1)
      : prefixOperation

    return seqMap(
      index,
      argument,
      seq(alt(...INFIX_OPERATORS[precedenceLevel].map(key)), argument.times(1), index).many(),
      (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
        ({ kind: 'Send', receiver, message, args, source: { start, end } }) as Unlinked<SendNode>
        , initial)
    )
  }

  return infixOperation(0)
}
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<Unlinked<LiteralNode<LiteralValue>>> = lazy(() =>
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

const Closure: Parser<Unlinked<SingletonNode>> = lazy(() =>
  seqMap(
    Parameter.sepBy(key(',')).skip(key('=>')).or(of([])),
    Sentence.skip(optional(alt(key(';'), _))).many(),
    makeClosure
  ).wrap(key('{'), key('}'))
)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeClosure = (parameters: Unlinked<ParameterNode>[], sentences: Unlinked<SentenceNode>[]): Unlinked<SingletonNode> =>
  ({
    kind: 'Singleton',
    // TODO: change this to 'wollok.Closure' and make getNodeById resolve composed references
    superCall: { superclass: { kind: 'Reference', name: 'Closure' }, args: [] },
    mixins: [],
    name: undefined,
    members: [
      {
        kind: 'Method',
        name: 'apply', isOverride: false, isNative: false, parameters,
        body: { kind: 'Body', sentences },
      },
    ],
  })

const makeList = (args: Unlinked<ExpressionNode>[]) => ({
  kind: 'New',
  className: { kind: 'Reference', name: 'wollok.List' },
  args,
})

const makeSet = (args: Unlinked<ExpressionNode>[]) => ({
  kind: 'New',
  className: { kind: 'Reference', name: 'wollok.Set' },
  args,
})