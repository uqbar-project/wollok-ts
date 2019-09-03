import { mapObject } from './extensions'
import { NativeFunction } from './interpreter'
import { Class, Constructor, Entity, Environment, Id, is, isEntity, isNode, Kind, KindOf, Linked, List, Method, Module, Name, Node, NodeOfKind, Stage } from './model'

const { isArray } = Array

// TODO: Test all this

// TODO: Extract applyTransform into single propagate function
export const transform = <S extends Stage, R extends Stage = S>(tx: (node: Node<S>) => Node<R>) =>
  <N extends Node<S>, U extends Node<R> = N extends Node<R> ? N : Node<R>>(node: N): U => {
    const applyTransform = (obj: any): any =>
      typeof obj === 'function' ? obj :
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
      typeof obj === 'function' ? obj :
        isNode<S>(obj) ? (tx[obj.kind] || defaultTx as any)(mapObject(applyTransform, obj as any), obj) :
          isArray(obj) ? obj.map(applyTransform) :
            obj instanceof Object ? mapObject(applyTransform, obj) :
              obj

    return applyTransform(node)
  }

export const reduce = <T, S extends Stage>(tx: (acum: T, node: Node<S>) => T) => (initial: T, node: Node<S>): T =>
  (node as any).children().reduce(reduce(tx), tx(initial, node))

export default (environment: Environment) => {

  const fullyQualifiedName = (node: Entity<Linked>): Name => {
    const parent = node.parent()
    return isEntity(parent)
      ? `${fullyQualifiedName(parent)}.${node.name}`
      : node.name || `#${node.id}`
  }

  const ancestors = (node: Node<Linked>): List<Node<Linked>> => {
    try {
      const parent = node.parent()
      return [parent, ...ancestors(parent)]
    } catch (e) {
      return []
    }
  }

  const firstAncestorOfKind = <K extends Kind>(kind: K, node: Node<Linked>): NodeOfKind<K, Linked> | undefined => {
    let parent: Node<Linked>
    try {
      parent = node.parent()
    } catch (_) { return undefined }

    if (is(kind)(parent)) return parent as NodeOfKind<K, Linked>
    return firstAncestorOfKind<K>(kind, parent)
  }


  // TODO: Put on every node and make it relative
  const resolve = <N extends Entity<Linked>>(qualifiedName: string): N => {
    return qualifiedName.startsWith('#') // TODO: It would be nice to make this the superclass FQN # id
      ? environment.getNodeById(qualifiedName.slice(1))
      : qualifiedName.split('.').reduce((current: Entity<Linked> | Environment, step) => {
        const allChildren = current.children()
        const next = allChildren.find((child): child is Entity<Linked> => isEntity(child) && child.name === step)
        if (!next) throw new Error(
          `Could not resolve reference to ${qualifiedName}: Missing child ${step} among ${allChildren.map((c: any) => c.name)}`
        )
        return next
      }, environment) as N
  }


  const hierarchy = (m: Module<Linked>): List<Module<Linked>> => {
    const hierarchyExcluding = (module: Module<Linked>, exclude: List<Id> = []): List<Module<Linked>> => {
      if (exclude.includes(module.id)) return []
      return [
        ...module.mixins.map(mixin => mixin.target<Module<Linked>>()),
        ...module.kind === 'Mixin' ? [] : module.superclassNode() ? [module.superclassNode()!] : [],
      ].reduce(({ mods, exs }, mod) => (
        { mods: [...mods, ...hierarchyExcluding(mod, exs)], exs: [mod.id, ...exs] }
      ), { mods: [module], exs: [module.id, ...exclude] }).mods
    }

    return hierarchyExcluding(m)
  }


  const inherits = (child: Module<Linked>, parent: Module<Linked>) => hierarchy(child).some(({ id }) => parent.id === id)


  const methodLookup = (name: Name, arity: number, start: Module<Linked>): Method<Linked> | undefined => {
    for (const module of hierarchy(start)) {
      const found = module.methods().find(member =>
        (!!member.body || member.isNative) && member.name === name && (
          member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
          member.parameters.length === arity
        )
      )
      if (found) return found
    }
    return undefined
  }


  const constructorLookup = (arity: number, owner: Class<Linked>): Constructor<Linked> | undefined => {
    return owner.constructors().find(member =>
      member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
      member.parameters.length === arity
    )
  }


  const nativeLookup = (natives: {}, method: Method<Linked>): NativeFunction => {
    const fqn = `${fullyQualifiedName(method.parent<Module<Linked>>())}.${method.name}`
    return fqn.split('.').reduce((current, step) => {
      const next = current[step]
      if (!next) throw new Error(`Native not found: ${fqn}`)
      return next
    }, natives as any)
  }


  return {
    transform,
    ancestors,
    firstAncestorOfKind,
    resolve,
    hierarchy,
    inherits,
    fullyQualifiedName,
    methodLookup,
    constructorLookup,
    nativeLookup,
  }
}