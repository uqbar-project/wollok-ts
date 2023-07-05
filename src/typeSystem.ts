import { is, last, List, match, when } from './extensions'
import { Assignment, BaseProblem, Body, Class, Closure, Environment, Expression, Field, If, Import, Level, Literal, Method, Module, Name, NamedArgument, New, Node, Package, Parameter, Program, Reference, Return, Self, Send, Super, Test, Throw, Try, Variable } from './model'

const { assign } = Object
interface Logger {
  log: (message: string) => void
}

export const ANY = 'Any'
export const VOID = 'Void'
export const ELEMENT = 'ELEMENT'
export const RETURN = 'RETURN'
export const PARAM = 'PARAM'
export const tVars = new Map<Node, TypeVariable>()
let environment: Environment
let globalChange: boolean
let logger: Logger = { log: () => { } }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERFACE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function infer(env: Environment, someLogger?: Logger): void {
  if (someLogger) logger = someLogger
  environment = env
  createTypeVariables(env)
  globalChange = true
  while (globalChange) {
    globalChange = [propagateTypes, bindMessages, maxTypesFromMessages].some(f => f())
  }
}

export function getType(node: Node): string {
  return typeVariableFor(node).type().name
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE VARIABLES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function typeVariableFor(node: Node): TypeVariable {
  const tVar = tVars.get(node)
  if (!tVar) return newTVarFor(node)
  return tVar
}

function newTVarFor(node: Node) {
  const newTVar = new TypeVariable(node)
  tVars.set(node, newTVar)
  var annotatedVar = newTVar // By default, annotations reference the same tVar
  if (node.is(Method)) {
    const parameters = node.parameters.map(p => createTypeVariables(p)!)
    annotatedVar = newSynteticTVar() // But for methods, annotations reference to return tVar
    newTVar.setType(new WollokMethodType(annotatedVar, parameters))
  }

  const typeAnnotation = node.metadata.find(_ => _.name === 'Type')
  if (typeAnnotation) {
    const typeName = typeAnnotation.args['name'] as string
    // TODO: Method type annotation missing
    let module = environment.getNodeOrUndefinedByFQN<Module>(typeName)
    if (!module) { // If not found, try to find in same package
      const p = node.ancestors.find(is(Package))
      const moduleFQN = p ? `${p.name}.${typeName}` : typeName
      module = environment.getNodeByFQN<Module>(moduleFQN)
    }
    annotatedVar.setType(new WollokModuleType(module))
  }
  return newTVar
}

export function newSynteticTVar() {
  return newTVarFor(Closure({ code: 'Param type' })).beSyntetic() // Using new closure as syntetic node. Is good enough? No.
}

function allValidTypeVariables() {
  return [...tVars.values()].filter(tVar => !tVar.hasProblems)
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
    when(NamedArgument)(typeVariableFor), //TODO

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

const inferModule = (m: Module) => {
  m.members.forEach(createTypeVariables)
  typeVariableFor(m).setType(new WollokModuleType(m))
}

const inferNew = (n: New) => {
  /*const args =*/ n.args.map(createTypeVariables)
  const clazz = n.instantiated.target!
  return typeVariableFor(n).setType(new WollokModuleType(clazz))
}

const inferMethod = (m: Method) => {
  const method = typeVariableFor(m)
  m.sentences.forEach(createTypeVariables)
  if (m.sentences.length) {
    const lastSentence = last(m.sentences)!
    if (!lastSentence.is(Return)) { // Return inference already propagate type to method
      method.atParam(RETURN).beSupertypeOf(typeVariableFor(lastSentence))
    }
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
  if (valueTVar) varTVar.beSupertypeOf(valueTVar)
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
  createTypeVariables(_if.condition)!.setType(new WollokModuleType(environment.booleanClass))
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
  const { numberClass, stringClass, booleanClass } = environment
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
  const elementTVar = typeVariableFor(value[0]) // TODO: Use syntetic node?
  value[1].map(createTypeVariables).forEach(inner =>
    elementTVar.beSupertypeOf(inner!)
  )
  return new WollokParametricType(value[0].target!, { [ELEMENT]: elementTVar })
}


const skip = (_: Node) => { }


export class TypeVariable {
  node: Node
  typeInfo: TypeInfo = new TypeInfo()
  subtypes: TypeVariable[] = []
  supertypes: TypeVariable[] = []
  messages: Send[] = []
  syntetic = false
  hasProblems = false

  constructor(node: Node) { this.node = node }


  type() { return this.typeInfo.type() }
  atParam(name: string): TypeVariable { return this.type().atParam(name)! }

  hasAnyType() { return this.type().contains(new WollokAtomicType(ANY)) }
  hasType(type: WollokType) { return this.allPossibleTypes().some(_type => _type.contains(type)) }

  setType(type: WollokType) {
    this.typeInfo.setType(type)
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

  toString() { return `TVar(${this.syntetic ? 'SYNTEC' : this.node})` }
}

class TypeInfo {
  minTypes: WollokType[] = []
  maxTypes: WollokType[] = []
  closed = false

  type() {
    if (this.maxTypes.length + this.minTypes.length == 0) return new WollokAtomicType(ANY)
    if (this.maxTypes.length == 1) return this.maxTypes[0]
    if (this.minTypes.length == 1) return this.minTypes[0]

    if (this.minTypes.length > 1) return new WollokUnionType(this.minTypes)
    if (this.maxTypes.length > 1) return new WollokUnionType(this.maxTypes)
    throw new Error('Halt')
  }

  setType(type: WollokType) {
    this.minTypes = [type]
    this.maxTypes = [type]
    this.closed = true
  }

  addMinType(type: WollokType) {
    if (this.maxTypes.some(maxType => maxType.contains(type))) return
    if (this.minTypes.some(minType => minType.contains(type))) return
    if (this.closed)
      throw new Error('Variable inference finalized')
    this.minTypes.push(type)
  }

  addMaxType(type: WollokType) {
    if (this.maxTypes.some(maxType => maxType.contains(type))) return
    if (this.minTypes.some(minType => minType.contains(type))) return // TODO: Check min/max types compatibility
    if (this.closed)
      throw new Error('Variable inference finalized')
    this.maxTypes.push(type)
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROPAGATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function any<T>(...fs: ((x: T) => boolean)[]): (x: T) => boolean {
  return x => fs.some(f => f(x))
}

function propagateTypes() {
  return allValidTypeVariables().some(any(propagateMinTypes, propagateMaxTypes))
}

export const propagateMinTypes = (tVar: TypeVariable) => {
  return propagateMinTypesTo(tVar, tVar.allMinTypes(), tVar.validSupertypes())
}
const propagateMinTypesTo = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[]) => {
  let changed = false
  for (const type of types) {
    for (const targetTVar of targetTVars) {
      if (!targetTVar.hasType(type)) {
        if (targetTVar.closed)
          return reportTypeMismatch(tVar, type, targetTVar)
        targetTVar.addMinType(type)
        logger.log(`PROPAGATE MIN TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
        changed = true
      }
    }
  }
  return changed
}

export const propagateMaxTypes = (tVars: TypeVariable) => {
  return propagateMaxTypesTo(tVars, tVars.allMaxTypes(), tVars.validSubtypes())
}

const propagateMaxTypesTo = (tVar: TypeVariable, types: WollokType[], targetTVars: TypeVariable[]) => {
  let changed = false
  for (const type of types) {
    for (const targetTVar of targetTVars) {
      if (!targetTVar.hasType(type)) {
        if (targetTVar.closed)
          return reportTypeMismatch(tVar, type, targetTVar)
        targetTVar.addMaxType(type)
        logger.log(`PROPAGATE MAX TYPE (${type.name}) FROM |${tVar}| TO |${targetTVar}|`)
        changed = true
      }
    }
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MESSAGE BINDING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function bindMessages() {
  return allValidTypeVariables().some(bindReceivedMessages)
}

export const bindReceivedMessages = (tVar: TypeVariable) => {
  const types = tVar.allPossibleTypes()
  let changed = false
  for (const type of types) {
    for (const send of tVar.messages) {
      const method = type.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
      if (!method)
        return reportProblem(tVar, new TypeSystemProblem('methodNotFound', [send.signature, type.name]))


      if (!typeVariableFor(method).atParam(RETURN).hasSupertype(typeVariableFor(send))) {
        // TOOD: Bind copies to not affect method types
        typeVariableFor(method).atParam(RETURN).addSupertype(typeVariableFor(send))
        method.parameters.forEach((param, index) => {
          typeVariableFor(param).addSubtype(typeVariableFor(send.args[index]))
        })
        // TODO: Bind arguments
        logger.log(`BIND MESSAGE |${send}| WITH METHOD |${method}|`)
        changed = true
      }
    }
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// GUESS TYPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function maxTypesFromMessages() {
  return allValidTypeVariables().some(any(maxTypeFromMessages, guessType))
}

export const maxTypeFromMessages = (tVar: TypeVariable) => {
  if (!tVar.messages.length) return false
  if (tVar.allMinTypes().length) return false
  let changed = false
  environment.descendants
    .filter(is(Module))
    .filter(module => tVar.messages.every(send =>
      module.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
      // TODO: check params and return types
    ))
    .map(_ => new WollokModuleType(_)) // Or bind to the module?
    .forEach(type => {
      if (!tVar.hasType(type)) {
        tVar.addMaxType(type)
        logger.log(`NEW MAX TYPE |${type}| FOR |${tVar.node}|`)
        changed = true
      }
    })
  return changed
}

export const guessType = (tVar: TypeVariable) => {
  if (tVar.allPossibleTypes().length) return false
  let changed = false
  for (const superTVar of tVar.validSupertypes()) {
    if (!tVar.subtypes.includes(superTVar)) {
      tVar.beSupertypeOf(superTVar)
      logger.log(`GUESS TYPE OF |${tVar}| FROM |${superTVar}|`)
      changed = true
    }
  }
  for (const subTVar of tVar.validSubtypes()) {
    if (!tVar.supertypes.includes(subTVar)) {
      tVar.beSubtypeOf(subTVar)
      logger.log(`GUESS TYPE OF |${tVar}| FROM |${subTVar}|`)
      changed = true
    }
  }
  return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// REPORTING PROBLEMS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function reportProblem(tVar: TypeVariable, problem: TypeSystemProblem) {
  tVar.addProblem(problem)
  return true // Something changed
}

function reportTypeMismatch(source: TypeVariable, type: WollokType, target: TypeVariable) {
  const [reported, expected, actual] = selectVictim(source, type, target, target.type())
  return reportProblem(reported, new TypeSystemProblem('typeMismatch', [expected.name, actual.name]))
}

function selectVictim(source: TypeVariable, type: WollokType, target: TypeVariable, targetType: WollokType): [TypeVariable, WollokType, WollokType] {
  // Super random, to be improved
  if (source.syntetic) return [target, targetType, type]
  if (target.syntetic) return [source, type, targetType]
  if (source.node.is(Reference)) return [source, type, targetType]
  if (target.node.is(Reference)) return [target, targetType, type]
  throw new Error('No victim found')
}



// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WOLLOK TYPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class TypeSystemProblem implements BaseProblem {
  constructor(public code: Name, public values: List<string> = []) { }

  get level(): Level { return 'warning' }
  get sourceMap(): undefined { return undefined }
}

export type WollokType = WollokAtomicType | WollokModuleType | WollokUnionType
export type AtomicType = typeof ANY | typeof VOID

export class WollokAtomicType {
  id: AtomicType

  constructor(id: AtomicType) {
    this.id = id
  }

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    throw new Error('Atomic types has no methods')
  }

  atParam(_name: string): TypeVariable {
    throw new Error('Atomic types has no params')
  }

  contains(type: WollokType): boolean {
    return type instanceof WollokAtomicType && this.id === type.id
  }

  asList() { return [this] }

  isSubtypeOf(_type: WollokType) { return false }

  get name(): string {
    return this.id
  }
}


export class WollokModuleType {
  module: Module

  constructor(module: Module) {
    this.module = module
  }

  lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    return this.module.lookupMethod(name, arity, options)
  }

  contains(type: WollokType): boolean {
    return type instanceof WollokModuleType && this.module === type.module
  }

  atParam(_name: string): TypeVariable { throw new Error('Module types has no params') }

  asList() { return [this] }

  isSubtypeOf(type: WollokType) {
    return type instanceof WollokModuleType && this.module !== type.module &&
      (environment.objectClass === type.module || this.module.inherits(type.module))
  }

  get name(): string {
    return this.module.name!
  }

  toString() { return this.module.toString() }
}

export class WollokParametricType extends WollokModuleType {
  params: Map<string, TypeVariable>

  constructor(base: Module, params: Record<string, TypeVariable>) {
    super(base)
    this.params = new Map(Object.entries(params))
  }

  contains(type: WollokType): boolean {
    return super.contains(type) && type instanceof WollokParametricType && this.sameParams(type)
  }

  atParam(name: string): TypeVariable { return this.params.get(name)! }

  get name(): string {
    const innerTypes = [...this.params.values()].map(_ => _.type().name).join(', ')
    return `${super.name}<${innerTypes}>`
  }

  sameParams(type: WollokParametricType) {
    return [...this.params.entries()].every(([name, tVar]) => type.params.get(name) === tVar)
  }
}

export class WollokMethodType extends WollokParametricType {
  constructor(returnVar: TypeVariable, params: TypeVariable[]) {
    // TODO: Mejorar esta herencia
    super(null as any, {
      ...Object.fromEntries(params.map((p, i) => [`${PARAM}${i}`, p])),
      [RETURN]: returnVar,
    })
  }

  get name(): string {
    const params = [...this.params.entries()]
      .filter(([name, _]) => name !== RETURN)
      .map(([_, tVar]) => tVar.type().name)
      .join(', ')
    const returnType = this.atParam(RETURN).type().name
    return `(${params}) => ${returnType}`
  }
}

export class WollokUnionType {
  types: WollokType[]

  constructor(types: WollokType[]) {
    this.types = types
  }

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    throw new Error('Halt')
  }

  atParam(_name: string): TypeVariable { throw new Error('Union types has no params') }

  contains(type: WollokType): boolean {
    if (type instanceof WollokUnionType)
      throw new Error('Halt')
    return this.types.some(_ => _.contains(type))
  }

  asList() { return this.types }

  isSubtypeOf(type: WollokType): boolean { return this.types.every(t => t.isSubtypeOf(type)) }

  get name(): string {
    const simplifiedTypes = this.types
      .reduce((acc, type) => [...acc, type].filter(t => !t.isSubtypeOf(type)) // Remove subtypes (are redundants)
        , [] as WollokType[])
    return `(${simplifiedTypes.map(_ => _.name).join(' | ')})`
  }
}
