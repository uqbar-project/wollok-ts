import { BOOLEAN_MODULE, CLOSURE_EVALUATE_METHOD, CLOSURE_TO_STRING_METHOD, INITIALIZE_METHOD, KEYWORDS, NUMBER_MODULE, OBJECT_MODULE, STRING_MODULE, WOLLOK_BASE_PACKAGE } from './constants'
import { List, count, is, isEmpty, last, match, notEmpty, when } from './extensions'
import { Assignment, Body, Class, Describe, Entity, Environment, Expression, Field, If, Import, Literal, LiteralValue, Method, Module, NamedArgument, New, Node, Package, Parameter, ParameterizedType, Program, Reference, Return, Self, Send, Sentence, Singleton, Super, Test, Throw, Try, Variable } from './model'

export const LIBRARY_PACKAGES = ['wollok.lang', 'wollok.lib', 'wollok.game', 'wollok.vm', 'wollok.mirror']

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR VALIDATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const allParents = (module: Module): Module[] =>
  module.supertypes.map(supertype => supertype.reference.target).flatMap(supertype => supertype?.hierarchy ?? [])

export const inheritsCustomDefinition = (module: Module): boolean =>
  notEmpty(allParents(module).filter(element => element.fullyQualifiedName == OBJECT_MODULE))

export const getReferencedModule = (parent: Node): Module | undefined => match(parent)(
  when(ParameterizedType)(node => node.reference.target),
  when(New)(node => node.instantiated.target),
  when(Node)(() => undefined),
)

export const getUninitializedAttributesForInstantiation = (node: New): string[] => {
  const target = node.instantiated.target
  if (!target) return []
  const initializers = node.args.map(_ => _.name)
  return getAllUninitializedAttributes(target, initializers)
}

export const getAllUninitializedAttributes = (node: Module, initializers: string[] = []): string[] =>
  getUninitializedAttributesIn(node, [...node.allFields], initializers)

export const getInheritedUninitializedAttributes = (node: Module, initializers: string[] = []): string[] =>
  getUninitializedAttributesIn(node, [...node.allFields.filter(f => f.parent !== node)], initializers)


export const getUninitializedAttributesIn = (node: Module, fields: Field[], initializers: string[] = []): string[] =>
  fields.
    filter(field => {
      const value = node.defaultValueFor(field)
      return isUninitialized(value) && !initializers.includes(field.name) && !initializesInsideInitMethod(node, field)
    })
    .map(field => field.name)


export const initializesInsideInitMethod = (node: Module, field: Field): boolean => {
  const allInitMethods = node.allMethods.filter(method => method.matchesSignature(INITIALIZE_METHOD, 0))
  return allInitMethods.some(method => initializesReference(method, field))
}

export const initializesReference = (method: Method, field: Field): boolean =>
  method.sentences.some(sentence => sentence.is(Assignment) && sentence.variable.target === field)

export const isUninitialized = (value: Expression): boolean => value.isSynthetic && value.is(Literal) && value.isNull()

export const isBooleanLiteral = (node: Expression, value: boolean): boolean => node.is(Literal) && node.value === value

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const targetSupertypes = (node: Class | Singleton) => node.supertypes.map(_ => _?.reference.target)

export const superclassMethod = (node: Method): Method | undefined => node.parent.lookupMethod(node.name, node.parameters.length, { lookupStartFQN: node.parent.fullyQualifiedName, allowAbstractMethods: true })

export const finishesFlow = (sentence: Sentence, node: Node): boolean => {
  const parent = node.parent
  const lastLineOnMethod = parent.is(Body) ? last(parent.sentences) : undefined
  const returnCondition = (sentence.is(Return) && lastLineOnMethod !== node && lastLineOnMethod?.is(Return) || lastLineOnMethod?.is(Throw)) ?? false
  // TODO: For Send, consider if expression returns a value
  return sentence.is(Variable) || sentence.is(Throw) || sentence.is(Send) || sentence.is(Assignment) || sentence.is(If) || returnCondition
}

export const getVariableContainer = (node: Node): Method | Test | undefined =>
  node.ancestors.find(parent => parent.is(Method) || parent.is(Test)) as Method | Test | undefined

export const getContainer = (node: Node): Module | Program | Test | undefined =>
  node.ancestors.find(parent => parent.is(Module) || parent.is(Program) || parent.is(Test)) as Module | Program | Test | undefined

export const getAllVariables = (node: Method | Test): List<Variable> => node.sentences.filter(is(Variable))

export const hasDuplicatedVariable = (node: Module, variableName: string): boolean =>
  node.is(Module) && !!node.lookupField(variableName)

export const isImplemented = (allMethods: List<Method>, method: Method): boolean => {
  return allMethods.some(someMethod => method.matchesSignature(someMethod.name, someMethod.parameters.length) && !someMethod.isAbstract())
}

export const isEqualMessage = (node: Send): boolean =>
  ['==', '!=', '===', '!==', 'equals'].includes(node.message) && node.args.length === 1

export const isBooleanMessage = (node: Send): boolean =>
  ['&&', 'and', '||', 'or'].includes(node.message) && node.args.length === 1 || ['negate', 'not'].includes(node.message) && isEmpty(node.args)

export const referencesSingleton = (node: Expression): boolean | undefined => node.is(Reference) && node.target?.is(Singleton)

export const isBooleanOrUnknownType = (node: Node): boolean => match(node)(
  when(Literal)(condition => condition.value === true || condition.value === false),
  when(Send)(_ => true), // tackled in a different validator
  when(Super)(_ => true),
  when(Reference)(condition => !condition.target?.is(Singleton)),
  when(Node)(_ => false),
)

export const valueFor: any | undefined = (node: Node) =>
  match(node)(
    when(Literal)(node => node.value),
    when(Return)(node => valueFor(node.value)),
    when(Node)(_ => undefined),
  )

export const sendsMessageToAssert = (node: Node): boolean =>
  match(node)(
    when(Body)(node => node.children.some(child => sendsMessageToAssert(child))),
    when(Send)<boolean>(nodeSend => {
      const objectSendsMessageToAssert = (_: Node) => {
        const method = findMethod(nodeSend)
        return !!method && !!method.body && method.body !== KEYWORDS.NATIVE && sendsMessageToAssert(method.body)
      }
      return match(nodeSend.receiver)(
        when(Reference)(receiver => receiver.name === 'assert'),
        when(Literal)(objectSendsMessageToAssert),
        when(Self)(objectSendsMessageToAssert),
        when(Expression)(_ => false),
      )
    }),
    when(Try)(node =>
      sendsMessageToAssert(node.body) ||
      node.catches.every(_catch => sendsMessageToAssert(_catch.body)) || sendsMessageToAssert(node.always)
    ),
    when(If)(node => sendsMessageToAssert(node.thenBody) && node.elseBody && sendsMessageToAssert(node.elseBody)),
    when(Node)(_ => false),
  )

// TODO: this should be no longer necessary when the type system is implemented
export const findMethod = (messageSend: Send): Method | undefined => {
  const parent = messageSend.receiver.ancestors.find(ancestor => ancestor.is(Module)) as Module
  return parent?.lookupMethod(messageSend.message, messageSend.args.length)
}

export const callsToSuper = (node: Method): boolean => node.sentences.some(sentence => isCallToSuper(sentence))

export const isCallToSuper = (node: Node): boolean =>
  match(node)(
    when(Super)(() => true),
    when(Return)(node => !!node.value && isCallToSuper(node.value)),
    when(Send)(node => isCallToSuper(node.receiver) || node.args.some(arg => isCallToSuper(arg))),
    when(Node)(() => false),
  )

export const isGetter = (node: Method): boolean => node.parent.allFields.map(_ => _.name).includes(node.name) && isEmpty(node.parameters)

export const methodOrTestUsesField = (parent: Method | Test, field: Field): boolean => parent.sentences.some(sentence => usesField(sentence, field))

export const usesField = (node: Sentence | Body | NamedArgument | Field, field: Field): boolean => {
  if (node.sourceFileName === 'shouldNotDefineUnusedVariables2.wtest' && node.kind === 'Field') {
    console.info(node.kind, node.name, node.value)
  }
  return match(node)(
    when(Singleton)(node => {
      if (!node.isClosure()) return false
      const applyMethod = node.methods.find(method => method.name === CLOSURE_EVALUATE_METHOD)
      return !!applyMethod && methodOrTestUsesField(applyMethod, field)
    }),
    when(Variable)(node => usesField(node.value, field)),
    when(Return)(node => !!node.value && usesField(node.value, field)),
    when(Assignment)(node => node.variable.target === field || usesField(node.value, field)),
    when(Reference)(node => node.target === field || (!!node.target && node.target.is(Field) && usesField(node.target, field))),
    when(Send)(node => usesField(node.receiver, field) || node.args.some(arg => usesField(arg, field))),
    when(If)(node => usesField(node.condition, field) || usesField(node.thenBody, field) || node.elseBody && usesField(node.elseBody, field)),
    when(New)(node => node.args.some(arg => usesField(arg, field))),
    when(NamedArgument)(node => usesField(node.value, field)),
    when(Throw)(node => usesField(node.exception, field)),
    when(Try)(node => usesField(node.body, field) || node.catches.some(catchBlock => usesField(catchBlock.body, field)) || !!node.always && usesField(node.always, field)),
    when(Expression)(() => false),
    when(Body)(node => node.sentences.some(sentence => usesField(sentence, field))),
    when(Field)(node => Array.isArray(node.value) && node.value.some(value => value === field)),
  )
}

// TODO: Import could offer a list of imported entities
export const entityIsAlreadyUsedInImport = (target: Entity | undefined, entityName: string): boolean | undefined => target && match(target)(
  when(Package)(node => node.members.some(member => member.name == entityName)),
  when(Entity)(node => node.name == entityName),
)

export const isAlreadyUsedInImport = (target: Entity | undefined, node: Entity | undefined): boolean | undefined => !!target && node && match(node)(
  when(Package)(node => node.name == target.name),
  when(Entity)(node => entityIsAlreadyUsedInImport(target, node.name!)),
)

export const duplicatesLocalVariable = (node: Variable): boolean => {
  if (node.ancestors.some(is(Program)) || node.isAtPackageLevel) return false

  const container = getVariableContainer(node)
  if (!container) return false
  const duplicateReference = count(getAllVariables(container), reference => reference.name == node.name) > 1
  return duplicateReference || hasDuplicatedVariable(container.parent, node.name) || !container.is(Test) && container.parameters.some(_ => _.name == node.name)
}

export const assigns = (method: Method, variable: Variable | Field): boolean => method.sentences.some(sentence => assignsVariable(sentence, variable))

export const assignsVariable = (sentence: Sentence | Body, variable: Variable | Field): boolean => match(sentence)(
  when(Body)(node => node.sentences.some(sentence => assignsVariable(sentence, variable))),
  when(Variable)(node => assignsVariable(node.value, variable)),
  when(Return)(node => !!node.value && assignsVariable(node.value, variable)),
  when(Assignment)(node => node.variable.target == variable),
  when(Send)(node => assignsVariable(node.receiver, variable) || node.args.some(arg => assignsVariable(arg, variable))),
  when(If)(node => assignsVariable(node.condition, variable) || assignsVariable(node.thenBody, variable) || assignsVariable(node.elseBody, variable)),
  when(Try)(node => assignsVariable(node.body, variable) || node.catches.some(catchBlock => assignsVariable(catchBlock.body, variable)) || assignsVariable(node.always, variable)),
  when(Singleton)(node => node.methods.some(method => assigns(method, variable))),
  when(Expression)(_ => false),
)

export const unusedVariable = (node: Field): boolean => {
  const parent = node.parent
  const allFields = parent.allFields
  const allMethods: List<Test | Method> = parent.is(Describe) ? parent.tests : parent.allMethods
  return !node.isProperty && node.name != CLOSURE_TO_STRING_METHOD
    && allMethods.every(method => !methodOrTestUsesField(method, node))
    && allFields.every(field => !usesField(field.value, node))
}

export const usesReservedWords = (node: Class | Singleton | Variable | Field | Parameter): boolean => {
  const parent = node.ancestors.find(ancestor => ancestor.is(Package)) as Package | undefined
  const wordsReserved = LIBRARY_PACKAGES.flatMap(libPackage => node.environment.getNodeByFQN<Package>(libPackage).members.map(_ => _.name))
  wordsReserved.push('wollok')
  return !!parent && !parent.fullyQualifiedName.includes(WOLLOK_BASE_PACKAGE) && wordsReserved.includes(node.name)
}

export const supposedToReturnValue = (node: Node): boolean => match(node.parent)(
  when(Assignment)(() => true),
  when(If)(() => true),
  when(Literal)(nodeLiteral => Array.isArray(nodeLiteral.value) && nodeLiteral.value[1].includes(node)),
  when(NamedArgument)(nodeArg => nodeArg.value == node),
  when(New)(nodeNew => nodeNew.args.some(namedArgument => namedArgument.value == node)),
  when(Return)(nodeReturn => {
    const parent = nodeReturn.ancestors.find(is(Singleton))
    return !nodeReturn.isSynthetic || !(parent && parent.isClosure())
  }),
  when(Send)(nodeSend => node.is(Expression) && nodeSend.args.includes(node) || nodeSend.receiver == node),
  when(Super)(nodeSuper => node.is(Expression) && nodeSuper.args.includes(node)),
  when(Variable)(() => true),
  when(Node)(() => false),
)

export const returnsValue = (node: Method): boolean => node.sentences.some(sentence => returnsAValue(sentence))

export const returnsAValue = (node: Node): boolean => match(node)(
  when(Return)(() => true),
  when(Body)(node => node.sentences.some(sentence => returnsAValue(sentence))),
  when(If)(node => returnsAValue(node.thenBody) || returnsAValue(node.elseBody)),
  when(Try)(node => returnsAValue(node.body) || node.catches.some(sentence => returnsAValue(sentence)) || returnsAValue(node.always)),
  when(Node)(() => false),
)

export const methodExists = (node: Send): boolean => match(node.receiver)(
  when(Self)(selfNode => {
    const allAncestors = selfNode.ancestors.filter(ancestor => ancestor.is(Module))
    return isEmpty(allAncestors) || allAncestors.some(ancestor => (ancestor as Module).lookupMethod(node.message, node.args.length, { allowAbstractMethods: true }))
  }),
  when(Reference)(referenceNode => {
    const receiver = referenceNode.target
    return !receiver?.is(Module) || isBooleanMessage(node) || !!receiver.lookupMethod(node.message, node.args.length, { allowAbstractMethods: true })
  }),
  when(Node)(() => true),
)

export const isInitialized = (node: Variable): boolean =>
  node.value.isSynthetic &&
  node.value.is(Literal) &&
  node.value.isNull()

export const loopInAssignment = (node: Expression, variableName: string): boolean =>
  node.is(Send) && methodExists(node) && node.receiver.is(Self) && node.message === variableName

export const methodsCallingToSuper = (node: Class | Singleton): Method[] => node.allMethods.filter(method => callsToSuper(method))

export const methodIsImplementedInSuperclass = (node: Class | Singleton) => (method: Method): Method | undefined => node.lookupMethod(method.name, method.parameters.length, { lookupStartFQN: method.parent.fullyQualifiedName })

export const literalValueToClass = (environment: Environment, literal: LiteralValue): Class => {
  const clazz = (() => { switch (typeof literal) {
    case 'number':
      return NUMBER_MODULE
    case 'string':
      return STRING_MODULE
    case 'boolean':
      return BOOLEAN_MODULE
    case 'object':
      try {
        const referenceClasses = literal as unknown as Reference<Class>[]
        return referenceClasses[0].name
      } catch (e) {
        return OBJECT_MODULE
      }
  }})()
  return environment.getNodeByFQN(clazz)
}

export const allAvailableMethods = (environment: Environment): Method[] =>
  environment.descendants.filter(is(Method)) as Method[]

export const allMethods = (environment: Environment, referenceClass: Reference<Module>): Method[] =>
  (referenceClass.target ?? environment.objectClass).allMethods as Method[]

export const firstNodeWithProblems = (node: Node): Node | undefined => {
  const { start, end } = node.problems![0].sourceMap ?? { start: { offset: -1 }, end: { offset: -1 } }
  return node.children.find(child =>
    child.sourceMap?.covers(start.offset) || child.sourceMap?.covers(end.offset)
  )
}

export const parentModule = (node: Node): Module => (node.ancestors.find(ancestor => ancestor.is(Module))) as Module ?? node.environment.objectClass

export const parentImport = (node: Node): Import | undefined => node.ancestors.find(ancestor => ancestor.is(Import)) as Import

export const implicitImport = (node: Node): boolean => ['wollok/lang.wlk', 'wollok/lib.wlk'].includes(node.sourceFileName ?? '')

// @ToDo Workaround because package fqn is absolute in the lsp.
export const fqnRelativeToPackage =
  (pckg: Package, node: Entity): string =>
    node.fullyQualifiedName.replace(pckg.fullyQualifiedName, pckg.name)


export const workspacePackage = (environment: Environment): Package => environment.members[1]

export const targettingAt = <T extends Node>(aNode: T) => (anotherNode: Node): anotherNode is Reference<T>  =>
  anotherNode.is(Reference) && anotherNode.target === aNode

export const projectPackages = (environment: Environment): Package[] =>
  environment.members.slice(1)

export const isNotImportedIn = (importedPackage: Package, importingPackage: Package): boolean =>
  importedPackage !== importingPackage &&
  !importingPackage.imports.some(imported => imported.entity.target && belongsTo(imported.entity.target, importedPackage)) &&
  !importedPackage.isGlobalPackage

export const belongsTo = (node: Node, mainPackage: Package): boolean =>
  match(node)(
    when(Package)((pkg) => pkg === mainPackage),
    when(Node)((node) => node.parent === mainPackage),
  )

export const mayExecute = (method: Method) => (node: Node): boolean =>
  node.is(Send) &&
  node.message === method.name &&
  // exclude cases where a message is sent to a different singleton
  !(node.receiver.is(Reference) && node.receiver.target?.is(Singleton) && node.receiver.target !== method.parent)