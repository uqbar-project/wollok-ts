import { v4 as uuid } from 'uuid'
import { Linked as LinkedBehavior } from './behavior'
import { Environment as buildEnvironment, Package as buildPackage } from './builders'
import { divideOn } from './extensions'
import { Entity, Environment, Filled, Linked, List, Module, Name, Node, Package, Scope } from './model'

const { assign, keys } = Object

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MERGING
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SCOPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

// TODO: Use reference target passing a custom scope instead?
const resolve = (context: Node<Linked>, qualifiedName: Name): Module<Linked> => {
  if (qualifiedName.startsWith('#')) return context.environment().getNodeById(qualifiedName.slice(1))

  const [start, rest] = divideOn('.')(qualifiedName)
  const root = context.environment().getNodeById<Entity<Linked>>(context.scope[start])

  return rest.length
    ? (root as Package<Linked>).getNodeByQN<Module<Linked>>(rest)
    : root as Module<Linked>
}

const scopeContribution = (contributor: Node<Linked>): Scope => {
  if (contributor.is('Import')) {
    const referenced = resolve(contributor.parent(), contributor.entity.name)
    return {
      ...contributor.isGeneric
        ? assign({}, ...referenced.children().map(scopeContribution))
        : scopeContribution(referenced),
    }
  }

  if (
    contributor.is('Entity') ||
    contributor.is('Variable') ||
    contributor.is('Field') ||
    contributor.is('Parameter')
  ) return contributor.name ? { [contributor.name]: contributor.id } : {}

  return {}
}

const scopeWithin = (includeInheritedMembers: boolean) => (node: Node<Linked>): Scope => {
  const response = { ...node.scope }

  if (includeInheritedMembers && node.is('Module')) {

    // TODO: maybe rename to inheritedMembers?
    function hierarchy(module: Module<Linked>): List<Module<Linked>> {
      const mixins = module.mixins.map(mixin => resolve(module, mixin.name))

      if (module.is('Mixin') || (module.is('Class') && !module.superclass)) return mixins

      const superclass = resolve(module, module.is('Class') ? module.superclass!.name : module.superCall.superclass.name)

      return [
        ...hierarchy(superclass),
        superclass,
        ...mixins,
      ]
    }

    assign(response, ...hierarchy(node).map(scopeWithin(includeInheritedMembers)), { ...response })
  }

  assign(response, ...[node, ...node.children()].map(scopeContribution))

  return response
}

const assignScopes = (environment: Environment<Linked>) => {
  const globalScope = assign({},
    ...environment.children().map(scopeContribution),
    ...environment.getNodeByFQN<Package>('wollok.lang').children().map(scopeContribution)
  )

  function propagateScopeAssignment(
    node: Node<Linked>,
    scope: Scope,
    includeInheritedNames: boolean,
    propagateOn: (child: Node<Linked>) => boolean,
  ) {
    (node as any).scope = scope
    const innerScope = scopeWithin(includeInheritedNames)(node)

    for (const child of node.children())
      if (propagateOn(child)) propagateScopeAssignment(child, innerScope, includeInheritedNames, propagateOn)
  }

  propagateScopeAssignment(environment, globalScope, false, child => child.is('Entity'))
  propagateScopeAssignment(environment, environment.scope, true, () => true)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (newPackages: List<Package<Filled>>, baseEnvironment: Environment = buildEnvironment()): Environment => {
  // TODO: Would it make life easier if we used fqn where possible as id?
  const environment = LinkedBehavior(buildEnvironment(...newPackages.reduce(mergePackage, baseEnvironment.members) as List<Package<Linked>>)
    .transform<Linked, Environment>(node => ({ ...node, id: uuid() })))

  assignScopes(environment)

  // TODO: Move this to validations so it becomes fail-resilient
  environment.forEach({
    Reference: node => {
      try { node.target() } catch (e) { throw new Error(`Unlinked reference to ${node.name} on scope ${node.scope && keys(node.scope)}`) }
    },
  })

  return environment
}