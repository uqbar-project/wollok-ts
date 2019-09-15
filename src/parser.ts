import Parsimmon, { alt, index, lazy, makeSuccess, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { Raw as RawBehavior } from './behavior'
import { Assignment as buildAssignment, Body as buildBody, Closure as buildClosure, ListOf, Literal as buildLiteral, Method as buildMethod, Return as buildReturn, Send as buildSend, SetOf, Singleton as buildSingleton } from './builders'
import { last } from './extensions'
import { Assignment, Body, Catch, Class, ClassMember, Constructor, Describe, DescribeMember, Entity, Expression, Field, Fixture, If, Import, Kind, List, Literal, Method, Mixin, Name, NamedArgument, New, NodeOfKind, ObjectMember, Package, Parameter, Program, Raw, Reference, Return, Self, Send, Sentence, Singleton, Source, Super, Test, Throw, Try, Variable } from './model'

const { keys } = Object


type Methods<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T]
type Optionals<T> = { [K in keyof T]: undefined extends T[K] ? K : never }[keyof T]


const ASSIGNATION_OPERATORS = ['=', '+=', '-=', '*=', '/=', '%=', '||=', '&&=']
const PREFIX_OPERATORS = ['!', '-', '+']
const LAZY_OPERATORS = ['||', '&&']
const INFIX_OPERATORS = [
  ['||'],
  ['&&'],
  ['===', '!==', '==', '!='],
  ['>=', '<=', '>', '<'],
  ['..<', '>..', '..', '->', '>>>', '>>', '<<<', '<<', '<=>', '<>', '?:'],
  ['**'], // TODO: remove this line
  ['+', '-'],
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
const optional = <T>(parser: Parser<T>): Parser<T | undefined> => parser.fallback(undefined)
const maybeString = (str: string) => string(str).atMost(1).map(([head]) => !!head)

const node = <
  K extends Kind,
  N extends NodeOfKind<K, Raw> = NodeOfKind<K, Raw>,
  // TODO: Don't list fields like 'id', instead exclude all | undefined entries
  P extends { [F in keyof N]: Parser<N[F]> } = { [F in keyof N]: Parser<N[F]> },
  M extends Omit<P, 'kind' | Optionals<N> | Methods<N>> = Omit<P, 'kind' | Optionals<N> | Methods<N>>,
  O extends Partial<Pick<P, Optionals<N>>> = Partial<Pick<P, Optionals<N>>>,
  C extends M & O = M & O,
  >(kind: K) => (fieldParserSeq: C): Parser<N> => {
    const subparsers = keys(fieldParserSeq).map(fieldName => [fieldName, fieldParserSeq[fieldName as keyof C]] as any)
    return (subparsers.length ? seqObj<P>(...subparsers) : of({}))
      .map(payload => ({ kind, ...payload as any }))
      .map(data => RawBehavior<N>(data))
  }

const sourced = <T>(parser: Parser<T>): Parser<T & { source: Source }> => seq(
  optional(_).then(index),
  parser,
  index
).map(([start, payload, end]) => ({ ...payload as any, source: { start, end, ...SOURCE_FILE ? { file: SOURCE_FILE } : {} } }))

export const file = (fileName: string): Parser<Package<Raw>> => {
  SOURCE_FILE = fileName
  return lazy(() =>
    node('Package')({
      name: of(fileName.split('.')[0]),
      imports: importEntity.sepBy(optional(_)).skip(optional(_)),
      members: entity.sepBy(optional(_)),
    }).thru(sourced).skip(optional(_))
  )
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const name: Parser<Name> = regex(/[a-zA-Z_][a-zA-Z0-9_]*/)

export const reference: Parser<Reference<Raw>> = lazy(() =>
  node('Reference')({
    name,
  }).thru(sourced)
)

export const parameter: Parser<Parameter<Raw>> = lazy(() =>
  node('Parameter')({
    name,
    isVarArg: maybeString('...'),
  }).thru(sourced)
)

export const parameters: Parser<List<Parameter<Raw>>> = lazy(() =>
  parameter.sepBy(key(',')).wrap(key('('), key(')'))
)

export const unamedArguments: Parser<List<Expression<Raw>>> = lazy(() =>
  expression.sepBy(key(',')).wrap(key('('), key(')'))
)

export const namedArguments: Parser<List<NamedArgument<Raw>>> = lazy(() =>
  node('NamedArgument')({
    name,
    value: key('=').then(expression),
  }).thru(sourced).sepBy(key(',')).wrap(key('('), key(')'))
)

export const body: Parser<Body<Raw>> = lazy(() =>
  node('Body')({
    sentences: sentence.skip(optional(alt(key(';'), _))).many(),
  }).wrap(key('{'), string('}')).thru(sourced)
)

export const singleExpressionBody: Parser<Body<Raw>> = lazy(() =>
  node('Body')({
    sentences: sentence.times(1),
  }).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const entity: Parser<Entity<Raw>> = lazy(() => alt(
  packageEntity,
  classEntity,
  singletonEntity,
  mixinEntity,
  programEntity,
  describeEntity,
  testEntity
))

export const importEntity: Parser<Import<Raw>> = lazy(() =>
  key('import').then(node('Import')({
    entity: node('Reference')({
      name: name.sepBy1(key('.')).tieWith('.'),
    }).thru(sourced),
    isGeneric: maybeString('.*'),
  })).thru(sourced).skip(optional(alt(key(';'), _)))
)

export const packageEntity: Parser<Package<Raw>> = lazy(() =>
  key('package').then(node('Package')({
    name: name.skip(key('{')),
    imports: importEntity.sepBy(optional(_)).skip(optional(_)),
    members: entity.sepBy(optional(_)).skip(key('}')),
  })).thru(sourced)
)

export const programEntity: Parser<Program<Raw>> = lazy(() =>
  key('program').then(node('Program')({
    name,
    body,
  })).thru(sourced)
)

export const describeEntity: Parser<Describe<Raw>> = lazy(() =>
  key('describe').then(node('Describe')({
    name: stringLiteral,
    members: describeMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const fixtureEntity: Parser<Fixture<Raw>> = lazy(() =>
  key('fixture').then(node('Fixture')({
    body,
  })).thru(sourced)
)

export const testEntity: Parser<Test<Raw>> = lazy(() =>
  key('test').then(node('Test')({
    name: stringLiteral,
    body,
  })).thru(sourced)
)

const mixinLinearization = lazy(() =>
  key('mixed with').then(reference.sepBy1(key('and'))).map(mixins => mixins.reverse())
)

export const classEntity: Parser<Class<Raw>> = lazy(() =>
  key('class').then(node('Class')({
    name,
    superclass: optional(key('inherits').then(reference)),
    mixins: mixinLinearization.fallback([]),
    members: classMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

export const singletonEntity: Parser<Singleton<Raw>> = lazy(() => {
  const superCall = key('inherits').then(seqMap(
    reference,
    alt(unamedArguments, namedArguments, of([])),
    (superclass, args) => ({ superclass, args }))
  )

  return key('object').then(seqMap(
    alt(
      seqMap(
        superCall,
        mixinLinearization.fallback([]),
        (call, mixins) => ({ superCall: call, mixins })
      ),

      mixinLinearization.map(mixins => ({ mixins, singletonName: undefined })),

      seqMap(
        notFollowedBy(key('inherits').or(key('mixed with'))).then(name),
        optional(superCall),
        mixinLinearization.fallback([]),
        (singletonName, call, mixins) => ({ singletonName, superCall: call, mixins })
      ),

      of({ mixins: [] }),
    ),

    objectMember.sepBy(optional(_)).wrap(key('{'), key('}')),

    ({ singletonName, superCall: call, mixins }, members) =>
      buildSingleton(singletonName, { superCall: call, mixins })(...members)
  )).thru(sourced)
})

export const mixinEntity: Parser<Mixin<Raw>> = lazy(() =>
  key('mixin').then(node('Mixin')({
    name,
    mixins: mixinLinearization.fallback([]),
    members: alt(method, field).sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const describeMember: Parser<DescribeMember<Raw>> = lazy(() => alt(variableSentence, fixtureEntity, testEntity, method))

export const classMember: Parser<ClassMember<Raw>> = lazy(() => alt(constructor, objectMember))

export const objectMember: Parser<ObjectMember<Raw>> = lazy(() => alt(method, field))

export const field: Parser<Field<Raw>> = lazy(() =>
  node('Field')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    isProperty: optional(key('property')).map(val => !!val),
    name,
    value: optional(key('=').then(expression)),
  }).thru(sourced)
)

export const method: Parser<Method<Raw>> = lazy(() => seqMap(
  key('override').result(true).fallback(false),
  key('method').then(alt(name, ...OPERATORS.map(key))),
  parameters,
  alt(
    key('=').then(
      expression.map(value => ({
        isNative: false, body: { ...buildBody(buildReturn(value)), source: value.source },
      }))
    ),
    key('native').result({ isNative: true, body: undefined }),
    body.map(methodBody => ({ isNative: false, body: methodBody })),
    of({ isNative: false, body: undefined })
  ),
  (isOverride, methodName, methodParameters, { isNative, body: methodBody }) =>
    buildMethod(methodName, { isOverride, parameters: methodParameters, isNative, body: methodBody })()
).thru(sourced))

export const constructor: Parser<Constructor<Raw>> = lazy(() =>
  key('constructor').then(node('Constructor')({
    parameters,
    baseCall: optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      unamedArguments,
      (callsSuper, args) => ({ callsSuper, args }))
    )),
    body: body.or(node('Body')({ sentences: of([]) })),
  })).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const sentence: Parser<Sentence<Raw>> = lazy(() => alt(variableSentence, returnSentence, assignmentSentence, expression))

export const variableSentence: Parser<Variable<Raw>> = lazy(() =>
  node('Variable')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name,
    value: optional(key('=').then(expression)),
  }).thru(sourced)
)

export const returnSentence: Parser<Return<Raw>> = lazy(() =>
  key('return').then(node('Return')({
    value: optional(expression),
  })).thru(sourced)
)

export const assignmentSentence: Parser<Assignment<Raw>> = lazy(() =>
  seqMap(
    reference,
    alt(...ASSIGNATION_OPERATORS.map(key)),
    expression,
    (variable, operator, value) => buildAssignment(
      variable,
      operator === '='
        ? value
        : buildSend(
          variable,
          operator.slice(0, -1),
          LAZY_OPERATORS.includes(operator.slice(0, -1)) ? [makeClosure([], [value])] : [value]
        ),
    )
  ).thru(sourced)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const expression: Parser<Expression<Raw>> = lazy(() => operation)

export const primaryExpression: Parser<Expression<Raw>> = lazy(() => alt(
  selfExpression,
  superExpression,
  ifExpression,
  newExpression,
  throwExpression,
  tryExpression,
  literal,
  reference,
  expression.wrap(key('('), key(')'))
))

export const selfExpression: Parser<Self<Raw>> = lazy(() =>
  key('self').then(node('Self')({})).thru(sourced)
)

export const superExpression: Parser<Super<Raw>> = lazy(() =>
  key('super').then(
    node('Super')({
      args: unamedArguments,
    })
  ).thru(sourced)
)

export const newExpression: Parser<New<Raw> | Literal<Raw, Singleton<Raw>>> = lazy(() =>
  alt(
    key('new').then(
      seqMap(
        reference,
        alt(unamedArguments, namedArguments),
        // TODO: Convince the world we need a single linearization syntax
        (key('with').then(reference)).atLeast(1).map(mixins => [...mixins].reverse()),
        (superclass, args, mixins) => buildLiteral(buildSingleton(undefined, {
          superCall: { superclass, args },
          mixins,
        })())
      )
    ),

    key('new').then(
      node('New')({
        instantiated: reference,
        args: alt(unamedArguments, namedArguments),
      })
    ).thru(sourced),
  )
)

export const ifExpression: Parser<If<Raw>> = lazy(() =>
  key('if').then(
    node('If')({
      condition: expression.wrap(key('('), key(')')),
      thenBody: alt(body, singleExpressionBody),
      elseBody: optional(key('else').then(alt(body, singleExpressionBody))),
    })
  ).thru(sourced)
)

export const throwExpression: Parser<Throw<Raw>> = lazy(() =>
  key('throw').then(
    node('Throw')({ exception: expression })
  ).thru(sourced)
)

export const tryExpression: Parser<Try<Raw>> = lazy(() =>
  key('try').then(node('Try')({
    body: alt(body, singleExpressionBody),
    catches: catchClause.many(),
    always: optional(key('then always').then(alt(body, singleExpressionBody))),
  })).thru(sourced)
)

export const catchClause: Parser<Catch<Raw>> = lazy(() =>
  key('catch').then(node('Catch')({
    parameter,
    parameterType: optional(key(':').then(reference)),
    body: alt(body, singleExpressionBody),
  })).thru(sourced)
)

// TODO: change type to Parser<Expression<Raw>>
export const sendExpression: Parser<Send<Raw>> = lazy(() =>
  seqMap(
    index,
    primaryExpression,
    seq(
      key('.').then(name),
      alt(unamedArguments, closureLiteral.thru(sourced).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
      buildSend(receiver, message, args, { source: { start, end } })
      , initial) as Send<Raw>
  )
)

export const operation: Parser<Expression<Raw>> = lazy(() => {
  const prefixOperation = seqMap(
    seq(index, alt(...PREFIX_OPERATORS.map(key))).many(),
    alt(sendExpression, primaryExpression),
    index,
    (calls, initial, end) => calls.reduceRight<Expression<Raw>>((receiver, [start, message]) =>
      buildSend(receiver, `${message}_`, [], { source: { start, end } })
      , initial)
  )

  const infixOperation = (precedenceLevel: number): Parser<Expression<Raw>> => {
    const argument = precedenceLevel < INFIX_OPERATORS.length - 1
      ? infixOperation(precedenceLevel + 1)
      : prefixOperation

    return seqMap(
      index,
      argument,
      seq(alt(...INFIX_OPERATORS[precedenceLevel].map(key)), argument.times(1), index).many(),
      (start, initial, calls) => calls.reduce((receiver, [message, args, end]) =>
        buildSend(
          receiver,
          message,
          LAZY_OPERATORS.includes(message)
            ? [makeClosure([], args)]
            : args,
          { source: { start, end } }
        )
        , initial)
    )
  }

  return infixOperation(0)
}
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const literal: Parser<Literal<Raw>> = lazy(() =>
  alt(
    closureLiteral,
    node('Literal')({
      value: alt(
        key('null').result(null),
        key('true').result(true),
        key('false').result(false),
        regex(/-?\d+(\.\d+)?/).map(Number),
        expression.sepBy(key(',')).wrap(key('['), key(']')).map(elems => ListOf(...elems)),
        expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(elems => SetOf(...elems)),
        stringLiteral,
        singletonEntity,
      ),
    })
  ).thru(sourced)
)

const stringLiteral: Parser<string> = lazy(() => {
  const escapedChar = alt(
    regex(/\\\\/).result('\\'),
    regex(/\\b/).result('\b'),
    regex(/\\t/).result('\t'),
    regex(/\\n/).result('\n'),
    regex(/\\f/).result('\f'),
    regex(/\\r/).result('\r'),
  )

  const singleQuoteString: Parser<string> = alt(
    escapedChar,
    regex(/\\'/).result('\''),
    regex(/[^\\']/)
  ).many().tie().wrap(string('\''), string('\''))

  const doubleQuoteString: Parser<string> = alt(
    escapedChar,
    regex(/\\"/).result('"'),
    regex(/[^\\"]/)
  ).many().tie().wrap(string('"'), string('"'))

  return alt(singleQuoteString, doubleQuoteString)
})

const closureLiteral: Parser<Literal<Raw, Singleton<Raw>>> = lazy(() => {
  const closure = seq(
    parameter.sepBy(key(',')).skip(key('=>')).fallback([]),
    sentence.skip(optional(alt(key(';'), _))).many(),
  ).wrap(key('{'), key('}'))

  return closure.mark().chain(({ start, end, value: [ps, b] }) => Parsimmon((input: string, i: number) =>
    makeSuccess(i, makeClosure(ps, b, input.slice(start.offset, end.offset)))
  ))
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeClosure = (closureParameters: List<Parameter<Raw>>, rawSentences: List<Sentence<Raw>>, toString?: string):
  Literal<Raw, Singleton<Raw>> => {

  const sentences: List<Sentence<Raw>> = rawSentences.some(s => s.is('Return')) || (rawSentences.length && !last(rawSentences)!.is('Expression'))
    ? [...rawSentences, buildReturn()]
    : [...rawSentences.slice(0, -1), buildReturn(last(rawSentences) as Expression<Raw>)]

  return buildClosure(toString, ...closureParameters)(...sentences)
}