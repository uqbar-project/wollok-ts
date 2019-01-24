import { getOrUpdate, NODE_CACHE, PARENT_CACHE } from './cache'
import { flatMap, mapObject } from './extensions'
import { Native } from './interpreter'
import { Class, Constructor, Entity, Environment, Id, is, isEntity, isNode, Kind, KindOf, List, Method, Module, Name, Node, NodeOfKind, Reference, Singleton, Stage } from './model'

const { isArray } = Array
const { values } = Object

// TODO: Test all this
// TODO: Review types (particulary regarding Stages)

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


export default (environment: Environment) => {
  type S = 'Linked'

  // TODO: Take this out of utils object?
  const reduce = <T>(tx: (acum: T, node: Node<S>) => T) => (initial: T, node: Node<S>): T =>
    children(node).reduce(reduce(tx), tx(initial, node))


  const children = <C extends Node<S>>(node: Node<S>): List<C> => {
    const extractChildren = (obj: any): List<Node<'Linked'>> => {
      if (isNode<'Linked'>(obj)) return [obj]
      if (isArray(obj)) return flatMap(extractChildren)(obj)
      if (obj instanceof Object) return flatMap(extractChildren)(values(obj))
      return []
    }
    return flatMap(extractChildren)(values(node)) as unknown as List<C>
  }


  const descendants = (node: Node<S>): List<Node<S>> => {
    const directDescendants = children(node)
    const indirectDescendants = flatMap(descendants)(directDescendants)
    return [...directDescendants, ...indirectDescendants]
  }


  const fullyQualifiedName = (node: Entity<'Linked'>): S extends 'Linked' ? Name : never => {
    const parent = parentOf(node)
    return (
      isEntity<'Linked'>(parent)
        ? `${fullyQualifiedName(parent)}.${node.name}`
        : node.name ? node.name : `#${node.id}`
    ) as S extends 'Linked' ? Name : never
  }


  const parentOf = <N extends Node<'Linked'>>(node: Node<'Linked'>): S extends 'Linked' ? N : never =>
    getNodeById(getOrUpdate(PARENT_CACHE, environment.id + node.id)(() => {
      const parent = [environment, ...descendants(environment)].find(descendant =>
        children(descendant).some(({ id }) => id === node.id)
      )
      if (!parent) throw new Error(`Node ${JSON.stringify(node)} is not part of the environment`)
      return parent.id as Id
    }))


  const firstAncestorOfKind = <K extends Kind>(kind: K, node: Node<'Linked'>): S extends 'Linked' ? NodeOfKind<K, 'Linked'> : never => {
    const parent = parentOf(node)
    if (parent.kind === kind) return parent as S extends 'Linked' ? NodeOfKind<K, 'Linked'> : never
    else return firstAncestorOfKind(kind, parent)
  }

  const getNodeById = <T extends Node<'Linked'>>(id: Id): S extends 'Linked' ? T : never =>
    getOrUpdate(NODE_CACHE, environment.id + id)(() => {
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
    }) as S extends 'Linked' ? T : never


  const resolve = <T extends Entity<'Linked'>>(qualifiedName: string): S extends 'Linked' ? T : never => {
    return qualifiedName.startsWith('#') // TODO: It would be nice to make this the superclass FQN # id
      ? getNodeById(qualifiedName.slice(1))
      : qualifiedName.split('.').reduce((current: Entity<'Linked'> | Environment, step) => {
        const allChildren = children(current as Entity<S>) as List<Node<'Linked'>>
        const next = allChildren.find((child): child is Entity<'Linked'> => isEntity(child) && child.name === step)
        if (!next) throw new Error(
          `Could not resolve reference to ${qualifiedName}: Missing child ${step} among ${allChildren.map((c: any) => c.name)}`
        )
        return next
      }, environment as Environment) as S extends 'Linked' ? T : never
  }
  // )


  const resolveTarget = <T extends Node<'Linked'>>(reference: Reference<'Linked'>): S extends 'Linked' ? T : never =>
    getNodeById<T>(reference.target)


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
      const methods = module.members.filter(is<'Method'>('Method')) as Method<'Linked'>[]
      const found = methods.find(member =>
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
  }
}