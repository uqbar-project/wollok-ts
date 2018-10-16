// tslint:disable:no-shadowed-variable
// tslint:disable:variable-name
import { alt, index, lazy, notFollowedBy, of, Parser, regex, seq, seqMap, string, whitespace } from 'parsimmon'
import { concat } from 'ramda'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, Constructor as ConstructorNode, Expression as ExpressionNode, Field as FieldNode, If as IfNode, Import as ImportNode, Literal as LiteralNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name as NameType, New as NewNode, NodeKind, NodeOfKind, NodePayload, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Unlinked, Variable as VariableNode } from './model'

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
const optional = <T>(parser: Parser<T>) => parser.or(of(undefined))
const _ = comment.or(whitespace).many()
const key = (str: string) => string(str).trim(_)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Name: Parser<NameType> = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)

export const Parameter: Parser<Unlinked<ParameterNode>> = lazy(() => seqMap(
    Name,
    string('...').atMost(1).map(([s]) => !!s),
    (name, isVarArg) => ({ name, isVarArg }),
  ).trim(_).thru(makeNode('Parameter'))
)

export const Parameters: Parser<Unlinked<ParameterNode>[]> = lazy(() =>
  Parameter.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Arguments: Parser<Unlinked<ExpressionNode>[]> = lazy(() =>
  Expression.sepBy(key(',')).wrap(key('('), key(')'))
)

export const Body: Parser<Unlinked<BodyNode>> = lazy(() =>
    Sentence.skip(optional(key(';'))).many().wrap(key('{'), key('}'))
      .map(sentences => ({ sentences }))
      .thru(makeNode('Body'))
)

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ENTITIES
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Import: Parser<Unlinked<ImportNode>> = lazy(() =>
  key('import').then(seqMap(
    Name.sepBy1(key('.')).tieWith('.').trim(_).map(name => ({ name })).thru(makeNode('Reference')),
    key('.*').or(of(false)).skip(optional(key(';'))),
    (reference, isGeneric) => ({ reference, isGeneric: !!isGeneric })
  )).thru(makeNode('Import'))
)

export const File: Parser<Unlinked<PackageNode>> = lazy(() => seqMap(
    Import.many(),
    alt(Package, Class, Singleton, Mixin, Program, Test).many(),
    (imports, members) => ({ name: '', imports, members })
  ).thru(makeNode('Package'))
)

export const Package: Parser<Unlinked<PackageNode>> = lazy(() =>
  key('package').then(seqMap(
      Name,
      Import.many(),
      alt(Package, Class, Singleton, Mixin, Program, Test).many().wrap(key('{'), key('}')),
      (name, imports, members) => ({ name, imports, members })
  )).thru(makeNode('Package'))
)

export const Program: Parser<Unlinked<ProgramNode>> = lazy(() =>
  key('program').then(seqMap(
    Name,
    Body,
    (name, body) => ({ name, body })
  )).thru(makeNode('Program'))
)

export const Test: Parser<Unlinked<TestNode>> = lazy(() =>
  key('test').then(seqMap(
    String,
    Body,
    (name, body) => ({ name, body })
  )).thru(makeNode('Test'))
)

export const Class: Parser<Unlinked<ClassNode>> = lazy(() =>
  key('class').then(seqMap(
    Name,
    optional(key('inherits').then(Reference)),
    key('mixed with').then(Reference.sepBy1(key('and'))).or(of([])),
    alt(Constructor, Method, Field).sepBy(optional(key(';'))).wrap(key('{'), key('}')),
    (name, superclass, mixins, members) => ({ name, superclass, mixins, members })
  )).thru(makeNode('Class'))
)

export const Singleton: Parser<Unlinked<SingletonNode>> = lazy(() => {
    const SuperCall = key('inherits').then(seqMap(Reference, Arguments.or(of([])), (superclass, args) => ({ superclass, args })))
    const Mixins = key('mixed with').then(Reference.sepBy1(key('and')))

    return key('object').then(seqMap(
      alt(
        Mixins.map(mixins => ({ mixins, name: undefined })),
        seqMap(
          SuperCall,
          Mixins.or(of([])),
          (superCall, mixins) => ({ superCall, mixins })
        ),
        seqMap(
          notFollowedBy(key('inherits').or(key('mixed with'))).then(Name),
          optional(SuperCall),
          Mixins.or(of([])),
          (name, superCall, mixins) => ({ name, superCall, mixins })
        ),
        of({ mixins: [] }),
      ),
      alt(Method, Field).sepBy(optional(key(';'))).wrap(key('{'), key('}')),
      ({ name, superCall, mixins }, members) => ({ name, superCall, mixins, members })
    )).thru(makeNode('Singleton'))
})

export const Mixin: Parser<Unlinked<MixinNode>> = lazy(() =>
  key('mixin').then(seqMap(
    Name,
    key('mixed with').then(Reference.sepBy1(key('and'))).or(of([])),
    alt(Method, Field).sepBy(optional(key(';'))).wrap(key('{'), key('}')),
    (name, mixins, members) => ({ name, mixins, members })
  )).thru(makeNode('Mixin'))
)

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // MEMBERS
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field: Parser<Unlinked<FieldNode>> = lazy(() => seqMap(
    alt(key('var').result(false), key('const').result(true)),
    Name,
    optional(key('=').then(Expression)),
    (isReadOnly, name, value) => ({ isReadOnly, name, value })
  ).thru(makeNode('Field'))
)

export const Method: Parser<Unlinked<MethodNode>> = lazy(() => seqMap(
    key('override').result(true).or(of(false)),
    key('method').then(alt(Name, ...OPERATORS.map(key))),
    Parameters,
    alt(
      key('native').result({ isNative: true, body: undefined }),
      key('=').then(Expression.times(1))
        .map(sentences => ({ sentences }))
        .thru(makeNode('Body'))
        .map(body => ({ isNative: false, body })),
      Body.map(body => ({ isNative: false, body })),
      of({ isNative: false, body: undefined })
    ),
    (isOverride, name, parameters, { isNative, body }) => ({ isOverride, name, parameters, isNative, body })
  ).thru(makeNode('Method'))
)

export const Constructor: Parser<Unlinked<ConstructorNode>> = lazy(() =>
  key('constructor').then(seqMap(
    Parameters,
    optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      Arguments,
      (callsSuper, args) => ({ callsSuper, args }))
    )),
    Body,
    (parameters, baseCall, body) => ({ parameters, baseCall, body })
  )).thru(makeNode('Constructor'))
)

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // SENTENCES
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Sentence: Parser<Unlinked<SentenceNode>> = lazy(() => alt(Variable, Return, Assignment, Expression))


export const Variable: Parser<Unlinked<VariableNode>> = lazy(() => seqMap(
    alt(key('var').then(of(false)), key('const').then(of(true))),
    Name,
    optional(key('=').then(Expression)),
    (isReadOnly, name, value) => ({ isReadOnly, name, value })
  ).thru(makeNode('Variable'))
)

export const Return: Parser<Unlinked<ReturnNode>> = lazy(() =>
  key('return').then(Expression).map(value => ({ value })).thru(makeNode('Return'))
)

export const Assignment: Parser<Unlinked<AssignmentNode>> = lazy(() =>  seqMap(
    Reference,
    alt(...ASSIGNATION_OPERATORS.map(key)),
    Expression,
    (reference, operator, value) => ({
      reference,
      value: operator === '='
        ? value
        : ({kind: 'Send', receiver: reference, message: operator.slice(0, -1), args: [value] }) as Unlinked<SendNode>,
    })
  ).thru(makeNode('Assignment'))
)

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXPRESSIONS
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<Unlinked<ExpressionNode>> = lazy(() => Operation)

export const PrimaryExpression: Parser<Unlinked<ExpressionNode>> = lazy(() =>  alt(
    Self,
    Super,
    If,
    New,
    Throw,
    Try,
    Literal,
    Reference,
    Expression.wrap(key('('), key(')'))
  )
)

export const Self: Parser<Unlinked<SelfNode>> = lazy(() =>
  key('self').result({}).thru(makeNode('Self'))
)

export const Reference: Parser<Unlinked<ReferenceNode>> = lazy(() =>
  Name.map(name => ({ name })).thru(makeNode('Reference'))
)

export const Super: Parser<Unlinked<SuperNode>> = lazy(() =>
  key('super').then(Arguments).map(args => ({ args })).thru(makeNode('Super'))
)

export const New: Parser<Unlinked<NewNode>> = lazy(() =>
  key('new').then(seqMap(
    Reference,
    Arguments,
    (className, args) => ({ className, args })
  )).thru(makeNode('New'))
)

export const If: Parser<Unlinked<IfNode>> = lazy(() =>
  key('if').then(seqMap(
    Expression.wrap(key('('), key(')')),
    alt(
      Body,
      Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
    ).trim(_),
    key('else').then(alt(
      Body,
      Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
    )).or(of([]).map(sentences => ({ sentences })).thru(makeNode('Body'))),
    (condition, thenBody, elseBody) => ({ condition, thenBody, elseBody })
  )).thru(makeNode('If'))
)

export const Throw: Parser<Unlinked<ThrowNode>> = lazy(() =>
  key('throw').then(Expression).map(arg => ({ arg })).thru(makeNode('Throw'))
)

export const Try: Parser<Unlinked<TryNode>> = lazy(() =>
  key('try').then(seqMap(
      alt(
        Body,
        Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
      ).trim(_),
    Catch.many(),
    key('then always').then(
      alt(
        Body,
        Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
      ).trim(_)
    ).or(of([]).map(sentences => ({ sentences })).thru(makeNode('Body'))),
    (body, catches, always) => ({ body, catches, always })
  )).thru(makeNode('Try'))
)

export const Catch: Parser<Unlinked<CatchNode>> = lazy(() =>
  key('catch').then(seqMap(
    Parameter,
    optional(key(':').then(Reference)),
    alt(
      Body,
      Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
    ).trim(_),
    (parameter, parameterType, body) => ({ parameter, parameterType, body })
  )).thru(makeNode('Catch'))
)

export const Send: Parser<Unlinked<SendNode>> = lazy(() =>  seqMap(
    index,
    PrimaryExpression,
    seq(
      key('.').then(Name),
      alt(Arguments, Closure.map(value => ({ value })).thru(makeNode('Literal')).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
      ({kind: 'Send', receiver, message, args, source: { start, end } })as Unlinked<SendNode>
      , initial)as Unlinked<SendNode>
  )
)

export const Operation: Parser<Unlinked<ExpressionNode>> = lazy(() => {
    const prefixOperation = seqMap(
      seq(index, alt(...PREFIX_OPERATORS.map(key))).many(),
      alt(Send, PrimaryExpression),
      index,
      (calls, initial, end) => calls.reduceRight<Unlinked<ExpressionNode>>((receiver, [start, message]) =>
        ({kind: 'Send', receiver, message, args: [], source: { start, end } })
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
          ({kind: 'Send', receiver, message, args, source: { start, end } }) as Unlinked<SendNode>
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
  alt(
    key('null').result(null),
    key('true').result(true),
    key('false').result(false),
    regex(/-?\d+(\.\d+)?/).map(Number),
    Expression.sepBy(key(',')).wrap(key('['), key(']')).map(makeList),
    Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(makeSet),
    String,
    Closure,
    Singleton,
  ).map(value => ({ value })).thru(makeNode('Literal'))
)

const String: Parser<string> = alt(
    regex(/\\\\/).result('\\'),
    regex(/\\b/).result('\b'),
    regex(/\\t/).result('\t'),
    regex(/\\n/).result('\n'),
    regex(/\\f/).result('\f'),
    regex(/\\r/).result('\r'),
    regex(/\\"/).result('"'),
    regex(/[^\\"]/)
  ).many().tie().wrap(string('"'), string('"'))

const Closure: Parser<Unlinked<SingletonNode>> = lazy(() => seqMap(
    Parameter.sepBy(key(',')).skip(key('=>')).or(of([])),
    Sentence.skip(optional(key(';'))).many(),
    makeClosure
  ).wrap(key('{'), key('}'))
)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeNode = <K extends NodeKind, N extends NodeOfKind<K>>(kind: K) =>
  (parser: Parser<NodePayload<N>>): Parser<Unlinked<N>> => seqMap(
    index,
    parser,
    index,
    (start, payload, end) => ({kind, ...payload as any, source: { start, end } })
  )

const makeClosure = (parameters: Unlinked<ParameterNode>[], sentences: Unlinked<SentenceNode>[]): Unlinked<SingletonNode> =>
  ({
    kind: 'Singleton',
    superCall: { superclass: { kind: 'Reference', name: 'wollok.Closure' }, args: [] },
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