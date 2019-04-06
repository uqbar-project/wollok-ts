import { getOrUpdate, NODE_CACHE, PARENT_CACHE, update } from './cache'
import { flatMap, mapObject } from './extensions'
import { Native } from './interpreter'
import { Class, Constructor, Describe, Entity, Environment, Field, Id, is, isEntity, isNode, Kind, KindOf, List, Method, Module, Name, Node, NodeOfKind, Reference, Singleton, Stage, Test } from './model'

const { isArray } = Array
const { values } = Object

// TODO: Test all this

export const transform = <S extends Stage, R extends Stage = S>(tx: (node: Node<S>) => Node<R>) =>
  <N extends Node<S>, U extends Node<R> = N extends Node<R> ? N : Node<R>>(node: N): U => {
    const applyTransform = (obj: any): any =>
      isNode<S>(obj) ? mapObject(applyTransform, tx(obj) as any) :
        isArray(obj) ? obj.map(applyTransform) :
          obj instanceof Object ? mapObject(applyTransform, obj) :
            obj

    return applyTransform(node)
  }

export const transformByKind = <S extends Stage, R extends Stage = S>(
  tx: { [K in Kind]?: (after: NodeOfKind<K, R>, before: NodeOfKind<K, S>) => NodeOfKind<K, R> },
  defaultTx: (transformed: Node<R>, node: Node<S>) => Node<R> = node => node,
) =>
  <N extends Node<S>, K extends KindOf<N> = KindOf<N>>(node: N): NodeOfKind<K, R> => {
    const applyTransform = (obj: any): any =>
      isNode<S>(obj) ? (tx[obj.kind] || defaultTx as any)(mapObject(applyTransform, obj as any), obj) :
        isArray(obj) ? obj.map(applyTransform) :
          obj instanceof Object ? mapObject(applyTransform, obj) :
            obj

    return applyTransform(node)
  }

export const methods = <S extends Stage>(module: Module<S>) => module.members.filter(is('Method')) as List<Method<S>>
export const fields = <S extends Stage>(module: Module<S>) => module.members.filter(is('Field')) as List<Field<S>>
export const constructors = <S extends Stage>(module: Class<S>) => module.members.filter(is('Constructor')) as List<Constructor<S>>
export const tests = <S extends Stage>(module: Describe<S>) => module.members.filter(is('Test')) as List<Test<S>>

export default (environment: Environment) => {

  // TODO: Take out?
  const reduce = <T, S extends Stage>(tx: (acum: T, node: Node<S>) => T) => (initial: T, node: Node<S>): T =>
    children<Node<S>>(node).reduce(reduce(tx), tx(initial, node))

  // TODO: Take out?
  const children = <C extends Node<S>, S extends Stage = Stage>(node: Node<S>): List<C> => {
    const extractChildren = (obj: any): List<C> => {
      if (isNode<S>(obj)) return [obj as C]
      if (isArray(obj)) return flatMap(extractChildren)(obj)
      if (obj instanceof Object) return flatMap(extractChildren)(values(obj))
      return []
    }
    const extractedChildren = flatMap(extractChildren)(values(node))
    extractedChildren.forEach(child => child.id && update(PARENT_CACHE, child.id!, node.id))
    return extractedChildren
  }

  // TODO: Take out?
  const descendants = (node: Node<'Linked'>): List<Node<'Linked'>> => {
    const directDescendants = children(node)
    const indirectDescendants = flatMap(descendants)(directDescendants)
    return [...directDescendants, ...indirectDescendants]
  }


  const fullyQualifiedName = (node: Entity<'Linked'>): Name => {
    const parent = parentOf(node)
    return isEntity(parent)
      ? `${fullyQualifiedName(parent)}.${node.name}`
      : node.name || `#${node.id}`
  }


  const parentOf = <N extends Node<'Linked'>>(node: Node<'Linked'>): N =>
    getNodeById(getOrUpdate(PARENT_CACHE, node.id)(() => {
      const parent = [environment, ...descendants(environment)].find(descendant =>
        children(descendant).some(({ id }) => id === node.id)
      )
      if (!parent) throw new Error(`Node ${JSON.stringify(node)} is not part of the environment`)

      return parent.id
    }))


  const firstAncestorOfKind = <K extends Kind>(kind: K, node: Node<'Linked'>): NodeOfKind<K, 'Linked'> => {
    const parent = parentOf(node)
    return is(kind)(parent) ? parent : firstAncestorOfKind(kind, parent)
  }

  const getNodeById = <N extends Node<'Linked'>>(id: Id): N =>
    getOrUpdate(NODE_CACHE, id)(() => {
      const search = (obj: any): Node<'Linked'> | undefined => {
        if (isArray(obj)) {
          for (const value of obj) {
            const found = search(value)
            if (found) return found
          }
        } else if (obj instanceof Object) {
          if (isNode<'Linked'>(obj) && obj.id === id) return obj
          return search(values(obj))
        }
        return undefined
      }

      const response = search(environment)
      if (!response) throw new Error(`Missing node ${id}`)
      return response
    }) as N


  const resolve = <N extends Entity<'Linked'>>(qualifiedName: string): N => {
    return qualifiedName.startsWith('#') // TODO: It would be nice to make this the superclass FQN # id
      ? getNodeById(qualifiedName.slice(1))
      : qualifiedName.split('.').reduce((current: Entity<'Linked'> | Environment, step) => {
        const allChildren = children(current)
        const next = allChildren.find((child): child is Entity<'Linked'> => isEntity(child) && child.name === step)
        if (!next) throw new Error(
          `Could not resolve reference to ${qualifiedName}: Missing child ${step} among ${allChildren.map((c: any) => c.name)}`
        )
        return next
      }, environment) as N
  }


  const resolveTarget = <N extends Node<'Linked'>>(reference: Reference<'Linked'>): N => getNodeById(reference.target)


  const superclass = (module: Class<'Linked'> | Singleton<'Linked'>): Class<'Linked'> | null => {
    switch (module.kind) {
      case 'Class': return module.superclass ? resolveTarget<Class<'Linked'>>(module.superclass!) : null
      case 'Singleton': return resolveTarget<Class<'Linked'>>(module.superCall.superclass)
    }
  }


  const hierarchy = (m: Module<'Linked'>): List<Module<'Linked'>> => {
    const hierarchyExcluding = (module: Module<'Linked'>, exclude: List<Id> = []): List<Module<'Linked'>> => {
      if (exclude.includes(module.id)) return []
      return [
        ...module.mixins.map(mixin => resolveTarget<Module<'Linked'>>(mixin)),
        ...module.kind === 'Mixin' ? [] : superclass(module) ? [superclass(module)!] : [],
      ].reduce(({ mods, exs }, mod) => (
        { mods: [...mods, ...hierarchyExcluding(mod, exs)], exs: [mod.id, ...exs] }
      ), { mods: [module], exs: [module.id, ...exclude] }).mods
    }

    return hierarchyExcluding(m)
  }


  const inherits = (child: Module<'Linked'>, parent: Module<'Linked'>) => hierarchy(child).some(({ id }) => parent.id === id)


  const methodLookup = (name: Name, arity: number, start: Module<'Linked'>): Method<'Linked'> | undefined => {
    for (const module of hierarchy(start)) {
      const found = methods(module).find(member =>
        (!!member.body || member.isNative) && member.name === name && (
          member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
          member.parameters.length === arity
        )
      )
      if (found) return found
    }
    return undefined
  }


  const constructorLookup = (arity: number, owner: Class<'Linked'>): Constructor<'Linked'> | undefined => {
    return owner.members.filter(is('Constructor')).find(member =>
      member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
      member.parameters.length === arity
    )
  }


  const nativeLookup = (natives: {}, method: Method<'Linked'>): Native => {
    const fqn = `${fullyQualifiedName(parentOf<Module<'Linked'>>(method))}.${method.name}`
    return fqn.split('.').reduce((current, step) => {
      const next = current[step]
      if (!next) throw new Error(`Native not found: ${fqn}`)
      return next
    }, natives as any)
  }


  return {
    children,
    transform,
    reduce,
    descendants,
    parentOf,
    firstAncestorOfKind,
    getNodeById,
    resolve,
    resolveTarget,
    superclass,
    hierarchy,
    inherits,
    fullyQualifiedName,
    methodLookup,
    constructorLookup,
    nativeLookup,
    tests,
  }
}