import { v4 as uuid } from 'uuid'
import { flushAll, NODE_CACHE, PARENT_CACHE, update } from './cache'
import { Entity, Environment, Id, isModule, List, Module, Node, Package } from './model'
import tools, { transform, transformByKind } from './tools'

export interface Scope { [name: string]: string }

const mergePackage = (members: List<Entity<'Filled' | 'Linked'>>, isolated: Entity<'Filled'>): List<Entity<'Filled' | 'Linked'>> => {

  if (isolated.kind !== 'Package') return [...members, isolated]

  const existent = members.find((member): member is Package<'Filled' | 'Linked'> =>
    member.kind === 'Package' && member.name === isolated.name
  )

  return existent
    ? [
      ...members.filter(member => member !== existent),
      { ...existent, members: isolated.members.reduce(mergePackage, existent.members) },
    ]
    : [...members, isolated]
}

const buildScopes = (environment: Environment): (id: string) => Scope => {

  const { children, descendants, getNodeById, parentOf, resolve, fullyQualifiedName } = tools(environment)

  const scopes: Map<Id, Scope | (() => Scope)> = new Map([
    [environment.id, {}],
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

  function ancestors(module: Module<'Linked'>): List<Module<'Linked'>> {
    const scope = getScope(module.id)

    let superclassId
    let superclass

    switch (module.kind) {
      case 'Class':
        if (!module.superclass) return [...module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name]))]

        superclassId = scope[module.superclass.name]
        if (!superclassId) throw new Error(
          `Missing superclass ${module.superclass.name} for class ${module.name} on scope ${JSON.stringify(scope)}`
        )
        superclass = getNodeById<Module<'Linked'>>(superclassId)

        return [
          superclass,
          ...ancestors(superclass),
          ...module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name])),
        ]

      case 'Singleton':
        superclassId = scope[module.superCall.superclass.name]
        if (!superclassId)
          throw new Error(
            `Missing superclass ${module.superCall.superclass.name} for singleton ${module.name} on scope ${JSON.stringify(scope)}`
          )
        superclass = getNodeById<Module<'Linked'>>(superclassId)

        return [
          ...[superclass, ...ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name])),
        ]

      case 'Mixin':
        return module.mixins.map(m => getNodeById<Module<'Linked'>>(scope[m.name]))
    }
  }

  const innerContributionFrom = (node: Node<'Linked'>): Scope => [
    ...isModule(node)
      ? ancestors(node).map(ancestor => innerContributionFrom(ancestor))
      : [],
    ...[node, ...children(node)].map(c => outerContributionFrom(c)),
  ].reduce((a, b) => ({ ...a, ...b }))

  const outerContributionFrom = (contributor: Node<'Linked'>): Scope => {
    switch (contributor.kind) {
      case 'Import':
        const referenced = resolve(contributor.reference.name)
        return {
          [contributor.reference.name]: referenced.id,
          ...contributor.isGeneric
            ? children<Entity<'Linked'>>(referenced).reduce((scope: Scope, child) => {
              scope[child.name || ''] = child.id
              return scope
            }, {})
            : { [referenced.name!]: referenced.id },
        }

      case 'Package':
        if (contributor.name === 'wollok') {
          const langPackage = children(contributor).find(p => p.kind === 'Package' && p.name === 'lang')!
          const globalContributions = children(langPackage).map(outerContributionFrom).reduce((a, b) => ({ ...a, ...b }))
          return {
            [contributor.name]: contributor.id,
            ...globalContributions,
          }
        }
        return { [contributor.name]: contributor.id }

      case 'Singleton':
      case 'Class':
      case 'Mixin':
      case 'Program':
      case 'Test':
      case 'Describe':
        return contributor.name
          ? {
            [contributor.name]: contributor.id,
            [fullyQualifiedName(contributor)]: contributor.id,
          }
          : {}

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

  const allNodes = descendants(environment)

  allNodes.forEach(node =>
    scopes.set(node.id, () => {
      const parent = parentOf(node)
      return { ...getScope(parent.id), ...innerContributionFrom(parent) }
    })
  )

  return getScope
}

export default (
  newPackages: List<Package<'Filled'>>,
  baseEnvironment: Environment = { kind: 'Environment', members: [], id: '' }
): Environment => {

  const mergedEnvironment = {
    ...baseEnvironment,
    members: newPackages.reduce(mergePackage, baseEnvironment.members),
  } as Environment

  const identifiedEnvironment: Environment = transform(node => {
    return node.id ? node : { ...node, id: uuid() }
  })(mergedEnvironment)

  transform<'Linked'>(node => {
    tools(identifiedEnvironment).children(node).forEach(child =>
      update(PARENT_CACHE, child.id, node.id)
    )
    return node
  })(identifiedEnvironment)

  const scopes = buildScopes(identifiedEnvironment)
  const targetedEnvironment = transformByKind<'Linked'>({
    Reference: node => {
      const target = scopes(node.id)[node.name]
      // TODO: In the future, we should make this fail-resilient
      if (!target) throw new Error(`Missing reference to ${node.name}`)
      const next = { ...node, target }
      return next
    },
  })(identifiedEnvironment)

  flushAll(NODE_CACHE)

  return targetedEnvironment

}