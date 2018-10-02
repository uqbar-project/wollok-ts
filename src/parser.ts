// tslint:disable:no-shadowed-variable
// tslint:disable:variable-name
import { alt, createLanguage, index, notFollowedBy, of, Parser, regex, seq, seqMap, string, whitespace } from 'parsimmon'
import { concat } from 'ramda'
import { Body, Entity, Expression, LiteralValue, makeNode as node, Name, NodeKind, NodeOfKind, NodePayload, Package, Parameter, Reference, Send, Sentence, Singleton } from './model'

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

type Parsers = { [K in NodeKind]: NodeOfKind<K> } & {
  File: Package

  Name: Name
  Arguments: Expression[]
  Parameters: Parameter[]
  Expression: Expression
  Sentence: Sentence
  PrimaryExpression: Expression
  Operation: Expression
  Closure: Singleton
  String: string
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const comment = regex(/\/\*(.|[\r\n])*?\*\//).or(regex(/\/\/.*/))
const optional = <T>(parser: Parser<T>) => parser.or(of(undefined))
const _ = comment.or(whitespace).many()
const key = (str: string) => string(str).trim(_)

export default createLanguage<Parsers>({

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // COMMON
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Name: () => regex(/[a-zA-Z_][a-zA-Z0-9_]*/),

  Parameter: ({ Name }) => seqMap(
    Name,
    string('...').atMost(1).map(([s]) => !!s),
    (name, isVarArg) => ({ name, isVarArg })
  ).trim(_).thru(makeNode('Parameter')),

  Parameters: ({ Parameter }) => Parameter.sepBy(key(',')).wrap(key('('), key(')')),

  Arguments: ({ Expression }) => Expression.sepBy(key(',')).wrap(key('('), key(')')),

  Body: ({ Sentence }) =>
    Sentence.skip(optional(key(';'))).many().wrap(key('{'), key('}'))
      .map(sentences => ({ sentences }))
      .thru(makeNode('Body')),

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ENTITIES
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Import: ({ Name }) => seqMap(
    key('import').then(Name.sepBy1(key('.')).tieWith('.').trim(_).map(name => ({ name })).thru(makeNode('Reference'))),
    key('.*').or(of(false)).skip(optional(key(';'))),
    (reference, isGeneric) => ({ reference, isGeneric: !!isGeneric })
  ).thru(makeNode('Import')),


  File: ({ Package, Class, Singleton, Mixin, Program, Test, Import }) => seqMap(
    Import.many(),
    alt<Entity>(Package, Class, Singleton, Mixin, Program, Test).many(),
    (imports, members) => ({ name: '', imports, members })
  ).thru(makeNode('Package')),


  Package: ({ Name, Package, Class, Singleton, Mixin, Program, Test, Import }) => seqMap(
    key('package').then(Name),
    Import.many(),
    alt<Entity>(Package, Class, Singleton, Mixin, Program, Test).many().wrap(key('{'), key('}')),
    (name, imports, members) => ({ name, imports, members })
  ).thru(makeNode('Package')),


  Program: ({ Name, Body }) => seqMap(
    key('program').then(Name),
    Body,
    (name, body) => ({ name, body })
  ).thru(makeNode('Program')),


  Test: ({ String, Body }) => seqMap(
    key('test').then(String),
    Body,
    (name, body) => ({ name, body })
  ).thru(makeNode('Test')),


  Class: ({ Name, Reference, Method, Field, Constructor }) => seqMap(
    key('class').then(Name),
    optional(key('inherits').then(Reference)),
    key('mixed with').then(Reference.sepBy1(key('and'))).or(of([])),
    alt(Constructor, Method, Field).sepBy(optional(key(';'))).wrap(key('{'), key('}')),
    (name, superclass, mixins, members) => ({ name, superclass, mixins, members })
  ).thru(makeNode('Class')),


  Singleton: ({ Name, Reference, Method, Field, Arguments }) => {
    const SuperCall = key('inherits').then(seqMap(Reference, Arguments.or(of([])), (superclass, args) => ({ superclass, args })))
    const Mixins = key('mixed with').then(Reference.sepBy1(key('and')))

    return key('object').then(seqMap(
      alt<{ name?: Name, mixins: ReadonlyArray<Reference>, superCall?: { superclass: Reference; args: Expression[] } }>(
        Mixins.map(mixins => ({ mixins })),
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
  },


  Mixin: ({ Name, Reference, Method, Field }) => seqMap(
    key('mixin').then(Name),
    key('mixed with').then(Reference.sepBy1(key('and'))).or(of([])),
    alt(Method, Field).sepBy(optional(key(';'))).wrap(key('{'), key('}')),
    (name, mixins, members) => ({ name, mixins, members })
  ).thru(makeNode('Mixin')),

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // MEMBERS
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Field: ({ Expression, Name }) => seqMap(
    alt(key('var').result(false), key('const').result(true)),
    Name,
    optional(key('=').then(Expression)),
    (isReadOnly, name, value) => ({ isReadOnly, name, value })
  ).thru(makeNode('Field')),


  Method: ({ Name, Parameters, Expression, Body }) => seqMap(
    key('override').result(true).or(of(false)),
    key('method').then(alt(Name, ...OPERATORS.map(key))),
    Parameters,
    alt<{ isNative: boolean, body?: Body }>(
      key('native').result({ isNative: true, body: undefined }),
      key('=').then(Expression.times(1)).map(sentences => ({ sentences })).thru(makeNode('Body')).map(body => ({ isNative: false, body })),
      Body.map(body => ({ isNative: false, body })),
      of({ isNative: false, body: undefined })
    ),
    (isOverride, name, parameters, { isNative, body }) => ({ isOverride, name, parameters, isNative, body })
  ).thru(makeNode('Method')),


  Constructor: ({ Parameters, Arguments, Body }) => seqMap(
    key('constructor').then(Parameters),
    optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      Arguments,
      (callsSuper, args) => ({ callsSuper, args }))
    )),
    Body,
    (parameters, baseCall, body) => ({ parameters, baseCall, body })
  ).thru(makeNode('Constructor')),

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // SENTENCES
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Sentence: ({ Variable, Return, Assignment, Expression }) => alt(Variable, Return, Assignment, Expression),


  Variable: ({ Name, Expression }) => seqMap(
    alt(key('var').then(of(false)), key('const').then(of(true))),
    Name,
    optional(key('=').then(Expression)),
    (isReadOnly, name, value) => ({ isReadOnly, name, value })
  ).thru(makeNode('Variable')),


  Return: ({ Expression }) => key('return').then(Expression).map(value => ({ value })).thru(makeNode('Return')),


  Assignment: ({ Reference, Expression }) => seqMap(
    Reference,
    alt(...ASSIGNATION_OPERATORS.map(key)),
    Expression,
    (reference, operator, value) => ({
      reference,
      value: operator === '=' ? value : node('Send')({ receiver: reference, message: operator.slice(0, -1), args: [value] }),
    })
  ).thru(makeNode('Assignment')),

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // EXPRESSIONS
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Expression: ({ Operation }) => Operation,


  PrimaryExpression: ({ Self, Super, New, If, Throw, Try, Literal, Reference, Expression }) => alt(
    Self,
    Super,
    If,
    New,
    Throw,
    Try,
    Literal,
    Reference,
    Expression.wrap(key('('), key(')'))
  ),


  Self: () => key('self').result({}).thru(makeNode('Self')),


  Reference: ({ Name }) => Name.map(name => ({ name })).thru(makeNode('Reference')),


  Super: ({ Arguments }) => key('super').then(Arguments).map(args => ({ args })).thru(makeNode('Super')),


  New: ({ Arguments, Reference }) => seqMap(
    key('new').then(Reference),
    Arguments,
    (className, args) => ({ className, args })
  ).thru(makeNode('New')),


  If: ({ Expression, Body, Sentence }) => seqMap(
    key('if').then(Expression.wrap(key('('), key(')'))),
    alt<Body>(
      Body,
      Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
    ).trim(_),
    key('else').then(alt<Body>(
      Body,
      Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
    )).or(of<Sentence[]>([]).map(sentences => ({ sentences })).thru(makeNode('Body'))),
    (condition, thenBody, elseBody) => ({ condition, thenBody, elseBody })
  ).thru(makeNode('If')),


  Throw: ({ Expression }) => key('throw').then(Expression).map(arg => ({ arg })).thru(makeNode('Throw')),


  Try: ({ Sentence, Body, Catch }) => seqMap(
    key('try').then(
      alt<Body>(
        Body,
        Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
      ).trim(_)
    ),
    Catch.many(),
    key('then always').then(
      alt<Body>(
        Body,
        Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
      ).trim(_)
    ).or(of<Sentence[]>([]).map(sentences => ({ sentences })).thru(makeNode('Body'))),
    (body, catches, always) => ({ body, catches, always })
  ).thru(makeNode('Try')),

  Catch: ({ Parameter, Reference, Body, Sentence }) => seqMap(
    key('catch').then(Parameter),
    optional(key(':').then(Reference)),
    alt<Body>(
      Body,
      Sentence.times(1).map(sentences => ({ sentences })).thru(makeNode('Body'))
    ).trim(_),
    (parameter, parameterType, body) => ({ parameter, parameterType, body })
  ).thru(makeNode('Catch')),

  Send: ({ Name, PrimaryExpression, Arguments, Closure }) => seqMap(
    index,
    PrimaryExpression,
    seq(
      key('.').then(Name),
      alt(Arguments, Closure.map(value => ({ value })).thru(makeNode('Literal')).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
      node('Send')({ receiver, message, args, source: { start, end } })
      , initial) as Send
  ),


  Operation: ({ Send, PrimaryExpression }) => {
    const prefixOperation = seqMap(
      seq(index, alt(...PREFIX_OPERATORS.map(key))).many(),
      alt(Send, PrimaryExpression),
      index,
      (calls, initial, end) => calls.reduceRight<Expression>((receiver, [start, message]) =>
        node('Send')({ receiver, message, args: [], source: { start, end } })
        , initial)
    )

    const infixOperation = (precedenceLevel: number): Parser<Expression> => {
      const argument = precedenceLevel < INFIX_OPERATORS.length - 1
        ? infixOperation(precedenceLevel + 1)
        : prefixOperation

      return seqMap(
        index,
        argument,
        seq(alt(...INFIX_OPERATORS[precedenceLevel].map(key)), argument.times(1), index).many(),
        (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
          node('Send')({ receiver, message, args, source: { start, end } })
          , initial) as Send
      )
    }

    return infixOperation(0)
  },


  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // LITERALS
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Literal: ({ Expression, String, Closure, Singleton }) => alt<LiteralValue>(
    key('null').result(null),
    key('true').result(true),
    key('false').result(false),
    regex(/-?\d+(\.\d+)?/).map(Number),
    Expression.sepBy(key(',')).wrap(key('['), key(']')).map(makeList),
    Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(makeSet),
    String,
    Closure,
    Singleton,
  ).map(value => ({ value })).thru(makeNode('Literal')),


  String: () => alt(
    regex(/\\\\/).result('\\'),
    regex(/\\b/).result('\b'),
    regex(/\\t/).result('\t'),
    regex(/\\n/).result('\n'),
    regex(/\\f/).result('\f'),
    regex(/\\r/).result('\r'),
    regex(/\\"/).result('"'),
    regex(/[^\\"]/)
  ).many().tie().wrap(string('"'), string('"')),


  Closure: ({ Parameter, Sentence }) => seqMap(
    Parameter.sepBy(key(',')).skip(key('=>')).or(of([])),
    Sentence.skip(optional(key(';'))).many(),
    makeClosure
  ).wrap(key('{'), key('}')),

})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeNode = <K extends NodeKind, N extends NodeOfKind<K>>(kind: K) => (parser: Parser<NodePayload<N>>): Parser<N> => seqMap(
  index,
  parser,
  index,
  (start, payload, end) => node<K, N>(kind)({ ...payload as any, source: { start, end } })
)

const makeClosure = (parameters: Parameter[], sentences: Sentence[]) => node('Singleton')({
  superCall: { superclass: node('Reference')({ name: 'wollok.Closure' }), args: [] },
  mixins: [],
  members: [
    node('Method')({ name: 'apply', isOverride: false, isNative: false, parameters, body: node('Body')({ sentences }) }),
  ],
})

const makeList = (args: Expression[]) => node('New')({
  className: node('Reference')({ name: 'wollok.List' }),
  args,
})

const makeSet = (args: Expression[]) => node('New')({
  className: node('Reference')({ name: 'wollok.Set' }),
  args,
})