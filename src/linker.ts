// TODO: Maybe we should map all references to fully qualyfied ones ?

import { memoizeWith, merge } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Class, Entity, Environment, Id, isModule, List, Module, Node, Package, Scope } from './model'
import utils from './utils'

const mergePackage = (
  members: List<Entity<'Complete' | 'Linked'>>,
  isolated: Entity<'Complete'>
): List<Entity<'Complete' | 'Linked'>> => {

  if (isolated.kind !== 'Package') return [...members, isolated]

  const existent = members.find((member): member is Package<'Complete' | 'Linked'> =>
    member.kind === 'Package' && member.name === isolated.name
  )

  return existent ? [
    ...members.filter(member => member !== existent),
    { ...existent, members: isolated.members.reduce(mergePackage, existent.members) },
  ] : [...members, isolated]
}

const buildScopes = (environment: Environment<'Linked'>): { [id: string]: Scope } => {

  const { children, descendants, getNodeById, parentOf, resolve } = utils(environment)

  const scopes: Map<Id<'Linked'>, Scope | (() => Scope)> = new Map([
    [environment.id, {}],
  ])

  const getScope = (id: Id<'Linked'>): Scope => {
    const scope = scopes.get(id)
    if (!scope) throw new Error(`Missing scope for node id ${id}`)
    if (scope instanceof Function) {
      const resolvedScope = scope()
      scopes.set(id, resolvedScope)
      return resolvedScope
    }
    return scope
  }

  function ancestors(module: Module<'Linked'>): List<Module<'Linked'>> {
    const scope = getScope(module.id)
    const ObjectClass = resolve<Class<'Linked'>>('wollok.lang.Object')

    let superclass

    switch (module.kind) {
      case 'Class':
        superclass = module.superclass
          ? getNodeById<Module<'Linked'>>(scope[module.superclass.name])
          : ObjectClass

        return [
          ...superclass === module ? [] : [superclass, ...ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name])),
        ]

      case 'Singleton':
        superclass = module.superCall
          ? getNodeById<Module<'Linked'>>(scope[module.superCall.superclass.name])
          : ObjectClass

        return [
          ...[superclass, ...ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name])),
        ]

      case 'Mixin':
        return module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name]))
    }
  }

  // TODO: Memoize?
  const innerContributionFrom = memoizeWith(({ id }) => id)(
    (node: Node<'Linked'>): Scope => {
      return [
        ...isModule(node)
          ? ancestors(node).map(ancestor => innerContributionFrom(ancestor))
          : [],
        ...[node, ...children(node)].map(c => outerContributionFrom(c)),
      ].reduce(merge)
    }
  )

  // TODO: Memoize?
  const outerContributionFrom = memoizeWith(({ id }) => id)(
    (contributor: Node<'Linked'>): Scope => {
      switch (contributor.kind) {
        // TODO: Resolve fully qualified names
        case 'Import':
          const referencedId = getScope(contributor.id)[contributor.reference.name]
          const referenced = getNodeById(referencedId)
          return contributor.isGeneric
            ? children(referenced)
              .map(child => ({ [(child as Entity<'Linked'>).name || '']: child.id }))
              .reduce(merge)
            : { [(referenced as Entity<'Linked'>).name || '']: referenced.id }
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
  )

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
  newPackages: List<Package<'Complete'>>,
  baseEnvironment: Environment<'Linked'> = { kind: 'Environment', members: [], id: '' }
): Environment<'Linked'> => {

  const mergedEnvironment = {
    ...baseEnvironment,
    members: newPackages.reduce(mergePackage, baseEnvironment.members),
  } as Environment<'Linked'>

  const identifiedEnvironment = utils(mergedEnvironment)
    .transform(node => ({ ...node, id: node.id || uuid() }))(mergedEnvironment)

  const scopes = buildScopes(identifiedEnvironment)

  // TODO: Don't assign scopes, just the Reference targets
  const scopedEnvironment = utils(identifiedEnvironment).transform((node: Node<'Linked'>) =>
    ({ ...node, scope: scopes[node.id] })
  )(identifiedEnvironment)

  // TODO: Validate that all references have a target

  return { ...scopedEnvironment, id: uuid() }
}