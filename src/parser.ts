import Parsimmon, { alt, index, lazy, makeSuccess, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { basename } from 'path'
import unraw from 'unraw'
import * as build from './builders'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, Constructor as ConstructorNode, Describe as DescribeNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, Fixture as FixtureNode, If as IfNode, Import as ImportNode, List, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, Node, Package as PackageNode, Parameter as ParameterNode, Payload, Program as ProgramNode, Raw, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode } from './model'

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

// TODO: Resolve this without effect. Maybe moving the file to a field in Package?
let SOURCE_FILE: string | undefined

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const check = <T>(parser: Parser<T>) => parser.result(true).fallback(false)

const optional = <T>(parser: Parser<T>) => parser.fallback(undefined)

const obj = <T>(parsers: {[K in keyof T]: Parser<T[K]>}): Parser<T> =>
  seqObj<T>(...keys(parsers).map(fieldName => [fieldName, parsers[fieldName as keyof T]] as any))
  

const key = (str: string) => string(str).trim(_)

const comment = regex(/\/\*(.|[\r\n])*?\*\/|\/\/.*/)

const _ = comment.or(whitespace).many()

const node = <N extends Node<Raw>>(constructor: new (payload: Payload<N>) => N) => (parser: () => Parser<Payload<N>>) =>
  seq(
    optional(_).then(index),
    lazy(parser),
    index
  ).map(([start, payload, end]) =>
    new constructor({ ...payload, source: { start, end, file: SOURCE_FILE } })
  )


export const File = (fileName: string): Parser<PackageNode<Raw>> => {
  SOURCE_FILE = fileName
  return node(PackageNode)(() =>
    obj({
      name: of(basename(fileName).split('.')[0]),
      imports: Import.sepBy(optional(_)).skip(optional(_)),
      members: Entity.sepBy(optional(_)),
    }).skip(optional(_))
  )
}

export const Import: Parser<ImportNode<Raw>> = node(ImportNode)(() =>
  key('import').then(obj({
    entity: FullyQualifiedReference,
    isGeneric: string('.*').result(true).fallback(false),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const name: Parser<Name> = regex(/[^\W\d]\w*/)

export const FullyQualifiedReference: Parser<ReferenceNode<Raw>> = node(ReferenceNode)(() =>
  obj({ name: name.sepBy1(key('.')).tieWith('.') })
)

export const Reference: Parser<ReferenceNode<Raw>> = node(ReferenceNode)(() =>
  obj({ name })
)

export const Parameter: Parser<ParameterNode<Raw>> = node(ParameterNode)(() =>
  obj({
    name,
    isVarArg: string('...').result(true).fallback(false),
  })
)
  
export const NamedArgument: Parser<NamedArgumentNode<Raw>> = node(NamedArgumentNode)(() =>
  obj({
    name,
    value: key('=').then(Expression),
  })
)

export const Body: Parser<BodyNode<Raw>> = node(BodyNode)(() =>
  obj({ sentences: Sentence.skip(optional(alt(key(';'), _))).many() }).wrap(key('{'), string('}'))
)

const inlineableBody: Parser<BodyNode<Raw>> = alt(
  Body,
  node(BodyNode)(() => obj({ sentences: Sentence.times(1) })),
)

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

export const Package: Parser<PackageNode<Raw>> = node(PackageNode)(() =>
  key('package').then(obj({
    name: name.skip(key('{')),
    imports: Import.skip(optional(alt(key(';'), _))).many(),
    members: Entity.sepBy(optional(_)).skip(key('}')),
  }))
)

export const Program: Parser<ProgramNode<Raw>> = node(ProgramNode)(() =>
  key('program').then(obj({
    name,
    body: Body,
  }))
)

export const Describe: Parser<DescribeNode<Raw>> = node(DescribeNode)(() =>
  key('describe').then(obj({
    name: stringLiteral,
    members: alt(Variable, Fixture, Test, Method).sepBy(optional(_)).wrap(key('{'), key('}')),
  }))
)

export const Test: Parser<TestNode<Raw>> = node(TestNode)(() =>
  key('test').then(obj({
    name: stringLiteral,
    body: Body,
  }))
)

export const mixins = lazy(() =>
  key('mixed with')
    .then(FullyQualifiedReference.sepBy1(key('and')))
    .map(_ => _.reverse())
    .fallback([])
)

export const Class: Parser<ClassNode<Raw>> = node(ClassNode)(() => {
  const member = alt<ConstructorNode<Raw>|FieldNode<Raw>|MethodNode<Raw>>(Constructor, Field, Method)
  // const memberError = regex(/([^}]+?)(?=var|const|method|constructor)/, 1).mark().map(({ start, end, value }) =>
  //   new Error(`ParseError: [${start}:${end}] Expected class member but found "${value}" instead`)
  // )

  return key('class').then(obj({
    name,
    superclassRef: optional(key('inherits').then(FullyQualifiedReference)),
    mixins: mixins,
    members: member.sepBy(optional(_)).wrap(key('{'), key('}')),
    // members: alt(member, memberError).sepBy(optional(_)).wrap(key('{'), key('}')),
  })) as any
  //.map(payload => ({
  // ...payload,
  // members: payload.members.filter<ClassMember>(isNode),
  // errors: [...payload.errors ??[], ...payload.members.filter(n => !isNode(n))].length
  //   ? [...payload.errors ??[], ...payload.members.filter(n => !isNode(n))]
  //   : undefined,
  // }))
})

export const Singleton: Parser<SingletonNode<Raw>> = node(SingletonNode)(() => 
  key('object').then(
    obj({
      name: optional(notFollowedBy(key('inherits').or(key('mixed with'))).then(name)), 
      superCall: optional(key('inherits').then(obj({
        superclassRef: FullyQualifiedReference,
        args: alt(unamedArguments, namedArguments).fallback([]),
      }))),
      mixins: mixins,
      members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
    })
  )
)

export const Mixin: Parser<MixinNode<Raw>> = node(MixinNode)(() =>
  key('mixin').then(obj({
    name,
    mixins: mixins,
    members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Field: Parser<FieldNode<Raw>> = node(FieldNode)(() =>
  obj({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    isProperty: check(key('property')),
    name,
    value: optional(key('=').then(Expression)),
  })
)

export const Method: Parser<MethodNode<Raw>> = node(MethodNode)(() =>
  obj({
    isOverride: check(key('override')),
    name: key('method').then(alt(name, operator(ALL_OPERATORS))),
    parameters,
    body: alt(
      key('=').then(Expression.map(value => new BodyNode<Raw>({
        sentences: [new ReturnNode<Raw>({ value })],
        source: value.source,
      }))),

      key('native'),

      optional(Body),
    ),
  })
)

export const Constructor: Parser<ConstructorNode<Raw>> = node(ConstructorNode)(() =>
  key('constructor').then(obj({
    parameters,
    baseCall: optional(key('=').then(seqMap(
      alt(key('self').result(false), key('super').result(true)),
      unamedArguments,
      (callsSuper, args) => ({ callsSuper, args })
    ))),
    body: Body.fallback(new BodyNode<Raw>({ sentences: [] })),
  }))
)

export const Fixture: Parser<FixtureNode<Raw>> = node(FixtureNode)(() =>
  key('fixture').then(obj({ body: Body }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Sentence: Parser<SentenceNode<Raw>> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<VariableNode<Raw>> = node(VariableNode)(() =>
  obj({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name,
    value: optional(key('=').then(Expression)),
  })
)

export const Return: Parser<ReturnNode<Raw>> = node(ReturnNode)(() =>
  key('return').then(obj({ value: optional(Expression) }))
)

export const Assignment: Parser<AssignmentNode<Raw>> = node(AssignmentNode)(() =>
  seq(
    Reference,
    operator(ASSIGNATION_OPERATORS),
    Expression,
  ).map(([variable, assignation, value]) => ({
    variable,
    value: assignation === '='
      ? value
      : new SendNode<Raw>({
        receiver: variable,
        message: assignation.slice(0, -1),
        args: LAZY_OPERATORS.includes(assignation.slice(0, -1))
          ? [build.Closure({ sentences: [value] })]
          : [value],
      }),
  }))
)

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

export const Self: Parser<SelfNode<Raw>> = node(SelfNode)(() =>
  key('self').result({})
)

export const Super: Parser<SuperNode<Raw>> = node(SuperNode)(() =>
  key('super').then(obj({ args: unamedArguments }))
)

export const New: Parser<NewNode<Raw> | LiteralNode<Raw, SingletonNode<Raw>>> = alt(
  node<LiteralNode<Raw, SingletonNode<Raw>>>(LiteralNode)(() => 
    key('new ').then(obj({
      value: node<SingletonNode<Raw>>(SingletonNode)(() => obj({
        superCall: obj({
          superclassRef: FullyQualifiedReference,
          args: alt(unamedArguments, namedArguments),
        }),
        // TODO: Convince the world we need a single linearization syntax
        mixins: (key('with').then(Reference)).atLeast(1).map(mixins => [...mixins].reverse()),
        members: of([]),
      })),
    }))
  ),

  node<NewNode<Raw>>(NewNode)(() =>
    key('new ').then(
      obj({
        instantiated: FullyQualifiedReference,
        args: alt(unamedArguments, namedArguments),
      })
    )
  ),
)

export const If: Parser<IfNode<Raw>> = node(IfNode)(() =>
  key('if').then(obj({
    condition: Expression.wrap(key('('), key(')')),
    thenBody: inlineableBody,
    elseBody: optional(key('else').then(inlineableBody)),
  }))
)

export const Throw: Parser<ThrowNode<Raw>> = node(ThrowNode)(() =>
  key('throw').then(obj({ exception: Expression }))
)

export const Try: Parser<TryNode<Raw>> = node(TryNode)(() =>
  key('try').then(obj({
    body: inlineableBody,
    catches: Catch.many(),
    always: optional(key('then always').then(inlineableBody)),
  }))
)

export const Catch: Parser<CatchNode<Raw>> = node(CatchNode)(() =>
  key('catch').then(obj({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: inlineableBody,
  }))
)

export const Send: Parser<ExpressionNode<Raw>> = lazy(() =>
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
        new SendNode<Raw>({ receiver, message, args, source: { start, end } })
      , initial
    )
  ))

const prefixOperation = seq(
  seq(index, operator(keys(PREFIX_OPERATORS))).many(),
  alt(Send, primaryExpression),
  index,
).map(([calls, initial, end]) => calls.reduceRight<ExpressionNode<Raw>>(
  (receiver, [start, message]) =>
    new SendNode({ receiver, message: PREFIX_OPERATORS[message], args: [], source: { start, end } })
  , initial
))

const infixOperation = (precedenceLevel = 0): Parser<ExpressionNode<Raw>> => {
  const argument = precedenceLevel < INFIX_OPERATORS.length - 1
    ? infixOperation(precedenceLevel + 1)
    : prefixOperation

  return seq(
    index,
    argument,
    seq(operator(INFIX_OPERATORS[precedenceLevel]), argument.times(1), index).many(),
  ).map(([start, initial, calls]) => calls.reduce((receiver, [message, args, end]) =>
    new SendNode<Raw>({
      receiver,
      message: message.trim(),
      args: LAZY_OPERATORS.includes(message)
        ? [build.Closure({ sentences: args })]
        : args,
      source: { start, end },
    })
  , initial))
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LITERALS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Literal: Parser<LiteralNode<Raw>> = lazy(() => alt(
  closureLiteral,
  node(LiteralNode)(() => obj({
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
  )
))

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

  return closure.mark().chain(({ start, end, value: [parameters, sentences] }) => Parsimmon((input: string, i: number) =>
    makeSuccess(i, build.Closure({
      parameters,
      sentences,
      code: input.slice(start.offset, end.offset),
      source:{ start, end, file: SOURCE_FILE },
    }))
  ))
})