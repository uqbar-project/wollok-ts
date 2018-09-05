// tslint:disable:no-shadowed-variable
// tslint:disable:variable-name
import { alt, createLanguage, index, of, optWhitespace as _, Parser, regex, seq, seqMap, string } from 'parsimmon'
import { Constructor, Entity, Expression, Field, LiteralValue, Method, Name, node, NodeKind, NodeOfKind, NodePayload, Package, Parameter, Send, Sentence, Singleton } from './model'

const ASSIGNATION_OPERATORS = ['=', '+=', '-=', '*=', '/=', '%=']
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
const OPERATORS = INFIX_OPERATORS.reduce((all, ops) => [...all, ...ops], PREFIX_OPERATORS)

type Parsers = { [K in NodeKind]: NodeOfKind<K> } & {
  File: Package

  Name: Name
  Block: Sentence[]
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

const key = (str: string) => string(str).trim(_)
const optional = <T>(parser: Parser<T>) => parser.or(of(undefined))

export default createLanguage<Parsers>({

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // COMMON
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Name: () => regex(/[a-zA-Z_][a-zA-Z0-9_]*/),

  Parameter: ({ Name }) => seqMap(
    Name,
    string('...').atMost(1).map(([s]) => !!s),
    (name, isVarArg) => ({ name, isVarArg })
  ).thru(makeNode('Parameter')),

  Parameters: ({ Parameter }) => Parameter.sepBy(key(',')).wrap(key('('), key(')')),

  Arguments: ({ Expression }) => Expression.sepBy(key(',')).wrap(key('('), key(')')),

  Block: ({ Sentence }) => Sentence.skip(key(';').atMost(1)).many().wrap(key('{'), key('}')),

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ENTITIES
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Import: ({ Reference }) => seqMap(
    key('import').then(Reference),
    key('.*').or(of(false)).skip(key(';').atMost(1)),
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


  Program: ({ Name, Sentence }) => seqMap(
    key('program').then(Name),
    Sentence.many().wrap(key('{'), key('}')),
    (name, body) => ({ name, body })
  ).thru(makeNode('Program')),


  Test: ({ String, Sentence }) => seqMap(
    key('test').then(String),
    Sentence.many().wrap(key('{'), key('}')),
    (description, body) => ({ description, body })
  ).thru(makeNode('Test')),


  Class: ({ Name, Reference, Method, Field, Constructor }) => seqMap(
    key('class').then(Name),
    optional(key('inherits').then(Reference)),
    key('mixed with').then(Reference.sepBy(key('and'))),
    alt<Method | Field | Constructor>(Method, Field, Constructor).many().wrap(key('{'), key('}')),
    (name, superclass, mixins, members) => ({ name, superclass, mixins, members })
  ).thru(makeNode('Class')),


  Singleton: ({ Name, Reference, Method, Field, Arguments }) => seqMap(
    key('object').then(optional(Name)),
    optional(key('inherits').then(seqMap(Reference, Arguments.or(of([])), (reference, args) => ({ reference, args })))),
    key('mixed with').then(Reference.sepBy(key('and'))),
    alt<Method | Field>(Method, Field).many().wrap(key('{'), key('}')),
    (name, superclass, mixins, members) => ({ name, superclass, mixins, members })
  ).thru(makeNode('Singleton')),


  Mixin: ({ Name, Reference, Method, Field }) => seqMap(
    key('mixin').then(Name),
    key('mixed with').then(Reference.sepBy(key('and'))),
    alt<Method | Field>(Method, Field).many().wrap(key('{'), key('}')),
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


  Method: ({ Name, Parameters, Expression, Block }) => seqMap(
    key('override').result(true).or(of(false)),
    key('method').then(alt(Name, ...OPERATORS.map(key))),
    Parameters,
    alt(
      key('native').result({ isNative: true, body: undefined }),
      key('=').then(Expression.times(1)).map(body => ({ isNative: false, body })),
      Block.map(body => ({ isNative: false, body })),
    ),
    (isOverride, name, parameters, { isNative, body }) => ({ isOverride, name, parameters, isNative, body })
  ).thru(makeNode('Method')),


  Constructor: ({ Parameters, Arguments, Block }) => seqMap(
    key('constructor').then(Parameters),
    optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      Arguments,
      (callsSuper, args) => ({ callsSuper, args }))
    )),
    Block,
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
      value: operator === '=' ? value : node('Send')({ receiver: reference, message: operator.slice(1), args: [value] }),
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


  Reference: ({ Name }) => Name.sepBy(key('.')).tieWith('.').map(name => ({ name })).thru(makeNode('Reference')),


  Super: ({ Arguments }) => key('super').then(Arguments).map(args => ({ args })).thru(makeNode('Super')),


  New: ({ Arguments, Reference }) => seqMap(
    key('new').then(Reference),
    Arguments,
    (className, args) => ({ className, args })
  ).thru(makeNode('New')),


  If: ({ Expression, Block, Sentence }) => seqMap(
    key('if').then(Expression.wrap(key('('), key(')'))),
    alt(Sentence.times(1), Block).trim(_),
    key('else').then(alt(Sentence.times(1), Block)).or(of<Sentence[]>([])),
    (condition, thenBody, elseBody) => ({ condition, thenBody, elseBody })
  ).thru(makeNode('If')),


  Throw: ({ Expression }) => key('throw').then(Expression).map(arg => ({ arg })).thru(makeNode('Throw')),


  Try: ({ Sentence, Block, Parameter, Reference }) => seqMap(
    key('try').then(alt(Sentence.times(1), Block)),
    seqMap(
      key('catch').then(Parameter),
      optional(key(':').then(Reference)),
      alt(Sentence.times(1), Block),
      (parameter, parameterType, body) => ({ parameter, parameterType, body })
    ).many(),
    key('then always').then(alt(Sentence.times(1), Block)).or(of([])),
    (body, catches, always) => ({ body, catches, always })
  ).thru(makeNode('Try')),


  Send: ({ Name, PrimaryExpression, Arguments, Closure }) => seqMap(
    index,
    PrimaryExpression,
    key('.').then(seq(Name, alt(Arguments, Closure.times(1)), index)).atLeast(1),
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


  String: () => regex(/(\\b|\\t|\\n|\\f|\\r|\\u|\\"|\\\\|[^"\\])*/).wrap(string('"'), string('"')),


  Closure: ({ Parameter, Sentence }) => seqMap(
    Parameter.sepBy(key(',')).skip(key('=>')).or(of([])),
    Sentence.skip(key(';').atMost(1)).many(),
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

const makeClosure = (parameters: Parameter[], body: Sentence[]) => node('Singleton')({
  name: '',
  superCall: { superclass: node('Reference')({ name: 'wollok.Closure' }), args: [] },
  mixins: [],
  members: [
    node('Method')({ name: 'apply', isOverride: false, isNative: false, parameters, body }),
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