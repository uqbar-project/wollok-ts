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
import { count, duplicates, isEmpty, last, List, notEmpty } from './extensions'
// - Unified problem type
import { Assignment, Body, Catch, Class, Code, Describe, Entity, Expression, Field, If, Import, is, Kind,
  Level, Method, Mixin, Module, NamedArgument, New, Node, NodeOfKind, Package, Parameter, Problem,
  Program, Self, Send, Sentence, Singleton, SourceIndex, SourceMap, Super, Test, Try, Variable } from './model'

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

const LIBRARY_PACKAGES = ['wollok.lang', 'wollok.lib', 'wollok.game', 'wollok.vm', 'wollok.mirror']

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

export const isNotWithin = (kind: Kind): (node: Node, code: Code) => Problem | null =>
  error(node => node.isSynthetic() || !node.ancestors().some(is(kind)))

export const nameMatches = (regex: RegExp): (node: Parameter | Entity | Field | Method, code: Code) => Problem | null =>
  warning(
    node => !node.name || regex.test(node.name),
    node => [node.name ?? ''],
    node => {
      if (!node.sourceMap) return undefined
      const nodeOffset = getOffsetForName(node)
      return node.sourceMap && new SourceMap({
        // TODO: reify node information (like class names)
        start: new SourceIndex({
          ...node.sourceMap.start,
          offset: node.sourceMap.start.offset + nodeOffset,
        }),
        end: new SourceIndex({
          ...node.sourceMap.end,
          offset: node.sourceMap.start.offset + (node.name?.length ?? 0) + nodeOffset,
        }),
      })
    }
  )

export const nameShouldBeginWithUppercase = nameMatches(/^[A-Z]/)

export const nameShouldBeginWithLowercase = nameMatches(/^[a-z_<]/)

export const nameShouldNotBeKeyword = error<Entity | Parameter | Variable | Field | Method>(node =>
  !KEYWORDS.includes(node.name || ''),
node => [node.name || ''],
)

export const inlineSingletonShouldBeAnonymous = error<Singleton>(
  singleton => singleton.parent.is('Package') || !singleton.name
)

export const topLevelSingletonShouldHaveAName = error<Singleton>(
  singleton => !singleton.parent.is('Package') || !!singleton.name
)

export const onlyLastParameterCanBeVarArg = error<Method>(node => {
  const varArgIndex = node.parameters.findIndex(p => p.isVarArg)
  return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
})

export const shouldHaveCatchOrAlways = error<Try>(node =>
  notEmpty(node.catches) || notEmpty(node.always.sentences)
)

export const methodShouldHaveDifferentSignature = error<Method>(node => {
  return node.parent.methods().every(other => node === other || !other.matchesSignature(node.name, node.parameters.length))
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

export const shouldNotReassignConst = error<Assignment>(node => {
  const target = node?.variable?.target()
  const referenceIsNotConstant = !!target && (target.is('Variable') || target?.is('Field')) && !target.isConstant
  return !target || referenceIsNotConstant && !target.is('Parameter')
})

export const shouldNotHaveLoopInHierarchy = error<Class | Mixin>(node => !allParents(node).includes(node))

export const shouldNotAssignToItselfInDeclaration = error<Field | Variable>(node => !node.value.is('Reference') || node.value.target() !== node)

export const shouldNotCompareAgainstBooleanLiterals = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return !isEqualMessage(node) || !arg || !(isBooleanLiteral(arg, true) || isBooleanLiteral(arg, false) || isBooleanLiteral(node.receiver, true) || isBooleanLiteral(node.receiver, false))
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
  node.parent.is('Mixin') || !node.isOverride || !!superclassMethod(node)
)

export const namedArgumentShouldExist = error<NamedArgument>(node => {
  const parent = getReferencedModule(node.parent)
  return !!parent && !!parent.lookupField(node.name)
})

export const namedArgumentShouldNotAppearMoreThanOnce = warning<NamedArgument>(node => {
  const nodeParent = node.parent
  let siblingArguments: List<NamedArgument> | undefined
  if (nodeParent.is('New')) siblingArguments = nodeParent.args
  return !siblingArguments || count(siblingArguments, _ => _.name === node.name) === 1
})

export const linearizationShouldNotRepeatNamedArguments = warning<Singleton | Class>(node => {
  const allNamedArguments = node.supertypes.flatMap(parent => parent.args.map(_ => _.name))
  return isEmpty(duplicates(allNamedArguments))
})

export const shouldPassValuesToAllAttributes = error<New>(
  node => isEmpty(getUninitializedAttributesForInstantation(node)),
  node => getUninitializedAttributesForInstantation(node),
)

export const shouldInitializeAllAttributes = error<Singleton>(
  node => isEmpty(getUninitializedAttributes(node)),
  node => getUninitializedAttributes(node)
)

export const shouldNotUseSelf = error<Self>(node => {
  const ancestors = node.ancestors()
  return node.isSynthetic() || !ancestors.some(is('Program')) || ancestors.some(is('Singleton'))
})

export const shouldNotDefineMoreThanOneSuperclass = error<Class | Singleton>(node =>
  count(targetSupertypes(node), _ => !!_ && _.is('Class')) <= 1
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

  // Try expression is still pending
  const rightCombinations: Record<string, string[]> = {
    'Assignment': ['Assignment', 'Send', 'Throw'],
    'Literal': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'New': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Reference': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Return': ['Return', 'Throw'],
    'Self': ['Literal', 'New', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Send': ['Literal', 'New', 'Return', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
    'Throw': ['Literal', 'New', 'Return', 'Self', 'Send', 'Reference', 'Super', 'Throw'],
  }

  const twoFlows = !!lastThenSentence && !!lastElseSentence && (rightCombinations[lastThenSentence.kind]?.includes(lastElseSentence.kind) || rightCombinations[lastElseSentence.kind]?.includes(lastThenSentence.kind))
  const ifFlows = !!lastThenSentence && !!lastElseSentence && (lastThenSentence.is('If') || lastElseSentence.is('If'))
  return singleFlow || twoFlows || ifFlows
})

export const shouldNotDuplicateFields = error<Field>(node =>
  count(node.parent.allFields(), _ => _.name == node.name) === 1
)

export const parameterShouldNotDuplicateExistingVariable = error<Parameter>(node => {
  const nodeMethod = getVariableContainer(node)
  if (!nodeMethod) return true
  const parameterNotDuplicated = count((nodeMethod as Method).parameters || [], parameter => parameter.name == node.name) <= 1
  return parameterNotDuplicated && !hasDuplicatedVariable(nodeMethod.parent, node.name)
})

export const shouldNotDuplicateLocalVariables = error<Variable>(node => !duplicatesLocalVariable(node))

export const shouldNotDuplicateGlobalDefinitions = error<Module | Variable>(node =>
  !node.name || !node.parent.is('Package') || isEmpty(node.siblings().filter(child => (child as Entity).name == node.name))
)

export const shouldNotDuplicateVariablesInLinearization = error<Module>(node => {
  const allFields = node.allFields().filter(field => !node.fields().includes(field)).map(_ => _.name)
  return allFields.length === new Set(allFields).size
})

export const shouldImplementAbstractMethods = error<Singleton>(node => {
  const allMethods = node.allMethods()
  return isEmpty(allMethods.filter(method => method.isAbstract() && !isImplemented(allMethods, method)))
})

export const shouldNotDefineGlobalMutableVariables = error<Variable>(variable => {
  return variable.isConstant || !variable.isGlobal()
})

export const shouldNotCompareEqualityOfSingleton = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return !isEqualMessage(node) || !arg || !(referencesSingleton(arg) || referencesSingleton(node.receiver))
})

export const shouldUseBooleanValueInIfCondition = error<If>(node =>
  isBooleanOrUnknownType(node.condition)
)

export const shouldUseBooleanValueInLogicOperation = error<Send>(node => {
  if (!isBooleanMessage(node)) return true
  const unaryOperation = isBooleanOrUnknownType(node.receiver) && isEmpty(node.args)
  const binaryOperation = node.args.length === 1 && isBooleanOrUnknownType(node.args[0]) && isBooleanOrUnknownType(node.receiver)
  return unaryOperation || binaryOperation
})

export const shouldNotDefineUnnecesaryIf = error<If>(node =>
  notEmpty(node.elseBody.sentences) || !node.condition.is('Literal') || node.condition.value !== true
)

export const shouldNotDefineEmptyDescribe = warning<Describe>(node =>
  notEmpty(node.tests())
)

export const shouldHaveNonEmptyName = warning<Describe | Test>(node =>
  (node.name ?? '').replaceAll('"', '').trim() !== ''
)

export const shouldNotMarkMoreThanOneOnlyTest = warning<Test>(node =>
  !node.isOnly || count(node.siblings(), element => element.is('Test') && element.isOnly) <= 1
)

export const shouldNotDefineNativeMethodsOnUnnamedSingleton = error<Method>(node => {
  const parent = node.parent
  return !node.isNative() || !parent.is('Singleton') || !!parent.name
})

export const codeShouldBeReachable = error<If | Send>(node =>
  node.match({
    If: node => {
      const condition = node.condition
      if (!condition.is('Literal') || condition.value !== true && condition.value !== false) return true
      return isBooleanLiteral(condition, true) && isEmpty(node.elseBody.sentences) || isBooleanLiteral(condition, false) && isEmpty(node.thenBody.sentences)
    },
    Send: node => {
      const receiver = node.receiver
      const message = node.message
      return !(isBooleanLiteral(receiver, true) && ['or', '||'].includes(message)) && !(isBooleanLiteral(receiver, false) && ['and', '&&'].includes(message))
    },
  })
)

export const methodShouldExist = error<Send>(node => methodExists(node))

export const shouldUseSuperOnlyOnOverridingMethod = error<Super>(node => {
  const method = node.ancestors().find(is('Method'))
  const parentModule = node.ancestors().find(is('Module'))
  if (parentModule?.is('Mixin')) return true
  if (!method) return false
  return !!superclassMethod(method) && method.matchesSignature(method.name, node.args.length)
})

export const shouldNotDefineUnnecessaryCondition = warning<If | Send>(node =>
  node.match({
    If: node => {
      if (node.thenBody.sentences.length !== 1 || node.elseBody?.sentences.length !== 1) return true
      const thenValue = valueFor(last(node.thenBody.sentences))
      const elseValue = valueFor(last(node.elseBody.sentences))
      return thenValue === undefined || elseValue === undefined || thenValue !== elseValue
    },
    Send: node => {
      const receiver = node.receiver
      const argument = node.args[0]
      const andOperation = ['and', '&&'].includes(node.message)
      const orOperation = ['or', '||'].includes(node.message)
      if (andOperation) return !isBooleanLiteral(receiver, true) && !isBooleanLiteral(argument, true)
      if (orOperation) return !isBooleanLiteral(receiver, false) && !isBooleanLiteral(argument, false)
      return true
    },
  })
)

export const overridingMethodShouldHaveABody = error<Method>(node =>
  !node.isOverride || node.isNative() || node.isConcrete()
)

export const shouldUseConditionalExpression = warning<If>(node => {
  const thenValue = valueFor(last(node.thenBody.sentences))
  const elseValue = isEmpty(node.elseBody.sentences) ? undefined : valueFor(last(node.elseBody.sentences))
  return (elseValue === undefined || ![true, false].includes(thenValue) || thenValue === elseValue) && (!node.nextSibling() || ![true, false].includes(valueFor(node.nextSibling())))
})

export const shouldHaveAssertInTest = warning<Test>(node =>
  !node.body.isEmpty() || sendsMessageToAssert(node.body)
)

export const shouldMatchFileExtension = error<Test | Program>(node => {
  const filename = node.sourceFileName()
  if (!filename) return true
  return node.match({
    Test: _ => filename.endsWith('wtest'),
    Program: _ => filename.endsWith('wpgm'),
  })
})

export const shouldImplementAllMethodsInHierarchy = error<Class | Singleton>(node => {
  const methodsCallingToSuper = node.allMethods().filter(method => callsToSuper(method))
  return methodsCallingToSuper
    .every(method => node.lookupMethod(method.name, method.parameters.length, { lookupStartFQN: method.parent.fullyQualifiedName() }))
})

export const getterMethodShouldReturnAValue = warning<Method>(node =>
  !isGetter(node) || node.isSynthetic() || node.isNative() || node.isAbstract() || node.sentences().some(_ => _.is('Return'))
)

export const shouldNotUseReservedWords = warning<Class | Singleton | Variable | Field | Parameter>(node => !usesReservedWords(node))

export const shouldInitializeGlobalReference = error<Variable>(node =>
  !node.isGlobal() || !node.value.is('Literal') || !uninitializedValue(node.value)
)

export const shouldNotDefineUnusedVariables = warning<Field>(node => !unusedVariable(node))

export const shouldNotDuplicatePackageName = error<Package>(node =>
  !node.siblings().some(sibling => sibling.is('Package') && sibling.name == node.name)
)

export const shouldCatchUsingExceptionHierarchy = error<Catch>(node => {
  const EXCEPTION_CLASS = node.environment.getNodeByFQN<Class>('wollok.lang.Exception')
  const exceptionType = node.parameterType.target()
  return !exceptionType || exceptionType?.inherits(EXCEPTION_CLASS)
})

export const catchShouldBeReachable = error<Catch>(node => {
  const previousSiblings = node.previousSiblings()
  const exceptionType = node.parameterType.target()
  return !exceptionType || isEmpty(previousSiblings) || !previousSiblings.some(sibling => {
    if (!sibling.is('Catch')) return false
    const siblingType = sibling.parameterType.target()!
    return exceptionType === siblingType || exceptionType.inherits(siblingType)
  })
})

export const shouldNotDuplicateEntities = error<Class | Mixin | Singleton>(node =>
  !node.name || !node.parent.is('Package') || node.parent.imports.every(importFile => !entityIsAlreadyUsedInImport(importFile.entity.target(), node.name!))
)

export const shouldNotImportSameFile = error<Import>(node =>
  ['wtest', 'wpgm'].some(allowedExtension => node.parent.fileName?.endsWith(allowedExtension)) || node.entity.target() !== node.parent
)

export const shouldNotImportMoreThanOnce = warning<Import>(node =>
  !node.parent.is('Package') || node.parent.imports.filter(importFile => importFile !== node).every(importFile => !isAlreadyUsedInImport(importFile.entity.target(), node.entity.target()))
)

export const shouldDefineConstInsteadOfVar = warning<Variable | Field>(node => {
  if (node.isConstant || usesReservedWords(node) || KEYWORDS.includes(node.name || '') || node.is('Field') && unusedVariable(node) || node.is('Variable') && duplicatesLocalVariable(node)) return true
  const module = getContainer(node)
  if (!module) return true
  return module.match({
    Program: program => assignsVariable(program.body, node),
    Test: test => assignsVariable(test.body, node),
    Describe: describe => describe.methods().some(method => assigns(method, node)) ||
      describe.tests().some(test => assignsVariable(test.body, node)),
    Module: module => module.methods().some(method => assigns(method, node)),
  })
})

export const shouldNotUseVoidMethodAsValue = error<Send>(node => {
  if (!methodExists(node) || !supposedToReturnValue(node)) return true
  const method = node.receiver.match({
    Reference: nodeRef => {
      const target = nodeRef.target()
      return target?.is('Module') ? target.lookupMethod(node.message, node.args.length) : undefined
    },
    Literal: _ => findMethod(node),
    Self: _ => findMethod(node),
    Expression: _ => undefined,
  })
  return !method || method.isNative() || method.isAbstract() || returnsValue(method)
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

const getUninitializedAttributesForInstantation = (node: New): string[] => {
  const target = node.instantiated.target()
  if (!target) return []
  const initializers = node.args.map(_ => _.name)
  return getUninitializedAttributes(target, initializers)
}

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

const superclassMethod = (node: Method) => node.parent.lookupMethod(node.name, node.parameters.length, { lookupStartFQN: node.parent.fullyQualifiedName(), allowAbstractMethods: true })

const finishesFlow = (sentence: Sentence, node: Node): boolean => {
  const parent = node.parent
  const lastLineOnMethod = parent.is('Body') ? last(parent.sentences) : undefined
  const returnCondition = (sentence.is('Return') && lastLineOnMethod !== node && lastLineOnMethod?.is('Return') || lastLineOnMethod?.is('Throw')) ?? false
  return sentence.is('Throw') || sentence.is('Send') || sentence.is('Assignment') || sentence.is('If') || returnCondition
}

const getVariableContainer = (node: Node) =>
  node.ancestors().find(parent => parent.is('Method') || parent.is('Test')) as Method | Test | undefined

const getContainer = (node: Node) =>
  node.ancestors().find(parent => parent.is('Module') || parent.is('Program') || parent.is('Test')) as Module | Program | Test | undefined

const getAllVariables = (node: Method | Test): List<Variable> => node.sentences().filter(is('Variable'))

const hasDuplicatedVariable = (node: Module, variableName: string): boolean =>
  node.is('Module') && !!node.lookupField(variableName)

const isImplemented = (allMethods: List<Method>, method: Method): boolean => {
  return allMethods.some(someMethod => method.matchesSignature(someMethod.name, someMethod.parameters.length) && !someMethod.isAbstract())
}

const isEqualMessage = (node: Send): boolean =>
  ['==', '!=', '===', '!==', 'equals'].includes(node.message) && node.args.length === 1

const isBooleanMessage = (node: Send): boolean =>
  ['&&', 'and', '||', 'or'].includes(node.message) && node.args.length === 1 || ['negate', 'not'].includes(node.message) && isEmpty(node.args)

const referencesSingleton = (node: Expression) => node.is('Reference') && node.target()?.is('Singleton')

const isBooleanOrUnknownType = (node: Node): boolean => node.match({
  Literal: condition => condition.value === true || condition.value === false,
  Send: _ => true, // tackled in a different validator
  Super: _ => true,
  Reference: condition => !condition.target()?.is('Singleton'),
  Node: _ => false,
})

const valueFor: any | undefined = (node: Node) =>
  node.match({
    Literal: node => node.value,
    Return: node => valueFor(node.value),
    Node: _ => undefined,
  })

const sendsMessageToAssert = (node: Node): boolean =>
  node.match({
    Body: node => node.children().some(child => sendsMessageToAssert(child)),
    Send: nodeSend => {
      return nodeSend.receiver.match({
        Reference: receiver => receiver.name === 'assert',
        Literal: _ => {
          const method = findMethod(nodeSend)
          return !!method && !!method.body && method.body !== 'native' && sendsMessageToAssert(method.body)
        },
        Self: _ => {
          const method = findMethod(nodeSend)
          return !!method && !!method.body && method.body !== 'native' && sendsMessageToAssert(method.body)
        },
        Expression: _ => false,
      })
    },
    Try: node => sendsMessageToAssert(node.body) || node.catches.every(_catch => sendsMessageToAssert(_catch.body)) || sendsMessageToAssert(node.always),
    If: node => sendsMessageToAssert(node.thenBody) && node.elseBody && sendsMessageToAssert(node.elseBody),
    Node: _ => false,
  })

// TODO: this should be no longer necessary when the type system is implemented
const findMethod = (messageSend: Send): Method | undefined => {
  const parent = messageSend.receiver.ancestors().find(ancestor => ancestor.is('Module')) as Module
  return parent?.lookupMethod(messageSend.message, messageSend.args.length)
}

const callsToSuper = (node: Method): boolean => node.sentences().some(sentence => isCallToSuper(sentence))

const isCallToSuper = (node: Node): boolean =>
  node.match({
    Super: _ => true,
    Return: node => !!node.value && isCallToSuper(node.value),
    Send: node => isCallToSuper(node.receiver) || node.args.some(arg => isCallToSuper(arg)),
    Node: _ => false,
  })

const isGetter = (node: Method): boolean => node.parent.allFields().map(_ => _.name).includes(node.name) && isEmpty(node.parameters)

const methodOrTestUsesField = (parent: Method | Test, field: Field) => parent.sentences().some(sentence => usesField(sentence, field))

const usesField = (node: Sentence | Body | NamedArgument, field: Field): boolean => node.match({
  Variable: (node) => usesField(node.value, field),
  Return: (node) => !!node.value && usesField(node.value, field),
  Assignment: (node) => node.variable.target() === field || usesField(node.value, field),
  Reference: (node) => node.target() === field,
  Send: (node) => usesField(node.receiver, field) || node.args.some(arg => usesField(arg, field)),
  If: (node) => usesField(node.condition, field) || usesField(node.thenBody, field) || node.elseBody && usesField(node.elseBody, field),
  New: (node) => node.args.some(arg => usesField(arg, field)),
  NamedArgument: (node) => usesField(node.value, field),
  Throw: (node) => usesField(node.exception, field),
  Try: (node) => usesField(node.body, field) || node.catches.some(catchBlock => usesField(catchBlock.body, field)) || !!node.always && usesField(node.always, field),
  Expression: (_) => false,
  Body: (node) => node.sentences.some(sentence => usesField(sentence, field)),
})

// TODO: Import could offer a list of imported entities
const entityIsAlreadyUsedInImport = (target: Entity | undefined, entityName: string) => target?.match({
  Package: node => node.members.some(member => member.name == entityName),
  Entity: node => node.name == entityName,
})

const isAlreadyUsedInImport = (target: Entity | undefined, node: Entity | undefined) => !!target && node?.match({
  Package: node => node.name == target.name,
  Entity: node => entityIsAlreadyUsedInImport(target, node.name!),
})

const duplicatesLocalVariable = (node: Variable): boolean => {
  if (node.ancestors().some(is('Program')) || node.isGlobal()) return false

  const container = getVariableContainer(node)
  if (!container) return false
  const duplicateReference = count(getAllVariables(container), reference => reference.name == node.name) > 1
  return duplicateReference || hasDuplicatedVariable(container.parent, node.name) || !container.is('Test') && container.parameters.some(_ => _.name == node.name)
}

const assigns = (method: Method, variable: Variable | Field) => method.sentences().some(sentence => assignsVariable(sentence, variable))

const assignsVariable = (sentence: Sentence | Body, variable: Variable | Field): boolean => sentence.match({
  Body: node => node.sentences.some(sentence => assignsVariable(sentence, variable)),
  Variable: node => assignsVariable(node.value, variable),
  Return: node => !!node.value && assignsVariable(node.value, variable),
  Assignment: node => node.variable.target() == variable,
  Send: node => assignsVariable(node.receiver, variable) || node.args.some(arg => assignsVariable(arg, variable)),
  If: node => assignsVariable(node.condition, variable) || assignsVariable(node.thenBody, variable) || assignsVariable(node.elseBody, variable),
  Try: node => assignsVariable(node.body, variable) || node.catches.some(catchBlock => assignsVariable(catchBlock.body, variable)) || assignsVariable(node.always, variable),
  Singleton: node => node.methods().some(method => assigns(method, variable)),
  Expression: _ => false,
})

const unusedVariable = (node: Field) => {
  const parent = node.parent
  const allFields = parent.allFields()
  const allMethods: List<Test | Method> = parent.is('Describe') ? parent.tests() : parent.allMethods()
  return !node.isProperty && node.name != '<toString>'
    && allMethods.every(method => !methodOrTestUsesField(method, node))
    && allFields.every(field => !usesField(field.value, node))
}

const usesReservedWords = (node: Class | Singleton | Variable | Field | Parameter) => {
  const parent = node.ancestors().find(ancestor => ancestor.is('Package')) as Package | undefined
  const wordsReserved = LIBRARY_PACKAGES.flatMap(libPackage => node.environment.getNodeByFQN<Package>(libPackage).members.map(_ => _.name))
  wordsReserved.push('wollok')
  return !!parent && !parent.fullyQualifiedName().includes('wollok.') && wordsReserved.includes(node.name)
}

const supposedToReturnValue = (node: Node): boolean => node.parent.match({
  Assignment: _ => true,
  If: _ => true,
  Literal: nodeLiteral => Array.isArray(nodeLiteral.value) && nodeLiteral.value[1].includes(node as Expression),
  NamedArgument: nodeArg => nodeArg.value == node as Expression,
  New: nodeNew => nodeNew.args.some(namedArgument => namedArgument.value == node as Expression),
  Return: nodeReturn => {
    const method = nodeReturn.ancestors().find(is('Method'))
    return !nodeReturn.isSynthetic() || method?.name !== '<apply>'
  },
  Send: nodeSend => nodeSend.args.includes(node as Expression) || nodeSend.receiver == node,
  Super: nodeSuper => nodeSuper.args.includes(node as Expression),
  Variable: _ => true,
  Node: _ => false,
})

const returnsValue = (node: Method): boolean => node.sentences().some(sentence => returnsAValue(sentence))

const returnsAValue = (node: Node): boolean => node.match({
  Return: _ => true,
  Body: node => node.sentences.some(sentence => returnsAValue(sentence)),
  If: node => returnsAValue(node.thenBody) || returnsAValue(node.elseBody),
  Try: node => returnsAValue(node.body) || node.catches.some(sentence => returnsAValue(sentence)) || returnsAValue(node.always),
  Node: _ => false,
})

const methodExists = (node: Send): boolean => node.receiver.match({
  Self: selfNode => {
    const allAncestors = selfNode.ancestors().filter(ancestor => ancestor.is('Module'))
    return isEmpty(allAncestors) || allAncestors.some(ancestor => (ancestor as Module).lookupMethod(node.message, node.args.length, { allowAbstractMethods: true }))
  },
  Reference: referenceNode => {
    const receiver = referenceNode.target()
    return !receiver?.is('Module') || isBooleanMessage(node) || !!receiver.lookupMethod(node.message, node.args.length, { allowAbstractMethods: true })
  },
  Node: _ => true,
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORT HELPERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const getOffsetForName = (node: Node): number => node.match({
  Parameter: _ => 0,
  Field: node => node.isConstant ? 6 : 4 + (node.isProperty ? 9 : 0),
  Entity: node => node.is('Singleton') ? 7 : node.kind.length + 1,
  Method: node => node.kind.length + 1,
})


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROBLEMS BY KIND
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const validationsByKind: { [K in Kind]: Record<Code, Validation<NodeOfKind<K>>> } = {
  Parameter: { nameShouldBeginWithLowercase, nameShouldNotBeKeyword, parameterShouldNotDuplicateExistingVariable, shouldNotUseReservedWords },
  ParameterizedType: {},
  NamedArgument: { namedArgumentShouldExist, namedArgumentShouldNotAppearMoreThanOnce },
  Import: { shouldNotImportSameFile, shouldNotImportMoreThanOnce },
  Body: { shouldNotBeEmpty },
  Catch: { shouldCatchUsingExceptionHierarchy, catchShouldBeReachable },
  Package: { shouldNotDuplicatePackageName },
  Program: { nameShouldNotBeKeyword, shouldMatchFileExtension },
  Test: { shouldHaveNonEmptyName, shouldNotMarkMoreThanOneOnlyTest, shouldHaveAssertInTest, shouldMatchFileExtension },
  Class: { nameShouldBeginWithUppercase, nameShouldNotBeKeyword, shouldNotHaveLoopInHierarchy, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementAllMethodsInHierarchy, shouldNotUseReservedWords, shouldNotDuplicateEntities },
  Singleton: { nameShouldBeginWithLowercase, inlineSingletonShouldBeAnonymous, topLevelSingletonShouldHaveAName, nameShouldNotBeKeyword, shouldInitializeAllAttributes, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementAbstractMethods, shouldImplementAllMethodsInHierarchy, shouldNotUseReservedWords, shouldNotDuplicateEntities },
  Mixin: { nameShouldBeginWithUppercase, shouldNotHaveLoopInHierarchy, shouldOnlyInheritFromMixin, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldNotDuplicateEntities },
  Field: { nameShouldBeginWithLowercase, shouldNotAssignToItselfInDeclaration, nameShouldNotBeKeyword, shouldNotDuplicateFields, shouldNotUseReservedWords, shouldNotDefineUnusedVariables, shouldDefineConstInsteadOfVar },
  Method: { onlyLastParameterCanBeVarArg, nameShouldNotBeKeyword, methodShouldHaveDifferentSignature, shouldNotOnlyCallToSuper, shouldUseOverrideKeyword, possiblyReturningBlock, shouldNotUseOverride, shouldMatchSuperclassReturnValue, shouldNotDefineNativeMethodsOnUnnamedSingleton, overridingMethodShouldHaveABody, getterMethodShouldReturnAValue },
  Variable: { nameShouldBeginWithLowercase, nameShouldNotBeKeyword, shouldNotAssignToItselfInDeclaration, shouldNotDuplicateLocalVariables, shouldNotDuplicateGlobalDefinitions, shouldNotDefineGlobalMutableVariables, shouldNotUseReservedWords, shouldInitializeGlobalReference, shouldDefineConstInsteadOfVar },
  Return: {},
  Assignment: { shouldNotAssignToItself, shouldNotReassignConst },
  Reference: {},
  Self: { shouldNotUseSelf },
  New: { shouldNotInstantiateAbstractClass, shouldPassValuesToAllAttributes },
  Literal: {},
  Send: { shouldNotCompareAgainstBooleanLiterals, shouldUseSelfAndNotSingletonReference, shouldNotCompareEqualityOfSingleton, shouldUseBooleanValueInLogicOperation, methodShouldExist, codeShouldBeReachable, shouldNotDefineUnnecessaryCondition, shouldNotUseVoidMethodAsValue },
  Super: { shouldUseSuperOnlyOnOverridingMethod },
  If: { shouldReturnAValueOnAllFlows, shouldUseBooleanValueInIfCondition, shouldNotDefineUnnecesaryIf, codeShouldBeReachable, shouldNotDefineUnnecessaryCondition, shouldUseConditionalExpression },
  Throw: {},
  Try: { shouldHaveCatchOrAlways },
  Environment: {},
  Describe: { shouldNotDuplicateGlobalDefinitions, shouldNotDefineEmptyDescribe, shouldHaveNonEmptyName },
}

export default (target: Node): List<Problem> => target.reduce<Problem[]>((found, node) => {
  return [
    ...found,
    ...node.problems?.map(({ code }) => ({ code, level: 'error', node, values: [], sourceMap: node.sourceMap } as Problem)) ?? [],
    ...entries(validationsByKind[node.kind] as Record<Code, Validation<Node>>)
      .map(([code, validation]) => validation(node, code)!)
      .filter(result => result !== null),
  ]
}, [])