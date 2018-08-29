// tslint:disable:no-shadowed-variable
import { alt, createLanguage, index, of, optWhitespace as _, Parser, regex, seq, seqMap, string } from 'parsimmon'
import { Expression, LiteralValue, Name, node, NodeKind, NodeOfKind, NodePayload, Parameter, Send, Sentence, Singleton } from './model'

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
const ASSIGNATION_OPERATORS = ['=', '+=', '-=', '*=', '/=', '%=']
// const OPERATORS = INFIX_OPERATORS.reduce((all, ops) => [...all, ...ops], PREFIX_OPERATORS)

// type Parsers = { [K in NodeKind]: NodeOfKind<K> } & {
type Parsers = { [K in 'Literal' | 'Parameter' | 'Self' | 'Super' | 'New' | 'If' | 'Throw' |
  'Try' | 'Send' | 'Variable' | 'Return' | 'Assignment' | 'Reference']: NodeOfKind<K> } & {
  Expression: Expression
  Sentence: Sentence

  Name: Name
  Parameters: Parameter[]
  Arguments: Expression[]
  Block: Sentence[],
  Closure: Singleton,

  PrimaryExpression: Expression,
  Operation: Expression,
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const key = (str: string) => string(str).trim(_)

export default createLanguage<Parsers>({

  // TODO:
  Name: ({ Name }) => Name,

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // COMMON
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  // TODO:
  Reference: ({ Reference }) => Reference.trim(_),

  Parameter: ({ Name }) => seqMap(
    Name,
    string('...').atMost(1).map(([s]) => !!s),
    (name, isVarArg) => ({ name, isVarArg })
  ).thru(makeNode('Parameter')),

  Parameters: ({ Parameter }) => Parameter.sepBy(key(',')).wrap(key('('), key(')')),

  Arguments: ({ Expression }) => Expression.sepBy(key(',')).wrap(key('('), key(')')),

  Block: ({ Sentence }) => Sentence.skip(key(';').atMost(1)).many().wrap(key('{'), key('}')),

  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // SENTENCES
  // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  Sentence: ({ Variable, Return, Assignment, Expression }) => alt(Variable, Return, Assignment, Expression),

  Variable: ({ Name, Expression }) => seqMap(
    alt(key('var').then(of(false)), key('const').then(of(true))),
    Name,
    key('=').then(Expression).or(of(undefined)),
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
      key(':').then(Reference).or(of(undefined)),
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

  Literal: ({ Expression, Closure }) => alt<LiteralValue>(
    key('null').result(null),
    key('true').result(true),
    key('false').result(false),
    regex(/-?\d+(\.\d+)?/).map(Number),
    regex(/(\\b|\\t|\\n|\\f|\\r|\\u|\\"|\\\\|[^"\\])*/).wrap(string('"'), string('"')),
    Expression.sepBy(key(',')).wrap(key('['), key(']')).map(makeList),
    Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(makeSet),
    Closure,
  ).map(value => ({ value })).thru(makeNode('Literal')),


  Closure: ({ Parameters, Sentence }) => seqMap(
    Parameters.skip(key('=>')).or(of([])),
    Sentence.skip(key(';').or(of(''))).many(),
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
  superclass: node('Reference')({ name: 'wollok.Closure' }),
  superArgs: [],
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


// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // COMMON
// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// protected lazy val name: Parser[Name] = """\^?[a-zA-Z_][a-zA-Z0-9_]*""".r

// protected lazy val localReference: Parser[LocalReference] = name
// protected lazy val Reference: Parser[Reference] = name +~ "."


// private def block[T](content: Parser[T]): Parser[Seq[T]] = "{" ~> (content *~ ";".?) <~ "}"

// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // TOP LEVEL
// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// protected lazy val file: Parser[Package] = importStatement.* ~ packageMember.*
// protected lazy val importStatement: Parser[Import] = "import" ~> Reference ~ ".*".??
// private lazy val packageMember: Parser[Member[Package]] = packageDef | singletonDef(true) | classDef | mixinDef | programDef | testDef

// protected lazy val programDef: Parser[Program] = "program" ~> name ~ block(sentence)
// protected lazy val testDef: Parser[Test] = "test" ~> stringLiteral ~ block(sentence)
// protected lazy val packageDef: Parser[Package] = "package" ~> name ~ ("{" ~> packageMember.* <~ "}")
// classDef: Parser[Class] = "class" ~> name ~ ("inherits" ~> Reference).? ~ mixinInclusion.?* ~ block(classMember)
// protected lazy val mixinDef: Parser[Mixin] = "mixin" ~> name ~ block(moduleMember)
// singletonDef(named: Boolean) = "object" ~> (if (named) name else "") ~
//    ("inherits" ~> Reference ~ arguments.?*).? ~ mixinInclusion.?* ~ block(moduleMember)

// mixinInclusion: Parser[Seq[Reference]] = "mixed with" ~> (Reference +~ ("and" | ",")) ^^ { _.reverse }

// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // MODULE MEMBERS
// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// private lazy val classMember: Parser[Member[Class]] = constructor | moduleMember
// private lazy val moduleMember: Parser[Member[Module]] = field | method

// constructor: Parser[Constructor] = "constructor" ~> parameters ~ ("=" ~> ("self" | "super") ~ arguments).? ~ block(sentence).?
// protected lazy val field: Parser[Field] = ("var" | "const") ~ name ~ ("=" ~> expression).?
// protected lazy val method: Parser[Method] = ("override".?? <~ "method") ~ (name | operator) ~ parameters ~ methodBody

// methodBody: Parser[(Boolean, Option[Seq[Sentence]])] = "native" ^^^ (true, None)
//   | (block(sentence) | "=" ~> expression.*#(1)).? ^^ { false -> _ }