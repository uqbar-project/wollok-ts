// TODO:
// No imports of local definitions or imports of duplicated names
// No siblings with the same name
// No global mutable vars
// No modules named wollok
// Generic import of non package

import { Assignment, Class, Field, Method, Mixin, New, Node, NodeOfKind, Parameter, Program, Reference, Self, Send, Singleton, Test, Try, Variable, is, Source, List } from './model'
import { Kind } from './model'

const { keys } = Object

type Code = string
type Level = 'Warning' | 'Error'

export type Validation<N extends Node> = (node: N, code: Code) => Problem | null

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node
  readonly values: List<string>
  readonly source: Source // TODO: Wouldn't it be best if this is an optional field?
}

const EMPTY_SOURCE: Source = {
  start: { offset: 0, line: 0, column: 0 },
  end: { offset: 0, line: 0, column: 0 },
}

const problem = (level: Level) => <N extends Node>(
  condition: (node: N) => boolean,
  values: (node: N) => string[] = () => [],
  source: (node: N) => Source = (node) => ({ start: node.source!.start, end: node.source!.end, file: node.source!.file }),
) => (node: N, code: Code): Problem | null =>
    !condition(node)
      ? {
        level,
        code,
        node,
        values: values(node),
        source: node.source ? source(node) : EMPTY_SOURCE,
      }
      : null

const warning = problem('Warning')

const error = problem('Error')

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const isNotEmpty = (node: Program | Test | Method) => node.sentences().length !== 0

const isNotPresentIn = <N extends Node>(kind: Kind) => error<N>((node: N) => !node.source || !node.ancestors().some(is(kind)))

// TODO: Why are we exporting this as a single object?
export const validations = {
  nameBeginsWithUppercase: warning<Mixin | Class>(
    node => /^[A-Z]/.test(node.name),
    node => [node.name],
    node => {
      const nodeOffset = node.kind.length + 1
      const { start, end } = node.source!
      return {
        start: {
          ...start,
          offset: nodeOffset,
        },
        end: {
          ...end,
          offset: node.name.length + nodeOffset,
        },
      }
    }
  ),

  nameBeginsWithLowercase: warning<Singleton>(
    node => /^[a-z_<]/.test(node.name ?? 'ok'),
    node => [node.name ?? '']
  ),

  referenceNameIsValid: warning<Parameter | Variable>(node => /^[a-z_<]/.test(node.name ?? 'ok')),

  onlyLastParameterIsVarArg: error<Method>(node => {
    const varArgIndex = node.parameters.findIndex(p => p.isVarArg)
    return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
  }),

  nameIsNotKeyword: error<Reference<any> | Method | Variable | Class | Singleton>(node =>
    ![
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
      'null',
      'false',
      'true',
    ].includes(node.name || ''),
  node => [node.name || ''],
  ),

  hasCatchOrAlways: error<Try>(
    t =>
      t.catches?.length > 0 ||
      t.always?.sentences.length > 0 && t.body?.sentences.length > 0
  ),

  singletonIsNotUnnamed: error<Singleton>(
    singleton => singleton.parent().is('Literal') || !!singleton.name,
  ),

  nonAsignationOfFullyQualifiedReferences: error<Assignment>(
    node => !node.variable.name.includes('.')
  ),

  hasDistinctSignature: error<Method>(node => {
    return node.parent().methods().every(other => node === other || !other.matchesSignature(node.name, node.parameters.length))
  }),

  methodNotOnlyCallToSuper: warning<Method>(node =>
    !node.sentences().length || !node.sentences().every(sentence =>
      sentence.is('Super') && sentence.args.every((arg, index) => arg.is('Reference') && arg.target() === node.parameters[index])
    )
  ),

  containerIsNotEmpty: warning<Test | Program>(node =>
    isNotEmpty(node)
  ),

  instantiationIsNotAbstractClass: error<New>(node => !node.instantiated.target()?.isAbstract()),

  notAssignToItself: error<Assignment>(node => !(node.value.is('Reference') && node.value.name === node.variable.name)),

  notAssignToItselfInVariableDeclaration: error<Field>(
    node => !(node.value.is('Reference') && node.value.name === node.name)
  ),

  dontCompareAgainstTrueOrFalse: warning<Send>(node => {
    if(node.message !== '==') return true
    const arg = node.args[0]
    return !arg.is('Literal') || arg.value !== true && arg.value !== false
  }),

  // TODO: Change to a validation on ancestor of can't contain certain type of descendant. More reusable.
  selfIsNotInAProgram: isNotPresentIn<Self>('Program'),

  // TODO: Packages inside packages
  // notDuplicatedPackageName: error<Package>(node => !firstAncestorOfKind('Environment', node)
  // .members.some(packages => packages.name === node.name)),
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (target: Node): List<Problem> => {
  const {
    nameBeginsWithUppercase,
    nameBeginsWithLowercase,
    referenceNameIsValid,
    nameIsNotKeyword,
    onlyLastParameterIsVarArg,
    hasDistinctSignature,
    methodNotOnlyCallToSuper,
    containerIsNotEmpty,
    notAssignToItselfInVariableDeclaration,
    singletonIsNotUnnamed,
    selfIsNotInAProgram,
    nonAsignationOfFullyQualifiedReferences,
    hasCatchOrAlways,
    instantiationIsNotAbstractClass,
    dontCompareAgainstTrueOrFalse,
    notAssignToItself,
  } = validations

  const problemsByKind: {
    [K in Kind]: {
      [code: string]: (n: NodeOfKind<K>, c: Code) => Problem | null
    }
  } = {
    Parameter: { referenceNameIsValid },
    NamedArgument: {},
    Import: {},
    Body: {},
    Catch: {},
    Package: {},
    Program: { containerIsNotEmpty },
    Test: { containerIsNotEmpty },
    Class: { nameBeginsWithUppercase, nameIsNotKeyword },
    Singleton: { nameBeginsWithLowercase, singletonIsNotUnnamed, nameIsNotKeyword },
    Mixin: { nameBeginsWithUppercase },
    Field: { notAssignToItselfInVariableDeclaration },
    Method: { onlyLastParameterIsVarArg, nameIsNotKeyword, hasDistinctSignature, methodNotOnlyCallToSuper },
    Variable: { referenceNameIsValid, nameIsNotKeyword },
    Return: {  },
    Assignment: { nonAsignationOfFullyQualifiedReferences, notAssignToItself },
    Reference: { nameIsNotKeyword },
    Self: { selfIsNotInAProgram },
    New: { instantiationIsNotAbstractClass },
    Literal: {},
    Send: { dontCompareAgainstTrueOrFalse },
    Super: {  },
    If: {},
    Throw: {},
    Try: { hasCatchOrAlways },
    Environment: {},
    Describe: {},
  }

  return target.reduce<Problem[]>((found, node) => {
    const checks = problemsByKind[node.kind] as {
      [code: string]: (n: Node, c: Code) => Problem | null
    }
    return [
      ...found,
      ...target.problems?.map(({ code }) => ({ code, level: 'Error', node: target, values: [], source: node.source ?? EMPTY_SOURCE } as const)  ) ?? [],
      ...keys(checks)
        .map(code => checks[code](node, code)!)
        .filter(result => result !== null),
    ]
  }, [])
}