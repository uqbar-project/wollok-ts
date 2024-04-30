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
import { EXCEPTION_MODULE, INITIALIZE_METHOD, KEYWORDS, PROGRAM_FILE_EXTENSION, TEST_FILE_EXTENSION } from '../constants'
import { List, TypeDefinition, count, duplicates, is, isEmpty, last, match, notEmpty, otherwise, when } from '../extensions'
// - Unified problem type
import { Assignment, Body, Catch, Class, Code, Describe, Entity, Expression, Field, If, Import,
  Level, Literal, Method, Mixin, Module, NamedArgument, New, Node, Package, Parameter,
  Problem,
  Program, Reference, Return, Self, Send, Sentence, Singleton, SourceMap, Super, Test, Throw, Try, Variable } from '../model'
import { allParents, assignsVariable, duplicatesLocalVariable, entityIsAlreadyUsedInImport, findMethod, finishesFlow, getContainer, getInheritedUninitializedAttributes, getReferencedModule, getUninitializedAttributesForInstantiation, getVariableContainer, hasDuplicatedVariable, inheritsCustomDefinition, isAlreadyUsedInImport, hasBooleanValue, isBooleanMessage, isBooleanOrUnknownType, isEqualMessage, isGetter, isImplemented, isUninitialized, loopInAssignment, methodExists, methodIsImplementedInSuperclass, methodsCallingToSuper, referencesSingleton, returnsAValue, returnsValue, sendsMessageToAssert, superclassMethod, supposedToReturnValue, targetSupertypes, unusedVariable, usesReservedWords, valueFor } from '../helpers'
import { sourceMapForBody, sourceMapForConditionInIf, sourceMapForNodeName, sourceMapForNodeNameOrFullNode, sourceMapForOnlyTest, sourceMapForOverrideMethod, sourceMapForUnreachableCode } from './sourceMaps'
import { valuesForNodeName } from './values'

const { entries } = Object

const RESERVED_WORDS = ['null', 'false', 'true']
  .concat(Object.values(KEYWORDS))
  .filter(word => word !== 'and')

export type Validation<N extends Node> = (node: N, code: Code) => Problem | null

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
  node.isEmpty()
)

export const isNotWithin = <N extends Node>(kind: TypeDefinition<N>): (node: N, code: Code) => Problem | null =>
  error((node: N) => !node.ancestors.some(is(kind)) || node.isSynthetic)

export const nameMatches = (regex: RegExp): (node: Node & { name: string }, code: Code) => Problem | null =>
  warning(
    node => !node.name || regex.test(node.name),
    valuesForNodeName,
    sourceMapForNodeName,
  )

export const nameShouldBeginWithUppercase = nameMatches(/^[A-Z]/)

export const nameShouldBeginWithLowercase = nameMatches(/^[a-z_<]/)

export const nameShouldNotBeKeyword = error<Parameter | Variable | Field | Method>(node =>
  !RESERVED_WORDS.includes(node.name || ''),
valuesForNodeName,
sourceMapForNodeName,
)

export const inlineSingletonShouldBeAnonymous = error<Singleton>(
  singleton => singleton.parent.is(Package) || !singleton.name,
  valuesForNodeName,
  sourceMapForNodeName,
)

export const topLevelSingletonShouldHaveAName = error<Singleton>(
  singleton => !singleton.parent.is(Package) || !!singleton.name
)

export const onlyLastParameterCanBeVarArg = error<Method>(node => {
  const varArgIndex = node.parameters.findIndex(parameter => parameter.isVarArg)
  return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
})

export const shouldHaveCatchOrAlways = error<Try>(node =>
  notEmpty(node.catches) || notEmpty(node.always.sentences)
)

export const methodShouldHaveDifferentSignature = error<Method>(node =>
  node.parent.methods.every(parentMethod => node === parentMethod || !parentMethod.matchesSignature(node.name, node.parameters.length))
)

export const shouldNotOnlyCallToSuper = warning<Method>(node => {
  const callsSuperWithSameArgs = (sentence?: Sentence) => sentence?.is(Super) && sentence.args.every((arg, index) => arg.is(Reference) && arg.target === node.parameters[index])
  return isEmpty(node.sentences) || !node.sentences.every(sentence =>
    callsSuperWithSameArgs(sentence) || sentence.is(Return) && callsSuperWithSameArgs(sentence.value)
  )
}, undefined, sourceMapForBody)

export const shouldNotInstantiateAbstractClass = error<New>(node => !node.instantiated.target?.isAbstract)

export const shouldNotAssignToItself = error<Assignment>(node => {
  const assigned = node.variable.target
  return !(node.value.is(Reference) && assigned && assigned === node.value.target)
})

export const shouldNotReassignConst = error<Assignment>(node => {
  const target = node?.variable?.target
  const referenceIsNotConstant = !target || (target.is(Variable) || target?.is(Field)) && !target.isConstant
  return referenceIsNotConstant && !target?.is(Parameter)
})

// TODO: Test if the reference points to the right kind of node
export const missingReference = error<Reference<Node>>(node => !!node.target)

export const shouldNotHaveLoopInHierarchy = error<Class | Mixin>(node => !allParents(node).includes(node))

export const shouldNotAssignToItselfInDeclaration = error<Field | Variable>(node => !node.value.is(Reference) || node.value.target !== node)

export const shouldNotCompareAgainstBooleanLiterals = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return !isEqualMessage(node) || !arg || !(hasBooleanValue(arg, true) || hasBooleanValue(arg, false) || hasBooleanValue(node.receiver, true) || hasBooleanValue(node.receiver, false))
})

export const shouldUseSelfAndNotSingletonReference = warning<Reference<Node>>(node => {
  const target = node.target
  return !target || !target.is(Singleton) || !node.ancestors.includes(target)
})

export const shouldOnlyInheritFromMixin = error<Mixin>(node => node.supertypes.every(parent => {
  const target = parent.reference.target
  return !target || target.is(Mixin)
}))

export const shouldUseOverrideKeyword = warning<Method>(node =>
  node.isOverride || !superclassMethod(node) || node.name == INITIALIZE_METHOD
)

export const possiblyReturningBlock = warning<Method>(node => {
  if (node.sentences.length !== 1) return true
  const singleSentence = node.sentences[0]
  return !(singleSentence.isSynthetic && singleSentence.is(Return) && singleSentence.value?.is(Singleton) && singleSentence.value.isClosure(0))
})
//, undefined, sourceMapForReturnValue)

export const shouldNotUseOverride = error<Method>(node =>
  node.parent.is(Mixin) || !node.isOverride || !!superclassMethod(node)
, valuesForNodeName,
sourceMapForOverrideMethod)

export const namedArgumentShouldExist = error<NamedArgument>(node => {
  const parent = getReferencedModule(node.parent)
  return !parent || !!parent.lookupField(node.name)
}, valuesForNodeName, sourceMapForNodeName)

export const namedArgumentShouldNotAppearMoreThanOnce = warning<NamedArgument>(node => {
  const nodeParent = node.parent
  let siblingArguments: List<NamedArgument> | undefined
  if (nodeParent.is(New)) siblingArguments = nodeParent.args
  return !siblingArguments || count(siblingArguments, _ => _.name === node.name) === 1
}, valuesForNodeName, sourceMapForNodeName)

export const linearizationShouldNotRepeatNamedArguments = warning<Singleton | Class>(node => {
  const allNamedArguments = node.supertypes.flatMap(parent => parent.args.map(_ => _.name))
  return isEmpty(duplicates(allNamedArguments))
})

export const shouldPassValuesToAllAttributes = error<New>(
  node => isEmpty(getUninitializedAttributesForInstantiation(node)),
  node => [node.instantiated?.name, getUninitializedAttributesForInstantiation(node).join(', ')],
)

export const shouldInitializeInheritedAttributes = error<Singleton>(
  node => isEmpty(getInheritedUninitializedAttributes(node)),
  node => [getInheritedUninitializedAttributes(node).join(', ')],
)

export const shouldInitializeSingletonAttribute = error<Field>(node => {
  return !node.parent.is(Singleton) || !isUninitialized(node.value)
}, valuesForNodeName, sourceMapForNodeName)

export const shouldNotUseSelf = error<Self>(node => {
  const ancestors = node.ancestors
  return node.isSynthetic || !ancestors.some(is(Program)) || ancestors.some(is(Singleton))
})

export const shouldNotDefineMoreThanOneSuperclass = error<Class | Singleton>(node =>
  count(targetSupertypes(node), _ => !!_ && _.is(Class)) <= 1
)

export const superclassShouldBeLastInLinearization = error<Class | Singleton>(node => {
  const parents = targetSupertypes(node)
  const hasSuperclass = notEmpty(parents.filter(_ => !!_ && _.is(Class)))
  const lastParentInHierarchy = last(parents)
  return !hasSuperclass || !!lastParentInHierarchy && lastParentInHierarchy.is(Class)
})

export const shouldMatchSuperclassReturnValue = error<Method>(node => {
  if (!node.isOverride) return true
  const overridenMethod = superclassMethod(node)
  if (!overridenMethod || overridenMethod.isAbstract() || overridenMethod.isNative()) return true
  const lastSentence = last(node.sentences)
  const superclassSentence = last(overridenMethod.sentences)
  return !lastSentence || !superclassSentence || lastSentence.is(Return) === superclassSentence.is(Return) || lastSentence.is(Throw) || superclassSentence.is(Throw)
}, undefined, sourceMapForBody)

export const shouldReturnAValueOnAllFlows = error<If>(node => {
  const lastThenSentence = last(node.thenBody.sentences)
  const lastElseSentence = last(node.elseBody.sentences)

  const noFlow = !lastThenSentence && !lastElseSentence
  const thenSingleFlow = !lastElseSentence && lastThenSentence && finishesFlow(lastThenSentence, node)
  const elseSingleFlow = !lastThenSentence && lastElseSentence && finishesFlow(lastElseSentence, node)
  const singleFlow = thenSingleFlow || elseSingleFlow

  // Try expression is still pending
  const rightCombinations: Record<string, string[]> = {
    'Assignment': ['Assignment', 'Send', 'Throw', 'Variable'],
    'Literal': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'New': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Reference': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Return': ['Return', 'Throw'],
    'Self': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Send': ['Literal', 'New', 'Return', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Throw': ['Literal', 'New', 'Return', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Variable': ['Assignment', 'Send', 'Throw', 'Variable'],
  }

  const twoFlows = !!lastThenSentence && !!lastElseSentence && (rightCombinations[lastThenSentence.kind]?.includes(lastElseSentence.kind) || rightCombinations[lastElseSentence.kind]?.includes(lastThenSentence.kind))
  const ifFlows = !!lastThenSentence && !!lastElseSentence && (lastThenSentence.is(If) || lastElseSentence.is(If))
  return noFlow || singleFlow || twoFlows || ifFlows
})

export const shouldNotDuplicateFields = error<Field>(node =>
  count(node.parent.allFields, _ => _.name == node.name) === 1
, valuesForNodeName,
sourceMapForNodeName)

export const parameterShouldNotDuplicateExistingVariable = error<Parameter>(node => {
  const nodeMethod = getVariableContainer(node)
  if (!nodeMethod) return true
  const parameterNotDuplicated = count((nodeMethod as Method).parameters || [], parameter => parameter.name == node.name) <= 1
  return parameterNotDuplicated && !hasDuplicatedVariable(nodeMethod.parent, node.name)
})

export const shouldNotDuplicateLocalVariables = error<Variable>(node => !duplicatesLocalVariable(node), valuesForNodeName, sourceMapForNodeName)

export const shouldNotDuplicateGlobalDefinitions = error<Module | Variable>(node =>
  !node.name || !node.parent.is(Package) || isEmpty(node.siblings().filter(child => (child as Entity).name == node.name)),
valuesForNodeName,
sourceMapForNodeName,
)

export const shouldNotDuplicateVariablesInLinearization = error<Module>(node => {
  const allFields = node.allFields.filter(field => !node.fields.includes(field)).map(_ => _.name)
  return allFields.length === new Set(allFields).size
})

export const shouldImplementInheritedAbstractMethods = error<Singleton>(node =>
  !inheritsCustomDefinition(node) || !node.allMethods.some(method => !isImplemented(node.allMethods, method) && method.isAbstract())
)

export const shouldHaveBody = error<Method>(node => {
  const parentModule = node.parent
  return !parentModule.is(Singleton) || node.isNative() || !node.isAbstract()
})

export const shouldNotDefineGlobalMutableVariables = error<Variable>(variable => {
  return variable.isConstant || !variable.isAtPackageLevel
},
valuesForNodeName,
sourceMapForNodeName)

export const shouldNotCompareEqualityOfSingleton = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return !isEqualMessage(node) || !arg || !(referencesSingleton(arg) || referencesSingleton(node.receiver))
})

export const shouldUseBooleanValueInIfCondition = error<If>(node =>
  isBooleanOrUnknownType(node.condition)
, undefined,
sourceMapForConditionInIf)

export const shouldUseBooleanValueInLogicOperation = error<Send>(node => {
  if (!isBooleanMessage(node)) return true
  const unaryOperation = isBooleanOrUnknownType(node.receiver) && isEmpty(node.args)
  const binaryOperation = node.args.length === 1 && isBooleanOrUnknownType(node.args[0]) && isBooleanOrUnknownType(node.receiver)
  return unaryOperation || binaryOperation
})

export const shouldNotDefineUnnecesaryIf = error<If>(node =>
  notEmpty(node.elseBody.sentences) || !node.condition.is(Literal) || node.condition.value !== true
, undefined,
sourceMapForConditionInIf)

export const shouldNotDefineEmptyDescribe = warning<Describe>(node =>
  notEmpty(node.tests)
)

export const shouldHaveNonEmptyName = warning<Describe | Test>(node =>
  (node.name ?? '').replaceAll('"', '').trim() !== ''
, valuesForNodeName,
sourceMapForNodeName)

export const shouldNotMarkMoreThanOneOnlyTest = warning<Test>(node =>
  !node.isOnly || count(node.siblings(), element => element.is(Test) && element.isOnly) <= 1
, valuesForNodeName,
sourceMapForOnlyTest)

export const shouldNotDefineNativeMethodsOnUnnamedSingleton = error<Method>(node => {
  const parent = node.parent
  return !node.isNative() || !parent.is(Singleton) || !!parent.name
},
valuesForNodeName,
sourceMapForNodeName)

export const codeShouldBeReachable = error<If | Send>(node =>
  match(node)(
    when(If)(node => {
      const condition = node.condition
      if (!condition.is(Literal) || condition.value !== true && condition.value !== false) return true
      return hasBooleanValue(condition, true) && isEmpty(node.elseBody.sentences) || hasBooleanValue(condition, false) && isEmpty(node.thenBody.sentences)
    }),
    when(Send)(node => {
      const receiver = node.receiver
      const message = node.message
      return !(hasBooleanValue(receiver, true) && ['or', '||'].includes(message)) && !(hasBooleanValue(receiver, false) && ['and', '&&'].includes(message))
    }),
  )
, undefined,
sourceMapForUnreachableCode)

export const methodShouldExist = error<Send>(node => methodExists(node))

export const shouldUseSuperOnlyOnOverridingMethod = error<Super>(node => {
  const method = node.ancestors.find(is(Method))
  const parentModule = node.ancestors.find(is(Module))
  if (parentModule?.is(Mixin)) return true
  if (!method) return false
  return !!superclassMethod(method) && method.matchesSignature(method.name, node.args.length)
})

export const shouldNotDefineUnnecessaryCondition = warning<If | Send>(node =>
  match(node)(
    when(If)(node => {
      if (node.thenBody.sentences.length !== 1 || node.elseBody?.sentences.length !== 1) return true
      const thenValue = valueFor(last(node.thenBody.sentences))
      const elseValue = valueFor(last(node.elseBody.sentences))
      return thenValue === undefined || elseValue === undefined || thenValue !== elseValue
    }),
    when(Send)(node => {
      const receiver = node.receiver
      const argument = node.args[0]
      const andOperation = ['and', '&&'].includes(node.message)
      const orOperation = ['or', '||'].includes(node.message)
      if (andOperation) return !hasBooleanValue(receiver, true) && !hasBooleanValue(argument, true)
      if (orOperation) return !hasBooleanValue(receiver, false) && !hasBooleanValue(argument, false)
      return true
    }),
  )
)

export const overridingMethodShouldHaveABody = error<Method>(node =>
  !node.isOverride || node.isNative() || node.isConcrete()
, valuesForNodeName,
sourceMapForNodeName)

export const shouldUseConditionalExpression = warning<If>(node => {
  const thenValue = isEmpty(node.thenBody.sentences) ? undefined : valueFor(last(node.thenBody.sentences))
  const elseValue = isEmpty(node.elseBody.sentences) ? undefined : valueFor(last(node.elseBody.sentences))
  const nextSentence = node.parent.children[node.parent.children.indexOf(node) + 1]
  return (
    thenValue === undefined ||
    elseValue === undefined ||
    ![true, false].includes(thenValue) ||
    thenValue === elseValue) && (!nextSentence ||
      ![true, false].includes(valueFor(nextSentence))
  )
})

export const shouldHaveAssertInTest = warning<Test>(node =>
  !node.body.isEmpty() || sendsMessageToAssert(node.body)
, undefined,
sourceMapForBody)

export const shouldMatchFileExtension = error<Test | Program>(node => {
  const filename = node.sourceFileName
  if (!filename) return true
  return match(node)(
    when(Test)(_ => filename.endsWith(TEST_FILE_EXTENSION)),
    when(Program)(_ => filename.endsWith(PROGRAM_FILE_EXTENSION)),
  )
})

export const shouldImplementAllMethodsInHierarchy = error<Class | Singleton>(node =>
  methodsCallingToSuper(node).every(methodIsImplementedInSuperclass(node))
, node =>
  [
    methodsCallingToSuper(node)
      .filter(method => !methodIsImplementedInSuperclass(node)(method))
      .map(method => method.name)
      .join(', '),
  ]
, sourceMapForNodeNameOrFullNode)

export const getterMethodShouldReturnAValue = warning<Method>(node =>
  !isGetter(node) || node.isSynthetic || node.isNative() || node.isAbstract() || node.sentences.some(returnsAValue)
, undefined,
sourceMapForBody)

export const shouldNotUseReservedWords = warning<Class | Singleton | Variable | Field | Parameter>(node =>
  !usesReservedWords(node)
, valuesForNodeName,
sourceMapForNodeName)

export const shouldInitializeGlobalReference = error<Variable>(node =>
  !(node.isAtPackageLevel && isUninitialized(node))
, valuesForNodeName,
sourceMapForNodeName)

export const shouldNotDefineUnusedVariables = warning<Field>(node => !unusedVariable(node), valuesForNodeName, sourceMapForNodeName)

export const shouldInitializeConst = error<Variable>(node =>
  !(
    getContainer(node)?.is(Program) &&
    node.isConstant &&
    isUninitialized(node))
, valuesForNodeName,
sourceMapForNodeName)

export const shouldNotDuplicatePackageName = error<Package>(node =>
  !node.siblings().some(sibling => sibling.is(Package) && sibling.name == node.name)
, valuesForNodeName,
sourceMapForNodeName)

export const shouldCatchUsingExceptionHierarchy = error<Catch>(node => {
  const EXCEPTION_CLASS = node.environment.getNodeByFQN<Class>(EXCEPTION_MODULE)
  const exceptionType = node.parameterType.target
  return !exceptionType || exceptionType?.inherits(EXCEPTION_CLASS)
})

export const catchShouldBeReachable = error<Catch>(node => {
  const previousSiblings = node.parent.children.slice(0, node.parent.children.indexOf(node))
  const exceptionType = node.parameterType.target
  return !exceptionType || isEmpty(previousSiblings) || !previousSiblings.some(sibling => {
    if (!sibling.is(Catch)) return false
    const siblingType = sibling.parameterType.target
    return !siblingType || exceptionType === siblingType || exceptionType.inherits(siblingType)
  })
})

export const shouldNotDuplicateEntities = error<Entity | Variable>(node =>
  !node.name || !node.parent.is(Package) || node.parent.imports.every(importFile => !entityIsAlreadyUsedInImport(importFile.entity.target, node.name!))
, valuesForNodeName,
sourceMapForNodeName)

export const shouldNotImportSameFile = error<Import>(node =>
  [TEST_FILE_EXTENSION, PROGRAM_FILE_EXTENSION].some(allowedExtension => node.parent.fileName?.endsWith(allowedExtension)) || node.entity.target !== node.parent
)

export const shouldNotImportMoreThanOnce = warning<Import>(node =>
  !node.parent.is(Package) || node.parent.imports.filter(importFile => importFile !== node).every(importFile => !isAlreadyUsedInImport(importFile.entity.target, node.entity.target))
)

export const shouldDefineConstInsteadOfVar = warning<Variable | Field>(node => {
  if (node.isConstant || usesReservedWords(node) || RESERVED_WORDS.includes(node.name || '') || node.is(Field) && unusedVariable(node) || node.is(Variable) && duplicatesLocalVariable(node)) return true
  const container = getContainer(node)
  return !container || assignsVariable(container, node)
}, valuesForNodeName, sourceMapForNodeName)

export const shouldNotUseVoidMethodAsValue = error<Send>(node => {
  if (!methodExists(node) || !supposedToReturnValue(node)) return true

  const method: Method | undefined = match(node.receiver)(
    when(Reference)(nodeRef => {
      const target = nodeRef.target
      return target?.is(Module) ? target.lookupMethod(node.message, node.args.length) : undefined
    }),
    when(Literal)(_ => findMethod(node)),
    when(Self)(_ => findMethod(node)),
    when(Expression)(_ => undefined),
  )

  return !method || method.isNative() || method.isAbstract() || returnsValue(method)
})

export const shouldNotAssignValueInLoop = error<Field>(node => !loopInAssignment(node.value, node.name))

export const shouldHaveDifferentName = error<Test>(node => {
  const tests: List<Test> = match(node.parent)(
    when(Describe)(describe => describe.tests),
    when(Package)(module => module.members.filter(member => member.is(Test)) as unknown as List<Test>),
    otherwise(_ => []),
  )
  return !tests || tests.every(other => node === other || other.name !== node.name)
}, valuesForNodeName, sourceMapForNodeName)


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const validationsByKind = (node: Node): Record<string, Validation<any>> => match(node)(
  when(Parameter)(() => ({ nameShouldBeginWithLowercase, nameShouldNotBeKeyword, parameterShouldNotDuplicateExistingVariable, shouldNotUseReservedWords })),
  when(NamedArgument)(() => ({ namedArgumentShouldExist, namedArgumentShouldNotAppearMoreThanOnce })),
  when(Import)(() => ({ shouldNotImportSameFile, shouldNotImportMoreThanOnce })),
  when(Body)(() => ({ shouldNotBeEmpty })),
  when(Catch)(() => ({ shouldCatchUsingExceptionHierarchy, catchShouldBeReachable })),
  when(Package)(() => ({ shouldNotDuplicatePackageName })),
  when(Program)(() => ({ nameShouldNotBeKeyword, shouldNotUseReservedWords, shouldMatchFileExtension, shouldNotDuplicateEntities })),
  when(Test)(() => ({ shouldHaveNonEmptyName, shouldNotMarkMoreThanOneOnlyTest, shouldHaveAssertInTest, shouldMatchFileExtension, shouldHaveDifferentName })),
  when(Class)(() => ({ nameShouldBeginWithUppercase, nameShouldNotBeKeyword, shouldNotHaveLoopInHierarchy, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementAllMethodsInHierarchy, shouldNotUseReservedWords, shouldNotDuplicateEntities })),
  when(Singleton)(() => ({ nameShouldBeginWithLowercase, inlineSingletonShouldBeAnonymous, topLevelSingletonShouldHaveAName, nameShouldNotBeKeyword, shouldInitializeInheritedAttributes, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementInheritedAbstractMethods, shouldImplementAllMethodsInHierarchy, shouldNotUseReservedWords, shouldNotDuplicateEntities })),
  when(Mixin)(() => ({ nameShouldBeginWithUppercase, shouldNotHaveLoopInHierarchy, shouldOnlyInheritFromMixin, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldNotDuplicateEntities })),
  when(Field)(() => ({ nameShouldBeginWithLowercase, shouldNotAssignToItselfInDeclaration, nameShouldNotBeKeyword, shouldNotDuplicateFields, shouldNotUseReservedWords, shouldNotDefineUnusedVariables, shouldDefineConstInsteadOfVar, shouldInitializeSingletonAttribute, shouldNotAssignValueInLoop })),
  when(Method)(() => ({ onlyLastParameterCanBeVarArg, nameShouldNotBeKeyword, methodShouldHaveDifferentSignature, shouldNotOnlyCallToSuper, shouldUseOverrideKeyword, possiblyReturningBlock, shouldNotUseOverride, shouldMatchSuperclassReturnValue, shouldNotDefineNativeMethodsOnUnnamedSingleton, overridingMethodShouldHaveABody, getterMethodShouldReturnAValue, shouldHaveBody })),
  when(Variable)(() => ({ nameShouldBeginWithLowercase, nameShouldNotBeKeyword, shouldNotAssignToItselfInDeclaration, shouldNotDuplicateLocalVariables, shouldNotDuplicateGlobalDefinitions, shouldNotDefineGlobalMutableVariables, shouldNotUseReservedWords, shouldInitializeGlobalReference, shouldDefineConstInsteadOfVar, shouldNotDuplicateEntities, shouldInitializeConst })),
  when(Assignment)(() => ({ shouldNotAssignToItself, shouldNotReassignConst })),
  when(Reference)(() => ({ missingReference, shouldUseSelfAndNotSingletonReference })),
  when(Self)(() => ({ shouldNotUseSelf })),
  when(New)(() => ({ shouldNotInstantiateAbstractClass, shouldPassValuesToAllAttributes })),
  when(Send)(() => ({ shouldNotCompareAgainstBooleanLiterals, shouldNotCompareEqualityOfSingleton, shouldUseBooleanValueInLogicOperation, methodShouldExist, codeShouldBeReachable, shouldNotDefineUnnecessaryCondition, shouldNotUseVoidMethodAsValue })),
  when(Super)(() => ({ shouldUseSuperOnlyOnOverridingMethod })),
  when(If)(() => ({ shouldReturnAValueOnAllFlows, shouldUseBooleanValueInIfCondition, shouldNotDefineUnnecesaryIf, codeShouldBeReachable, shouldNotDefineUnnecessaryCondition, shouldUseConditionalExpression })),
  when(Try)(() => ({ shouldHaveCatchOrAlways })),
  when(Describe)(() => ({ shouldNotDuplicateGlobalDefinitions, shouldNotDefineEmptyDescribe, shouldHaveNonEmptyName })),
  otherwise(() => ({})),
)

export default (target: Node): List<Problem> => target.reduce<Problem[]>((found, node) => {
  return [
    ...found,
    ...node.problems?.map(({ code, sourceMap, level, values }) => ({ code, level, node, values, sourceMap: sourceMap ?? node.sourceMap } as Problem)  ) ?? [],
    ...entries(validationsByKind(node))
      .map(([code, validation]) => validation(node, code)!)
      .filter(result => result !== null),
  ]
}, [])