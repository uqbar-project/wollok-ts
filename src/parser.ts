import Parsimmon, { Index, Parser, alt as alt_parser, any, index, lazy, makeSuccess, newline, notFollowedBy, of, regex, seq, seqObj, string, whitespace } from 'parsimmon'
import unraw from 'unraw'
import { ASSIGNATION_OPERATORS, INFIX_OPERATORS, PREFIX_OPERATORS } from './constants'
import { List, discriminate, is, hasWhitespace, mapObject } from './extensions'
import { Annotation, Assignment as AssignmentNode, BaseProblem, Body as BodyNode, Catch as CatchNode, Class as ClassNode, Closure as ClosureNode, Describe as DescribeNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, If as IfNode, Import as ImportNode, Level, Literal as LiteralNode, LiteralValue, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, Node, Package as PackageNode, Parameter as ParameterNode, ParameterizedType as ParameterizedTypeNode, Program as ProgramNode, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, SourceIndex, SourceMap, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode } from './model'

// TODO: Use description in lazy() for better errors
// TODO: Support FQReferences to singletons as expressions

const { keys, values, fromEntries } = Object
const { isArray } = Array

const ALL_OPERATORS = [
  ...values(PREFIX_OPERATORS),
  ...INFIX_OPERATORS.flat(),
].sort((a, b) => b.localeCompare(a))

export const MALFORMED_ENTITY = 'malformedEntity'
export const MALFORMED_MEMBER = 'malformedMember'
export const MALFORMED_SENTENCE = 'malformedSentence'

export class ParseError implements BaseProblem {
  constructor(public code: Name, public sourceMap: SourceMap){ }

  get level(): Level { return 'error' }
  get values(): List<string> { return [] }
}

const buildSourceMap = (start: Index, end: Index) => new SourceMap({
  start: new SourceIndex(start),
  end: new SourceIndex(end),
})

// TODO: Contribute this type so we don't have to do it here
function alt<T1, T2>(p1: Parser<T1>, p2: Parser<T2>): Parser<T1 | T2>
function alt<T1, T2, T3>(p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>): Parser<T1 | T2 | T3>
function alt<T1, T2, T3, T4>(p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>, p4: Parser<T4>): Parser<T1 | T2 | T3 | T4>
function alt<T>(...parsers: Parser<T>[]): Parser<T>
function alt<T>(...parsers: Parser<T>[]): Parser<T> { return alt_parser(...parsers) }

const error = (code: string) => (...safewords: string[]) => {
  const skippable = (...breakpoints: Parser<any>[]): Parser<any> => lazy(() =>
    alt(
      skippableContext,
      comment('start'),
      notFollowedBy(alt(key('}'), newline, ...breakpoints)).then(any),
    )
  )

  const skippableContext = skippable().many().wrap(key('{'), key('}'))

  return skippable(...safewords.map(key))
    .atLeast(1)
    .mark()
    .map(({ start, end }) => new ParseError(code, buildSourceMap(start, end)))
}

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
).trim(_)


const _ = optional(whitespace.atLeast(1))
const __ = optional(key(';').or(_))

const comment = (position: 'start' | 'end') => lazy('comment', () => regex(/\/\*(.|[\r\n])*?\*\/|\/\/.*/)).map(text => new Annotation('comment', { text, position }))
const endComment =  alt(
  optional(_).then(comment('end')), // same-line comment
  comment('end').sepBy(_) // after-line comments
)

export const sanitizeWhitespaces = (originalFrom: SourceIndex, originalTo: SourceIndex, input: any): SourceIndex[] => {
  const hasWhitespaceAtTheEnd = hasWhitespace(input[originalTo.offset - 1])
  const shouldBeSanitized = hasWhitespace(input.substring(originalFrom.offset, originalTo.offset)) && hasWhitespaceAtTheEnd || hasWhitespace(input[originalFrom.offset])
  if (!shouldBeSanitized) return [originalFrom, originalTo]
  const from = { ...originalFrom }
  const to = { ...originalTo, offset: originalTo.offset - (hasWhitespaceAtTheEnd ? 1 : 0) }
  while(hasWhitespace(input[from.offset]) && from.offset < originalTo.offset) {
    from.offset++
  }
  while(hasWhitespace(input[to.offset]) && to.offset > originalFrom.offset) {
    to.offset--
  }
  to.offset = to.offset + (hasWhitespace(input[to.offset]) ? 0 : 1)
  return [from, to]
}

export const annotation: Parser<Annotation> = lazy(() =>
  string('@').then(obj({
    name,
    args: seq(
      name,
      key('=').then(Literal).map(literal => literal.value),
    ).sepBy(key(','))
      .wrap(key('('), key(')'))
      .fallback([]),
  })
  ).map(({ name, args }) => new Annotation(name, fromEntries(args)))
)

const node = <N extends Node, P>(constructor: new (payload: P) => N) => (parser: () => Parser<P>): Parser<N> =>
  seq(
    alt(annotation, comment('start')).sepBy(_).wrap(_, _),
    index,
    lazy(parser),
    endComment,
    index,
  )
    .chain(([metadata, _start, payload, comment, _end]) => Parsimmon((input, index) => {
      const [start, end] = sanitizeWhitespaces(_start, _end, input)
      return makeSuccess<[Annotation[], Parsimmon.Index, P, Annotation | Annotation[], Parsimmon.Index]>(index, [metadata, start, payload, comment, end])
    }))
    .map(([metadata, start, payload, comment, end]) =>
      new constructor({ metadata: metadata.concat(comment), sourceMap: buildSourceMap(start, end), ...payload })
    )

export const File = (fileName: string): Parser<PackageNode> => lazy(() =>
  obj({
    fileName: of(fileName),
    name: of(fileName.split('.')[0].replaceAll('/', '.')),
    imports: Import.sepBy(_).skip(_),
    members: Entity.or(entityError).sepBy(_),
  }).skip(_)
    .map(filePackage => new PackageNode(recover(filePackage)))
)


export const Import: Parser<ImportNode> = node(ImportNode)(() =>
  key('import').then(obj({
    entity: FullyQualifiedReference,
    isGeneric: string('.*').result(true).fallback(false),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const name: Parser<Name> = lazy('identifier', () => regex(/[^\W\d]\w*/))

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
  obj({ sentences: alt(Sentence.skip(__), sentenceError).many() }).wrap(key('{'), key('}')).map(recover)
)

export const ExpressionBody: Parser<BodyNode> = node(BodyNode)(() => {
  return obj(
    {
      sentences: alt(Expression.skip(__).map(value => {
        return new ReturnNode({ value })
      }), sentenceError).times(1),
    }
  ).wrap(_, _).map(recover)
})


const inlineableBody: Parser<BodyNode> = Body.or(
  node(BodyNode)(() => obj({ sentences: Sentence.times(1) })).map(body =>
    body.copy({
      metadata: [],
      sentences: body.sentences.map(sentence => sentence.copy({ metadata: [...body.metadata, ...sentence.metadata] })),
    })
  )
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

const entityError = error(MALFORMED_ENTITY)('package', 'class', 'singleton', 'mixin', 'program', 'describe', 'test', 'var', 'const')

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
    imports: Import.skip(__).many(),
    members: Entity.or(entityError).sepBy(_).skip(key('}')),
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
      .sepBy(_)
      .wrap(key('{'), key('}')),
  })).map(recover)
)

export const Singleton: Parser<SingletonNode> = node(SingletonNode)(() =>
  key('object').then(obj({
    name: optional(notFollowedBy(key('inherits')).then(name)),
    supertypes,
    members: alt(Field, Method, memberError)
      .sepBy(_)
      .wrap(key('{'), key('}')),
  })).map(recover)
)

export const Mixin: Parser<MixinNode> = node(MixinNode)(() =>
  key('mixin').then(obj({
    name,
    supertypes,
    members: alt(Field, Method, memberError)
      .sepBy(_)
      .wrap(key('{'), key('}')),
  })).map(recover)
)

export const Describe: Parser<DescribeNode> = node(DescribeNode)(() =>
  key('describe').then(obj({
    name: stringLiteral.map(name => `"${name}"`),
    members: alt(Field, Method, Test, memberError)
      .sepBy(_)
      .wrap(key('{'), key('}')),
  })).map(recover)
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const memberError = error(MALFORMED_MEMBER)('method', 'var', 'const', 'test', 'describe')
const classMemberError = error(MALFORMED_MEMBER)('method', 'var', 'const')

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
      key('=').then(ExpressionBody),

      key('native'),

      optional(Body),
    ),
  })
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const sentenceError = error(MALFORMED_SENTENCE)()

export const Sentence: Parser<SentenceNode> = lazy('sentence', () => alt(Variable, Return, Assignment, Expression))

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
        args: [value],
      }),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<ExpressionNode> = lazy('expression', () => infixMessageChain(0))

const infixMessageChain = (precedenceLevel = 0): Parser<ExpressionNode> => {
  const argument = precedenceLevel < INFIX_OPERATORS.length - 1
    ? infixMessageChain(precedenceLevel + 1)
    : prefixMessageChain

  return messageChain(argument, operator(INFIX_OPERATORS[precedenceLevel]), argument.times(1))
}

const prefixMessageChain: Parser<ExpressionNode> = lazy(() =>
  alt(
    node(SendNode)(() => obj({
      message: operator(keys(PREFIX_OPERATORS)),
      receiver: prefixMessageChain,
    }).map((send) => ({ ...send, message: PREFIX_OPERATORS[send.message], originalOperator: send.message }))),
    postfixMessageChain
  )
)

const postfixMessageChain: Parser<ExpressionNode> = lazy(() =>
  messageChain(
    primaryExpression,
    key('.').then(name),
    alt(unamedArguments, Closure.times(1))
  )
)

const messageChain = (receiver: Parser<ExpressionNode>, message: Parser<Name>, args: Parser<List<ExpressionNode>>): Parser<ExpressionNode> => lazy(() =>
  seq(
    index,
    receiver,
    seq(message, args, index).many(),
    endComment,
  ).map(([start, initialReceiver, calls, comments]) =>
    calls.reduce((receiver, [message, args, end]) =>
      new SendNode({ receiver, message, args, sourceMap: buildSourceMap(start, end), metadata: Array.isArray(comments) ? comments : [comments] })
    , initialReceiver)
  )
)

const primaryExpression: Parser<ExpressionNode> = lazy(() => {
  const NonAppliedFullyQualifiedReference: Parser<ReferenceNode<any>> = node(ReferenceNode)(() =>
    obj({ name: name.notFollowedBy(alt(key('('), key('{'))).sepBy1(key('.')).tieWith('.') })
  )

  return alt(
    Self,
    Super,
    If,
    New,
    Throw,
    Try,
    Singleton,
    Closure,
    Literal,
    NonAppliedFullyQualifiedReference,
    seq(
      annotation.sepBy(_).wrap(_, _),
      Expression.wrap(key('('), key(')'))
    ).map(([metadata, expression]) => expression.copy({ metadata: [...expression.metadata, ...metadata] }))
  )
})


export const Self: Parser<SelfNode> = node(SelfNode)(() =>
  key('self').result({})
)

export const Super: Parser<SuperNode> = node(SuperNode)(() =>
  key('super').then(obj({ args: unamedArguments }))
)

export const New: Parser<NewNode> = node(NewNode)(() =>
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
    parameterType: optional(key(':').then(FullyQualifiedReference)),
    body: inlineableBody,
  }))
)

export const Send: Parser<SendNode> = postfixMessageChain.assert(is(SendNode), 'Send') as Parser<SendNode>

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<LiteralNode> = lazy('literal', () => alt(
  node(LiteralNode)(() => obj({
    value: alt<LiteralValue>(
      key('null').result(null),
      key('true').result(true),
      key('false').result(false),
      lazy('number literal', () => regex(/-?\d+(\.\d+)?/).map(Number)),
      Expression.sepBy(key(',')).wrap(key('['), key(']')).map(args => [new ReferenceNode({ name: 'wollok.lang.List' }), args]),
      Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(args => [new ReferenceNode({ name: 'wollok.lang.Set' }), args]),
      stringLiteral,
    ),
  })
  )
))

const stringLiteral: Parser<string> = lazy('string literal', () =>
  alt(
    regex(/"((?:[^\\"]|\\[bfnrtv"\\/]|\\u[0-9a-fA-F]{4})*)"/, 1),
    regex(/'((?:[^\\']|\\[bfnrtv'\\/]|\\u[0-9a-fA-F]{4})*)'/, 1)
  ).map(unraw)
)

const Closure: Parser<SingletonNode> = lazy(() => {
  return seq(
    annotation.sepBy(_).wrap(_, _),
    seq(
      Parameter.sepBy(key(',')).skip(key('=>')).fallback([]),
      Sentence.skip(__).many(),
    ).wrap(key('{'), key('}')).mark()
  ).chain(([metadata, { start, end, value: [parameters, sentences] }]) =>
    Parsimmon((input: string, i: number) =>
      makeSuccess(i, ClosureNode({
        metadata,
        parameters,
        sentences,
        code: input.slice(start.offset, end.offset),
        sourceMap: buildSourceMap(start, end),
      }))
    )
  )
})