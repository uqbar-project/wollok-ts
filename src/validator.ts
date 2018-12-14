// TODO:

// No members with the same selector las clases no puede tener
// fields que se llamen como sus metodos una clase no puede tener
// dos metodos con el mismo nombre y aridades que matcheen
// No imports of local references


// DONE
// Name capitalization
// Only one (the last) parameter can be vararg
// No references named as keywords
// No try without catch or always
// No unnamed singleton outside Literals
// No asignation of fully qualified references

import { isNil, keys, reject } from 'ramda'
import { Assignment, Class, ClassMember, Environment, Field, Import, Method, Mixin, Node, NodeKind, NodeOfKind, Package, Parameter, Reference, Singleton, Try, Variable } from './model'
import utils from './utils'

type Code = string
type Level = 'Warning' | 'Error'

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node
}

const problem = (level: Level) => <N extends Node>(condition: (node: N) => boolean) => (node: N, code: Code): Problem | null =>
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

const matchingSignatures =
  (list: ReadonlyArray<ClassMember>, member: Method) =>
    list.filter(m => m.kind === 'Method' && m.name === member.name && canBeCalledWithArgs(m.parameters.length, member) && m !== member)


const canBeCalledWithArgs = (parametersOfOtherMethod: number, member: Method) =>
  (member.parameters[member.parameters.length - 1].isVarArg || member.parameters.length === parametersOfOtherMethod)


export const validations = (environment: Environment) => {
  const { parentOf } = utils(environment)

  return {

    nameIsPascalCase: warning<Mixin | Class>(node =>
      /^[A-Z]$/.test(node.name[0])
    ),

    // TODO: Y las referencias cuando no son a superclases o mixines
    nameIsCamelCase: warning<Parameter>(node =>
      /^[a-z]$/.test(node.name[0])
    ),

    onlyLastParameterIsVarArg: error<Method>(node =>
      node.parameters.findIndex(p => p.isVarArg) + 1 === (node.parameters.length)
    ),

    nameIsNotKeyword: error<Reference | Method | Variable>(node => !['.', ',', '(', ')', ';', '_', '{', '}',
      'import', 'package', 'program', 'test', 'mixed with', 'class', 'inherits', 'object', 'mixin',
      'var', 'const', '=', 'override', 'method', 'native', 'constructor',
      'self', 'super', 'new', 'if', 'else', 'return', 'throw', 'try', 'then always', 'catch', ':', '+',
      'null', 'false', 'true', '=>'].includes(node.name)),

    hasCatchOrAlways: error<Try>(t => t.catches.length !== 0 || t.always.sentences.length !== 0 && t.body.sentences.length !== 0),

    singletonIsNotUnnamed: error<Singleton>(node => (parentOf(node).kind === 'Package') && node.name !== undefined),

    importHasNotLocalReference: error<Import>(node =>
      (parentOf(node) as Package).members.every(({ name }) => name !== node.reference.name)
    ),

    nonAsignationOfFullyQualifiedReferences: error<Assignment>(node => !node.reference.name.includes('.')),

    fieldNameDifferentFromTheMethods: error<Field>(node => (parentOf(node) as Class).members.
      filter((member): member is Method => member.kind === 'Method').every(({ name }) => name !== node.name)),

    methodsHaveDistinctSignatures: error<Class>(node => node.members
      .every(member => member.kind === 'Method'
        && matchingSignatures(node.members, member).length === 0
      )),
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (target: Node, environment: Environment): ReadonlyArray<Problem> => {
  const { reduce } = utils(environment)

  const {
    nameIsPascalCase,
    nameIsCamelCase,
    nameIsNotKeyword,
    onlyLastParameterIsVarArg,
    hasCatchOrAlways,
    singletonIsNotUnnamed,
    importHasNotLocalReference,
    nonAsignationOfFullyQualifiedReferences,
    fieldNameDifferentFromTheMethods,
    methodsHaveDistinctSignatures,
  } = validations(environment)

  const problemsByKind: { [K in NodeKind]: { [code: string]: (n: NodeOfKind<K>, c: Code) => Problem | null } } = {
    Parameter: { nameIsCamelCase, },
    Import: { importHasNotLocalReference },
    Body: {},
    Catch: {},
    Package: {},
    Program: {},
    Test: {},
    Class: { nameIsPascalCase, methodsHaveDistinctSignatures },
    Singleton: { singletonIsNotUnnamed },
    Mixin: { nameIsPascalCase },
    Constructor: {},
    Field: { fieldNameDifferentFromTheMethods },
    Method: { onlyLastParameterIsVarArg, nameIsNotKeyword },
    Variable: { nameIsNotKeyword },
    Return: {},
    Assignment: { nonAsignationOfFullyQualifiedReferences },
    Reference: { nameIsNotKeyword },
    Self: {},
    New: {},
    Literal: {},
    Send: {},
    Super: {},
    If: {},
    Throw: {},
    Try: { hasCatchOrAlways },
    Environment: {},
    Describe: {},
  }

  return reduce<Problem[]>((found, node) => {
    const checks = problemsByKind[node.kind] as { [code: string]: (n: Node, c: Code) => Problem | null }
    return [
      ...found,
      ...reject(isNil)(keys(checks).map(code => checks[code](node, code))),
    ]
  })([], target)
}