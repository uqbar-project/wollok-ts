import Parsimmon, { alt, index, lazy, makeSuccess, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { basename } from 'path'
import unraw from 'unraw'
import { asNode, Closure as buildClosure } from './builders'
import { last } from './extensions'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember as ClassMemberNode, Constructor as ConstructorNode, Describe as DescribeNode, DescribeMember as DescribeMemberNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, Fixture as FixtureNode, If as IfNode, Import as ImportNode, Kind, List, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, Node, NodeOfKind, ObjectMember as ObjectMemberNode, Package as PackageNode, Parameter as ParameterNode, Payload, Program as ProgramNode, Raw, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode } from './model'

const { keys, values } = Object

const PREFIX_OPERATORS: Record<Name, Name> = {
  '!': 'negate',
  '-': 'invert',
  '+': 'plus',
}

const ASSIGNATION_OPERATORS = ['=', '||=', '/=', '-=', '+=', '*=', '&&=', '%=']

const LAZY_OPERATORS = ['||', '&&', 'or ', 'and ']

const INFIX_OPERATORS = [
  ['||', 'or '],
  ['&&', 'and '],
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

// TODO: Resolve this without effect
let SOURCE_FILE: string | undefined

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const comment = regex(/\/\*(.|[\r\n])*?\*\/|\/\/.*/)

const _ = comment.or(whitespace).many()

const key = (str: string) => string(str).trim(_)

const optional = <T>(parser: Parser<T>) => parser.fallback(undefined)

const node = <
  K extends Kind,
  N extends NodeOfKind<K, Raw> = NodeOfKind<K, Raw>,
  P extends { [F in keyof Payload<N>]: Parser<Payload<N>[F]> } = { [F in keyof Payload<N>]: Parser<Payload<N>[F]> },
  >(kind: K) => (fieldParserSeq: P): Parser<N> => {
    const subparsers = keys(fieldParserSeq).map(fieldName => [fieldName, fieldParserSeq[fieldName as keyof P]] as any)
    return (subparsers.length ? seqObj<P>(...subparsers) : of({}))
      .map(payload => asNode<N>({ kind, ...payload } as any))
  }

const sourced = <T extends Node<Raw>>(parser: Parser<T>): Parser<T> => seq(
  optional(_).then(index),
  parser,
  index
).map(([start, payload, end]) => payload.copy({ source: { start, end, file: SOURCE_FILE } }) as T)

export const File = (fileName: string): Parser<PackageNode<Raw>> => {
  SOURCE_FILE = fileName
  return lazy(() =>
    node('Package')({
      name: of(basename(fileName).split('.')[0]),
      imports: Import.sepBy(optional(_)).skip(optional(_)),
      members: Entity.sepBy(optional(_)),
    }).thru(sourced).skip(optional(_)))
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const name: Parser<Name> = regex(/[^\W\d]\w*/)

export const FullyQualifiedReference: Parser<ReferenceNode<Raw>> = lazy(() =>
  node('Reference')({ name: name.sepBy1(key('.')).tieWith('.') }).thru(sourced))

export const Reference: Parser<ReferenceNode<Raw>> = lazy(() =>
  node('Reference')({ name }).thru(sourced))

export const Parameter: Parser<ParameterNode<Raw>> = lazy(() =>
  node('Parameter')({
    name,
    isVarArg: string('...').result(true).fallback(false),
  }).thru(sourced))
  
export const NamedArgument: Parser<NamedArgumentNode<Raw>> = lazy(() =>
  node('NamedArgument')({
    name,
    value: key('=').then(Expression),
  }).thru(sourced))

export const Body: Parser<BodyNode<Raw>> = lazy(() =>
  node('Body')({ sentences: Sentence.skip(optional(alt(key(';'), _))).many() }).wrap(key('{'), string('}')).thru(sourced))

const singleExpressionBody: Parser<BodyNode<Raw>> = lazy(() =>
  node('Body')({ sentences: Sentence.times(1) }).thru(sourced))

const parameters: Parser<List<ParameterNode<Raw>>> = lazy(() =>
  Parameter.sepBy(key(',')).wrap(key('('), key(')')))

const unamedArguments: Parser<List<ExpressionNode<Raw>>> = lazy(() =>
  Expression.sepBy(key(',')).wrap(key('('), key(')')))

const namedArguments: Parser<List<NamedArgumentNode<Raw>>> = lazy(() =>
  NamedArgument.sepBy(key(',')).wrap(key('('), key(')'))
)

const operator = (operatorNames: Name[]): Parser<Name> => alt(...operatorNames.map(key))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ENTITIES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Entity: Parser<EntityNode<Raw>> = lazy(() => alt(
  Package,
  Class,
  Singleton,
  Mixin,
  Program,
  Describe,
  Test,
  Variable,
))

export const Import: Parser<ImportNode<Raw>> = lazy(() =>
  key('import').then(node('Import')({
    entity: FullyQualifiedReference,
    isGeneric: string('.*').result(true).fallback(false),
  })).thru(sourced).skip(optional(alt(key(';'), _))))

export const Package: Parser<PackageNode<Raw>> = lazy(() =>
  key('package').then(node('Package')({
    name: name.skip(key('{')),
    imports: Import.sepBy(optional(_)).skip(optional(_)),
    members: Entity.sepBy(optional(_)).skip(key('}')),
  })).thru(sourced))

export const Program: Parser<ProgramNode<Raw>> = lazy(() =>
  key('program').then(node('Program')({
    name,
    body: Body,
  })).thru(sourced))

export const Describe: Parser<DescribeNode<Raw>> = lazy(() =>
  key('describe').then(node('Describe')({
    name: stringLiteral,
    members: describeMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced))

export const Fixture: Parser<FixtureNode<Raw>> = lazy(() =>
  key('fixture').then(node('Fixture')({ body: Body })).thru(sourced))

export const Test: Parser<TestNode<Raw>> = lazy(() =>
  key('test').then(node('Test')({
    name: stringLiteral,
    body: Body,
  })).thru(sourced))

const mixinLinearization = lazy(() =>
  key('mixed with').then(FullyQualifiedReference.sepBy1(key('and'))).map(mixins => mixins.reverse()))

export const Class: Parser<ClassNode<Raw>> = lazy(() =>
  key('class').then(node('Class')({
    name,
    superclassRef: optional(key('inherits').then(FullyQualifiedReference)),
    mixins: mixinLinearization.fallback([]),
    members: classMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced))

export const Singleton: Parser<SingletonNode<Raw>> = lazy(() => {
  const superCall = key('inherits').then(seqMap(
    FullyQualifiedReference,
    alt(unamedArguments, namedArguments, of([])),
    (superclassRef, args) => ({ superclassRef, args })
  ))

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
      new SingletonNode<Raw>({
        name: singletonName,
        superCall: call,
        mixins,
        members,
      })
  )).thru(sourced)
})

export const Mixin: Parser<MixinNode<Raw>> = lazy(() =>
  key('mixin').then(node('Mixin')({
    name,
    mixins: mixinLinearization.fallback([]),
    members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
  })).thru(sourced))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const describeMember: Parser<DescribeMemberNode<Raw>> = lazy(() => alt(Variable, Fixture, Test, Method))

const classMember: Parser<ClassMemberNode<Raw>> = lazy(() => alt(Constructor, objectMember))

const objectMember: Parser<ObjectMemberNode<Raw>> = lazy(() => alt(Method, Field))

export const Field: Parser<FieldNode<Raw>> = lazy(() =>
  node('Field')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    isProperty: optional(key('property')).map(val => !!val),
    name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced))

export const Method: Parser<MethodNode<Raw>> = lazy(() => seqMap(
  key('override').result(true).fallback(false),
  key('method').then(alt(name, operator(ALL_OPERATORS))),
  parameters,
  alt(
    key('=').then(Expression.map(value => ({
      isNative: false, body: new BodyNode<Raw>({
        sentences: [new ReturnNode<Raw>({ value })],
        source: value.source,
      }),
    }))),
    key('native').result({ isNative: true, body: undefined }),
    Body.map(methodBody => ({ isNative: false, body: methodBody })),
    of({ isNative: false, body: undefined })
  ),
  (isOverride, methodName, methodParameters, { isNative, body: methodBody }) =>
    new MethodNode<Raw>({ name: methodName, isOverride, parameters: methodParameters, isNative, body: methodBody })
).thru(sourced))

export const Constructor: Parser<ConstructorNode<Raw>> = lazy(() =>
  key('constructor').then(node('Constructor')({
    parameters,
    baseCall: optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      unamedArguments,
      (callsSuper, args) => ({ callsSuper, args })
    ))),
    body: Body.or(node('Body')({ sentences: of([]) })),
  })).thru(sourced))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Sentence: Parser<SentenceNode<Raw>> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<VariableNode<Raw>> = lazy(() =>
  node('Variable')({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name,
    value: optional(key('=').then(Expression)),
  }).thru(sourced))

export const Return: Parser<ReturnNode<Raw>> = lazy(() =>
  key('return').then(node('Return')({ value: optional(Expression) })).thru(sourced))

export const Assignment: Parser<AssignmentNode<Raw>> = lazy(() =>
  seqMap(
    Reference,
    operator(ASSIGNATION_OPERATORS),
    Expression,
    (variable, assignation, value) =>
      new AssignmentNode<Raw>({
        variable,
        value: assignation === '='
          ? value
          : new SendNode<Raw>({
            receiver: variable,
            message: assignation.slice(0, -1),
            args: LAZY_OPERATORS.includes(assignation.slice(0, -1)) ? [makeClosure([], [value])] : [value],
          }),
      })
  ).thru(sourced))

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EXPRESSIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Expression: Parser<ExpressionNode<Raw>> = lazy(() => infixOperation())

export const primaryExpression: Parser<ExpressionNode<Raw>> = lazy(() => alt(
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
  key('self').then(node('Self')({})).thru(sourced))

export const Super: Parser<SuperNode<Raw>> = lazy(() =>
  key('super').then(node('Super')({ args: unamedArguments })).thru(sourced))

export const New: Parser<NewNode<Raw> | LiteralNode<Raw, SingletonNode<Raw>>> = lazy(() =>
  alt(
    key('new ').then(seqMap(
      FullyQualifiedReference,
      alt(unamedArguments, namedArguments),
      // TODO: Convince the world we need a single linearization syntax
      (key('with').then(Reference)).atLeast(1).map(mixins => [...mixins].reverse()),
      (superclass, args, mixins) => new LiteralNode<Raw>({
        value: new SingletonNode({
          superCall: { superclassRef: superclass, args },
          mixins,
          members: [],
        }),
      })
    )),

    key('new ').then(node('New')({
      instantiated: FullyQualifiedReference,
      args: alt(unamedArguments, namedArguments),
    })).thru(sourced),
  ))

export const If: Parser<IfNode<Raw>> = lazy(() =>
  key('if').then(node('If')({
    condition: Expression.wrap(key('('), key(')')),
    thenBody: alt(Body, singleExpressionBody),
    elseBody: optional(key('else').then(alt(Body, singleExpressionBody))),
  })).thru(sourced))

export const Throw: Parser<ThrowNode<Raw>> = lazy(() =>
  key('throw').then(node('Throw')({ exception: Expression })).thru(sourced))

export const Try: Parser<TryNode<Raw>> = lazy(() =>
  key('try').then(node('Try')({
    body: alt(Body, singleExpressionBody),
    catches: Catch.many(),
    always: optional(key('then always').then(alt(Body, singleExpressionBody))),
  })).thru(sourced))

export const Catch: Parser<CatchNode<Raw>> = lazy(() =>
  key('catch').then(node('Catch')({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: alt(Body, singleExpressionBody),
  })).thru(sourced))

export const Send: Parser<ExpressionNode<Raw>> = lazy(() =>
  seqMap(
    index,
    primaryExpression,
    seq(
      key('.').then(name),
      alt(unamedArguments, closureLiteral.thru(sourced).times(1)),
      index
    ).atLeast(1),
    (start, initial, calls) => calls.reduce(
      (receiver, [message, args, end]) =>
        new SendNode({ receiver, message, args, source: { start, end } })
      , initial
    )
  ))

const prefixOperation = seqMap(
  seq(index, operator(keys(PREFIX_OPERATORS))).many(),
  alt(Send, primaryExpression),
  index,
  (calls, initial, end) => calls.reduceRight<ExpressionNode<Raw>>(
    (receiver, [start, message]) =>
      new SendNode({ receiver, message: PREFIX_OPERATORS[message], args: [], source: { start, end } })
    , initial
  )
)

const infixOperation = (precedenceLevel = 0): Parser<ExpressionNode<Raw>> => {
  const argument = precedenceLevel < INFIX_OPERATORS.length - 1
    ? infixOperation(precedenceLevel + 1)
    : prefixOperation

  return seqMap(
    index,
    argument,
    seq(operator(INFIX_OPERATORS[precedenceLevel]), argument.times(1), index).many(),
    (start, initial, calls) => calls.reduce(
      (receiver, [message, args, end]) =>
        new SendNode({
          receiver,
          message: message.trim(),
          args: LAZY_OPERATORS.includes(message)
            ? [makeClosure([], args)]
            : args,
          source: { start, end },
        })
      , initial
    )
  )
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<LiteralNode<Raw>> = lazy(() =>
  alt(
    closureLiteral,
    node('Literal')({
      value: alt(
        _.then(string('null')).notFollowedBy(name).result(null),
        _.then(string('true')).notFollowedBy(name).result(true),
        _.then(string('false')).notFollowedBy(name).result(false),
        regex(/-?\d+(\.\d+)?/).map(Number),
        Expression.sepBy(key(',')).wrap(key('['), key(']')).map(args =>
          new NewNode<Raw>({ instantiated: new ReferenceNode<Raw>({ name: 'wollok.lang.List' }), args })),
        Expression.sepBy(key(',')).wrap(key('#{'), key('}')).map(args =>
          new NewNode<Raw>({ instantiated: new ReferenceNode<Raw>({ name: 'wollok.lang.Set' }), args })),
        stringLiteral,
        Singleton,
      ),
    })
  ).thru(sourced))

const stringLiteral: Parser<string> = lazy(() =>
  alt(
    regex(/"((?:[^\\"]|\\[bfnrtv"\\/]|\\u[0-9a-fA-F]{4})*)"/, 1),
    regex(/'((?:[^\\']|\\[bfnrtv'\\/]|\\u[0-9a-fA-F]{4})*)'/, 1)
  ).map(unraw)
)

const closureLiteral: Parser<LiteralNode<Raw, SingletonNode<Raw>>> = lazy(() => {
  const closure = seq(
    Parameter.sepBy(key(',')).skip(key('=>')).fallback([]),
    Sentence.skip(optional(alt(key(';'), _))).many(),
  ).wrap(key('{'), key('}'))

  return closure.mark().chain(({ start, end, value: [ps, b] }) => Parsimmon((input: string, i: number) =>
    makeSuccess(i, makeClosure(ps, b, input.slice(start.offset, end.offset)))))
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BUILDERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const makeClosure = (closureParameters: List<ParameterNode<Raw>>, rawSentences: List<SentenceNode<Raw>>, toString?: string):
  LiteralNode<Raw, SingletonNode<Raw>> => {

  const sentences: List<SentenceNode<Raw>> = rawSentences.some(s => s.is('Return')) || (rawSentences.length && !last(rawSentences)!.is('Expression'))
    ? [...rawSentences, new ReturnNode<Raw>({})]
    : [...rawSentences.slice(0, -1), new ReturnNode<Raw>({ value: last(rawSentences) as ExpressionNode<Raw> })]

  return buildClosure(toString, ...closureParameters)(...sentences)
}