// TODO: Maybe we should map all references to fully qualyfied ones ?

import { memoizeWith, merge } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Class, Entity, Environment, Id, isModule, Module, Node, Package, Scope, Unlinked } from './model'
import utils, { transform } from './utils'

const mergePackage = (
  members: ReadonlyArray<Entity | Unlinked<Entity>>,
  isolated: Unlinked<Entity>
): ReadonlyArray<Entity | Unlinked<Entity>> => {

  if (isolated.kind !== 'Package') return [...members, isolated]

  const existent = members.find(member => member.kind === isolated.kind && member.name === isolated.name) as Package

  return existent ? [
    ...members.filter(member => member !== existent),
    { ...existent, members: isolated.members.reduce(mergePackage, existent.members) },
  ] : [...members, isolated]
}

const buildScopes = (environment: Environment): { [id: string]: Scope } => {

  const { children, descendants, getNodeById, parentOf } = utils(environment)

  const scopes: Map<Id, Scope | (() => Scope)> = new Map([
    [environment.id, environment.scope],
  ])

  const getScope = (id: Id): Scope => {
    const scope = scopes.get(id)
    if (!scope) throw new Error(`Missing scope for node id ${id}`)
    if (scope instanceof Function) {
      const resolvedScope = scope()
      scopes.set(id, resolvedScope)
      return resolvedScope
    }
    return scope
  }

  function ancestors(module: Module): ReadonlyArray<Module> {
    const scope = getScope(module.id)
    // TODO: change this to 'wollok.Object' and make getNodeById resolve composed references
    const ObjectClass = getNodeById<Class>(scope.Object)

    let superclass

    switch (module.kind) {
      case 'Class':
        superclass = module.superclass
          ? getNodeById<Module>(scope[module.superclass.name])
          : ObjectClass

        return [
          ...superclass === module ? [] : [superclass, ...ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module>(scope[m.name])),
        ]

      case 'Singleton':
        superclass = module.superCall
          ? getNodeById<Module>(scope[module.superCall.superclass.name])
          : ObjectClass

        return [
          ...[superclass, ...ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module>(scope[m.name])),
        ]

      case 'Mixin':
        return module.mixins.map(m => getNodeById<Module>(scope[m.name]))
    }
  }

  const innerContributionFrom = memoizeWith(({ id }) => id)(
    (contributor: Node): Scope => {
      return [
        ...isModule(contributor)
          ? ancestors(contributor).map(ancestor => innerContributionFrom(ancestor))
          : [],
        ...[contributor, ...children(contributor)].map(c => outerContributionFrom(c)),
      ].reduce(merge)
    }
  )

  const outerContributionFrom = memoizeWith(({ id }) => id)(
    (contributor: Node): Scope => {
      switch (contributor.kind) {
        // TODO: Resolve fully qualified names
        case 'Import':
          const referencedId = getScope(contributor.id)[contributor.reference.name]
          const referenced = getNodeById(referencedId)
          return contributor.isGeneric
            ? children(referenced)
              .map(child => ({ [(child as Entity).name || '']: child.id }))
              .reduce(merge)
            : { [(referenced as Entity).name || '']: referenced.id }
        case 'Package':
          const globalContributions: Scope = contributor.name === 'wollok'
            ? children(contributor).map(c => outerContributionFrom(c)).reduce(merge)
            : {}
          return {
            [contributor.name]: contributor.id,
            ...globalContributions,
          }
        case 'Singleton':
        case 'Class':
        case 'Mixin':
        case 'Program':
        case 'Test':
          return contributor.name ? { [contributor.name]: contributor.id } : {}
        case 'Variable':
        case 'Field':
        case 'Parameter':
          return { [contributor.name]: contributor.id }
        default:
          return {}
      }
    }
  )

  function scopeFor(node: Node): (() => Scope) {
    return () => {
      const parent = parentOf(node)
      return merge(getScope(parent.id), innerContributionFrom(parent))
    }
  }

  const allNodes = descendants(environment)

  allNodes.forEach(node => scopes.set(node.id, scopeFor(node)))

  return allNodes.reduce((scope, node) => merge(scope, { [node.id]: getScope(node.id) }), {})
}

export default (
  newPackages: Unlinked<Package>[],
  baseEnvironment: Environment = { kind: 'Environment', members: [], scope: {}, id: uuid() }
): Environment => {

  const mergedEnvironment = { ...baseEnvironment, members: newPackages.reduce(mergePackage, baseEnvironment.members) } as Environment

  const identifiedEnvironment = transform(node => ({ ...node, id: node.id || uuid() }))(mergedEnvironment)

  const scopes = buildScopes(identifiedEnvironment)

  const scopedEnvironment = transform(node => ({ ...node, scope: scopes[node.id] }))(identifiedEnvironment)

  // TODO: Validate that all references have a target

  return scopedEnvironment
}