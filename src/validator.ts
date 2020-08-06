// TODO:
// No imports of local references
// No siblings with the same name
// No global mutable vars
// No modules named wollok

import { Assignment, Class, Constructor, Field, Linked, Method,
  Mixin, New, Node, NodeOfKind, Parameter, Program, Reference, Return, Self, Send, Singleton, Super, Test, Try, Variable, is } from './model'
import { Kind } from './model'

const { keys } = Object

type Code = string
type Level = 'Warning' | 'Error'

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node<Linked>
}

export type Validation<N extends Node<Linked>> = (node: N, code: Code) => Problem | null

const problem = (level: Level) => <N extends Node<Linked>>(condition: (node: N) => boolean): Validation<N> => (node, code) =>
  !condition(node) ? {
    level,
    code,
    node,
  } : null

const warning = problem('Warning')

const error = problem('Error')

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const isNotEmpty = (node: Program<Linked> | Test<Linked> | Method<Linked>) => node.sentences().length !== 0

const isNotPresentIn = <N extends Node<Linked>>(kind: Kind) => error<N>((node: N) => !node.source || !node.ancestors().some(is(kind)))

// TODO: Why are we exporting this as a single object?
export const validations: any = {
  nameIsPascalCase: warning<Mixin<Linked> | Class<Linked>>(node =>
    /^[A-Z]/.test(node.name)),

  nameIsCamelCase: warning<Parameter<Linked> | Singleton<Linked> | Variable<Linked>>(node => /^[a-z_<]/.test(node.name ?? 'ok')),

  onlyLastParameterIsVarArg: error<Method<Linked>>(node => {
    const varArgIndex = node.parameters.findIndex(p => p.isVarArg)
    return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
  }),

  nameIsNotKeyword: error<Reference<any, Linked> | Method<Linked> | Variable<Linked>>(node => !['.',
    ',',
    '(',
    ')',
    ';',
    '_',
    '{',
    '}',
    'import',
    'package',
    'program',
    'test',
    'mixed with',
    'class',
    'inherits',
    'object',
    'mixin',
    'var',
    'const',
    '=',
    'override',
    'method',
    'native',
    'constructor',
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
    ':',
    'null',
    'false',
    'true',
    '=>'].includes(node.name)),

  hasCatchOrAlways: error<Try<Linked>>(t => t.catches.length > 0 || t.always.sentences.length > 0 && t.body.sentences.length > 0),

  hasNameWhenNecessary: error<Singleton<Linked>>(node => !node.parent().is('Package') || node.name !== undefined),

  nonAsignationOfFullyQualifiedReferences: error<Assignment<Linked>>(node => !node.variable.name.includes('.')),

  hasDistinctSignature: error<Constructor<Linked> | Method<Linked>>(node => {
    if(node.is('Constructor')) {
      return node.parent().constructors().every(other => node === other || !other.matchesSignature(node.parameters.length))
    } else {
      return node.parent().methods().every(other => node === other || !other.matchesSignature(node.name, node.parameters.length))
    }
  }),

  methodNotOnlyCallToSuper: warning<Method<Linked>>(node =>
    !node.sentences().length || !node.sentences().every(sentence =>
      sentence.is('Super') && sentence.args.every((arg, index) => arg.is('Reference') && arg.target() === node.parameters[index])
    )
  ),

  testIsNotEmpty: warning<Test<Linked>>(node => isNotEmpty(node)),

  programIsNotEmpty: warning<Program<Linked>>(node => isNotEmpty(node)),

  abstractsAreNotInstantiated: error<New<Linked>>(node => !node.instantiated.target().isAbstract()),

  notAssignToItself: error<Assignment<Linked>>(node => !(node.value.is('Reference') && node.value.name === node.variable.name)),

  notAssignToItselfInVariableDeclaration: error<Field<Linked>>(node =>
    !(node.value!.is('Reference') && node.value!.name === node.name)),


  doesNotCheckEqualityAgainstBooleanLiterals: warning<Send<Linked>>(node => {
    if(node.message !== '==') return true
    const arg = node.args[0]
    return !arg.is('Literal') || (arg.value !== true && arg.value !== false)
  }),

  // TODO: Change to a validation on ancestor of can't contain certain type of descendant. More reusable.
  selfIsNotInAProgram: isNotPresentIn<Self<Linked>>('Program'),
  noSuperInConstructorBody: isNotPresentIn<Super<Linked>>('Constructor'),
  noReturnStatementInConstructor: isNotPresentIn<Return<Linked>>('Constructor'),

  // TODO: Packages inside packages
  // notDuplicatedPackageName: error<Package>(node => !firstAncestorOfKind('Environment', node)
  // .members.some(packages => packages.name === node.name)),

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (target: Node<Linked>): ReadonlyArray<Problem> => {

  const {
    nameIsPascalCase,
    nameIsCamelCase,
    nameIsNotKeyword,
    onlyLastParameterIsVarArg,
    hasCatchOrAlways,
    hasNameWhenNecessary,
    nonAsignationOfFullyQualifiedReferences,
    hasDistinctSignature,
    methodNotOnlyCallToSuper,
    programIsNotEmpty,
    testIsNotEmpty,
    abstractsAreNotInstantiated,
    selfIsNotInAProgram,
    notAssignToItself,
    notAssignToItselfInVariableDeclaration,
    doesNotCheckEqualityAgainstBooleanLiterals,
    noSuperInConstructorBody,
    noReturnStatementInConstructor,
  } = validations

  const problemsByKind: { [K in Kind]: { [code: string]: (n: NodeOfKind<K, Linked>, c: Code) => Problem | null } } = {
    Parameter: { nameIsCamelCase },
    NamedArgument: {},
    Import: {},
    Body: {},
    Catch: {},
    Package: {},
    Program: { programIsNotEmpty },
    Test: { testIsNotEmpty },
    Class: { nameIsPascalCase },
    Singleton: { nameIsCamelCase, hasNameWhenNecessary },
    Mixin: { nameIsPascalCase },
    Constructor: { hasDistinctSignature },
    Field: { notAssignToItselfInVariableDeclaration },
    Method: { onlyLastParameterIsVarArg, hasDistinctSignature, nameIsNotKeyword, methodNotOnlyCallToSuper },
    Variable: { nameIsCamelCase, nameIsNotKeyword },
    Return: { noReturnStatementInConstructor },
    Assignment: { nonAsignationOfFullyQualifiedReferences, notAssignToItself },
    Reference: { nameIsNotKeyword },
    Self: { selfIsNotInAProgram },
    New: { abstractsAreNotInstantiated },
    Literal: {},
    Send: { doesNotCheckEqualityAgainstBooleanLiterals },
    Super: { noSuperInConstructorBody },
    If: {},
    Throw: {},
    Try: { hasCatchOrAlways },
    Environment: {},
    Describe: {},
    Fixture: {},
  }

  return target.reduce<Problem[]>((found, node) => {
    const checks = problemsByKind[node.kind] as { [code: string]: (n: Node<Linked>, c: Code) => Problem | null }
    return [
      ...found,
      ...target.problems?.map(({ code }) => ({ code, level: 'Error', node: target } as const)  ) ?? [],
      ...keys(checks).map(code => checks[code](node, code)!).filter(result => result !== null),
    ]
  }, [])
}