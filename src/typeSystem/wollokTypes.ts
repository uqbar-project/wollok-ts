import { List } from '../extensions'
import { BaseProblem, Level, Module, Name, Node, Singleton } from '../model'
import { TypeVariable } from './typeVariables'

const { entries, fromEntries } = Object

export const ANY = 'Any'
export const VOID = 'Void'
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

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    throw new Error('Atomic types has no methods')
  }

  atParam(_name: string): TypeVariable { throw new Error('Atomic types has no params') }
  instanceFor(_instance: TypeVariable, _send?: TypeVariable, _name?: string): TypeVariable | null { return null }

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
    return type instanceof WollokModuleType && (this.module === type.module ||
      (this.module instanceof Singleton && type.module instanceof Singleton
      && this.module.isClosure() && type.module.isClosure()))
  }

  atParam(_name: string): TypeVariable { throw new Error('Module types has no params') }
  instanceFor(_instance: TypeVariable, _send?: TypeVariable): TypeVariable | null { return null }

  asList() { return [this] }

  isSubtypeOf(type: WollokType) {
    return type instanceof WollokModuleType && this.module !== type.module &&
      (type.module.name === 'Object' || this.module.inherits(type.module))
  }

  get name(): string {
    return this.module.name!
  }

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
    this.params.forEach((tVar, name) => {
      // Possible name callision
      const newInstance = tVar.instanceFor(instance, send, name)
      if (newInstance !== tVar) {
        resolvedParamTypes[name] = newInstance
        changed = true
      }
    })

    // If nothing changes, we can use the original TVar
    if (!changed) return super.instanceFor(instance, send)

    // TODO: Creating a new syntetic TVar *each time* is not the best solution.
    //      We should attach this syntetic TVar to the instance, so we can reuse it.
    //      We also need to take care of MethodType (subclasses of ParametricType)
    return instance.newParam(name).setType(new WollokParametricType(this.module, resolvedParamTypes), false)
  }

  get name(): string {
    const innerTypes = [...this.params.values()].map(_ => _.type().name).join(', ')
    if (!innerTypes) return super.name
    return `${super.name}<${innerTypes}>`
  }

  sameParams(type: WollokParametricType) {
    return [...this.params.entries()].every(([name, tVar]) => type.atParam(name)?.type().name == ANY || type.atParam(name)?.type().contains(tVar.type()))
  }
}

export class WollokMethodType extends WollokParametricType {
  constructor(returnVar: TypeVariable, params: TypeVariable[], extra: Record<string, TypeVariable> = {}, base?: Module) {
    // TODO: Improve this inheritance
    super(base!, {
      ...fromEntries(params.map((p, i) => [`${PARAM}${i}`, p])),
      [RETURN]: returnVar,
      ...extra
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

export class WollokClosureType extends WollokMethodType {

  constructor(returnVar: TypeVariable, params: TypeVariable[], closure: Module) {
    super(returnVar, params, {}, closure)
  }

  get name(): string {
    return `{${super.name}}`
  }

}


export class WollokParameterType {
  id: Name

  constructor(id: Name) {
    this.id = id
  }

  instanceFor(instance: TypeVariable, send?: TypeVariable): TypeVariable | null {
    return instance.atParam(this.name) || send?.newParam(this.name)
  }

  lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    throw new Error('Parameters types has no methods')
  }

  atParam(_name: string): TypeVariable {
    throw new Error('Parameters types has no params')
  }

  contains(type: WollokType): boolean {
    if (this === type) return true
    throw new Error('Parameters types does not contains other types')
  }

  asList() { return [this] }

  isSubtypeOf(_type: WollokType) {
    throw new Error('Parameters types cannot be subtype of other types (invariant)')
  }

  get name(): string {
    return this.id
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
  instanceFor(_instance: TypeVariable) { return null }

  contains(type: WollokType): boolean {
    return type.asList().every(t => this.types.some(_ => _.contains(t)))
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


export class TypeRegistry {
  constructor(private tVars: Map<Node, TypeVariable>) { }

  getType(node: Node): WollokType {
    const tVar = this.tVars.get(node)
    if (!tVar) throw new Error(`No type variable for node ${node}`)
    return tVar.type()
  }
}