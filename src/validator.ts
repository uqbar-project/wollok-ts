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
import { count, Definition, duplicates, is, isEmpty, last, List, match, notEmpty, when } from './extensions'
// - Unified problem type
import { Assignment, Body, Catch, Class, Code, Describe, Entity, Expression, Field, If, Import,
  Level, Literal, Method, Mixin, Module, NamedArgument, New, Node, Package, Parameter, ParameterizedType, Problem,
  Program, Reference, Return, Self, Send, Sentence, Singleton, SourceIndex, SourceMap, Super, Test, Throw, Try, Variable } from './model'

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

export const isNotWithin = <N extends Node>(kind: Definition<N>): (node: N, code: Code) => Problem | null =>
  error((node: N) => !node.ancestors.some(is(kind)) || node.isSynthetic)

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
  singleton => singleton.parent.is(Package) || !singleton.name
)

export const topLevelSingletonShouldHaveAName = error<Singleton>(
  singleton => !singleton.parent.is(Package) || !!singleton.name
)

export const onlyLastParameterCanBeVarArg = error<Method>(node => {
  const varArgIndex = node.parameters.findIndex(p => p.isVarArg)
  return varArgIndex < 0 || varArgIndex === node.parameters.length - 1
})

export const shouldHaveCatchOrAlways = error<Try>(node =>
  notEmpty(node.catches) || notEmpty(node.always.sentences)
)

export const methodShouldHaveDifferentSignature = error<Method>(node => {
  return node.parent.methods.every(other => node === other || !other.matchesSignature(node.name, node.parameters.length))
})

export const shouldNotOnlyCallToSuper = warning<Method>(node => {
  const callsSuperWithSameArgs = (sentence?: Sentence) => sentence?.is(Super) && sentence.args.every((arg, index) => arg.is(Reference) && arg.target() === node.parameters[index])
  return isEmpty(node.sentences) || !node.sentences.every(sentence =>
    callsSuperWithSameArgs(sentence) || sentence.is(Return) && callsSuperWithSameArgs(sentence.value)
  )
})

export const shouldNotInstantiateAbstractClass = error<New>(node => !node.instantiated.target()?.isAbstract)

export const shouldNotAssignToItself = error<Assignment>(node => {
  const assigned = node.variable.target()
  return !(node.value.is(Reference) && assigned && assigned === node.value.target())
})

export const shouldNotReassignConst = error<Assignment>(node => {
  const target = node?.variable?.target()
  const referenceIsNotConstant = !!target && (target.is(Variable) || target?.is(Field)) && !target.isConstant
  return referenceIsNotConstant && !target?.is(Parameter)
})

export const shouldNotHaveLoopInHierarchy = error<Class | Mixin>(node => !allParents(node).includes(node))

export const shouldNotAssignToItselfInDeclaration = error<Field | Variable>(node => !node.value.is(Reference) || node.value.target() !== node)

export const shouldNotCompareAgainstBooleanLiterals = warning<Send>(node => {
  const arg: Expression = node.args[0]
  return !isEqualMessage(node) || !arg || !(isBooleanLiteral(arg, true) || isBooleanLiteral(arg, false) || isBooleanLiteral(node.receiver, true) || isBooleanLiteral(node.receiver, false))
})

export const shouldUseSelfAndNotSingletonReference = warning<Send>(node => {
  const receiver = node.receiver
  return !receiver.is(Reference) || !receiver.ancestors.includes(receiver.target()!)
})

export const shouldOnlyInheritFromMixin = error<Mixin>(node => !node.supertypes.some(parent => !parent.reference.target()?.is(Mixin)))

export const shouldUseOverrideKeyword = warning<Method>(node =>
  node.isOverride || !superclassMethod(node)
)

export const possiblyReturningBlock = warning<Method>(node => {
  const singleSentence = node.sentences[0]
  return !(node.sentences.length === 1 && singleSentence.isSynthetic && singleSentence.is(Return) && singleSentence.value?.is(Singleton) && singleSentence.value.isClosure)
})

export const shouldNotUseOverride = error<Method>(node =>
  node.parent.is(Mixin) || !node.isOverride || !!superclassMethod(node)
)

export const namedArgumentShouldExist = error<NamedArgument>(node => {
  const parent = getReferencedModule(node.parent)
  return !!parent && !!parent.lookupField(node.name)
})

export const namedArgumentShouldNotAppearMoreThanOnce = warning<NamedArgument>(node =>  {
  const nodeParent = node.parent
  let siblingArguments: List<NamedArgument> | undefined
  if (nodeParent.is(New)) siblingArguments = nodeParent.args
  return !siblingArguments || count(siblingArguments, _ => _.name === node.name) === 1
})

export const linearizationShouldNotRepeatNamedArguments = warning<Singleton | Class>(node =>  {
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
  const ifFlows = !!lastThenSentence && !!lastElseSentence && (lastThenSentence.is(If) || lastElseSentence.is(If))
  return singleFlow || twoFlows || ifFlows
})

export const shouldNotDuplicateFields = error<Field>(node =>
  count(node.parent.allFields, _ => _.name == node.name) === 1
)

export const parameterShouldNotDuplicateExistingVariable = error<Parameter>(node => {
  const nodeMethod = getVariableContainer(node)
  if (!nodeMethod) return true
  const parameterNotDuplicated = count((nodeMethod as Method).parameters || [], parameter => parameter.name == node.name) <= 1
  return parameterNotDuplicated && !hasDuplicatedVariable(nodeMethod.parent, node.name)
})

export const shouldNotDuplicateLocalVariables = error<Variable>(node => !duplicatesLocalVariable(node))

export const shouldNotDuplicateGlobalDefinitions = error<Module | Variable>(node =>
  !node.name || !node.parent.is(Package) || isEmpty(node.siblings().filter(child => (child as Entity).name == node.name))
)

export const shouldNotDuplicateVariablesInLinearization = error<Module>(node => {
  const allFields = node.allFields.filter(field => !node.fields.includes(field)).map(_ => _.name)
  return allFields.length === new Set(allFields).size
})

export const shouldImplementAbstractMethods = error<Singleton>(node => {
  const allMethods = node.allMethods
  return isEmpty(allMethods.filter(method => !isImplemented(allMethods, method) && method.isAbstract()))
})

export const shouldNotDefineGlobalMutableVariables = error<Variable>(variable => {
  return variable.isConstant || !variable.isGlobal
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
  notEmpty(node.elseBody.sentences) || !node.condition.is(Literal) || node.condition.value !== true
)

export const shouldNotDefineEmptyDescribe = warning<Describe>(node =>
  notEmpty(node.tests)
)

export const shouldHaveNonEmptyName = warning<Describe | Test>(node =>
  (node.name ?? '').replaceAll('"', '').trim() !== ''
)

export const shouldNotMarkMoreThanOneOnlyTest = warning<Test>(node =>
  !node.isOnly || count(node.siblings(), element => element.is(Test) && element.isOnly) <= 1
)

export const shouldNotDefineNativeMethodsOnUnnamedSingleton = error<Method>(node => {
  const parent = node.parent
  return !node.isNative() || !parent.is(Singleton) || !!parent.name
})

export const codeShouldBeReachable = error<If | Send>(node =>
  match(node)(
    when(If)(node => {
      const condition = node.condition
      if (!condition.is(Literal) || condition.value !== true && condition.value !== false) return true
      return isBooleanLiteral(condition, true) && isEmpty(node.elseBody.sentences) || isBooleanLiteral(condition, false) && isEmpty(node.thenBody.sentences)
    }),
    when(Send)(node => {
      const receiver = node.receiver
      const message = node.message
      return !(isBooleanLiteral(receiver, true) && ['or', '||'].includes(message)) && !(isBooleanLiteral(receiver, false) && ['and', '&&'].includes(message))
    }),
  )
)

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
      if (andOperation) return !isBooleanLiteral(receiver, true) && !isBooleanLiteral(argument, true)
      if (orOperation) return !isBooleanLiteral(receiver, false) && !isBooleanLiteral(argument, false)
      return true
    }),
  )
)

export const overridingMethodShouldHaveABody = error<Method>(node =>
  !node.isOverride || node.isNative() || node.isConcrete()
)

export const shouldUseConditionalExpression = warning<If>(node => {
  const thenValue = valueFor(last(node.thenBody.sentences))
  const elseValue = isEmpty(node.elseBody.sentences) ? undefined : valueFor(last(node.elseBody.sentences))
  return elseValue === undefined || ![true, false].includes(thenValue) || thenValue === elseValue
  // && (!node.nextSibling() || ![true, false].includes(valueFor(node.nextSibling())))
})

export const shouldHaveAssertInTest = warning<Test>(node =>
  !node.body.isEmpty() || sendsMessageToAssert(node.body)
)

export const shouldMatchFileExtension = error<Test | Program>(node => {
  const filename = node.sourceFileName
  if (!filename) return true
  return match(node)(
    when(Test)(_ => filename.endsWith('wtest')),
    when(Program)(_ => filename.endsWith('wpgm')),
  )
})

export const shouldImplementAllMethodsInHierarchy = error<Class | Singleton>(node => {
  const methodsCallingToSuper = node.allMethods.filter(method => callsToSuper(method))
  return methodsCallingToSuper
    .every(method => node.lookupMethod(method.name, method.parameters.length, { lookupStartFQN: method.parent.fullyQualifiedName }))
})

export const getterMethodShouldReturnAValue = warning<Method>(node =>
  !isGetter(node) || node.isSynthetic || node.isNative() || node.isAbstract() || node.sentences.some(_ => _.is(Return))
)

export const shouldNotUseReservedWords = warning<Class | Singleton | Variable | Field | Parameter>(node => !usesReservedWords(node))

export const shouldInitializeGlobalReference = error<Variable>(node =>
  !node.isGlobal || !node.value.is(Literal) || !uninitializedValue(node.value)
)

export const shouldNotDefineUnusedVariables = warning<Field>(node => !unusedVariable(node))

export const shouldNotDuplicatePackageName = error<Package>(node =>
  !node.siblings().some(sibling => sibling.is(Package) && sibling.name == node.name)
)

export const shouldCatchUsingExceptionHierarchy = error<Catch>(node => {
  const EXCEPTION_CLASS = node.environment.getNodeByFQN<Class>('wollok.lang.Exception')
  const exceptionType = node.parameterType.target()
  return !exceptionType || exceptionType?.inherits(EXCEPTION_CLASS)
})

export const catchShouldBeReachable = error<Catch>(node => {
  const previousSiblings = node.parent.children.slice(0, node.parent.children.indexOf(node))
  const exceptionType = node.parameterType.target()!
  return isEmpty(previousSiblings) || !previousSiblings.some(sibling => {
    if (!sibling.is(Catch)) return false
    const siblingType = sibling.parameterType.target()!
    return exceptionType === siblingType || exceptionType.inherits(siblingType)
  })
})

export const shouldNotDuplicateEntities = error<Class | Mixin | Singleton>(node =>
  !node.name || !node.parent.is(Package) || node.parent.imports.every(importFile => !entityIsAlreadyUsedInImport(importFile.entity.target(), node.name!))
)

export const shouldNotImportSameFile = error<Import>(node =>
  ['wtest', 'wpgm'].some(allowedExtension => node.parent.fileName?.endsWith(allowedExtension)) || node.entity.target() !== node.parent
)

export const shouldNotImportMoreThanOnce = warning<Import>(node =>
  !node.parent.is(Package) || node.parent.imports.filter(importFile => importFile !== node).every(importFile => !isAlreadyUsedInImport(importFile.entity.target(), node.entity.target()))
)

export const shouldDefineConstInsteadOfVar = warning<Variable | Field>(node => {
  if (node.isConstant || usesReservedWords(node) || KEYWORDS.includes(node.name || '') || node.is(Field) && unusedVariable(node) || node.is(Variable) && duplicatesLocalVariable(node)) return true
  const module = getContainer(node)
  if (!module) return true
  return match(module)(
    when(Program)(program => assignsVariable(program.body, node)),
    when(Test)(test => assignsVariable(test.body, node)),
    when(Describe)(describe =>
      describe.methods.some(method => assigns(method, node)) ||
      describe.tests.some(test => assignsVariable(test.body, node))
    ),
    when(Module)(module => module.methods.some(method => assigns(method, node))),
  )
})

export const shouldNotUseVoidMethodAsValue = error<Send>(node => {
  if (!methodExists(node) || !supposedToReturnValue(node)) return true

  const method: Method | undefined = match(node.receiver)(
    when(Reference)(nodeRef => {
      const target = nodeRef.target()
      return target?.is(Module) ? target.lookupMethod(node.message, node.args.length) : undefined
    }),
    when(Literal)(_ => findMethod(node)),
    when(Self)(_ => findMethod(node)),
    when(Expression)(_ => undefined),
  )

  return !method || method.isNative() || method.isAbstract() || returnsValue(method)
})

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const allParents = (module: Module) =>
  module.supertypes.map(supertype => supertype.reference.target()).flatMap(supertype => supertype?.hierarchy ?? [])

const getReferencedModule = (parent: Node): Module | undefined => match(parent)(
  when(ParameterizedType)(node => node.reference.target()),
  when(New)(node => node.instantiated.target()),
  when(Node)(() => undefined),
)

const uninitializedValue = (value: Expression | undefined) => value && value.is(Literal) && !value.value && value.isSynthetic

const getUninitializedAttributesForInstantation = (node: New): string[] => {
  const target = node.instantiated.target()!
  const initializers = node.args.map(_ => _.name)
  return getUninitializedAttributes(target, initializers)
}

const getUninitializedAttributes = (node: Module, initializers: string[] = []): string[] => {
  const uninitializedAttributes: string[] = []
  node.defaultFieldValues?.forEach(
    (value, field) => {
      if (uninitializedValue(value) && !initializers.includes(field.name)) {
        uninitializedAttributes.push(field.name)
      }
    })
  return uninitializedAttributes
}

const isBooleanLiteral = (node: Expression, value: boolean) => node.is(Literal) && node.value === value

const targetSupertypes = (node: Class | Singleton) => node.supertypes.map(_ => _?.reference.target())

const superclassMethod = (node: Method) => node.parent.lookupMethod(node.name, node.parameters.length, { lookupStartFQN: node.parent.fullyQualifiedName, allowAbstractMethods: true })

const finishesFlow = (sentence: Sentence, node: Node): boolean => {
  const parent = node.parent
  const lastLineOnMethod = parent.is(Body) ? last(parent.sentences) : undefined
  const returnCondition = (sentence.is(Return) && lastLineOnMethod !== node && lastLineOnMethod?.is(Return) || lastLineOnMethod?.is(Throw)) ?? false
  return sentence.is(Throw) || sentence.is(Send) || sentence.is(Assignment) || sentence.is(If) || returnCondition
}

const getVariableContainer = (node: Node) =>
  node.ancestors.find(parent => parent.is(Method) || parent.is(Test)) as Method | Test | undefined

const getContainer = (node: Node) =>
  node.ancestors.find(parent => parent.is(Module) || parent.is(Program) || parent.is(Test)) as Module | Program | Test | undefined

const getAllVariables = (node: Method | Test): List<Variable> => node.sentences.filter(is(Variable))

const hasDuplicatedVariable = (node: Module, variableName: string): boolean =>
  node.is(Module) && !!node.lookupField(variableName)

const isImplemented = (allMethods: List<Method>, method: Method): boolean => {
  return allMethods.some(someMethod => method.matchesSignature(someMethod.name, someMethod.parameters.length) && !someMethod.isAbstract)
}

const isEqualMessage = (node: Send): boolean =>
  ['==', '!=', '===', '!==', 'equals'].includes(node.message) && node.args.length === 1

const isBooleanMessage = (node: Send): boolean =>
  ['&&', 'and', '||', 'or'].includes(node.message) && node.args.length === 1 || ['negate', 'not'].includes(node.message) && isEmpty(node.args)

const referencesSingleton = (node: Expression) => node.is(Reference) && node.target()?.is(Singleton)

const isBooleanOrUnknownType = (node: Node): boolean => match(node)(
  when(Literal)(condition => condition.value === true || condition.value === false),
  when(Send)( _ =>  true), // tackled in a different validator
  when(Super)( _ => true),
  when(Reference)( condition => !condition.target()?.is(Singleton)),
  when(Node)( _ => false),
)

const valueFor: any | undefined = (node: Node) =>
  match(node)(
    when(Literal)(node => node.value),
    when(Return)(node => valueFor(node.value)),
    when(Node)(_ => undefined),
  )

const sendsMessageToAssert = (node: Node): boolean =>
  match(node)(
    when(Body)(node => node.children.some(child => sendsMessageToAssert(child))),
    when(Send)<boolean>(nodeSend =>
      match(nodeSend.receiver)(
        when(Reference)(receiver => receiver.name === 'assert'),
        when(Literal)(_ => {
          const method = findMethod(nodeSend)
          return !!method && !!method.body && method.body !== 'native' && sendsMessageToAssert(method.body)
        }),
        when(Self)(_ => {
          const method = findMethod(nodeSend)
          return !!method && !!method.body && method.body !== 'native' && sendsMessageToAssert(method.body)
        }),
        when(Expression)(_ => false),
      )
    ),
    when(Try)(node =>
      sendsMessageToAssert(node.body) ||
      node.catches.every(_catch => sendsMessageToAssert(_catch.body)) || sendsMessageToAssert(node.always)
    ),
    when(If)(node => sendsMessageToAssert(node.thenBody) && node.elseBody && sendsMessageToAssert(node.elseBody)),
    when(Node)(_ => false),
  )

// TODO: this should be no longer necessary when the type system is implemented
const findMethod = (messageSend: Send): Method | undefined => {
  const parent = messageSend.receiver.ancestors.find(ancestor => ancestor.is(Module)) as Module
  return parent?.lookupMethod(messageSend.message, messageSend.args.length)
}

const callsToSuper = (node: Method): boolean => node.sentences.some(sentence => isCallToSuper(sentence))

const isCallToSuper = (node: Node): boolean =>
  match(node)(
    when(Super)(() => true),
    when(Return)(node => !!node.value && isCallToSuper(node.value)),
    when(Send)(node => isCallToSuper(node.receiver) || node.args.some(arg => isCallToSuper(arg))),
    when(Node)(() => false),
  )

const isGetter = (node: Method): boolean => node.parent.allFields.map(_ => _.name).includes(node.name) && isEmpty(node.parameters)

const methodOrTestUsesField = (parent: Method | Test, field: Field) => parent.sentences.some(sentence => usesField(sentence, field))

const usesField = (node: Sentence | Body | NamedArgument, field: Field): boolean => match(node)(
  when(Variable)(node => usesField(node.value, field)),
  when(Return)(node => !!node.value && usesField(node.value, field)),
  when(Assignment)(node => node.variable.target() === field || usesField(node.value, field)),
  when(Reference)(node => node.target() === field),
  when(Send)(node => usesField(node.receiver, field) || node.args.some(arg => usesField(arg, field))),
  when(If)(node => usesField(node.condition, field) || usesField(node.thenBody, field) || node.elseBody && usesField(node.elseBody, field)),
  when(New)(node => node.args.some(arg => usesField(arg, field))),
  when(NamedArgument)(node => usesField(node.value, field)),
  when(Throw)(node => usesField(node.exception, field)),
  when(Try)(node => usesField(node.body, field) || node.catches.some(catchBlock => usesField(catchBlock.body, field)) || !!node.always && usesField(node.always, field)),
  when(Expression)(() => false),
  when(Body)(node => node.sentences.some(sentence => usesField(sentence, field))),
)

// TODO: Import could offer a list of imported entities
const entityIsAlreadyUsedInImport = (target: Entity | undefined, entityName: string) => target && match(target)(
  when(Package)(node => node.members.some(member => member.name == entityName)),
  when(Entity)(node => node.name == entityName),
)

const isAlreadyUsedInImport = (target: Entity | undefined, node: Entity | undefined) => !!target && node && match(node)(
  when(Package)(node => node.name == target.name),
  when(Entity)(node => entityIsAlreadyUsedInImport(target, node.name!)),
)

const duplicatesLocalVariable = (node: Variable): boolean => {
  if (node.ancestors.some(is(Program)) || node.isGlobal) return false

  const container = getVariableContainer(node)
  if (!container) return false
  const duplicateReference = count(getAllVariables(container), reference => reference.name == node.name) > 1
  return duplicateReference || hasDuplicatedVariable(container.parent, node.name) || !container.is(Test) && container.parameters.some(_ => _.name == node.name)
}

const assigns = (method: Method, variable: Variable | Field) => method.sentences.some(sentence => assignsVariable(sentence, variable))

const assignsVariable = (sentence: Sentence | Body, variable: Variable | Field): boolean => match(sentence)(
  when(Body)(node => node.sentences.some(sentence => assignsVariable(sentence, variable))),
  when(Variable)(node => assignsVariable(node.value, variable)),
  when(Return)(node => !!node.value && assignsVariable(node.value, variable)),
  when(Assignment)(node => node.variable.target() == variable),
  when(Send)(node => assignsVariable(node.receiver, variable) || node.args.some(arg => assignsVariable(arg, variable))),
  when(If)(node => assignsVariable(node.condition, variable) || assignsVariable(node.thenBody, variable) || assignsVariable(node.elseBody, variable)),
  when(Try)(node => assignsVariable(node.body, variable) || node.catches.some(catchBlock => assignsVariable(catchBlock.body, variable)) || assignsVariable(node.always, variable)),
  when(Singleton)(node => node.methods.some(method => assigns(method, variable))),
  when(Expression)(_ => false),
)

const unusedVariable = (node: Field) => {
  const parent = node.parent
  const allFields = parent.allFields
  const allMethods: List<Test | Method> = parent.is(Describe) ? parent.tests : parent.allMethods
  return !node.isProperty && node.name != '<toString>'
    && allMethods.every(method => !methodOrTestUsesField(method, node))
    && allFields.every(field => !usesField(field.value, node))
}

const usesReservedWords = (node: Class | Singleton | Variable | Field | Parameter) => {
  const parent = node.ancestors.find(ancestor => ancestor.is(Package)) as Package | undefined
  const wordsReserved = LIBRARY_PACKAGES.flatMap(libPackage => node.environment.getNodeByFQN<Package>(libPackage).members.map(_ => _.name))
  wordsReserved.push('wollok')
  return !!parent && !parent.fullyQualifiedName.includes('wollok.') && wordsReserved.includes(node.name)
}

const supposedToReturnValue = (node: Node): boolean => match(node.parent)(
  when(Assignment)(() => true),
  when(If)(() => true),
  when(Literal)(nodeLiteral => Array.isArray(nodeLiteral.value) && nodeLiteral.value[1].includes(node)),
  when(NamedArgument)(nodeArg => nodeArg.value == node),
  when(New)(nodeNew => nodeNew.args.some(namedArgument => namedArgument.value == node)),
  when(Return)(nodeReturn => {
    const parent = nodeReturn.ancestors.find(is(Singleton))
    return !nodeReturn.isSynthetic || !(parent && parent.isClosure)
  }),
  when(Send)(nodeSend => nodeSend.args.includes(node) || nodeSend.receiver == node),
  when(Super)(nodeSuper => nodeSuper.args.includes(node)),
  when(Variable)(() => true),
  when(Node)(() => false),
)

const returnsValue = (node: Method): boolean => node.sentences.some(sentence => returnsAValue(sentence))

const returnsAValue = (node: Node): boolean => match(node)(
  when(Return)(() => true),
  when(Body)(node => node.sentences.some(sentence => returnsAValue(sentence))),
  when(If)(node => returnsAValue(node.thenBody) || returnsAValue(node.elseBody)),
  when(Try)(node => returnsAValue(node.body) || node.catches.some(sentence => returnsAValue(sentence)) || returnsAValue(node.always)),
  when(Node)(() => false),
)

const methodExists = (node: Send): boolean => match(node.receiver)(
  when(Self)(selfNode => {
    const allAncestors = selfNode.ancestors.filter(ancestor => ancestor.is(Module))
    return isEmpty(allAncestors) || allAncestors.some(ancestor => (ancestor as Module).lookupMethod(node.message, node.args.length, { allowAbstractMethods: true }))
  }),
  when(Reference)(referenceNode => {
    const receiver = referenceNode.target()
    return !receiver?.is(Module) || isBooleanMessage(node) || !!receiver.lookupMethod(node.message, node.args.length, { allowAbstractMethods: true })
  }),
  when(Node)(() => true),
)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORT HELPERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const getOffsetForName = (node: Node): number => match(node)(
  when(Parameter)(() => 0),
  when(Field)(node => node.isConstant ? 6 : 4 + (node.isProperty ? 9 : 0)),
  when(Entity)(node => node.is(Singleton) ? 7 : node.kind.length + 1),
  when(Method)(node => node.kind.length + 1),
)

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
  when(Program)(() => ({ nameShouldNotBeKeyword, shouldMatchFileExtension })),
  when(Test)(() => ({ shouldHaveNonEmptyName, shouldNotMarkMoreThanOneOnlyTest, shouldHaveAssertInTest, shouldMatchFileExtension })),
  when(Class)(() => ({ nameShouldBeginWithUppercase, nameShouldNotBeKeyword, shouldNotHaveLoopInHierarchy, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementAllMethodsInHierarchy, shouldNotUseReservedWords, shouldNotDuplicateEntities })),
  when(Singleton)(() => ({ nameShouldBeginWithLowercase, inlineSingletonShouldBeAnonymous, topLevelSingletonShouldHaveAName, nameShouldNotBeKeyword, shouldInitializeAllAttributes, linearizationShouldNotRepeatNamedArguments, shouldNotDefineMoreThanOneSuperclass, superclassShouldBeLastInLinearization, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldImplementAbstractMethods, shouldImplementAllMethodsInHierarchy, shouldNotUseReservedWords, shouldNotDuplicateEntities })),
  when(Mixin)(() => ({ nameShouldBeginWithUppercase, shouldNotHaveLoopInHierarchy, shouldOnlyInheritFromMixin, shouldNotDuplicateGlobalDefinitions, shouldNotDuplicateVariablesInLinearization, shouldNotDuplicateEntities })),
  when(Field)(() => ({ nameShouldBeginWithLowercase, shouldNotAssignToItselfInDeclaration, nameShouldNotBeKeyword, shouldNotDuplicateFields, shouldNotUseReservedWords, shouldNotDefineUnusedVariables, shouldDefineConstInsteadOfVar })),
  when(Method)(() => ({ onlyLastParameterCanBeVarArg, nameShouldNotBeKeyword, methodShouldHaveDifferentSignature, shouldNotOnlyCallToSuper, shouldUseOverrideKeyword, possiblyReturningBlock, shouldNotUseOverride, shouldMatchSuperclassReturnValue, shouldNotDefineNativeMethodsOnUnnamedSingleton, overridingMethodShouldHaveABody, getterMethodShouldReturnAValue })),
  when(Variable)(() => ({ nameShouldBeginWithLowercase, nameShouldNotBeKeyword, shouldNotAssignToItselfInDeclaration, shouldNotDuplicateLocalVariables, shouldNotDuplicateGlobalDefinitions, shouldNotDefineGlobalMutableVariables, shouldNotUseReservedWords, shouldInitializeGlobalReference, shouldDefineConstInsteadOfVar })),
  when(Assignment)(() => ({ shouldNotAssignToItself, shouldNotReassignConst })),
  when(Self)(() => ({ shouldNotUseSelf })),
  when(New)(() => ({ shouldNotInstantiateAbstractClass, shouldPassValuesToAllAttributes })),
  when(Send)(() => ({ shouldNotCompareAgainstBooleanLiterals, shouldUseSelfAndNotSingletonReference, shouldNotCompareEqualityOfSingleton, shouldUseBooleanValueInLogicOperation, methodShouldExist, codeShouldBeReachable, shouldNotDefineUnnecessaryCondition, shouldNotUseVoidMethodAsValue })),
  when(Super)(() => ({ shouldUseSuperOnlyOnOverridingMethod })),
  when(If)(() => ({ shouldReturnAValueOnAllFlows, shouldUseBooleanValueInIfCondition, shouldNotDefineUnnecesaryIf, codeShouldBeReachable, shouldNotDefineUnnecessaryCondition, shouldUseConditionalExpression })),
  when(Try)(() => ({ shouldHaveCatchOrAlways })),
  when(Describe)(() => ({ shouldNotDuplicateGlobalDefinitions, shouldNotDefineEmptyDescribe, shouldHaveNonEmptyName })),
  when(Node)(() => ({})),
)

export default (target: Node): List<Problem> => target.reduce<Problem[]>((found, node) => {
  return [
    ...found,
    ...node.problems?.map(({ code }) => ({ code, level: 'error', node, values: [], source: node.sourceMap } as const)  ) ?? [],
    ...entries(validationsByKind(node))
      .map(([code, validation]) => validation(node, code)!)
      .filter(result => result !== null),
  ]
}, [])