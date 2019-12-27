// TODO:
// No imports of local references
// No siblings with the same name
// No global mutable vars
// No modules named wollok
import { last } from './extensions'
import {
  Assignment,
  Class,
  ClassMember,
  Constructor,
  Field,
  Kind,
  Linked,
  Method,
  Mixin,
  New,
  Node,
  NodeOfKind,
  Parameter,
  Program,
  Reference,
  Return,
  Self,
  Send,
  Singleton,
  Super,
  Test,
  Try,
  Variable,
} from './model'


const { keys } = Object

type Code = string
type Level = 'Warning' | 'Error'

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node<Linked>
  readonly values: string[]
}

const problem = (level: Level) => <N extends Node<Linked>>(
  condition: (node: N) => boolean,
  values: (node: N) => string[] = () => []
) => (node: N, code: Code): Problem | null =>
    !condition(node)
      ? {
        level,
        code,
        node,
        values: values(node),
      }
      : null

const warning = problem('Warning')

const error = problem('Error')

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type HaveArgs = Method<Linked> | Constructor<Linked>

type notEmpty = Program<Linked> | Test<Linked> | Method<Linked>

const canBeCalledWithArgs = (member1: HaveArgs, member2: HaveArgs) =>
  ((hasVarArg(member2) &&
    member1.parameters.length >= member2.parameters.length) ||
    member2.parameters.length === member1.parameters.length) &&
  member1 !== member2

const matchingConstructors = (
  constructors: ReadonlyArray<ClassMember<Linked>>,
  constructor: Constructor<Linked>
) => constructors.some(c => c.kind === 'Constructor' && canBeCalledWithArgs(c, constructor))

const matchingSignatures = (
  methods: ReadonlyArray<ClassMember<Linked>>,
  method: Method<Linked>
) =>
  methods.some(
    m =>
      m.kind === 'Method' &&
      m.name === method.name &&
      canBeCalledWithArgs(m, method)
  )

const isNotEmpty = (node: notEmpty) => node.body?.sentences.length !== 0

const isNotAbstractClass = (clazz: Class<Linked>) => {
  const methods = clazz.methods()
  return (methods.length === 0) || methods.some(method => isNotEmpty(method))
}

const isNotPresentIn = <N extends Node<Linked>>(kind: Kind) =>
  error<N>((node: N) => !node.closestAncestor(kind))

// TODO: Why are we exporting this as a single object?
export const validations = {
  nameIsPascalCase: warning<Mixin<Linked> | Class<Linked>>(node =>
    /^[A-Z]$/.test(node.name[0])
  ),

  nameIsCamelCase: warning<
    Singleton<Linked>
  >(node => !node.name || /^[a-z]$/.test(node.name[0])),

  referenceNameIsValid: warning<
    Parameter<Linked> | Variable<Linked>
  >(node => node.name !== undefined && /^[a-z\_]$/.test(node.name[0])),

  onlyLastParameterIsVarArg: error<Method<Linked>>(method => {
    const varArgIndex = method.parameters.findIndex(parameter => parameter.isVarArg)
    const methodHasVarArg = varArgIndex > -1
    return (
      !methodHasVarArg || varArgIndex + 1 === method.parameters.length
    )
  }),

  nameIsNotKeyword: error<
    Reference<Linked> | Method<Linked> | Variable<Linked>
  >(
    node =>
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
      ].includes(node.name)
  ),

  hasCatchOrAlways: error<Try<Linked>>(
    t =>
      t.catches?.length > 0 ||
      (t.always?.sentences.length > 0 && t.body?.sentences.length > 0)
  ),

  singletonIsNotUnnamed: error<Singleton<Linked>>(
    singleton => singleton.parent().is('Literal') || !!singleton.name,
  ),

  nonAsignationOfFullyQualifiedReferences: error<Assignment<Linked>>(
    node => !node.variable.name.includes('.')
  ),

  methodsHaveDistinctSignatures: error<Class<Linked>>(clazz =>
    clazz.methods().every(method => !matchingSignatures(clazz.members, method))
  ),

  constructorsHaveDistinctArity: error<Constructor<Linked>>(originalConstructor =>
    originalConstructor
      .parent()
      .constructors().every(
        constructor =>
          !matchingConstructors(originalConstructor.parent().members, constructor)
      )
  ),

  methodNotOnlyCallToSuper: warning<Method<Linked>>(
    method =>
      method.isNative ||
      !(
        method.body?.sentences.length === 1 &&
        method.body?.sentences[0].is('Super')
      )
  ),

  containerIsNotEmpty: warning<Test<Linked> | Program<Linked>>(node =>
    isNotEmpty(node)
  ),

  instantiationIsNotAbstractClass: error<New<Linked>>(node =>
    isNotAbstractClass(node.instantiated.target())
  ),

  notAssignToItself: error<Assignment<Linked>>(
    node =>
      !(
        node.value.kind === 'Reference' &&
        node.value.name === node.variable.name
      )
  ),

  notAssignToItselfInVariableDeclaration: error<Field<Linked>>(
    node => !(node.value!.is('Reference') && node.value!.name === node.name)
  ),

  dontCompareAgainstTrueOrFalse: warning<Send<Linked>>(
    call =>
      call.message !== '==' ||
      (call.message === '==' && !(call.args[0].is('Literal') && [true, false].includes(call.args[0].value as boolean)))
  ),

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
    referenceNameIsValid,
    nameIsNotKeyword,
    onlyLastParameterIsVarArg,
    hasCatchOrAlways,
    singletonIsNotUnnamed,
    nonAsignationOfFullyQualifiedReferences,
    methodsHaveDistinctSignatures,
    constructorsHaveDistinctArity,
    methodNotOnlyCallToSuper,
    containerIsNotEmpty,
    instantiationIsNotAbstractClass,
    selfIsNotInAProgram,
    notAssignToItself,
    notAssignToItselfInVariableDeclaration,
    dontCompareAgainstTrueOrFalse,
    noSuperInConstructorBody,
    noReturnStatementInConstructor,
  } = validations

  const problemsByKind: {
    [K in Kind]: {
      [code: string]: (n: NodeOfKind<K, Linked>, c: Code) => Problem | null
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
    Class: { nameIsPascalCase, methodsHaveDistinctSignatures },
    Singleton: { nameIsCamelCase, singletonIsNotUnnamed },
    Mixin: { nameIsPascalCase },
    Constructor: { constructorsHaveDistinctArity },
    Field: {
      notAssignToItselfInVariableDeclaration,
    },
    Method: {
      onlyLastParameterIsVarArg,
      nameIsNotKeyword,
      methodNotOnlyCallToSuper,
    },
    Variable: { referenceNameIsValid, nameIsNotKeyword },
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
    const checks = problemsByKind[node.kind] as {
      [code: string]: (n: Node<Linked>, c: Code) => Problem | null
    }
    return [
      ...found,
      ...keys(checks)
        .map(code => checks[code](node, code)!)
        .filter(result => result !== null),
    ]
  }, [])
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// EXTRA FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// const hasParameters = (member: HaveArgs) => member.parameters.length > 0

const hasVarArg = (member: HaveArgs) =>
  last(member.parameters)?.isVarArg || false
