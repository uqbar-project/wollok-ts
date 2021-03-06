import Parsimmon, { takeWhile, alt as alt_parser, index, lazy, makeSuccess, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace, any } from 'parsimmon'
import { basename, dirname } from 'path'
import unraw from 'unraw'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, Describe as DescribeNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, If as IfNode, Import as ImportNode, List, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, Node, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode, Problem, SourceMap, Closure, ParameterizedType as ParameterizedTypeNode, LiteralValue } from './model'
import { mapObject, discriminate } from './extensions'

const { keys, values } = Object
const { isArray } = Array

const PREFIX_OPERATORS: Record<Name, Name> = {
  '!': 'negate',
  '-': 'invert',
  '+': 'plus',
  'not': 'negate',
}

const ASSIGNATION_OPERATORS = ['=', '||=', '/=', '-=', '+=', '*=', '&&=', '%=']

const LAZY_OPERATORS = ['||', '&&', 'or', 'and']

const INFIX_OPERATORS = [
  ['||', 'or'],
  ['&&', 'and'],
  ['===', '==', '!==', '!='],
  ['>=', '>', '<=', '<'],
  ['?:', '>>>', '>>', '>..', '<>', '<=>', '<<<', '<<', '..<', '..', '->'],
  ['-', '+'],
  ['/', '*'],
  ['**', '%'],
]

const ALL_OPERATORS = [
  ...values(PREFIX_OPERATORS),
  ...INFIX_OPERATORS.flat(),
].sort((a, b) => b.localeCompare(a))

export class ParseError extends Problem {
  constructor(public code: Name, public sourceMap: SourceMap){ super() }
}

// TODO: Contribute this type so we don't have to do it here
function alt<T1, T2>(p1: Parser<T1>, p2: Parser<T2>): Parser<T1 | T2>
function alt<T1, T2, T3>(p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>): Parser<T1 | T2 | T3>
function alt<T1, T2, T3, T4>(p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>): Parser<T1 | T2 | T3 | T4>
function alt<T>(...parsers: Parser<T>[]): Parser<T>
function alt<T>(...parsers: Parser<T>[]): Parser<T> { return alt_parser(...parsers) }

const error = (code: string) => (...safewords: string[]) =>
  notFollowedBy(alt(...safewords.map(key))).then(alt(
    seq(string('{'), takeWhile(c => c !== '}'), string('}')),
    any
  )).atLeast(1).mark().map(({ start, end }) =>
    new ParseError(code, { start, end })
  )

const recover = <T>(recoverable: T): {[K in keyof T]: T[K] extends List<infer E> ? List<Exclude<E, ParseError>> : T[K] } & {problems: List<ParseError>} => {
  const problems: ParseError[] = []
  const purged = mapObject((value: any) => {
    if(isArray(value)) {
      const [newProblems, nonProblems] = discriminate<ParseError>((member): member is ParseError => member instanceof ParseError)(value)
      problems.push(...newProblems)
      return nonProblems
    } else return value
  }, recoverable)
  return { ...purged, problems }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const check = <T>(parser: Parser<T>) => parser.result(true).fallback(false)

const optional = <T>(parser: Parser<T>) => parser.fallback(undefined)

const obj = <T>(parsers: {[K in keyof T]: Parser<T[K]>}): Parser<T> =>
  seqObj<T>(...keys(parsers).map(fieldName => [fieldName, parsers[fieldName as keyof T]] as any))

const key = <T extends string>(str: T): Parser<T> => (
  str.match(/[\w ]+/)
    ? string(str).notFollowedBy(regex(/\w/))
    : string(str)
).trim(optional(_))

const comment = regex(/\/\*(.|[\r\n])*?\*\/|\/\/.*/)

const _ = comment.or(whitespace).atLeast(1)

const node = <N extends Node, P>(constructor: new (payload: P) => N) => (parser: () => Parser<P>): Parser<N> =>
  seq(
    optional(_).then(index),
    lazy(parser),
    index
  ).map(([start, payload, end]) => {
    return new constructor({ ...payload, sourceMap: { start, end } })
  }
  )


export const File = (fileName: string): Parser<PackageNode> => node(PackageNode)(() =>
  obj({
    fileName: of(fileName),
    name: of(basename(fileName).split('.')[0]),
    imports: Import.sepBy(optional(_)).skip(optional(_)),
    members: Entity.sepBy(optional(_)),
  }).skip(optional(_))
).map(filePackage => {
  const dir = dirname(fileName)
  return (dir === '.' ? [] : dir.split('/')).reduceRight((entity, name) =>
    new PackageNode({ name, members:[entity] })
  , filePackage)
})


export const Import: Parser<ImportNode> = node(ImportNode)(() =>
  key('import').then(obj({
    entity: FullyQualifiedReference,
    isGeneric: string('.*').result(true).fallback(false),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const name: Parser<Name> = regex(/[^\W\d]\w*/)

export const FullyQualifiedReference: Parser<ReferenceNode<any>> = node(ReferenceNode)(() =>
  obj({ name: name.sepBy1(key('.')).tieWith('.') })
)

export const Reference: Parser<ReferenceNode<any>> = node(ReferenceNode)(() =>
  obj({ name })
)

export const Parameter: Parser<ParameterNode> = node(ParameterNode)(() =>
  obj({
    name,
    isVarArg: string('...').result(true).fallback(false),
  })
)

export const NamedArgument: Parser<NamedArgumentNode> = node(NamedArgumentNode)(() =>
  obj({
    name,
    value: key('=').then(Expression),
  })
)

export const Body: Parser<BodyNode> = node(BodyNode)(() =>
  obj({ sentences: Sentence.skip(optional(alt(key(';'), _))).many() }).wrap(key('{'), key('}'))
)

const inlineableBody: Parser<BodyNode> = Body.or(
  node(BodyNode)(() => obj({ sentences: Sentence.times(1) }))
)


const parameters: Parser<List<ParameterNode>> = lazy(() =>
  Parameter.sepBy(key(',')).wrap(key('('), key(')')))

const unamedArguments: Parser<List<ExpressionNode>> = lazy(() =>
  Expression.sepBy(key(',')).wrap(key('('), key(')')))

const namedArguments: Parser<List<NamedArgumentNode>> = lazy(() =>
  NamedArgument.sepBy(key(',')).wrap(key('('), key(')'))
)

const operator = (operatorNames: Name[]): Parser<Name> => alt(...operatorNames.map(key))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const entityError = error('malformedEntity')('package', 'class', 'singleton', 'mixin', 'program', 'describe', 'test', 'var', 'const', '}')

export const Entity: Parser<EntityNode> = lazy(() => alt<EntityNode>(
  Package,
  Class,
  Singleton,
  Mixin,
  Program,
  Describe,
  Test,
  Variable,
))

export const Package: Parser<PackageNode> = node(PackageNode)(() =>
  key('package').then(obj({
    name: name.skip(key('{')),
    imports: Import.skip(optional(alt(key(';'), _))).many(),
    members: Entity.or(entityError).sepBy(optional(_)).skip(key('}')),
  })).map(recover)
)

export const Program: Parser<ProgramNode> = node(ProgramNode)(() =>
  key('program').then(obj({
    name,
    body: Body,
  }))
)

export const Test: Parser<TestNode> = node(TestNode)(() =>
  obj({
    isOnly: check(key('only')),
    name: key('test').then(stringLiteral.map(name => `"${name}"`)),
    body: Body,
  })
)


// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MODULES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// TODO: Test
export const ParameterizedType = node(ParameterizedTypeNode)(() => obj({
  reference: FullyQualifiedReference,
  args: optional(namedArguments),
}))

const supertypes = lazy(() => key('inherits').then(ParameterizedType.sepBy1(key('and'))).fallback([]))


//TODO: It looks like current typing detects missing fields but not inexistent ones
export const Class: Parser<ClassNode> = node(ClassNode)(() =>
  key('class').then(obj({
    name,
    supertypes,
    members: alt(Field, Method, classMemberError)
      .sepBy(optional(_))
      .wrap(key('{'), key('}')),
  })).map(recover)
)

export const Singleton: Parser<SingletonNode> = node(SingletonNode)(() =>
  key('object').then(obj({
    name: optional(notFollowedBy(key('inherits')).then(name)),
    supertypes,
    members: alt(Field, Method, memberError)
      .sepBy(optional(_))
      .wrap(key('{'), key('}')),
  })).map(recover)
)

export const Mixin: Parser<MixinNode> = node(MixinNode)(() =>
  key('mixin').then(obj({
    name,
    supertypes,
    members: alt(Field, Method, memberError)
      .sepBy(optional(_))
      .wrap(key('{'), key('}')),
  })).map(recover)
)

export const Describe: Parser<DescribeNode> = node(DescribeNode)(() =>
  key('describe').then(obj({
    name: stringLiteral.map(name => `"${name}"`),
    members: alt(Field, Method, Test, memberError)
      .sepBy(optional(_))
      .wrap(key('{'), key('}')),
  })).map(recover)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const memberError = error('malformedMember')('method', 'var', 'const', 'test', 'describe', '}')
const classMemberError = error('malformedMember')('method', 'var', 'const', '}')

export const Field: Parser<FieldNode> = node(FieldNode)(() =>
  obj({
    isConstant: alt(key('var').result(false), key('const').result(true)),
    isProperty: check(key('property')),
    name,
    value: optional(key('=').then(Expression)),
  })
)

export const Method: Parser<MethodNode> = node(MethodNode)(() =>
  obj({
    isOverride: check(key('override')),
    name: key('method').then(alt(name, operator(ALL_OPERATORS))),
    parameters,
    body: alt(
      key('=').then(Expression.map(value => new BodyNode({
        sentences: [value],
        sourceMap: value.sourceMap,
      }))),

      key('native'),

      optional(Body),
    ),
  })
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Sentence: Parser<SentenceNode> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<VariableNode> = node(VariableNode)(() =>
  obj({
    isConstant: alt(key('var').result(false), key('const').result(true)),
    name,
    value: optional(key('=').then(Expression)),
  })
)

export const Return: Parser<ReturnNode> = node(ReturnNode)(() =>
  key('return').then(obj({ value: optional(Expression) }))
)

export const Assignment: Parser<AssignmentNode> = node(AssignmentNode)(() =>
  seq(
    Reference,
    operator(ASSIGNATION_OPERATORS),
    Expression,
  ).map(([variable, assignation, value]) => ({
    variable,
    value: assignation === '='
      ? value
      : new SendNode({
        receiver: variable,
        message: assignation.slice(0, -1),
        args: LAZY_OPERATORS.includes(assignation.slice(0, -1))
          ? [Closure({ sentences: [value] })]
          : [value],
      }),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<ExpressionNode> = lazy(() => infixOperation())

export const primaryExpression: Parser<ExpressionNode> = lazy(() => alt(
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

export const Self: Parser<SelfNode> = node(SelfNode)(() =>
  key('self').result({})
)

export const Super: Parser<SuperNode> = node(SuperNode)(() =>
  key('super').then(obj({ args: unamedArguments }))
)

export const New: Parser<NewNode | LiteralNode<SingletonNode>> = node(NewNode)(() =>
  key('new').then(
    obj({
      instantiated: FullyQualifiedReference,
      args: namedArguments,
    })
  )
)

export const If: Parser<IfNode> = node(IfNode)(() =>
  key('if').then(obj({
    condition: Expression.wrap(key('('), key(')')),
    thenBody: inlineableBody,
    elseBody: optional(key('else').then(inlineableBody)),
  }))
)

export const Throw: Parser<ThrowNode> = node(ThrowNode)(() =>
  key('throw').then(obj({ exception: Expression }))
)

export const Try: Parser<TryNode> = node(TryNode)(() =>
  key('try').then(obj({
    body: inlineableBody,
    catches: Catch.many(),
    always: optional(key('then always').then(inlineableBody)),
  }))
)

export const Catch: Parser<CatchNode> = node(CatchNode)(() =>
  key('catch').then(obj({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: inlineableBody,
  }))
)

export const Send: Parser<ExpressionNode> = lazy(() =>
  seqMap(
    index,
    primaryExpression,
    seq(
      key('.').then(name),
      alt(unamedArguments, closureLiteral.times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce(
      (receiver, [message, args, end]) =>
        new SendNode({ receiver, message, args, sourceMap: { start, end } })
      , initial
    )
  ))

const prefixOperation = seq(
  seq(index, operator(keys(PREFIX_OPERATORS))).many(),
  alt(Send, primaryExpression),
  index,
).map(([calls, initial, end]) => calls.reduceRight<ExpressionNode>(
  (receiver, [start, message]) =>
    new SendNode({ receiver, message: PREFIX_OPERATORS[message], args: [], sourceMap: { start, end } })
  , initial
))

const infixOperation = (precedenceLevel = 0): Parser<ExpressionNode> => {
  const argument = precedenceLevel < INFIX_OPERATORS.length - 1
    ? infixOperation(precedenceLevel + 1)
    : prefixOperation

  return seq(
    index,
    argument,
    seq(operator(INFIX_OPERATORS[precedenceLevel]), argument.times(1), index).many(),
  ).map(([start, initial, calls]) => calls.reduce((receiver, [message, args, end]) =>
    new SendNode({
      receiver,
      message: message.trim(),
      args: LAZY_OPERATORS.includes(message)
        ? [Closure({ sentences: args })]
        : args,
      sourceMap: { start, end },
    })
  , initial))
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<LiteralNode> = lazy(() => alt(
  closureLiteral,
  node(LiteralNode)(() => obj({
    value: alt<LiteralValue>(
      key('null').result(null),
      key('true').result(true),
      key('false').result(false),
      regex(/-?\d+(\.\d+)?/).map(Number),
      Expression.sepBy(key(',')).wrap(key('['), key(']')).map(args => [new ReferenceNode({ name: 'wollok.lang.List' }), args]),
      Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(args => [new ReferenceNode({ name: 'wollok.lang.Set' }), args]),
      stringLiteral,
      Singleton,
    ),
  })
  )
))

const stringLiteral: Parser<string> = lazy(() =>
  alt(
    regex(/"((?:[^\\"]|\\[bfnrtv"\\/]|\\u[0-9a-fA-F]{4})*)"/, 1),
    regex(/'((?:[^\\']|\\[bfnrtv'\\/]|\\u[0-9a-fA-F]{4})*)'/, 1)
  ).map(unraw)
)

const closureLiteral: Parser<LiteralNode<SingletonNode>> = lazy(() => {
  const closure = seq(
    Parameter.sepBy(key(',')).skip(key('=>')).fallback([]),
    Sentence.skip(optional(alt(key(';'), _))).many(),
  ).wrap(key('{'), key('}'))

  return closure.mark().chain(({ start, end, value: [parameters, sentences] }) => Parsimmon((input: string, i: number) =>
    makeSuccess(i, Closure({
      parameters,
      sentences,
      code: input.slice(start.offset, end.offset),
      sourceMap:{ start, end },
    }))
  ))
})