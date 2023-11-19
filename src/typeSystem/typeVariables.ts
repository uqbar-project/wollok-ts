import { is, last, List, match, when } from '../extensions'
import { Assignment, Body, Class, Closure, Describe, Environment, Expression, Field, If, Import, Literal, Method, Module, NamedArgument, New, Node, Package, Parameter, Program, Reference, Return, Self, Send, Singleton, Super, Test, Throw, Try, Variable } from '../model'
import { ANY, AtomicType, ELEMENT, RETURN, TypeSystemProblem, VOID, WollokAtomicType, WollokClosureType, WollokMethodType, WollokModuleType, WollokParameterType, WollokParametricType, WollokType, WollokUnionType } from './wollokTypes'

const { assign } = Object

const tVars = new Map<Node, TypeVariable>()

export function newTypeVariables(env: Environment): Map<Node, TypeVariable> {
  tVars.clear()
  createTypeVariables(env)
  return tVars
}

export function newSynteticTVar(node?: Node): TypeVariable {
  return doNewTVarFor(node?.copy() ?? Closure({ code: 'Param type' })) // Using new closure as syntetic node. Is good enough? No.
    .beSyntetic()
}

export function typeVariableFor(node: Node): TypeVariable {
  const tVar = tVars.get(node)
  if (!tVar) return newTVarFor(node)
  return tVar
}


function newTVarFor(node: Node) {
  const newTVar = doNewTVarFor(node)
  let annotatedVar = newTVar // By default, annotations reference the same tVar
  if (node.is(Method)) {
    const parameters = node.parameters.map(p => createTypeVariables(p)!)
    annotatedVar = newSynteticTVar(node) // But for methods, annotations reference to return tVar
    newTVar.setType(new WollokMethodType(annotatedVar, parameters, annotatedVariableMap(node)), false)
  }
  if (node.is(Singleton) && node.isClosure()) {
    const methodApply = node.methods.find(_ => _.name === '<apply>')!
    const parameters = methodApply.parameters.map(p => typeVariableFor(p))
    // annotatedVar = newSynteticTVar() // But for methods, annotations reference to return tVar
    const returnType = typeVariableFor(methodApply).atParam(RETURN)
    newTVar.setType(new WollokClosureType(returnType, parameters, node), false)
  }

  const annotatedType = annotatedTypeName(node)
  if (annotatedType) annotatedVar.setType(annotatedWollokType(annotatedType, node), false)

  return newTVar
}

function doNewTVarFor(node: Node) {
  const newTVar = new TypeVariable(node)
  tVars.set(node, newTVar)
  return newTVar
}

function createTypeVariables(node: Node): TypeVariable | void {
  return match(node)(
    when(Environment)(inferEnvironment),

    when(Environment)(inferEnvironment),
    when(Package)(inferPackage),
    when(Import)(skip),
    when(Program)(inferProgram),
    when(Body)(inferBody),
    when(Module)(inferModule),
    when(Describe)(inferModule),

    when(Send)(inferSend),
    when(Method)(inferMethod),
    when(Test)(inferTest),
    when(Parameter)(inferParameter),

    when(Return)(inferReturn),
    when(If)(inferIf),
    when(Assignment)(inferAssignment),
    when(Throw)(typeVariableFor), //TODO
    when(Try)(typeVariableFor), //TODO

    when(New)(inferNew),
    when(NamedArgument)(inferNamedArgument),

    when(Variable)(inferVariable),
    when(Field)(inferVariable),
    when(Reference)(inferReference),

    when(Literal)(inferLiteral),
    when(Self)(inferSelf),
    when(Super)(inferSelf),

    when(Node)(skip) //TODO: Not implemented?
  )
}

const inferEnvironment = (env: Environment) => {
  env.children.forEach(createTypeVariables)
}

const inferPackage = (p: Package) => {
  if (p.name.startsWith('wollok')) return //TODO: Fix wrong inferences
  p.children.forEach(createTypeVariables)
}

const inferProgram = (p: Program) => {
  createTypeVariables(p.body)
}

const inferTest = (t: Test) => {
  createTypeVariables(t.body)
}

const inferBody = (body: Body) => {
  body.sentences.forEach(createTypeVariables)
}

const inferModule = (m: Module | Describe) => {
  m.members.forEach(createTypeVariables)
  const tVar = typeVariableFor(m)
  if (!(m.is(Singleton) && m.isClosure())) // Avoid closures
    tVar.setType(typeForModule(m)) // Set module type
  return tVar
}

const inferNew = (n: New) => {
  const clazz = n.instantiated.target!
  const tVar = typeVariableFor(n).setType(typeForModule(clazz))
  /*const args =*/ n.args.map(createTypeVariables)
  return tVar
}

const inferNamedArgument = (n: NamedArgument) => {
  const valueTVar = createTypeVariables(n.value)!
  if (n.parent instanceof New) {
    // Named arguments value should be subtype of field definition
    const clazz = n.parent.instantiated.target!
    const field = clazz.lookupField(n.name)
    if (field) { // Validation already checked that field exists
      const fieldTVar = typeVariableFor(field)
      const instanceTVar = typeVariableFor(n.parent)
      fieldTVar.instanceFor(instanceTVar).beSupertypeOf(valueTVar)
    }
  }
  return valueTVar
}

const inferMethod = (m: Method) => {
  const method = typeVariableFor(m)
  m.sentences.forEach(createTypeVariables)
  if (m.sentences.length) {
    const lastSentence = last(m.sentences)!
    if (!lastSentence.is(Return) && !lastSentence.is(If)) { // Return inference already propagate type to method
      method.atParam(RETURN).beSupertypeOf(typeVariableFor(lastSentence))
    }
  } else { // Empty body
    method.atParam(RETURN).setType(new WollokAtomicType(VOID))
  }
  return method
}

const inferSend = (send: Send) => {
  const receiver = createTypeVariables(send.receiver)!
  /*const args =*/ send.args.map(createTypeVariables)
  receiver.addSend(send)
  // TODO: Save args info for max type inference
  return typeVariableFor(send)
}

const inferAssignment = (a: Assignment) => {
  const variable = createTypeVariables(a.variable)!
  const value = createTypeVariables(a.value)!
  variable.beSupertypeOf(value)
  return typeVariableFor(a).setType(new WollokAtomicType(VOID))
}

const inferVariable = (v: Variable | Field) => {
  const valueTVar = createTypeVariables(v.value)
  const varTVar = typeVariableFor(v)
  if (valueTVar && !varTVar.closed) varTVar.beSupertypeOf(valueTVar)
  return varTVar
}

const inferParameter = (p: Parameter) => {
  return typeVariableFor(p) //TODO: Close min types?
}

const inferReturn = (r: Return) => {
  const method = r.ancestors.find(is(Method))
  if (!method) throw new Error('Method for Return not found')
  if (r.value)
    typeVariableFor(method).atParam(RETURN).beSupertypeOf(createTypeVariables(r.value)!)
  else
    typeVariableFor(method).atParam(RETURN).setType(new WollokAtomicType(VOID))
  return typeVariableFor(r).setType(new WollokAtomicType(VOID))
}

const inferIf = (_if: If) => {
  createTypeVariables(_if.condition)!.setType(new WollokModuleType(_if.environment.booleanClass))
  createTypeVariables(_if.thenBody)
  createTypeVariables(_if.elseBody)
  if (_if.elseBody.sentences.length) {
    typeVariableFor(_if)
      .beSupertypeOf(typeVariableFor(last(_if.elseBody.sentences)!))
  }
  return typeVariableFor(_if) // TODO: only for if-expression
    .beSupertypeOf(typeVariableFor(last(_if.thenBody.sentences)!))
}

const inferReference = (r: Reference<Node>) => {
  const varTVar = typeVariableFor(r.target!)! // Variable already visited
  const referenceTVar = typeVariableFor(r)
  referenceTVar.unify(varTVar)
  return referenceTVar
}

const inferSelf = (self: Self | Super) => {
  const module = self.ancestors.find<Module>((node: Node): node is Module =>
    node.is(Module) && !node.fullyQualifiedName.startsWith('wollok.lang.Closure')) // Ignore closures
  if (!module) throw new Error('Module for Self not found')
  return typeVariableFor(self).setType(new WollokModuleType(module))
}

const inferLiteral = (l: Literal) => {
  const tVar = typeVariableFor(l)
  const { numberClass, stringClass, booleanClass } = l.environment
  switch (typeof l.value) {
    case 'number': return tVar.setType(new WollokModuleType(numberClass))
    case 'string': return tVar.setType(new WollokModuleType(stringClass))
    case 'boolean': return tVar.setType(new WollokModuleType(booleanClass))
    case 'object':
      if (Array.isArray(l.value)) return tVar.setType(arrayLiteralType(l.value))
      if (l.value === null) return tVar //tVar.setType('Nullable?')
  }
  throw new Error('Literal type not found')
}

const arrayLiteralType = (value: readonly [Reference<Class>, List<Expression>]) => {
  const arrayTVar = typeForModule(value[0].target!)
  const elementTVar = arrayTVar.atParam(ELEMENT)
  value[1].map(createTypeVariables).forEach(inner =>
    elementTVar.beSupertypeOf(inner!)
  )
  return arrayTVar
}


const skip = (_: Node) => { }


export class TypeVariable {
  node: Node
  typeInfo: TypeInfo = new TypeInfo()
  subtypes: TypeVariable[] = []
  supertypes: TypeVariable[] = []
  messages: Send[] = []
  cachedParams: Map<string, TypeVariable> = new Map()
  syntetic = false
  hasProblems = false

  constructor(node: Node) { this.node = node }


  type(): WollokType { return this.typeInfo.type() }
  atParam(name: string): TypeVariable { return this.type().atParam(name) }
  newInstance(name: string): TypeVariable {
    return this.cachedParams.get(name) ??
      this.cachedParams.set(name, newSynteticTVar(this.node)).get(name)!
  }
  instanceFor(instance: TypeVariable, send?: TypeVariable, name?: string): TypeVariable { return this.type().instanceFor(instance, send, name) || this }

  hasType(type: WollokType) { return this.allPossibleTypes().some(_type => _type.contains(type)) }

  setType(type: WollokType, closed?: boolean) {
    this.typeInfo.setType(type, closed)
    return this
  }

  addMinType(type: WollokType) {
    this.typeInfo.addMinType(type)
  }

  addMaxType(type: WollokType) {
    this.typeInfo.addMaxType(type)
  }

  beSubtypeOf(tVar: TypeVariable) {
    this.addSupertype(tVar)
    tVar.addSubtype(this)
    return this
  }

  beSupertypeOf(tVar: TypeVariable) {
    this.addSubtype(tVar)
    tVar.addSupertype(this)
    return this
  }

  unify(tVar: TypeVariable) {
    // Unification means same type, so min and max types should be propagated in both directions
    this.beSupertypeOf(tVar)
    this.beSubtypeOf(tVar)
  }

  hasSubtype(tVar: TypeVariable) {
    return this.subtypes.includes(tVar)
  }

  hasSupertype(tVar: TypeVariable) {
    return this.supertypes.includes(tVar)
  }

  addSend(send: Send) {
    this.messages.push(send)
  }

  allMinTypes() {
    return this.typeInfo.minTypes
  }
  allMaxTypes() {
    return this.typeInfo.maxTypes
  }
  allPossibleTypes() {
    return [...this.allMinTypes(), ...this.allMaxTypes()]
  }

  hasTypeInfered() {
    return this.allPossibleTypes().some(t => t.isComplete)
  }



  validSubtypes() {
    return this.subtypes.filter(tVar => !tVar.hasProblems)
  }
  validSupertypes() {
    return this.supertypes.filter(tVar => !tVar.hasProblems)
  }

  addSubtype(tVar: TypeVariable) {
    this.subtypes.push(tVar)
  }

  addSupertype(tVar: TypeVariable) {
    this.supertypes.push(tVar)
  }

  addProblem(problem: TypeSystemProblem) {
    assign(this.node, { problems: [...this.node.problems ?? [], problem] })
    this.hasProblems = true
  }

  beSyntetic() {
    this.syntetic = true
    return this
  }

  get closed() { return this.typeInfo.closed }

  toString() { return `TVar(${this.syntetic ? 'SYNTEC' + this.node?.sourceInfo : this.node})` }
}

class TypeInfo {
  minTypes: WollokType[] = []
  maxTypes: WollokType[] = []
  closed = false

  type(): WollokType {
    if (this.maxTypes.length + this.minTypes.length == 0) return new WollokAtomicType(ANY)
    if (this.maxTypes.length == 1) return this.maxTypes[0]
    if (this.minTypes.length == 1) return this.minTypes[0]

    if (this.minTypes.length > 1) return new WollokUnionType(this.minTypes)
    if (this.maxTypes.length > 1) return new WollokUnionType(this.maxTypes)
    throw new Error('Halt')
  }

  setType(type: WollokType, closed: boolean = true) {
    this.minTypes = [type]
    this.maxTypes = [type]
    this.closed = closed
  }

  addMinType(type: WollokType) {
    if (this.maxTypes.some(maxType => maxType.contains(type))) return
    if (this.minTypes.some(minType => minType.contains(type))) return
    if (this.closed)
      throw new Error('Variable inference finalized')

    // Try to fill inner types!
    // This technique implies union inference by kind: A<T1> | A<T2> -> A<T1 | T2>
    if (type instanceof WollokParametricType && type.params.size) {
      const myType = this.minTypes.find((t): t is WollokParametricType => t.kind == type.kind)
      if (myType) return myType.addMinType(type)
    }

    this.minTypes.push(type)
  }

  addMaxType(type: WollokType) {
    if (this.maxTypes.some(maxType => maxType.contains(type))) return
    if (this.minTypes.some(minType => minType.contains(type))) return // TODO: Check min/max types compatibility
    if (this.closed)
      throw new Error('Variable inference finalized')

    // Try to fill inner types!
    // This technique implies union inference by kind: A<T1> | A<T2> -> A<T1 | T2>
    if (type instanceof WollokParametricType && type.params.size) {
      const myType = this.maxTypes.find((t): t is WollokParametricType => t.kind == type.kind)
      if (myType) return myType.addMaxType(type)
    }

    this.maxTypes.push(type)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ANNOTATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════


function typeAnnotation(node: Node) {
  return node.metadata.find(_ => _.name === 'Type')
}

function annotatedTypeName(node: Node): string | undefined {
  return typeAnnotation(node)?.args['name'] as string
}
function annotatedVariableName(node: Node): string | undefined {
  return typeAnnotation(node)?.args['variable'] as string
}


function annotatedWollokType(annotatedType: string, node: Node): WollokType {
  if ([VOID, ANY].includes(annotatedType)) return new WollokAtomicType(annotatedType as AtomicType)

  // First try with closures
  if (annotatedType.startsWith('{') && annotatedType.endsWith('}')) {
    return parseAnnotatedClosure(annotatedType, node)
  }

  // Then try parametric types
  if (isParameterName(annotatedType, node)) {
    // TODO: Add parametric type definition, not just parameter name
    return new WollokParameterType(annotatedType)
  }

  // First try generics
  if (annotatedType.includes('<') && annotatedType.includes('>')) {
    return parseAnnotatedGeneric(annotatedType, node)
  }

  // Then try defined modules
  let module = node.environment.getNodeOrUndefinedByFQN<Module>(annotatedType)
  if (!module) {
    // If not found, try to find just by name in same package (sibling definition)
    const p = node.ancestors.find(is(Package))!
    module = p.getNodeByQN<Module>(annotatedType)
  }
  return typeForModule(module)
}

function parseAnnotatedClosure(annotatedType: string, node: Node) {
  const [params, returnTypeName] = annotatedType.slice(1, -1).split('=>')
  const parameters = params.trim().slice(1, -1).split(',').map(_ => _.trim()).filter(_ => _ /* clean empty arguments */)
  const parametersTVar = parameters.map(_ => newSynteticTVar(node).setType(annotatedWollokType(_, node)))
  const returnTypeTVar = newSynteticTVar(node).setType(annotatedWollokType(returnTypeName.trim(), node))
  return new WollokClosureType(returnTypeTVar, parametersTVar, Closure({ code: annotatedType }))
}

function parseAnnotatedGeneric(annotatedType: string, node: Node) {
  const [baseTypeName] = annotatedType.split('<')
  const paramTypeNames = annotatedType.slice(baseTypeName.length + 1, -1).split(',').map(_ => _.trim())
  const baseType = annotatedWollokType(baseTypeName, node) as WollokParametricType
  const paramTypes = paramTypeNames.map(t => annotatedWollokType(t, node));
  [...baseType.params.values()].forEach((param, i) => param.setType(paramTypes[i]))
  return baseType
}

function isParameterName(name: string, node: Node) {
  return [node, ...node.ancestors].find(n => annotatedVariableName(n) === name)
}

// TODO: Support many variables
function annotatedVariableMap(n: Node) {
  const varName = annotatedVariableName(n)
  if (varName) return { [varName]: newSynteticTVar(n) }
  return {}
}

function typeForModule(m: Module) {
  const map = annotatedVariableMap(m)
  return new WollokParametricType(m, map)
}