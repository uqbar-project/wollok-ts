import { v4 as uuid } from 'uuid'
import { Linked as LinkedBehavior } from './behavior'
import { Environment as buildEnvironment, Package as buildPackage } from './builders'
import { NODE_CACHE, PARENT_CACHE, update } from './cache'
import { Entity, Environment, Filled, Linked, List, Module, Name, Node, Package, Scope } from './model'

const { assign } = Object

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// STEPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const mergePackage = (members: List<Entity<Filled>>, isolated: Entity<Filled>): List<Entity<Filled>> => {
  if (!isolated.is('Package')) return [...members, isolated]
  const existent = members.find((member: Entity<Filled>): member is Package<Filled> =>
    member.is('Package') && member.name === isolated.name
  )
  return existent
    ? [
      ...members.filter(member => member !== existent),
      buildPackage(existent.name, existent)(...isolated.members.reduce(mergePackage, existent.members)) as Package<Filled>,
    ]
    : [...members, isolated]
}


function resolve(context: Node<Linked>, qualifiedName: Name): Module<Linked> {
  if (qualifiedName.startsWith('#')) return context.environment().getNodeById(qualifiedName.slice(1))

  const [root, ...path] = qualifiedName.split('.')

  const start = context.environment().getNodeById<Entity<Linked>>(context.scope[root])

  // TODO: getDescendantByQN in entities ?
  return path.reduce((current: Entity<Linked>, step) => {
    const next = current.children().find((child): child is Entity<Linked> => child.is('Entity') && child.name === step)
    if (!next) throw new Error(
      `Could not resolve reference to ${qualifiedName}: Missing child ${step} among childs of ${current.name}`
    )
    return next
  }, start) as Module<Linked>
}

const scopeContribution = (contributor: Node<Linked>): Scope => {
  switch (contributor.kind) {
    case 'Import':
      const referenced = resolve(contributor.parent(), contributor.entity.name)
      return {
        [contributor.entity.name]: referenced.id,
        ...contributor.isGeneric
          ? referenced.children<Entity<Linked>>().reduce((scope: Scope, child) => {
            if (child.name) scope[child.name] = child.id
            return scope
          }, {})
          : { [referenced.name!]: referenced.id },
      }

    case 'Package':
      if (contributor.name === 'wollok') {
        const langPackage = contributor.children().find(p => p.kind === 'Package' && p.name === 'lang')!
        const globalContributions = langPackage.children().map(scopeContribution).reduce((a, b) => ({ ...a, ...b }))
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
          [contributor.fullyQualifiedName()]: contributor.id,
        }
        : {}

    case 'Variable':
    case 'Field':
    case 'Parameter':
      return { [contributor.name]: contributor.id }

    default:
      return {}
  }
}

const scopeWithin = (includeInner: boolean) => (node: Node<Linked>): Scope => {
  const response = { ...node.scope }

  if (includeInner && node.is('Module')) {
    function hierarchy(module: Module<Linked>): List<Module<Linked>> {
      const mixins = module.mixins.map(m => resolve(module, m.name))

      if (module.is('Mixin') || (module.is('Class') && !module.superclass)) return mixins

      const superclass = resolve(module, module.is('Class') ? module.superclass!.name : module.superCall.superclass.name)
      return [
        superclass,
        ...hierarchy(superclass),
        ...mixins,
      ]
    }

    assign(response, ...hierarchy(node).map(scopeWithin(includeInner)))
  }

  assign(response, ...[node, ...node.children()].map(scopeContribution))

  return response
}

const assignEntityScopes = (node: Node<Linked>, scope: Scope = {}) => {
  (node as any).scope = scope
  const innerScope = scopeWithin(false)(node)
  for (const child of node.children()) if (child.is('Entity')) assignEntityScopes(child, innerScope)
}

const assignNonEntityScopes = (node: Node<Linked>, scope: Scope = {}) => {
  (node as any).scope = scope
  const innerScope = scopeWithin(true)(node)
  for (const child of node.children()) assignNonEntityScopes(child, innerScope)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (newPackages: List<Package<Filled>>, baseEnvironment: Environment = buildEnvironment()): Environment => {

  // TODO: It would make life easier and more performant if we used a fqn where possible as id
  const environment = LinkedBehavior(
    buildEnvironment(...newPackages.reduce(mergePackage, baseEnvironment.members) as List<Package<Linked>>)
      .transform<Linked, Environment>(node => ({ ...node, id: uuid() }))
  )

  environment.reduce((_, node) => {
    update(NODE_CACHE, node.id, node)
    node.children().forEach(child =>
      update(PARENT_CACHE, child.id, node.id)
    )
    return null
  }, null)

  assignEntityScopes(environment)
  assignNonEntityScopes(environment)

  environment.reduce((_, node) => {
    // TODO: In the future, we should make this fail-resilient
    if (node.is('Reference')) {
      try { node.target() } catch (e) { throw new Error(`Unlinked reference to ${node.name} on scope ${node.scope && Object.keys(node.scope)}`) }
    }

    return null
  }, null)

  return environment
}