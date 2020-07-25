// TODO:
// No imports of local references
// No siblings with the same name
// No global mutable vars
// No modules named wollok

import { Literal } from './builders'
import { Assignment, Class, ClassMember, Constructor, Field, Linked, Method,
  Mixin, New, Node, NodeOfKind, Parameter, Program, Reference, Return, Self, Send, Singleton, Super, Test, Try, Variable } from './model'
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

type HaveArgs = Method<Linked> | Constructor<Linked>

const canBeCalledWithArgs = (member1: HaveArgs, member2: HaveArgs) =>
  ((member2.parameters[member2.parameters.length - 1].isVarArg && member1.parameters.length >= member2.parameters.length)
    || member2.parameters.length === member1.parameters.length) && member1 !== member2

const matchingConstructors =
  (list: ReadonlyArray<ClassMember<Linked>>, member: Constructor<Linked>) =>
    list.some(m => m.is('Constructor') && canBeCalledWithArgs(m, member))

const matchingSignatures =
  (list: ReadonlyArray<ClassMember<Linked>>, member: Method<Linked>) =>
    list.some(m => m.is('Method') && m.name === member.name && canBeCalledWithArgs(m, member))

const isNotEmpty = (node: Program<Linked> | Test<Linked> | Method<Linked>) => node.sentences().length !== 0

const isNotAbstractClass = (node: Class<Linked>) =>
  node.members.some(member => member.is('Method') && isNotEmpty(member))

const isNotPresentIn = <N extends Node<Linked>>(kind: Kind) => error<N>((node: N) => !node.ancestors().find(ancestor => ancestor.is(kind)))

// TODO: Why are we exporting this as a single object?
export const validations: any = {
  nameIsPascalCase: warning<Mixin<Linked> | Class<Linked>>(node =>
    /^[A-Z]$/.test(node.name[0])),

  nameIsCamelCase: warning<Parameter<Linked> | Singleton<Linked> | Variable<Linked>>(node => node.name !== undefined &&
    /^[a-z]$/.test(node.name[0])),

  onlyLastParameterIsVarArg: error<Method<Linked>>(node =>
    node.parameters.findIndex(p => p.isVarArg) + 1 === (node.parameters.length)),

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
    '+',
    'null',
    'false',
    'true',
    '=>'].includes(node.name)),

  hasCatchOrAlways: error<Try<Linked>>(t => t.catches.length > 0 || t.always.sentences.length > 0 && t.body.sentences.length > 0),

  singletonIsNotUnnamed: error<Singleton<Linked>>(node => (node.parent().is('Package')) && node.name !== undefined),

  nonAsignationOfFullyQualifiedReferences: error<Assignment<Linked>>(node => !node.variable.name.includes('.')),

  fieldNameDifferentFromTheMethods: error<Field<Linked>>(node => node.parent()
    .methods().every(({ name }) => name !== node.name)),

  methodsHaveDistinctSignatures: error<Class<Linked>>(node => node.members
    .every(member => member.is('Method') && !matchingSignatures(node.members, member))),

  constructorsHaveDistinctArity: error<Constructor<Linked>>(node => node.parent().members
    .every(member => member.is('Constructor') && !matchingConstructors(node.parent().members, member))),

  methodNotOnlyCallToSuper: warning<Method<Linked>>(node =>
    !!node.sentences().length && !node.sentences().every(sentence => sentence.is('Super'))
  ),

  testIsNotEmpty: warning<Test<Linked>>(node => isNotEmpty(node)),

  programIsNotEmpty: warning<Program<Linked>>(node => isNotEmpty(node)),

  instantiationIsNotAbstractClass: error<New<Linked>>(node =>
    isNotAbstractClass(node.instantiated.target())),

  notAssignToItself: error<Assignment<Linked>>(node => !(node.value.is('Reference') && node.value.name === node.variable.name)),

  notAssignToItselfInVariableDeclaration: error<Field<Linked>>(node =>
    !(node.value!.is('Reference') && node.value!.name === node.name)),


  dontCompareAgainstTrueOrFalse: warning<Send<Linked>>(node => node.message === '==' && (node.args[0] === Literal(true) || node.args[0] === Literal(false))),

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
    singletonIsNotUnnamed,
    nonAsignationOfFullyQualifiedReferences,
    fieldNameDifferentFromTheMethods,
    methodsHaveDistinctSignatures,
    constructorsHaveDistinctArity,
    methodNotOnlyCallToSuper,
    programIsNotEmpty,
    testIsNotEmpty,
    instantiationIsNotAbstractClass,
    selfIsNotInAProgram,
    notAssignToItself,
    notAssignToItselfInVariableDeclaration,
    dontCompareAgainstTrueOrFalse,
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
    Class: { nameIsPascalCase, methodsHaveDistinctSignatures },
    Singleton: { nameIsCamelCase, singletonIsNotUnnamed },
    Mixin: { nameIsPascalCase },
    Constructor: { constructorsHaveDistinctArity },
    Field: { fieldNameDifferentFromTheMethods, notAssignToItselfInVariableDeclaration },
    Method: { onlyLastParameterIsVarArg, nameIsNotKeyword, methodNotOnlyCallToSuper },
    Variable: { nameIsCamelCase, nameIsNotKeyword },
    Return: { noReturnStatementInConstructor },
    Assignment: { nonAsignationOfFullyQualifiedReferences, notAssignToItself },
    Reference: { nameIsNotKeyword },
    Self: { selfIsNotInAProgram },
    New: { instantiationIsNotAbstractClass },
    Literal: {},
    Send: { dontCompareAgainstTrueOrFalse },
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
      ...keys(checks).map(code => checks[code](node, code)!).filter(result => result !== null),
    ]
  }, [])
}