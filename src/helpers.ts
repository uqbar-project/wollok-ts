import { BOOLEAN_MODULE, CLOSURE_EVALUATE_METHOD, CLOSURE_MODULE, CLOSURE_TO_STRING_METHOD, INITIALIZE_METHOD, KEYWORDS, NUMBER_MODULE, OBJECT_MODULE, STRING_MODULE, VOID_WKO, WOLLOK_BASE_PACKAGE } from './constants'
import { getPotentiallyUninitializedLazy } from './decorators'
import { count, is, isEmpty, last, List, match, notEmpty, otherwise, valueAsListOrEmpty, when, excludeNullish } from './extensions'
import { RuntimeObject, RuntimeValue } from './interpreter/runtimeModel'
import { Assignment, Body, Class, CodeContainer, Describe, Entity, Environment, Expression, Field, If, Import, Literal, LiteralValue, Method, Module, Name, NamedArgument, New, Node, Package, Parameter, ParameterizedType, Problem, Program, Reference, Referenciable, Return, Self, Send, Sentence, Singleton, Super, Test, Throw, Try, Variable } from './model'

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
  otherwise(() => undefined),
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
  getUninitializedAttributesIn(node, [...node.allFields.filter(field => field.parent !== node)], initializers)

export const getUninitializedAttributesIn = (node: Module, fields: Field[], initializers: string[] = []): string[] =>
  fields.
    filter(field => {
      const value = node.defaultValueFor(field)
      return isUninitialized(value) && !initializers.includes(field.name) && !initializesInsideInitMethod(node, field)
    })
    .map(field => field.name)

// TODO: Fix because it won´t work if an initialize method is overriden by subclass
export const initializesInsideInitMethod = (node: Module, field: Field): boolean => {
  const allInitMethods = node.allMethods.filter(method => method.matchesSignature(INITIALIZE_METHOD, 0))
  return allInitMethods.some(method => initializesReference(method, field))
}

export const initializesReference = (method: Method, field: Field): boolean =>
  method.sentences.some(sentence => sentence.is(Assignment) && sentence.variable.target === field)

export const isUninitialized = (node: Expression | Variable): boolean =>
  match(node)(
    when(Expression)(node => node.isSynthetic && hasNullValue(node)),
    when(Variable)(node => isUninitialized(node.value)),
  )

export const hasBooleanValue = (node: Expression, value: boolean): boolean => node.is(Literal) && node.value === value

export const hasNullValue = (node: Expression): boolean => node.is(Literal) && node.isNull()

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const targetSupertypes = (node: Class | Singleton) => node.supertypes.map(_ => _?.reference.target)

export const superclassMethod = (node: Method): Method | undefined => node.parent.lookupMethod(node.name, node.parameters.length, { lookupStartFQN: node.parent.fullyQualifiedName, allowAbstractMethods: true })

export const finishesFlow = (sentence: Sentence, node: Node): boolean => {
  const parent = node.parent
  const lastLineOnMethod = parent.is(Body) ? last(parent.sentences) : undefined
  const returnCondition = (sentence.is(Return) && lastLineOnMethod !== node && lastLineOnMethod?.is(Return) || lastLineOnMethod?.is(Throw)) ?? false
  // TODO: For Send, consider if expression returns a value
  return sentence.is(Variable) || sentence.is(Throw) || sentence.is(Send) || sentence.is(Super) || sentence.is(Assignment) || sentence.is(If) || returnCondition
}

export const getVariableContainer = (node: Node): CodeContainer | undefined =>
  node.ancestors.find(parent => parent.is(Method) || parent.is(Test)) as CodeContainer | undefined

export const getContainer = (node: Node): Module | Program | Test | undefined =>
  node.ancestors.find(parent => parent.is(Module) || parent.is(Program) || parent.is(Test)) as Module | Program | Test | undefined

export const allScopedVariables = (node: CodeContainer): Referenciable[] => {
  const fields = node.parent.allFields ?? []
  const params = node.is(Method) ? node.parameters : []
  const codeContainerVars = allVariables(node)

  return [...fields, ...params, ...codeContainerVars]
}

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
  otherwise(_ => false),
)

export const valueFor: any | undefined = (node: Node) =>
  match(node)(
    when(Literal)(node => node.value),
    when(Return)(node => valueFor(node.value)),
    otherwise(_ => undefined),
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
    otherwise(_ => false),
  )

// TODO: this should be no longer necessary when the type system is implemented
export const findMethod = (messageSend: Send): Method | undefined => {
  const findModule = (node: Send) => node.receiver.ancestors.find(ancestor => ancestor.is(Module)) as Module

  const module: Module | undefined = match(messageSend.receiver)(
    when(Reference)(nodeRef => {
      const target = nodeRef.target
      return target?.is(Module) ? target : undefined
    }),
    when(Literal)(_ => findModule(messageSend)),
    when(Self)(_ => findModule(messageSend)),
    when(Expression)(_ => undefined),
  )

  return module?.lookupMethod(messageSend.message, messageSend.args.length)
}

export const callsToSuper = (node: Node): boolean =>
  match(node)(
    when(Method)(node => node.sentences.some(sentence => callsToSuper(sentence))),
    when(Return)(node => !!node.value && callsToSuper(node.value)),
    when(Super)(() => true),
    when(Send)(node => callsToSuper(node.receiver) || node.args.some(arg => callsToSuper(arg))),
    otherwise(() => false),
  )

export const isGetter = (node: Method): boolean => node.parent.allFields.map(_ => _.name).includes(node.name) && isEmpty(node.parameters)

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
  const duplicateReference = count(allVariables(container), reference => reference.name == node.name) > 1
  return duplicateReference || hasDuplicatedVariable(container.parent, node.name) || !container.is(Test) && container.parameters.some(_ => _.name == node.name)
}

export const assignsVariable = (sentence: Node, variable: Variable | Field): boolean => match(sentence)(
  when(Assignment)(node => node.variable.target == variable),
  when(Body)(node => node.sentences.some(sentence => assignsVariable(sentence, variable))),
  when(Describe)(node => node.members.some(member => assignsVariable(member, variable))),
  when(If)(node => assignsVariable(node.condition, variable) || assignsVariable(node.thenBody, variable) || assignsVariable(node.elseBody, variable)),
  when(Method)(node => node.sentences.some(sentence => assignsVariable(sentence, variable))),
  when(Module)(node => node.methods.some(method => assignsVariable(method, variable))),
  when(Program)(node => assignsVariable(node.body, variable)),
  when(Return)(node => !!node.value && assignsVariable(node.value, variable)),
  when(Send)(node => assignsVariable(node.receiver, variable) || node.args.some(arg => assignsVariable(arg, variable))),
  when(Singleton)(node => node.methods.some(method => assignsVariable(method, variable))),
  when(Test)(node => assignsVariable(node.body, variable)),
  when(Try)(node => assignsVariable(node.body, variable) || node.catches.some(catchBlock => assignsVariable(catchBlock.body, variable)) || assignsVariable(node.always, variable)),
  when(Variable)(node => assignsVariable(node.value, variable)),
  otherwise(_ => false),
)

export const unusedVariable = (node: Field): boolean => {
  const parent = node.parent
  return !node.isProperty && node.name != CLOSURE_TO_STRING_METHOD
    && parent.allMembers.every((member: Field | Method | Variable | Test) => !usesField(member, node))
}

export const usesField = (node: Node, field: Field): boolean =>
  match(node)(
    when(Singleton)(node => {
      if (!node.isClosure()) return false
      const applyMethod = node.methods.find(isApplyMethodForClosures)
      return !!applyMethod && usesField(applyMethod, field)
    }),
    when(Variable)(node => usesField(node.value, field)),
    when(Return)(node => !!node.value && usesField(node.value, field)),
    when(Assignment)(node => node.variable.target === field || usesField(node.value, field)),
    when(Reference)(node => node.target === field || !!node.target && node.target.is(Field) && usesField(node.target, field)),
    when(Field)(node => node.value && (node.value.is(Literal) || node.value.is(Send)) && usesField(node.value, field)),
    when(Literal)(node =>
      // See type LiteralValue for collection values
      Array.isArray(node.value) && node.value[1].some((expression: any) => usesField(expression, field))),
    when(Send)(node => usesField(node.receiver, field) || node.args.some(arg => usesField(arg, field))),
    when(If)(node => usesField(node.condition, field) || usesField(node.thenBody, field) || node.elseBody && usesField(node.elseBody, field)),
    when(New)(node => node.args.some(arg => usesField(arg, field))),
    when(NamedArgument)(node => usesField(node.value, field)),
    when(Throw)(node => usesField(node.exception, field)),
    when(Try)(node => usesField(node.body, field) || node.catches.some(catchBlock => usesField(catchBlock.body, field)) || !!node.always && usesField(node.always, field)),
    when(Expression)(() => false),
    otherwise((node: Node) => (node.is(Body) || node.is(Method) || node.is(Test)) && node.sentences.some(sentence => usesField(sentence, field))),
  )

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
  otherwise(() => false),
)

export const returnsAValue = (node: Node): boolean => match(node)(
  when(Body)(node => node.sentences.some(sentence => returnsAValue(sentence))),
  when(If)(node => returnsAValue(node.thenBody) || returnsAValue(node.elseBody)),
  when(Method)(node => node.sentences.some(sentence => returnsAValue(sentence))),
  when(Return)(() => true),
  when(Try)(node => returnsAValue(node.body) || node.catches.some(sentence => returnsAValue(sentence)) || returnsAValue(node.always)),
  otherwise(() => false),
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
  otherwise(() => true),
)

export const loopInAssignment = (node: Expression, variableName: string): boolean =>
  node.is(Send) && methodExists(node) && node.receiver.is(Self) && node.message === variableName

export const methodsCallingToSuper = (node: Class | Singleton): Method[] => node.allMethods.filter(method => callsToSuper(method))

export const methodIsImplementedInSuperclass = (node: Class | Singleton) => (method: Method): Method | undefined => node.lookupMethod(method.name, method.parameters.length, { lookupStartFQN: method.parent.fullyQualifiedName })

export const literalValueToClass = (environment: Environment, literal: LiteralValue): Class => {
  const clazz = (() => {
    switch (typeof literal) {
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
    }
  })()
  return environment.getNodeByFQN(clazz)
}

export const allAvailableMethods = (environment: Environment): Method[] =>
  environment.descendants.filter(is(Method)) as Method[]

export const allMethods = (environment: Environment, referenceClass: Reference<Module>): Method[] =>
  (referenceClass.target ?? environment.objectClass).allMethods as Method[]

export const projectToJSON = (wre: Environment): string => JSON.stringify(
  wre,
  (key, value) => key.startsWith('_') ? undefined : value,
  2,
)

export const firstNodeWithProblems = (node: Node): Node | undefined => {
  const { start, end } = node.problems![0].sourceMap ?? { start: { offset: -1 }, end: { offset: -1 } }
  return node.children.find(child =>
    child.sourceMap?.covers(start.offset) || child.sourceMap?.covers(end.offset)
  )
}

export const isError = (problem: Problem): boolean => problem.level === 'error'

export const parentModule = (node: Node): Module => getParentModule(node) ?? node.environment.objectClass

export const parentImport = (node: Node): Import | undefined => node.ancestors.find(ancestor => ancestor.is(Import)) as Import

export const implicitImport = (node: Node): boolean => ['wollok/lang.wlk', 'wollok/lib.wlk'].includes(node.sourceFileName ?? '')

// @ToDo Workaround because package fqn is absolute in the lsp.
export const fqnRelativeToPackage =
  (pckg: Package, node: Entity): string =>
    node.fullyQualifiedName.replace(pckg.fullyQualifiedName, pckg.name)

export const workspacePackage = (environment: Environment): Package => environment.members[1]

export const targettingAt = <T extends Node>(aNode: T) => (anotherNode: Node): anotherNode is Reference<T> =>
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
    otherwise((node: Node) => node.parent === mainPackage),
  )

export const mayExecute = (method: Method) => (node: Node): boolean =>
  node.is(Send) &&
  node.message === method.name &&
  // exclude cases where a message is sent to a different singleton
  !(node.receiver.is(Reference) && node.receiver.target?.is(Singleton) && node.receiver.target !== method.parent)

export const allVariables = (node: CodeContainer): List<Variable> => node.sentences.filter(is(Variable))

export const isNamedSingleton = (node: Node): node is Singleton => node.is(Singleton) && !!node.name

export const methodByFQN = (environment: Environment, fqn: string): Method | undefined => {
  const parts = fqn.split('.')
  const methodWithArity = last(parts)
  const [methodName, originalMethodArity] = methodWithArity!.split('/')
  const methodArity = originalMethodArity ?? 0
  const entityFQN = fqn.replace(`.${methodWithArity}`, '')
  const entity = environment.getNodeByFQN<Module>(entityFQN)
  if (!entity.is(Module)) return undefined
  return entity.lookupMethod(methodName, Number.parseInt(methodArity, 10))
}

export const sendDefinitions = (environment: Environment) => (send: Send): (Method | Field)[] => {
  const originalDefinitions = (): Method[] => {
    try {
      return match(send.receiver)(
        when(Reference)(node => {
          const target = node.target
          return target && is(Singleton)(target) ?
            valueAsListOrEmpty(target.lookupMethod(send.message, send.args.length))
            : allMethodDefinitions(environment, send)
        }),
        when(New)(node => valueAsListOrEmpty(node.instantiated.target?.lookupMethod(send.message, send.args.length))),
        when(Self)(_ => moduleFinderWithBackup(environment, send)(
          (module) => valueAsListOrEmpty(module.lookupMethod(send.message, send.args.length))
        )),
      )
    } catch (error) {
      return allMethodDefinitions(environment, send)
    }
  }
  const getDefinitionFromSyntheticMethod = (method: Method) => {
    return method.parent.allFields.find((field) => field.name === method.name && field.isProperty)
  }

  return excludeNullish<Method | Field>(originalDefinitions().map((method: Method) => method.isSynthetic ? getDefinitionFromSyntheticMethod(method) : method))
}

export const allMethodDefinitions = (environment: Environment, send: Send): Method[] => {
  const arity = send.args.length
  const name = send.message
  return environment.descendants.filter(method =>
    is(Method)(method) &&
    method.name === name &&
    method.parameters.length === arity
  ) as Method[]
}

export const moduleFinderWithBackup = (environment: Environment, send: Send) => (methodFinder: (module: Module) => Method[]): Method[] => {
  const module = send.ancestors.find(is(Module))
  return module ? methodFinder(module) : allMethodDefinitions(environment, send)
}

export const targetName = (target: Node | undefined, defaultName: Name): string =>
  target?.is(Module) || target?.is(Variable) && getPotentiallyUninitializedLazy(target, 'parent')?.is(Package)
    ? target.fullyQualifiedName
    : defaultName

export const getNodeDefinition = (environment: Environment) => (node: Node): Node[] => {
  try {
    return match(node)(
      when(Reference)(node => valueAsListOrEmpty(node.target)),
      when(Send)(sendDefinitions(environment)),
      when(Super)(node => valueAsListOrEmpty(superMethodDefinition(node, getParentModule(node)))),
      when(Self)(node => valueAsListOrEmpty(getParentModule(node)))
    )
  } catch {
    return [node]
  }
}

export const isApplyMethodForClosures = (method: Method): boolean =>
  method.name === CLOSURE_EVALUATE_METHOD && method.parent.fullyQualifiedName.startsWith(`${CLOSURE_MODULE}#`) // TODO: Maybe re-define isClosure() ?

export const superMethodDefinition = (superNode: Super, methodModule: Module): Method | undefined => {
  function isValidMethod(node: Node): node is Method {
    return node.is(Method) && !isApplyMethodForClosures(node)
  }
  const currentMethod = superNode.ancestors.find(isValidMethod)!
  return methodModule.lookupMethod(currentMethod.name, superNode.args.length, { lookupStartFQN: currentMethod.parent.fullyQualifiedName })
}

const getParentModule = (node: Node): Module => node.ancestors.find(is(Module)) as Module

export const isVoid = (obj: RuntimeValue | RuntimeObject): boolean => obj?.module?.fullyQualifiedName === VOID_WKO

export const assertNotVoid = (value: RuntimeObject, errorMessage: string): void => {
  if (isVoid(value)) {
    throw new RangeError(errorMessage)
  }
}

export const getExpressionFor = (node: Expression): string =>
  match(node)(
    when(Send)(nodeSend =>
      `message ${nodeSend.message}/${nodeSend.args.length}`),
    when(If)(_ => 'if expression'),
    when(Reference)(nodeRef => `reference '${nodeRef.name}'`),
    when(Literal)(nodeLiteral => `literal ${nodeLiteral.value}`),
    when(Self)(_ => 'self'),
    when(Expression)(_ => 'expression'),
  )

export const showParameter = (obj: RuntimeObject): string =>
  `"${obj.getShortRepresentation().trim() || obj.module.fullyQualifiedName}"`

export const getMethodContainer = (node: Node): Method | Program | Test | undefined =>
  last(node.ancestors.filter(parent => parent.is(Method) || parent.is(Program) || parent.is(Test))) as unknown as Method | Program | Test