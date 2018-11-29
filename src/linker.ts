// TODO: Maybe we should map all references to fully qualyfied ones ?

import { merge } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Class, Entity, Environment, Id, isModule, Module, Node, Package, Scope, Unlinked } from './model'
import utils from './utils'

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

  const { children, descendants, getNodeById, parentOf, resolve } = utils(environment)

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
    const ObjectClass = resolve<Class>('wollok.lang.Object')

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

  // TODO: Memoize?
  const innerContributionFrom = // memoizeWith(({ id }) => id)(
    (node: Node): Scope => {
      return [
        ...isModule(node)
          ? ancestors(node).map(ancestor => innerContributionFrom(ancestor))
          : [],
        ...[node, ...children(node)].map(c => outerContributionFrom(c)),
      ].reduce(merge)
    }
  // )

  // TODO: Memoize?
  const outerContributionFrom = // memoizeWith(({ id }) => id)(
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
          const langPackage = children(contributor).find(p => p.kind === 'Package' && p.name === 'lang')
          const globalContributions: Scope = contributor.name === 'wollok'
            ? children(langPackage!).map(outerContributionFrom).reduce(merge)
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
        case 'Describe':
          return contributor.name ? { [contributor.name]: contributor.id } : {}
        case 'Variable':
        case 'Field':
        case 'Parameter':
          return { [contributor.name]: contributor.id }
        case 'Assignment':
        case 'Reference':
        case 'Body':
        case 'Method':
        case 'Constructor':
        case 'Return':
        case 'Reference':
        case 'Self':
        case 'Literal':
        case 'Send':
        case 'Super':
        case 'New':
        case 'If':
        case 'Throw':
        case 'Try':
        case 'Catch':
        case 'Environment':
          return {}
      }
    }
  // )

  const allNodes = descendants(environment)

  allNodes.forEach(node =>
    scopes.set(node.id, () => {
      const parent = parentOf(node)
      return merge(getScope(parent.id), innerContributionFrom(parent))
    })
  )

  return allNodes.reduce((scope, node) => merge(scope, { [node.id]: getScope(node.id) }), {})
}

export default (
  newPackages: Unlinked<Package>[],
  baseEnvironment: Environment = { kind: 'Environment', members: [], scope: {}, id: uuid() }
): Environment => {

  const mergedEnvironment = { ...baseEnvironment, members: newPackages.reduce(mergePackage, baseEnvironment.members) } as Environment

  const identifiedEnvironment = utils(mergedEnvironment).transform(node => ({ ...node, id: node.id || uuid() }))(mergedEnvironment)

  const scopes = buildScopes(identifiedEnvironment)

  const scopedEnvironment = utils(identifiedEnvironment).transform(node => ({ ...node, scope: scopes[node.id] }))(identifiedEnvironment)

  // TODO: Validate that all references have a target

  return scopedEnvironment
}