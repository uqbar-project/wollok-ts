import { v4 as uuid } from 'uuid'
import { Linked as LinkedBehavior } from './behavior'
import { Environment as buildEnvironment, Package as buildPackage } from './builders'
import { flushAll, NODE_CACHE, PARENT_CACHE, update } from './cache'
import { Entity, Environment, Filled, Id, is, isModule, Linked, List, Module, Node, Package, Raw } from './model'
import tools, { transform, transformByKind } from './tools'

export interface Scope { [name: string]: string }

const mergePackage = (members: List<Entity<Filled> | Entity<Linked>>, isolated: Entity<Filled>): List<Entity<Filled> | Entity<Linked>> => {
  if (!is('Package')(isolated)) return [...members, isolated]
  const existent = members.find((member): member is (Package<Filled> | Package<Linked>) =>
    is('Package')(member) && member.name === isolated.name
  )
  return existent
    ? [
      ...members.filter(member => member !== existent),
      buildPackage(existent.name, existent)(...isolated.members.reduce(mergePackage, existent.members) as List<Entity<Raw>>) as Package<'Filled'>,
    ]
    : [...members, isolated]
}

const buildScopes = (environment: Environment): (id: string) => Scope => {

  const { getNodeById, resolve, fullyQualifiedName } = tools(environment)

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

  function ancestors(module: Module<Linked>): List<Module<Linked>> {
    const scope = getScope(module.id)

    let superclassId
    let superclass

    switch (module.kind) {
      case 'Class':
        if (!module.superclass) return [...module.mixins.map(m => getNodeById<Module<Linked>>(scope[m.name]))]

        superclassId = scope[module.superclass.name]
        if (!superclassId) throw new Error(
          `Missing superclass ${module.superclass.name} for class ${module.name} on scope ${JSON.stringify(scope)}`
        )
        superclass = getNodeById<Module<Linked>>(superclassId)

        return [
          superclass,
          ...ancestors(superclass),
          ...module.mixins.map(m => getNodeById<Module<Linked>>(scope[m.name])),
        ]

      case 'Singleton':
        superclassId = scope[module.superCall.superclass.name]
        if (!superclassId)
          throw new Error(
            `Missing superclass ${module.superCall.superclass.name} for singleton ${module.name} on scope ${JSON.stringify(scope)}`
          )
        superclass = getNodeById<Module<Linked>>(superclassId)

        return [
          ...[superclass, ...ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module<Linked>>(scope[m.name])),
        ]

      case 'Mixin':
        return module.mixins.map(m => getNodeById<Module<Linked>>(scope[m.name]))
    }
  }

  const innerContributionFrom = (node: Node<Linked>): Scope => [
    ...isModule(node)
      ? ancestors(node).map(ancestor => innerContributionFrom(ancestor))
      : [],
    ...[node, ...node.children()].map(c => outerContributionFrom(c)),
  ].reduce((a, b) => ({ ...a, ...b }))

  const outerContributionFrom = (contributor: Node<Linked>): Scope => {
    switch (contributor.kind) {
      case 'Import':
        const referenced = resolve(contributor.entity.name)
        return {
          [contributor.entity.name]: referenced.id,
          ...contributor.isGeneric
            ? referenced.children<Entity<Linked>>().reduce((scope: Scope, child) => {
              scope[child.name || ''] = child.id
              return scope
            }, {})
            : { [referenced.name!]: referenced.id },
        }

      case 'Package':
        if (contributor.name === 'wollok') {
          const langPackage = contributor.children().find(p => p.kind === 'Package' && p.name === 'lang')!
          const globalContributions = langPackage.children().map(outerContributionFrom).reduce((a, b) => ({ ...a, ...b }))
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

      case 'NamedArgument':
      case 'Assignment':
      case 'Reference':
      case 'Body':
      case 'Method':
      case 'Constructor':
      case 'Fixture':
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

  environment.descendants().forEach(node =>
    scopes.set(node.id, () => {
      const parent = node.parent()
      return { ...getScope(parent.id), ...innerContributionFrom(parent) }
    })
  )

  return getScope
}

export default (newPackages: List<Package<Filled>>, baseEnvironment: Environment = buildEnvironment()): Environment => {

  const mergedEnvironment = buildEnvironment(
    ...newPackages.reduce(mergePackage, baseEnvironment.members) as List<Package<Linked>>,
  )

  const identifiedEnvironment: Environment = LinkedBehavior(transform<Linked, Linked>(node =>
    // TODO: It would make life easier and more performant if we used a fqn where possible as id
    node.id ? node : { ...node, id: uuid() }
  )(mergedEnvironment))

  transform<Linked>(node => {
    update(NODE_CACHE, node.id, node)
    node.children().forEach(child =>
      update(PARENT_CACHE, child.id, node.id)
    )
    return node
  })(identifiedEnvironment)

  const scopes = buildScopes(identifiedEnvironment)

  const targetedEnvironment = LinkedBehavior(transformByKind<Linked>({
    Reference: node => {
      const target = scopes(node.id)[node.name]
      // TODO: In the future, we should make this fail-resilient
      if (!target) throw new Error(`Missing reference to ${node.name}`)
      return { ...node, targetId: target }
    },
  })(identifiedEnvironment))

  flushAll(NODE_CACHE)

  return targetedEnvironment
}