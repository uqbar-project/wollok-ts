import Parsimmon, { alt, index, lazy, makeSuccess, notFollowedBy, of, Parser, regex, seq, seqMap, seqObj, string, whitespace } from 'parsimmon'
import { basename } from 'path'
import unraw from 'unraw'
import * as build from './builders'
import { Assignment as AssignmentNode, Body as BodyNode, Catch as CatchNode, Class as ClassNode, ClassMember as ClassMemberNode, Constructor as ConstructorNode, Describe as DescribeNode, DescribeMember as DescribeMemberNode, Entity as EntityNode, Expression as ExpressionNode, Field as FieldNode, Fixture as FixtureNode, If as IfNode, Import as ImportNode, List, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Name, NamedArgument as NamedArgumentNode, New as NewNode, Node, ObjectMember as ObjectMemberNode, Package as PackageNode, Parameter as ParameterNode, Payload, Program as ProgramNode, Raw, Reference as ReferenceNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Sentence as SentenceNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Throw as ThrowNode, Try as TryNode, Variable as VariableNode } from './model'

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

// TODO: Only export useful parsers?

const optional = <T>(parser: Parser<T>) => parser.fallback(undefined)

const obj = <T>(parsers: {[K in keyof T]: Parser<T[K]>}): Parser<T> =>
  seqObj<T>(...keys(parsers).map(fieldName => [fieldName, parsers[fieldName as keyof T]] as any))
  
const key = (str: string) => string(str).trim(_)

const comment = regex(/\/\*(.|[\r\n])*?\*\/|\/\/.*/)

const _ = comment.or(whitespace).many()

const nodex = <N extends Node<Raw>>(constructor: new (payload: Payload<N>) => N) => (parser: () => Parser<Payload<N>>) =>
  seq(
    optional(_).then(index),
    lazy(parser),
    index
  ).map(([start, payload, end]) =>
    new constructor({ ...payload, source: { start, end, file: SOURCE_FILE } })
  )


export const File = (fileName: string): Parser<PackageNode<Raw>> => {
  SOURCE_FILE = fileName
  return nodex(PackageNode)(() =>
    obj({
      name: of(basename(fileName).split('.')[0]),
      imports: Import.sepBy(optional(_)).skip(optional(_)),
      members: Entity.sepBy(optional(_)),
    }).skip(optional(_))
  )
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// COMMON
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const name: Parser<Name> = regex(/[^\W\d]\w*/)

export const FullyQualifiedReference: Parser<ReferenceNode<Raw>> = nodex(ReferenceNode)(() =>
  obj({ name: name.sepBy1(key('.')).tieWith('.') })
)

export const Reference: Parser<ReferenceNode<Raw>> = nodex(ReferenceNode)(() =>
  obj({ name })
)

export const Parameter: Parser<ParameterNode<Raw>> = nodex(ParameterNode)(() =>
  obj({
    name,
    isVarArg: string('...').result(true).fallback(false),
  })
)
  
export const NamedArgument: Parser<NamedArgumentNode<Raw>> = nodex(NamedArgumentNode)(() =>
  obj({
    name,
    value: key('=').then(Expression),
  })
)

export const Body: Parser<BodyNode<Raw>> = nodex(BodyNode)(() =>
  obj({ sentences: Sentence.skip(optional(alt(key(';'), _))).many() }).wrap(key('{'), string('}'))
)

// TODO: Merge with body?
const singleExpressionBody: Parser<BodyNode<Raw>> = nodex(BodyNode)(() =>
  obj({ sentences: Sentence.times(1) })
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

export const Import: Parser<ImportNode<Raw>> = nodex(ImportNode)(() =>
  key('import').then(obj({
    entity: FullyQualifiedReference,
    isGeneric: string('.*').result(true).fallback(false),
  }))
)

export const Package: Parser<PackageNode<Raw>> = nodex(PackageNode)(() =>
  key('package').then(obj({
    name: name.skip(key('{')),
    imports: Import.skip(optional(alt(key(';'), _))).many(),
    members: Entity.sepBy(optional(_)).skip(key('}')),
  }))
)

export const Program: Parser<ProgramNode<Raw>> = nodex(ProgramNode)(() =>
  key('program').then(obj({
    name,
    body: Body,
  }))
)

export const Describe: Parser<DescribeNode<Raw>> = nodex(DescribeNode)(() =>
  key('describe').then(obj({
    name: stringLiteral,
    members: describeMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  }))
)

export const Fixture: Parser<FixtureNode<Raw>> = nodex(FixtureNode)(() =>
  key('fixture').then(obj({ body: Body }))
)

export const Test: Parser<TestNode<Raw>> = nodex(TestNode)(() =>
  key('test').then(obj({
    name: stringLiteral,
    body: Body,
  }))
)

const mixins = lazy(() =>
  key('mixed with')
    .then(FullyQualifiedReference.sepBy1(key('and')))
    .map(_ => _.reverse())
    .fallback([])
)

export const Class: Parser<ClassNode<Raw>> = nodex(ClassNode)(() =>
  key('class').then(obj({
    name,
    superclassRef: optional(key('inherits').then(FullyQualifiedReference)),
    mixins: mixins,
    members: classMember.sepBy(optional(_)).wrap(key('{'), key('}')),
  }))
)

export const Singleton: Parser<SingletonNode<Raw>> = nodex(SingletonNode)(() => 
  key('object').then(
    obj({
      name: optional(notFollowedBy(key('inherits').or(key('mixed with'))).then(name)), 
      superCall: optional(key('inherits').then(obj({
        superclassRef: FullyQualifiedReference,
        args: alt(unamedArguments, namedArguments).fallback([]),
      }))),
      mixins: mixins,
      members: objectMember.sepBy(optional(_)).wrap(key('{'), key('}')),
    })
  )
)

export const Mixin: Parser<MixinNode<Raw>> = nodex(MixinNode)(() =>
  key('mixin').then(obj({
    name,
    mixins: mixins,
    members: alt(Method, Field).sepBy(optional(_)).wrap(key('{'), key('}')),
  }))
)

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// TODO: remove these member alt methods
const describeMember: Parser<DescribeMemberNode<Raw>> = lazy(() => alt(Variable, Fixture, Test, Method))

const classMember: Parser<ClassMemberNode<Raw>> = lazy(() => alt(Constructor, objectMember))

const objectMember: Parser<ObjectMemberNode<Raw>> = lazy(() => alt(Method, Field))

export const Field: Parser<FieldNode<Raw>> = nodex(FieldNode)(() =>
  obj({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    isProperty: key('property').result(true).fallback(false), // TODO: Re-extract checkString for PR
    name,
    value: optional(key('=').then(Expression)),
  })
)

// TODO: Improve
export const Method: Parser<MethodNode<Raw>> = nodex(MethodNode)(() =>
  seq(
    obj({
      isOverride: key('override').result(true).fallback(false), // TODO: Re-extract checkString for PR
      name: key('method').then(alt(name, operator(ALL_OPERATORS))),
      parameters,
    }),

    alt(
      obj({
        isNative: of(false),
        body: key('=').then(Expression.map(value => new BodyNode<Raw>({
          sentences: [new ReturnNode<Raw>({ value })],
          source: value.source,
        }))),
      }),

      obj({
        isNative: key('native').result(true),
        body: of(undefined),
      }),

      obj({
        isNative: of(false),
        body: Body.fallback(undefined),
      }),
    )
  ).map(([method, body]) => ({ ...method, ...body }))
)

export const Constructor: Parser<ConstructorNode<Raw>> = nodex(ConstructorNode)(() =>
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

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// SENTENCES
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const Sentence: Parser<SentenceNode<Raw>> = lazy(() => alt(Variable, Return, Assignment, Expression))

export const Variable: Parser<VariableNode<Raw>> = nodex(VariableNode)(() =>
  obj({
    isReadOnly: alt(key('var').result(false), key('const').result(true)),
    name,
    value: optional(key('=').then(Expression)),
  })
)

export const Return: Parser<ReturnNode<Raw>> = nodex(ReturnNode)(() =>
  key('return').then(obj({ value: optional(Expression) }))
)

export const Assignment: Parser<AssignmentNode<Raw>> = nodex(AssignmentNode)(() =>
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

export const Self: Parser<SelfNode<Raw>> = nodex(SelfNode)(() =>
  key('self').result({})
)

export const Super: Parser<SuperNode<Raw>> = nodex(SuperNode)(() =>
  key('super').then(obj({ args: unamedArguments }))
)

export const New: Parser<NewNode<Raw> | LiteralNode<Raw, SingletonNode<Raw>>> = alt(
  nodex<LiteralNode<Raw, SingletonNode<Raw>>>(LiteralNode)(() => 
    key('new ').then(obj({
      value: nodex<SingletonNode<Raw>>(SingletonNode)(() => obj({
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

  nodex<NewNode<Raw>>(NewNode)(() =>
    key('new ').then(
      obj({
        instantiated: FullyQualifiedReference,
        args: alt(unamedArguments, namedArguments),
      })
    )
  ),
)

export const If: Parser<IfNode<Raw>> = nodex(IfNode)(() =>
  key('if').then(obj({
    condition: Expression.wrap(key('('), key(')')),
    thenBody: alt(Body, singleExpressionBody),
    elseBody: optional(key('else').then(alt(Body, singleExpressionBody))),
  }))
)

export const Throw: Parser<ThrowNode<Raw>> = nodex(ThrowNode)(() =>
  key('throw').then(obj({ exception: Expression }))
)

export const Try: Parser<TryNode<Raw>> = nodex(TryNode)(() =>
  key('try').then(obj({
    body: alt(Body, singleExpressionBody),
    catches: Catch.many(),
    always: optional(key('then always').then(alt(Body, singleExpressionBody))),
  }))
)

export const Catch: Parser<CatchNode<Raw>> = nodex(CatchNode)(() =>
  key('catch').then(obj({
    parameter: Parameter,
    parameterType: optional(key(':').then(Reference)),
    body: alt(Body, singleExpressionBody),
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
  nodex(LiteralNode)(() => obj({
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