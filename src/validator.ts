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
import { Class, If,  Mixin, Module, NamedArgument, Package, Self, Sentence, Test } from './model'
import { duplicates } from './extensions'
import { Assignment, Body, Entity, Expression, Field, is, Kind, List, Method, New, Node, NodeOfKind, Parameter, Send, Singleton, SourceMap, Try, Variable } from './model'
import { isEmpty, last, notEmpty } from './extensions'

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

export const shouldNotBeEmpty = warning<Body>(node =>
  node.isSynthetic() || node.parent().is('Method') || notEmpty(node.sentences)
)

export const isNotWithin = (kind: Kind):  (node: Node, code: Code) => Problem | null =>
  error(node => node.isSynthetic() || !node.ancestors().some(is(kind)))

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

export const nameShouldBeginWithUppercase = nameMatches(/^[A-Z]/)

export const nameShouldBeginWithLowercase = nameMatches(/^[a-z_<]/)

export const nameShouldNotBeKeyword = error<Entity | Parameter | Variable | Field | Method>(node =>
  !KEYWORDS.includes(node.name || ''),
node => [node.name || ''],
)

export const inlineSingletonShouldBeAnonymous = error<Singleton>(
  singleton => singleton.parent().is('Package') || !singleton.name
)

export const topLevelSingletonShouldHaveAName = error<Singleton>(
  singleton => !singleton.parent().is('Package') || !!singleton.name
)

export const onlyLastParameterCanBeVarArg = error<Method>(node => {
  const varArgIndex = node.parameters.findIndex(p => p.isVarArg)
  return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
})

export const shouldHaveCatchOrAlways = error<Try>(node =>
  notEmpty(node.catches) || notEmpty(node.always.sentences)
)

export const methodShouldHaveDifferentSignature = error<Method>(node => {
  return node.parent().methods().every(other => node === other || !other.matchesSignature(node.name, node.parameters.length))
})

export const shouldNotOnlyCallToSuper = warning<Method>(node => {
  const callsSuperWithSameArgs = (sentence?: Sentence) => sentence?.is('Super') && sentence.args.every((arg, index) => arg.is('Reference') && arg.target() === node.parameters[index])
  return isEmpty(node.sentences()) || !node.sentences().every(sentence =>
    callsSuperWithSameArgs(sentence) || sentence.is('Return') && callsSuperWithSameArgs(sentence.value)
  )
})

export const shouldNotInstantiateAbstractClass = error<New>(node => !node.instantiated.target()?.isAbstract())

export const shouldNotAssignToItself = error<Assignment>(node => {
  const assigned = node.variable.target()
  return !(node.value.is('Reference') && assigned && assigned === node.value.target())
})

export const shouldNotReassignConst = error<Assignment>(node => !node?.variable?.target()?.isConstant && !node?.variable?.target()?.is('Parameter'))

export const shouldNotHaveLoopInHierarchy = error<Class | Mixin>(node => !allParents(node).includes(node))

export const shouldNotAssignToItselfInDeclaration = error<Field | Variable>(node => !node.value.is('Reference') || node.value.target() !== node)

export const shouldNotCompareAgainstBooleanLiterals = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return !['==', '!=', '===', '!==', 'equals'].includes(node.message) || !arg || !(isBooleanLiteral(arg, true) || isBooleanLiteral(arg, false) || isBooleanLiteral(node.receiver, true) || isBooleanLiteral(node.receiver, false))
})

export const shouldUseSelfAndNotSingletonReference = warning<Send>(node => {
  const receiver = node.receiver
  return !receiver.is('Reference') || !receiver.ancestors().includes(receiver.target()!)
})

export const shouldOnlyInheritFromMixin = error<Mixin>(node => !node.supertypes.some(parent => !parent.reference.target()?.is('Mixin')))

export const shouldUseOverrideKeyword = warning<Method>(node =>
  node.isOverride || !superclassMethod(node)
)

export const possiblyReturningBlock = warning<Method>(node => {
  const singleSentence = node.sentences()[0]
  return !(node.sentences().length === 1 && singleSentence.isSynthetic() && singleSentence.is('Return') && singleSentence.value?.is('Singleton') && singleSentence.value.isClosure())
})

export const shouldNotUseOverride = error<Method>(node =>
  !node.isOverride || !!superclassMethod(node)
)

export const namedArgumentShouldExist = error<NamedArgument>(node => {
  const parent = getReferencedModule(node.parent())
  return !!parent && parent.hasField(node.name)
})

export const namedArgumentShouldNotAppearMoreThanOnce = warning<NamedArgument>(node =>  {
  const nodeParent = node.parent()
  let siblingArguments: List<NamedArgument> | undefined
  if (nodeParent.is('New')) siblingArguments = nodeParent.args
  return !siblingArguments || siblingArguments.filter(_ => _.name === node.name).length === 1
})

export const linearizationShouldNotRepeatNamedArguments = warning<Singleton | Class>(node =>  {
  const allNamedArguments = node.supertypes.flatMap(parent => parent.args.map(_ => _.name))
  return isEmpty(duplicates(allNamedArguments))
})

export const shouldPassValuesToAllAttributes = error<New>(node => {
  const target = node.instantiated.target()!
  const initializers = node.args.map(_ => _.name)
  const uninitializedAttributes = getUninitializedAttributes(target, initializers)
  return isEmpty(uninitializedAttributes)
})

export const shouldInitializeAllAttributes = error<Singleton>(node => {
  const uninitializedAttributes = getUninitializedAttributes(node)
  return isEmpty(uninitializedAttributes)
})

export const shouldNotUseSelf = error<Self>(node => {
  const ancestors = node.ancestors()
  return node.isSynthetic() || !ancestors.some(is('Program')) || ancestors.some(is('Singleton'))
})

export const shouldNotDefineMoreThanOneSuperclass = error<Class | Singleton>(node =>
  targetSupertypes(node).filter(_ => !!_ && _.is('Class')).length <= 1
)

export const superclassShouldBeLastInLinearization = error<Class | Singleton>(node => {
  const parents = targetSupertypes(node)
  const hasSuperclass = notEmpty(parents.filter(_ => !!_ && _.is('Class')))
  const lastParentInHierarchy = last(parents)
  return !hasSuperclass || !!lastParentInHierarchy && lastParentInHierarchy.is('Class')
})

export const shouldMatchSuperclassReturnValue = error<Method>(node => {
  if (!node.isOverride) return true
  const overridenMethod = superclassMethod(node)
  if (!overridenMethod || overridenMethod.isAbstract() || overridenMethod.isNative()) return true
  const lastSentence = last(node.sentences())
  const superclassSentence = last(overridenMethod.sentences())
  return !lastSentence || !superclassSentence || lastSentence.is('Return') === superclassSentence.is('Return') || lastSentence.is('Throw') || superclassSentence.is('Throw')
})

export const shouldReturnAValueOnAllFlows = error<If>(node => {
  const lastThenSentence = last(node.thenBody.sentences)
  const lastElseSentence = last(node.elseBody.sentences)
  // TODO: For Send, consider if expression returns a value
  const singleFlow = !lastElseSentence && lastThenSentence && finishesFlow(lastThenSentence, node)
  const rightCombinations: Record<string, string[]> = {
    'Return': ['Return', 'Throw', 'Send'],
    'Throw': ['Return', 'Throw', 'Send', 'Literal'],
    'Send': ['Return', 'Throw', 'Send', 'Literal'],
    'Literal': ['Literal', 'Throw', 'Send'],
    'Assignment': ['Throw', 'Send', 'Assignment'],
  }

  const twoFlows = !!lastThenSentence && !!lastElseSentence && rightCombinations[lastThenSentence.kind]?.includes(lastElseSentence.kind)
  return singleFlow || twoFlows
})

export const shouldNotDuplicateFields = error<Field>(node =>
  node.parent().allFields().filter(_ => _.name == node.name).length === 1
)

export const parameterShouldNotDuplicateExistingVariable = error<Parameter>(node => {
  const nodeMethod = getVariableContainer(node)
  const parameterNotDuplicated = (nodeMethod as Method).parameters?.filter(parameter => parameter.name == node.name).length <= 1
  return parameterNotDuplicated && !hasDuplicatedVariable(nodeMethod, node.name)
})

export const shouldNotDuplicateLocalVariables = error<Variable>(node => {
  if (isGlobal(node)) return true

  const container = getVariableContainer(node)
  const duplicateReference = getAllReferences(container).filter(reference => reference.name == node.name).length > 1
  return !duplicateReference && !hasDuplicatedVariable(container, node.name) && (container.is('Test') || !container.parameters.some(_ => _.name == node.name))
})

export const shouldNotDuplicateGlobalDefinitions = error<Module | Variable>(node =>
  !node.name || !node.parent().is('Package') || (node.parent() as Package).members.filter(child => child.name == node.name).length === 1
)

export const shouldNotDuplicateVariablesInLinearization = error<Module>(node => {
  const allFields = node.allFields().filter(field => !node.fields().includes(field)).map(_ => _.name)
  return allFields.length === new Set(allFields).size
})

export const shouldImplementAbstractMethods = error<Singleton>(node => {
  const allMethods = node.allMethods()
  return isEmpty(allMethods.filter(method => method.isAbstract() && !isImplemented(allMethods, method)))
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const allParents = (module: Module) =>
  module.supertypes.map(supertype => supertype.reference.target()).flatMap(supertype => supertype?.hierarchy() ?? [])

const getReferencedModule = (parent: Node): Module | undefined => {
  if (parent.kind === 'ParameterizedType') return parent.reference.target()
  if (parent.kind === 'New') return parent.instantiated.target()
  return undefined
}

const uninitializedValue = (value: Expression | undefined) => value && value.is('Literal') && !value.value && value.isSynthetic()

const getUninitializedAttributes = (node: Module, initializers: string[] = []): string[] => {
  const uninitializedAttributes: string[] = []
  node.defaultFieldValues()?.forEach(
    (value, field) => {
      if (uninitializedValue(value) && !initializers.includes(field.name)) {
        uninitializedAttributes.push(field.name)
      }
    })
  return uninitializedAttributes
}

const isBooleanLiteral = (node: Expression, value: boolean) => node.is('Literal') && node.value === value

const targetSupertypes = (node: Class | Singleton) => node.supertypes.map(_ => _?.reference.target())

const superclassMethod = (node: Method) => node.parent().lookupMethod(node.name, node.parameters.length, { lookupStartFQN: node.parent().fullyQualifiedName(), allowAbstractMethods: true })

const finishesFlow = (sentence: Sentence, node: Node): boolean => {
  const parent = node.parent()
  const lastLineOnMethod = parent.is('Body') ? last(parent.sentences) : undefined
  const returnCondition = (sentence.is('Return') && lastLineOnMethod !== node && lastLineOnMethod?.is('Return') || lastLineOnMethod?.is('Throw')) ?? false
  return sentence.is('Throw') || sentence.is('Send') || sentence.is('Assignment') || sentence.is('If') || returnCondition
}

const isGlobal = (node: Variable) => node.parent().is('Package') || node.parent().is('Program') || node.parent().parent().is('Program')

const getVariableContainer = (node: Node): Method | Test => {
  let nodeContainer = node.parent()
  while (!nodeContainer.is('Method') && !nodeContainer.is('Test')) {
    nodeContainer = nodeContainer.parent()
  }
  return nodeContainer
}

const getAllReferences = (node: Method | Test): List<Variable> => node.sentences().filter(sentence => sentence.is('Variable')) as List<Variable>

const hasDuplicatedVariable = (node: Method | Test, variableName: string): boolean => {
  const parent = node.parent() as Class | Singleton | Mixin
  return parent.hierarchy().flatMap(_ => _.allFields()).some(_ => _.name == variableName)
}

const isImplemented = (allMethods: List<Method>, method: Method): boolean => {
  return allMethods.some(someMethod => method.matchesSignature(someMethod.name, someMethod.parameters.length) && !someMethod.isAbstract())
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const validationsByKind: {[K in Kind]: Record<Code, Validation<NodeOfKind<K>>>} = {
  Parameter: { nameShouldBeginWithLowercase, nameShouldNotBeKeyword, parameterShouldNotDuplicateExistingVariable },
  ParameterizedType: { },
  NamedArgument: { namedArgumentShouldExist, namedArgumentShouldNotAppearMoreThanOnce },
  Import: {},
  Body: { shouldNotBeEmpty },
  Catch: {},
  Package: {},
  Program: { nameShouldNotBeKeyword },
  Test: { },
  Class: { nameShouldBeginWithUppercase, nameShouldNotBeKeyword, shouldNotHaveLoopInHierarchy, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization },
  Singleton: { nameShouldBeginWithLowercase, inlineSingletonShouldBeAnonymous, topLevelSingletonShouldHaveAName, nameShouldNotBeKeyword, shouldInitializeAllAttributes, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementAbstractMethods },
  Mixin: { nameShouldBeginWithUppercase, shouldNotHaveLoopInHierarchy, shouldOnlyInheritFromMixin, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization },
  Field: { nameShouldBeginWithLowercase, shouldNotAssignToItselfInDeclaration, nameShouldNotBeKeyword, shouldNotDuplicateFields },
  Method: { onlyLastParameterCanBeVarArg, nameShouldNotBeKeyword, methodShouldHaveDifferentSignature, shouldNotOnlyCallToSuper, shouldUseOverrideKeyword, possiblyReturningBlock, shouldNotUseOverride, shouldMatchSuperclassReturnValue },
  Variable: { nameShouldBeginWithLowercase, nameShouldNotBeKeyword, shouldNotAssignToItselfInDeclaration, shouldNotDuplicateLocalVariables, shouldNotDuplicateGlobalDefinitions },
  Return: {  },
  Assignment: { shouldNotAssignToItself, shouldNotReassignConst },
  Reference: { },
  Self: { shouldNotUseSelf },
  New: { shouldNotInstantiateAbstractClass, shouldPassValuesToAllAttributes },
  Literal: {},
  Send: { shouldNotCompareAgainstBooleanLiterals, shouldUseSelfAndNotSingletonReference },
  Super: {  },
  If: { shouldReturnAValueOnAllFlows },
  Throw: {},
  Try: { shouldHaveCatchOrAlways },
  Environment: {},
  Describe: { shouldNotDuplicateGlobalDefinitions },
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