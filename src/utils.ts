import { chain as flatMap, mapObjIndexed, memoizeWith, values } from 'ramda'
import { Class, Entity, Environment, Id, isEntity, isNode, Module, Node, NodeKind, NodeOfKind, Reference, Singleton } from './model'

const { isArray } = Array

// TODO: Test all this

export default (environment: Environment) => {

  const transform = (tx: (node: Node) => Node) => <T extends Node, U extends T>(node: T): U => {
    const applyTransform = (obj: any): any =>
      isNode(obj) ? mapObjIndexed(applyTransform, tx(obj) as any) :
        isArray(obj) ? obj.map(applyTransform) :
          obj instanceof Object ? mapObjIndexed(applyTransform, obj) :
            obj

    return applyTransform(node) as U
  }


  const reduce = <T>(tx: (acum: T, node: Node) => T) => (initial: T, node: Node): T =>
    children(node).reduce(reduce(tx), tx(initial, node))


  const children = memoizeWith(({ id }) => environment.id + id)(
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


  const descendants = memoizeWith(({ id }) => environment.id + id)(
    ((node: Node): ReadonlyArray<Node> => {
      const directDescendants = children(node)
      const indirectDescendants = flatMap(child => descendants(child), directDescendants)
      return [...directDescendants, ...indirectDescendants]
    })
  )


  const parentOf = memoizeWith(({ id }) => environment.id + id)(
    <N extends Node>(node: Node): N => {
      const parent = [environment, ...descendants(environment)].find(descendant => children(descendant).includes(node))
      if (!parent) throw new Error(`Node ${JSON.stringify(node)} is not part of the environment`)
      return parent as N
    }
  )


  const firstAncestorOfKind = memoizeWith((kind, { id }) => environment.id + kind + id)(
    <K extends NodeKind>(kind: K, node: Node): NodeOfKind<K> => {
      const parent = parentOf(node)
      if (parent.kind === kind) return parent as NodeOfKind<K>
      else return firstAncestorOfKind(kind, parent)
    }
  )


  const getNodeById = memoizeWith(id => environment.id + id)(
    <T extends Node>(id: Id): T => {
      const response = [environment, ...descendants(environment)].find(node => node.id === id)
      if (!response) throw new Error(`Missing node ${id}`)
      return response as T
    }
  )


  const target = memoizeWith(({ id }) => environment.id + id)(
    <T extends Node>(reference: Reference) => {
      try {
        return getNodeById(reference.scope[reference.name]) as T
      } catch (e) {
        throw new Error(`Could not find reference to ${reference.name} in scope of node ${JSON.stringify(reference)}`)
      }
    }
  )


  const resolve = memoizeWith(({ id }) => environment.id + id)(
    <T extends Entity>(fullyQualifiedName: string) =>
      fullyQualifiedName.split('.').reduce((current: Entity | Environment, step) => {
        const next = children(current).find((child): child is Entity => isEntity(child) && child.name === step)!
        if (!next) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
        return next
      }, environment) as T
  )


  const superclass = memoizeWith(({ id }) => environment.id + id)(
    (module: Class | Singleton): Class | null => {
      const ObjectClass = resolve<Class>('wollok.lang.Object')
      if (module === ObjectClass) return null
      switch (module.kind) {
        case 'Class': return module.superclass ? target<Class>(module.superclass) : ObjectClass
        case 'Singleton': return module.superCall ? target<Class>(module.superCall.superclass) : ObjectClass
      }
    }
  )


  const hierarchy = memoizeWith(({ id }) => environment.id + id)(
    (m: Module): ReadonlyArray<Module> => {
      const hierarchyExcluding = (module: Module, exclude: ReadonlyArray<Module> = []): ReadonlyArray<Module> =>
        [
          module,
          ...module.mixins.map(mixin => target<Module>(mixin)),
          ...module.kind === 'Mixin' ? [] : superclass(module) ? [superclass(module)!] : [],
        ].reduce((ancestors, node) => exclude.includes(node)
          ? ancestors
          : [node, ...hierarchyExcluding(node, [node, ...exclude, ...ancestors]), ...ancestors]
          , [] as ReadonlyArray<Module>)

      return hierarchyExcluding(m)
    }
  )


  const inherits = memoizeWith(({ id: childId }, { id: parentId }) => environment.id + childId + parentId)(
    (child: Module, parent: Module) => hierarchy(child).includes(parent)
  )


  return {
    children,
    transform,
    reduce,
    descendants,
    parentOf,
    firstAncestorOfKind,
    getNodeById,
    target,
    resolve,
    superclass,
    hierarchy,
    inherits,
  }
}