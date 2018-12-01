import { chain as flatMap, mapObjIndexed, memoizeWith, values } from 'ramda'
import { Class, Entity, Environment, Id, isEntity, isNode, Kind, List, Module, Node, NodeOfKind, Reference, Singleton, Stage } from './model'

const { isArray } = Array

// TODO: Test all this
// TODO: Review types (particulary regarding Stages)
export default <S extends Stage>(environment: Environment<S>) => {

  const transform = (tx: (node: Node<Stage>) => Node<Stage>) => <T extends Node<Stage>, U extends T>(node: T): U => {
    const applyTransform = (obj: any): any =>
      isNode(obj) ? mapObjIndexed(applyTransform, tx(obj) as any) :
        isArray(obj) ? obj.map(applyTransform) :
          obj instanceof Object ? mapObjIndexed(applyTransform, obj) :
            obj

    return applyTransform(node) as U
  }


  const reduce = <T>(tx: (acum: T, node: Node<Stage>) => T) => (initial: T, node: Node<Stage>): T =>
    children(node).reduce(reduce(tx), tx(initial, node))


  const children = memoizeWith(({ id }) => environment.id + id)(
    <NS extends Stage>(node: Node<NS>): List<Node<NS>> => {
      const extractChildren = (obj: any): List<Node<NS>> => {
        if (isNode(obj)) return [obj]
        if (isArray(obj)) return flatMap(extractChildren)(obj)
        if (obj instanceof Object) return flatMap(extractChildren)(values(obj))
        return []
      }

      return flatMap(extractChildren)(values(node))
    }
  )


  const descendants = memoizeWith(({ id }) => environment.id + id)(
    (node: Node<S>): List<Node<S>> => {
      const directDescendants = children(node)
      const indirectDescendants = flatMap(child => descendants(child), directDescendants)
      return [...directDescendants, ...indirectDescendants]
    }
  )


  const parentOf = memoizeWith(({ id }) => environment.id + id)(
    <N extends Node<'Linked'>>(node: Node<'Linked'>): S extends 'Linked' ? N : never => {
      const parent = [environment, ...descendants(environment)].find(descendant => children(descendant).some(({ id }) => id === node.id))
      if (!parent) throw new Error(`Node ${JSON.stringify(node)} is not part of the environment`)
      return parent as S extends 'Linked' ? N : never
    }
  )


  const firstAncestorOfKind = memoizeWith((kind, { id }) => environment.id + kind + id)(
    <K extends Kind>(kind: K, node: Node<'Linked'>): S extends 'Linked' ? NodeOfKind<K, 'Linked'> : never => {
      const parent = parentOf(node)
      if (parent.kind === kind) return parent as S extends 'Linked' ? NodeOfKind<K, 'Linked'> : never
      else return firstAncestorOfKind(kind, parent)
    }
  )


  const getNodeById = memoizeWith(id => environment.id + id)(
    <T extends Node<'Linked'>>(id: Id<'Linked'>): S extends 'Linked' ? T : never => {
      const response = [environment, ...descendants(environment)].find(node => node.id === id)
      if (!response) throw new Error(`Missing node ${id}`)
      return response as S extends 'Linked' ? T : never
    }
  )


  const target = memoizeWith(({ id }) => environment.id + id)(
    <T extends Node<'Linked'>>(reference: Reference<'Linked'>): S extends 'Linked' ? T : never => {
      try {
        return getNodeById(reference.target) as S extends 'Linked' ? T : never
      } catch (e) {
        throw new Error(`Could not find reference to ${reference.name} in scope of node ${JSON.stringify(reference)}`)
      }
    }
  )


  const resolve = memoizeWith(({ id }) => environment.id + id)(
    <T extends Entity<'Linked'>>(fullyQualifiedName: string): S extends 'Linked' ? T : never =>
      fullyQualifiedName.split('.').reduce((current: Entity<'Linked'> | Environment<'Linked'>, step) => {
        const next = children(current).find((child): child is Entity<'Linked'> => isEntity(child) && child.name === step)!
        if (!next) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
        return next
      }, environment as Environment<'Linked'>) as S extends 'Linked' ? T : never
  )


  const superclass = memoizeWith(({ id }) => environment.id + id)(
    (module: Class<'Linked'> | Singleton<'Linked'>): Class<'Linked'> | null => {
      const ObjectClass = resolve<Class<'Linked'>>('wollok.lang.Object')
      if (module === ObjectClass) return null
      switch (module.kind) {
        case 'Class': return module.superclass ? target<Class<'Linked'>>(module.superclass) : ObjectClass
        case 'Singleton': return module.superCall ? target<Class<'Linked'>>(module.superCall.superclass) : ObjectClass
      }
    }
  )


  const hierarchy = memoizeWith(({ id }) => environment.id + id)(
    (m: Module<'Linked'>): List<Module<'Linked'>> => {
      const hierarchyExcluding = (module: Module<'Linked'>, exclude: List<Module<'Linked'>> = []): List<Module<'Linked'>> =>
        [
          module,
          ...module.mixins.map(mixin => target<Module<'Linked'>>(mixin)),
          ...module.kind === 'Mixin' ? [] : superclass(module) ? [superclass(module)!] : [],
        ].reduce((ancestors, node) => exclude.includes(node)
          ? ancestors
          : [node, ...hierarchyExcluding(node, [node, ...exclude, ...ancestors]), ...ancestors]
          , [] as List<Module<'Linked'>>)

      return hierarchyExcluding(m)
    }
  )


  const inherits = memoizeWith(({ id: childId }, { id: parentId }) => environment.id + childId + parentId)(
    (child: Module<'Linked'>, parent: Module<'Linked'>) => hierarchy(child).includes(parent)
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