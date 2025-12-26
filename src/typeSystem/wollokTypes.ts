import { KEYWORDS, OBJECT_MODULE } from '../constants'
import { List } from '../extensions'
import { BaseProblem, Level, Method, Module, Name, Node, Singleton } from '../model'
import { TypeVariable } from './typeVariables'

const { entries, fromEntries } = Object

export const ANY = 'Any'
export const VOID = 'Void'
export const SELF = 'Self'
export const ELEMENT = 'Element'
export const RETURN = 'RETURN'
export const PARAM = 'PARAM'
export const INSTANCE = 'INSTANCE'

export class TypeSystemProblem implements BaseProblem {
  constructor(public code: Name, public values: List<string> = []) { }

  get level(): Level { return 'warning' }
  get sourceMap(): undefined { return undefined }
}

export type WollokType = WollokAtomicType | WollokModuleType | WollokUnionType | WollokParameterType
export type AtomicType = typeof ANY | typeof VOID

export class WollokAtomicType {
  id: AtomicType

  constructor(id: AtomicType) {
    this.id = id
  }

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method {
    throw new Error('Atomic types have no methods')
  }

  atParam(_name: string): TypeVariable { throw new Error('Atomic types have no params') }
  instanceFor(_instance: TypeVariable, _send?: TypeVariable, _name?: string): TypeVariable | null { return null }

  contains(type: WollokType): boolean {
    return type instanceof WollokAtomicType && this.id === type.id
  }

  asList(): WollokType[] { return [this] }

  isSubtypeOf(_type: WollokType): boolean { return false }

  get name(): string { return this.id }
  get kind(): string { return this.name }
  get isComplete(): boolean { return true }
}


export class WollokModuleType {
  module: Module

  constructor(module: Module) {
    this.module = module
  }

  lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method | undefined {
    return this.module.lookupMethod(name, arity, options)
  }

  contains(type: WollokType): boolean {
    return type instanceof WollokModuleType && (this.module === type.module
      || this.module instanceof Singleton && type.module instanceof Singleton && this.module.isClosure() && type.module.isClosure()
      || !(type.module instanceof Singleton && type.module.isClosure()) && type.module.inherits(this.module))
  }

  atParam(_name: string): TypeVariable { throw new Error('Module types has no params') }
  instanceFor(_instance: TypeVariable, _send?: TypeVariable): TypeVariable | null { return null }

  asList(): WollokType[] { return [this] }

  isSubtypeOf(type: WollokType): boolean {
    return type instanceof WollokModuleType && this.module !== type.module &&
      (type.module.fullyQualifiedName == OBJECT_MODULE || this.module.inherits(type.module))
  }

  get name(): string { return this.module.name! }
  get kind(): string { return this.module?.name ?? KEYWORDS.NULL }
  get isComplete(): boolean { return true }

  toString(): string { return this.module.toString() }
}

export class WollokParametricType extends WollokModuleType {
  params: Map<string, TypeVariable>

  constructor(base: Module, params: Record<string, TypeVariable> = {}) {
    super(base)
    this.params = new Map(entries(params))
  }

  contains(type: WollokType): boolean {
    return super.contains(type) && (!this.params.size || type instanceof WollokParametricType && this.sameParams(type))
  }

  atParam(name: string): TypeVariable { return this.params.get(name)! }
  instanceFor(instance: TypeVariable, send?: TypeVariable, name: string = INSTANCE): TypeVariable | null {
    let changed = false
    const resolvedParamTypes = fromEntries([...this.params])
    this.params.forEach((tVar, paramName) => {
      // Possible name collision
      const newInstance = tVar.instanceFor(instance, send, `${name}.${paramName}`)
      if (newInstance !== tVar) {
        resolvedParamTypes[paramName] = newInstance
        changed = true
      }
    })

    // If nothing changes, we can use the original TVar
    if (!changed) return super.instanceFor(instance, send)

    // Here inside there is a cache system
    const maybeNewInstance = instance.newInstance(name)
    const newType = this.newFrom(resolvedParamTypes)
    if (!maybeNewInstance.type().contains(newType)) {
      maybeNewInstance.setType(newType, false)
    }
    return maybeNewInstance
  }

  addMinType(minType: WollokParametricType): void {
    this.params.forEach((paramTVar, name) =>
      minType.atParam(name).allPossibleTypes().forEach(paramMinType =>
        paramTVar.addMinType(paramMinType)
      )
    )
  }
  addMaxType(minType: WollokParametricType): void {
    this.params.forEach((paramTVar, name) =>
      minType.atParam(name).allPossibleTypes().forEach(paramMaxType =>
        paramTVar.addMaxType(paramMaxType)
      )
    )
  }

  get name(): string {
    const innerTypes = [...this.params.values()].map(_ => _.type().name).join(', ')
    if (!innerTypes) return super.name
    return `${super.name}<${innerTypes}>`
  }
  get kind(): string {
    const innerTypes = [...this.params.keys()].join(', ')
    if (!innerTypes) return super.kind
    return `${super.kind}<${innerTypes}>`
  }
  get isComplete(): boolean {
    return [...this.params.values()].every((tVar) => tVar.hasTypeInfered())
  }

  sameParams(type: WollokParametricType): boolean {
    return [...this.params.entries()].every(([name, tVar]) =>
      type.atParam(name) && (type.atParam(name).type().name == ANY ||
        new WollokUnionType(tVar.allPossibleTypes()).contains(type.atParam(name).type())))
  }

  newFrom(newParams: Record<string, TypeVariable>): WollokParametricType {
    return new WollokParametricType(this.module, newParams)
  }
}

export class WollokMethodType extends WollokParametricType {
  constructor(returnVar: TypeVariable, params: TypeVariable[], extra: Record<string, TypeVariable> = {}, base?: Module) {
    // TODO: Improve this inheritance
    super(base!, {
      ...fromEntries(params.map((p, i) => [`${PARAM}${i}`, p])),
      [RETURN]: returnVar,
      ...extra,
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

  override newFrom(newParams: Record<string, TypeVariable>): WollokMethodType {
    return new WollokMethodType(newParams[RETURN], [], newParams, this.module)
  }
}

export class WollokClosureType extends WollokMethodType {

  constructor(returnVar: TypeVariable, params: TypeVariable[], closure: Module) {
    super(returnVar, params, {}, closure)
  }

  get name(): string { return `{ ${super.name} }` }

  override newFrom(newParams: Record<string, TypeVariable>): WollokClosureType {
    return new WollokClosureType(newParams[RETURN], Object.values(newParams).filter(tVar => tVar != newParams[RETURN]), this.module)
  }
}


export class WollokParameterType {
  id: Name

  constructor(id: Name) {
    this.id = id
  }

  instanceFor(instance: TypeVariable, send?: TypeVariable): TypeVariable | null {
    if (this.id === SELF)
      return instance
    return instance.atParam(this.name) || send?.newInstance(this.name) || null
  }

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method {
    throw new Error('Parameters types have no methods')
  }

  atParam(_name: string): TypeVariable {
    throw new Error('Parameters types have no params')
  }

  contains(type: WollokType): boolean {
    return type instanceof WollokParameterType && this.id === type.id
  }

  asList(): WollokType[] { return [this] }

  // Parameters types cannot be subtype of other types (invariant)
  isSubtypeOf(_type: WollokType): boolean {
    return false
  }

  get name(): string { return this.id }
  get kind(): string { return this.name }
  get isComplete(): boolean { return true }
}


export class WollokUnionType {
  types: WollokType[]

  constructor(types: WollokType[]) {
    this.types = types
  }

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }): Method {
    throw new Error('Halt')
  }

  atParam(_name: string): TypeVariable | null { return null }
  instanceFor(_instance: TypeVariable): TypeVariable | null { return null }

  contains(type: WollokType): boolean {
    return type.asList().every(t => this.types.some(_ => _.contains(t)))
  }

  asList(): WollokType[] { return this.simplifiedTypes }

  isSubtypeOf(type: WollokType): boolean { return this.types.every(t => t.isSubtypeOf(type)) }

  get simplifiedTypes(): WollokType[] {
    return this.types
      .reduce((acc, type) => [...acc.filter(t => !type.asList().some(innerType => t.isSubtypeOf(innerType))), ...type.asList()] // Remove subtypes (are redundants)
        , [] as WollokType[])
  }

  get name(): string { return this.printBy(_ => _.name) }
  get kind(): string { return this.printBy(_ => _.kind) }

  printBy(property: (type: WollokType) => string): string {
    if (this.simplifiedTypes.length === 1) return this.simplifiedTypes[0].name
    return `(${this.simplifiedTypes.map(property).join(' | ')})`
  }

  get isComplete(): boolean {
    return this.types.every(t => t.isComplete)
  }
}


export class TypeRegistry {
  constructor(private tVars: Map<Node, TypeVariable>) { }

  typeVariableFor(node: Node): TypeVariable {
    const tVar = this.tVars.get(node)
    if (!tVar) throw new Error(`No tVar variable for node: ${node}`)
    return tVar

  }

  getType(node: Node): WollokType {
    return this.typeVariableFor(node).type()
  }
}