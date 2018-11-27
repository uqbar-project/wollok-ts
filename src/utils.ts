import { chain as flatMap, mapObjIndexed, memoizeWith, values } from 'ramda'
import { Class, Environment, Id, isNode, Module, Node, NodeKind, NodeOfKind, Reference, Singleton } from './model'

const { isArray } = Array

// TODO: Test all this

export const transform = (tx: (node: Node) => Node) => <T extends Node, U extends T>(node: T): U => {
  const applyTransform = (obj: any): any =>
    isNode(obj) ? mapObjIndexed(applyTransform, tx(obj) as any) :
      isArray(obj) ? obj.map(applyTransform) :
        obj instanceof Object ? mapObjIndexed(applyTransform, obj) :
          obj

  return applyTransform(node) as U
}

export const reduce = <T>(tx: (acum: T, node: Node) => T) => (initial: T, node: Node): T =>
  children(node).reduce(reduce(tx), tx(initial, node))


const children = memoizeWith(({ id }) => id)(
  (node: Node): ReadonlyArray<Node> => {
    const extractChildren = (obj: any): ReadonlyArray<Node> => {
      if (isNode(obj)) return [obj]
      if (isArray(obj)) return flatMap(extractChildren)(obj)
      if (obj instanceof Object) return flatMap(extractChildren)(values(obj))
      return []
    }

    return flatMap(extractChildren)(values(node))
  }
)

export const descendants = memoizeWith(({ id }) => id)(
  ((node: Node): ReadonlyArray<Node> => {
    const directDescendants = children(node)
    const indirectDescendants = flatMap(child => descendants(child), directDescendants)
    return [...directDescendants, ...indirectDescendants]
  })
)

export const parentOf = (environment: Environment) => memoizeWith(({ id }) => id)(
  <N extends Node>(node: Node): N => {
    const parent = [environment, ...descendants(environment)].find(descendant => children(descendant).includes(node))
    if (!parent) throw new Error(`Node ${JSON.stringify(node)} is not part of the environment`)
    return parent as N
  }
)

export const firstAncestorOfKind = (environment: Environment) => memoizeWith((kind, { id }) => kind + id)(
  <K extends NodeKind>(kind: K, node: Node): NodeOfKind<K> => {
    const parent = parentOf(environment)(node)
    if (parent.kind === kind) return parent as NodeOfKind<K>
    else return firstAncestorOfKind(environment)(kind, parent)
  }
)

export const getNodeById = (environment: Environment) => memoizeWith(id => id)(
  <T extends Node>(id: Id): T => {
    const response = [environment, ...descendants(environment)].find(node => node.id === id)
    if (!response) throw new Error(`Missing node ${id}`)
    return response as T
  }
)

export const target = (environment: Environment) => <T extends Node>(reference: Reference) =>
  getNodeById(environment)(reference.scope[reference.name]) as T

export const resolve = (environment: Environment) => memoizeWith(({ id }) => id)(
  <T extends Node>(fullyQualifiedName: string) =>
    fullyQualifiedName.split('.').reduce((current, step) => {
      const next = children(current).find(child => (child as any).name === step)!
      if (!next) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
      return next
    }
      , environment as Node
    ) as T
)

export const superclass = (environment: Environment) => memoizeWith(({ id }) => id)(
  (module: Class | Singleton): Class | null => {
    // TODO: use 'wollok.Object'
    const ObjectClass = getNodeById(environment)<Class>(module.scope.Object)
    if (module === ObjectClass) return null
    switch (module.kind) {
      case 'Class': return module.superclass ? target(environment)<Class>(module.superclass) : ObjectClass
      case 'Singleton': return module.superCall ? target(environment)<Class>(module.superCall.superclass) : ObjectClass
    }
  }
)

export const hierarchy = (environment: Environment) => memoizeWith(({ id }) => id)(
  (m: Module): ReadonlyArray<Module> => {
    const hierarchyExcluding = (module: Module, exclude: ReadonlyArray<Module> = []): ReadonlyArray<Module> =>
      [
        module,
        ...module.mixins.map(mixin => target(environment)<Module>(mixin)),
        ...module.kind === 'Mixin' ? [] : superclass(environment)(module) ? [superclass(environment)(module)!] : [],
      ].reduce((ancestors, node) => exclude.includes(node)
        ? ancestors
        : [node, ...hierarchyExcluding(node, [node, ...exclude, ...ancestors]), ...ancestors]
        , [] as ReadonlyArray<Module>)

    return hierarchyExcluding(m)
  }
)

export const inherits = (environment: Environment) => (child: Module, parent: Module) =>
  hierarchy(environment)(child).includes(parent)


export default (environment: Environment) => ({
  children,
  transform,
  reduce,
  descendants,
  parentOf: parentOf(environment),
  firstAncestorOfKind: firstAncestorOfKind(environment),
  getNodeById: getNodeById(environment),
  target: target(environment),
  resolve: resolve(environment),
  superclass: superclass(environment),
  hierarchy: hierarchy(environment),
  inherits: inherits(environment),
})