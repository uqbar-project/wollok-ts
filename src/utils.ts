import { chain as flatMap, identity, mapObjIndexed, memoizeWith, values } from 'ramda'
import { Class, Entity, Environment, Id, isEntity, isNode, Kind, KindOf, List, Module, Name, Node, NodeOfKind, Singleton, Stage } from './model'

const { isArray } = Array

// TODO: Test all this
// TODO: Review types (particulary regarding Stages)

export const transform = <S extends Stage, R extends Stage = S>(tx: (node: Node<S>) => Node<R>) =>
  <N extends Node<S>, U extends Node<R> = N extends Node<R> ? N : Node<R>>(node: N): U => {
    const applyTransform = (obj: any): any =>
      isNode<S>(obj) ? mapObjIndexed(applyTransform, tx(obj) as any) :
        isArray(obj) ? obj.map(applyTransform) :
          obj instanceof Object ? mapObjIndexed(applyTransform, obj) :
            obj

    return applyTransform(node)
  }

export const transformByKind = <S extends Stage, R extends Stage = S>(
  tx: { [K in Kind]?: (after: NodeOfKind<K, R>, before: NodeOfKind<K, S>) => NodeOfKind<K, R> },
  defaultTx: (transformed: Node<R>, node: Node<S>) => Node<R> = identity,
) =>
  <N extends Node<S>, K extends KindOf<N> = KindOf<N>>(node: N): NodeOfKind<K, R> => {
    const applyTransform = (obj: any): any =>
      isNode<S>(obj) ? (tx[obj.kind] || defaultTx as any)(mapObjIndexed(applyTransform, obj as any), obj) :
        isArray(obj) ? obj.map(applyTransform) :
          obj instanceof Object ? mapObjIndexed(applyTransform, obj) :
            obj

    return applyTransform(node)
  }

export default <S extends Stage>(environment: Environment<S>) => {
  // TODO: Take this out of utils object?
  const reduce = <T>(tx: (acum: T, node: Node<S>) => T) => (initial: T, node: Node<S>): T =>
    children(node).reduce(reduce(tx), tx(initial, node))


  const children = memoizeWith(({ id }) => environment.id + id)(
    <C extends Node<S>>(node: Node<S>): List<C> => {
      const extractChildren = (obj: any): List<Node<S>> => {
        if (isNode<S>(obj)) return [obj]
        if (isArray(obj)) return flatMap(extractChildren)(obj)
        if (obj instanceof Object) return flatMap(extractChildren)(values(obj))
        return []
      }

      return flatMap(extractChildren)(values(node)) as unknown as List<C>
    }
  )


  const descendants = memoizeWith(({ id }) => environment.id + id)(
    (node: Node<S>): List<Node<S>> => {
      const directDescendants = children(node)
      const indirectDescendants = flatMap(child => descendants(child), directDescendants)
      return [...directDescendants, ...indirectDescendants]
    }
  )


  const fullyQualifiedName = memoizeWith(({ id }) => environment.id + id)(
    (node: Entity<'Linked'>): S extends 'Linked' ? Name : never => {
      const parent = parentOf(node)
      return (isEntity<'Linked'>(parent)
        ? `${fullyQualifiedName(parent)}.${node.name}`
        : node.name!) as S extends 'Linked' ? Name : never
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


  const resolve = memoizeWith(qualifiedName => environment.id + qualifiedName)(
    <T extends Entity<'Linked'>>(qualifiedName: string): S extends 'Linked' ? T : never =>
      qualifiedName.split('.').reduce((current: Entity<'Linked'> | Environment<'Linked'>, step) => {
        const allChildren = children(current as Entity<S>) as List<Node<'Linked'>>
        const next = allChildren.find((child): child is Entity<'Linked'> => isEntity(child) && child.name === step)
        if (!next) throw new Error(`Could not resolve reference to ${qualifiedName}`)
        return next
      }, environment as Environment<'Linked'>) as S extends 'Linked' ? T : never
  )


  const superclass = memoizeWith(({ id }) => environment.id + id)(
    (module: Class<'Linked'> | Singleton<'Linked'>): Class<'Linked'> | null => {
      const ObjectClass = resolve<Class<'Linked'>>('wollok.lang.Object')
      if (module === ObjectClass) return null
      switch (module.kind) {
        case 'Class': return module.superclass ? getNodeById<Class<'Linked'>>(module.superclass.target) : null
        case 'Singleton': return getNodeById<Class<'Linked'>>(module.superCall.superclass.target)
      }
    }
  )


  const hierarchy = memoizeWith(({ id }) => environment.id + id)(
    (m: Module<'Linked'>): List<Module<'Linked'>> => {
      const hierarchyExcluding = (module: Module<'Linked'>, exclude: List<Module<'Linked'>> = []): List<Module<'Linked'>> =>
        [
          module,
          ...module.mixins.map(({ target }) => getNodeById<Module<'Linked'>>(target)),
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
    resolve,
    superclass,
    hierarchy,
    inherits,
    fullyQualifiedName,
  }
}