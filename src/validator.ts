// TODO:

// No imports of local references

import { Literal } from '../test/builders'
import {
  Assignment, Class, ClassMember, Constructor, Environment, Field, Method, Mixin,
  New, Node, NodeOfKind, Parameter, Program, Reference, Return, Self, Send, Singleton, Super, Test, Try, Variable
} from './model'
import { is, Kind } from './model'
import utils from './utils'

const { keys } = Object

type Code = string
type Level = 'Warning' | 'Error'

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node<'Linked'>
}

const problem = (level: Level) => <N extends Node<'Linked'>>(condition: (node: N) => boolean) => (node: N, code: Code): Problem | null =>
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

type HaveArgs = Method<'Linked'> | Constructor<'Linked'>

type notEmpty = Program<'Linked'> | Test<'Linked'> | Method<'Linked'>

const canBeCalledWithArgs = (member1: HaveArgs, member2: HaveArgs) =>
  ((member2.parameters[member2.parameters.length - 1].isVarArg && member1.parameters.length >= member2.parameters.length)
    || member2.parameters.length === member1.parameters.length) && member1 !== member2

const matchingConstructors =
  (list: ReadonlyArray<ClassMember<'Linked'>>, member: Constructor<'Linked'>) =>
    list.some(m => m.kind === 'Constructor' && canBeCalledWithArgs(m, member))

const matchingSignatures =
  (list: ReadonlyArray<ClassMember<'Linked'>>, member: Method<'Linked'>) =>
    list.some(m => m.kind === 'Method' && m.name === member.name && canBeCalledWithArgs(m, member))

const isNotEmpty = (node: notEmpty) => node.body!.sentences.length !== 0

const isNotAbstractClass = (node: Class<'Linked'>) =>
  node.members.some(member => is('Method')(member) && isNotEmpty(member))

export const validations = (environment: Environment) => {
  const { parentOf, firstAncestorOfKind, resolveTarget } = utils(environment)

  return {

    nameIsPascalCase: warning<Mixin<'Linked'> | Class<'Linked'>>(node =>
      /^[A-Z]$/.test(node.name[0])
    ),

    nameIsCamelCase: warning<Parameter<'Linked'> | Singleton<'Linked'> | Variable<'Linked'>>(node => node.name !== undefined &&
      /^[a-z]$/.test(node.name[0])
    ),

    onlyLastParameterIsVarArg: error<Method<'Linked'>>(node =>
      node.parameters.findIndex(p => p.isVarArg) + 1 === (node.parameters.length)
    ),

    nameIsNotKeyword: error<Reference<'Linked'> | Method<'Linked'> | Variable<'Linked'>>(node => !['.', ',', '(', ')', ';', '_', '{', '}',
      'import', 'package', 'program', 'test', 'mixed with', 'class', 'inherits', 'object', 'mixin',
      'var', 'const', '=', 'override', 'method', 'native', 'constructor',
      'self', 'super', 'new', 'if', 'else', 'return', 'throw', 'try', 'then always', 'catch', ':', '+',
      'null', 'false', 'true', '=>'].includes(node.name)),

    hasCatchOrAlways: error<Try<'Linked'>>(t => t.catches.length > 0 || t.always.sentences.length > 0 && t.body.sentences.length > 0),

    singletonIsNotUnnamed: error<Singleton<'Linked'>>(node => (parentOf(node).kind === 'Package') && node.name !== undefined),

    /* importHasNotLocalReference: error<Import>(node =>
       (parentOf(node) as Package).members.every(({ name }) => name !== node.reference.name)
     ),*/

    nonAsignationOfFullyQualifiedReferences: error<Assignment<'Linked'>>(node => !node.reference.name.includes('.')),

    fieldNameDifferentFromTheMethods: error<Field<'Linked'>>(node => parentOf<Class<'Linked'>>(node).members.
      filter(is('Method')).every(({ name }) => name !== node.name)),

    methodsHaveDistinctSignatures: error<Class<'Linked'>>(node => node.members
      .every(member => is('Method')(member) && !matchingSignatures(node.members, member)
      )),

    constructorsHaveDistinctArity: error<Constructor<'Linked'>>(node => parentOf<Class<'Linked'>>(node).members
      .every(member => is('Constructor')(member) && !matchingConstructors(parentOf<Class<'Linked'>>(node).members, member)
      )),

    methodNotOnlyCallToSuper: warning<Method<'Linked'>>(node =>
      !(node.body!.sentences.length === 1 && node.body!.sentences[0].kind === 'Super')),

    testIsNotEmpty: warning<Test<'Linked'>>(node => isNotEmpty(node)),

    programIsNotEmpty: warning<Program<'Linked'>>(node => isNotEmpty(node)),

    instantiationIsNotAbstractClass: error<New<'Linked'>>(node =>
      isNotAbstractClass(resolveTarget(node.className))),

    notAssignToItself: error<Assignment<'Linked'>>(node => !(node.value.kind === 'Reference' && node.value.name === node.reference.name)),

    notAssignToItselfInVariableDeclaration: error<Field<'Linked'>>(node =>
      !(is('Reference')(node.value!) && (node.value! as Reference<'Linked'>).name === node.name)
    ),


    dontCompareAgainstTrueOrFalse: warning<Send<'Linked'>>(
      node => node.message === '==' && (node.args[0] === Literal(true) || node.args[0] === Literal(false))
    ),


    // TODO: codigo repetido, lo sé, horrible
    selfIsNotInAProgram: error<Self<'Linked'>>(node => {
      try {
        firstAncestorOfKind('Program', node)
      } catch (e) {
        return true
      }
      return false
    }),

    noSuperInConstructorBody: error<Super<'Linked'>>(node => {
      try {
        firstAncestorOfKind('Constructor', node)
      } catch (e) {
        return true
      }
      return false
    }),

    noReturnStatementInConstructor: error<Return<'Linked'>>(node => {
      try {
        firstAncestorOfKind('Constructor', node)
      } catch (e) {
        return true
      }
      return false
    }),


    // TODO: Packages inside packages
    // notDuplicatedPackageName: error<Package>(node => !firstAncestorOfKind('Environment', node)
    // .members.some(packages => packages.name === node.name)),

  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (target: Node<'Linked'>, environment: Environment): ReadonlyArray<Problem> => {
  const { reduce } = utils(environment)

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
  } = validations(environment)

  const problemsByKind: { [K in Kind]: { [code: string]: (n: NodeOfKind<K, 'Linked'>, c: Code) => Problem | null } } = {
    Parameter: { nameIsCamelCase, },
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
  }

  return reduce<Problem[]>((found, node) => {
    const checks = problemsByKind[node.kind] as { [code: string]: (n: Node<'Linked'>, c: Code) => Problem | null }
    return [
      ...found,
      ...keys(checks).map(code => checks[code](node, code)!).filter(result => result !== null),
    ]
  })([], target)
}