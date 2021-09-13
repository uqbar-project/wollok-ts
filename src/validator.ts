// TODO:
// No imports of local definitions or imports of duplicated names
// No siblings with the same name
// No global mutable vars
// No modules named wollok
// Generic import of non package

// Last supertype in linearization is the class (if any)
// No more than 1 class in linearization
// Mixins don't have class supertype
// Default parameters don't repeat
// Describes should never contain accesors, just plain fields
// No two entities should have the same name


// TODO: WISHLIST
// - Define against categories
// - Level could be different for the same Expectation on different nodes
// - Problem could know how to convert to string, receiving the interpolation function (so it can be translated). This could let us avoid having parameters.
// - Good default for simple problems, but with a config object for more complex, so we know what is each parameter
// - Unified problem type
import { Sentence } from './model'
import { Assignment, Body, Entity, Expression, Field, is, Kind, List, Method, New, Node, NodeOfKind, Parameter, Send, Singleton, SourceMap, Try, Variable } from './model'
import { isEmpty, notEmpty } from './extensions'

const { entries } = Object

const KEYWORDS = [
  'import',
  'package',
  'program',
  'test',
  'class',
  'inherits',
  'object',
  'mixin',
  'var',
  'const',
  'override',
  'method',
  'native',
  'self',
  'super',
  'new',
  'if',
  'else',
  'return',
  'throw',
  'try',
  'then always',
  'catch',
  'null',
  'false',
  'true',
]

type Code = string
type Level = 'warning' | 'error'

export type Validation<N extends Node> = (node: N, code: Code) => Problem | null

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node
  readonly values: List<string>
  readonly sourceMap?: SourceMap
}

const problem = (level: Level) => <N extends Node>(
  expectation: (node: N) => boolean,
  values: (node: N) => string[] = () => [],
  source: (node: N) => SourceMap | undefined = (node) => node.sourceMap,
) => (node: N, code: Code): Problem | null =>
    !expectation(node)
      ? {
        level,
        code,
        node,
        values: values(node),
        sourceMap: source(node),
      }
      : null

const warning = problem('warning')

const error = problem('error')

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const isNotEmpty = warning<Body>(node =>
  node.isSynthetic() || node.parent().is('Method') || notEmpty(node.sentences)
)

export const isNotWithin = (kind: Kind):  (node: Node, code: Code) => Problem | null =>
  error(node => !node.sourceMap || !node.ancestors().some(is(kind)))

export const nameMatches = (regex: RegExp): (node: Parameter | Entity | Field | Method, code: Code) => Problem | null =>
  warning(
    node => !node.name || regex.test(node.name),
    node => [node.name ?? ''],
    node => {
      const nodeOffset = node.kind.length + 1
      return node.sourceMap && {
        start: {
          ...node.sourceMap.start,
          offset: nodeOffset,
        },
        end: {
          ...node.sourceMap.end,
          offset: node.name?.length ?? 0 + nodeOffset,
        },
      }
    }
  )

export const nameBeginsWithUppercase = nameMatches(/^[A-Z]/)

export const nameBeginsWithLowercase = nameMatches(/^[a-z_<]/)

export const nameIsNotKeyword = error<Entity | Parameter | Variable | Field | Method>(node =>
  !KEYWORDS.includes(node.name || ''),
node => [node.name || ''],
)

export const singletonIsUnnamedIffIsLiteral = error<Singleton>(
  singleton => singleton.parent().is('Package') === !!singleton.name,
)

export const onlyLastParameterIsVarArg = error<Method>(node => {
  const varArgIndex = node.parameters.findIndex(p => p.isVarArg)
  return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
})

export const hasCatchOrAlways = error<Try>(node =>
  notEmpty(node.catches) || notEmpty(node.always.sentences)
)

export const hasDistinctSignature = error<Method>(node => {
  return node.parent().methods().every(other => node === other || !other.matchesSignature(node.name, node.parameters.length))
})

export const methodNotOnlyCallToSuper = warning<Method>(node => {
  const callsSuperWithSameArgs = (sentence?: Sentence) => sentence?.is('Super') && sentence.args.every((arg, index) => arg.is('Reference') && arg.target() === node.parameters[index])
  return isEmpty(node.sentences()) || !node.sentences().every(sentence =>
    callsSuperWithSameArgs(sentence) || sentence.is('Return') && callsSuperWithSameArgs(sentence.value)
  )
})

export const instantiationIsNotAbstractClass = error<New>(node => !node.instantiated.target()?.isAbstract())

export const noIdentityAssignment = error<Assignment>(node => !node.value.is('Reference') || node.value.target() !== node.variable.target())

export const noIdentityDeclaration = error<Field | Variable>(node => !node.value.is('Reference') || node.value.target() !== node)

export const dontCheckEqualityAgainstBooleanLiterals = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return node.message !== '==' || !arg || !arg.is('Literal') || !(arg.value === true || arg.value === false)
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const validationsByKind: {[K in Kind]: Record<Code, Validation<NodeOfKind<K>>>} = {
  Parameter: { nameBeginsWithLowercase },
  ParameterizedType: {},
  NamedArgument: {},
  Import: {},
  Body: { isNotEmpty },
  Catch: {},
  Package: {},
  Program: { },
  Test: { },
  Class: { nameBeginsWithUppercase, nameIsNotKeyword },
  Singleton: { nameBeginsWithLowercase, singletonIsUnnamedIffIsLiteral, nameIsNotKeyword },
  Mixin: { nameBeginsWithUppercase },
  Field: { nameBeginsWithLowercase, noIdentityDeclaration },
  Method: { onlyLastParameterIsVarArg, nameIsNotKeyword, hasDistinctSignature, methodNotOnlyCallToSuper },
  Variable: { nameBeginsWithLowercase, nameIsNotKeyword, noIdentityDeclaration },
  Return: {  },
  Assignment: { notAssignToItself: noIdentityAssignment },
  Reference: { },
  Self: { isNotWithinProgram: isNotWithin('Program') },
  New: { instantiationIsNotAbstractClass },
  Literal: {},
  Send: { dontCheckEqualityAgainstBooleanLiterals },
  Super: {  },
  If: {},
  Throw: {},
  Try: { hasCatchOrAlways },
  Environment: {},
  Describe: {},
}

export default (target: Node): List<Problem> => target.reduce<Problem[]>((found, node) => {
  return [
    ...found,
    ...target.problems?.map(({ code }) => ({ code, level: 'error', node: target, values: [], source: node.sourceMap } as const)  ) ?? [],
    ...entries(validationsByKind[node.kind] as Record<Code, Validation<Node>>)
      .map(([code, validation]) => validation(node, code)!)
      .filter(result => result !== null),
  ]
}, [])