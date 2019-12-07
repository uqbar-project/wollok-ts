import { v4 as uuid } from 'uuid'
import { Linked as LinkedBehavior } from './behavior'
import { Environment as buildEnvironment, Package as buildPackage } from './builders'
import { divideOn } from './extensions'
import { Entity, Environment, Filled, Id, Linked, List, Module, Name, Node, Package, Scope } from './model'

const { assign } = Object

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MERGING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const mergePackage = (members: List<Entity<Filled>>, isolated: Entity<Filled>): List<Entity<Filled>> => {
  if (!isolated.is('Package')) return [...members.filter(({ name }) => name !== isolated.name), isolated]
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
const resolve = (context: Node<Linked>, qualifiedName: Name): Entity<Linked> => {
  if (qualifiedName.startsWith('#')) return context.environment().getNodeById(qualifiedName.slice(1))

  const [start, rest] = divideOn('.')(qualifiedName)
  const root = context.environment().getNodeById<Entity<Linked>>(context.scope[start])

  if (rest.length) {
    if (!root.is('Package'))
      throw new Error(`Trying to resolve ${qualifiedName} from non-package root`)

    return (root as Package<Linked>).getNodeByQN<Module<Linked>>(rest)
  } else {
    return root
  }
}

const scopeContribution = (contributor: Node<Linked>): Scope => {
  if (contributor.is('Import')) {
    let referenced
    try {
      referenced = resolve(contributor.parent(), contributor.entity.name)
    } catch (e) {
      throw new Error(`Importing unresolved entity ${contributor.entity.name}`)
    }

    return {
      ...contributor.isGeneric
        ? assign({}, ...(referenced as Package).members.map(scopeContribution))
        : scopeContribution(referenced),
    }
  }

  if (
    contributor.is('Entity') ||
    contributor.is('Field') ||
    contributor.is('Parameter')
  ) return contributor.name ? { [contributor.name]: contributor.id } : {}

  return {}
}

const scopeWithin = (includeInheritedMembers: boolean) => (node: Node<Linked>): Scope => {
  const response = { ...node.scope }

  if (includeInheritedMembers && node.is('Module')) {

    function inheritedScope(module: Module<Linked>, exclude: List<Id> = []): Scope {
      if (exclude.includes(module.id)) return {}

      const mixins = module.mixins.map(mixin => resolve(module, mixin.name))
      const mixinsScope: Scope = assign({}, ...mixins.flatMap(mixin =>
        mixin.children().map(scopeContribution)
      ))

      if (module.is('Mixin') || (module.is('Class') && !module.superclass)) return mixinsScope

      const superclass = resolve(module, module.is('Class') ? module.superclass!.name : module.superCall.superclass.name) as Module
      const superclassScope = assign({}, ...superclass.children().map(scopeContribution))

      return {
        ...inheritedScope(superclass, [module.id, ...exclude]),
        ...superclassScope,
        ...mixinsScope,
      }
    }

    assign(response, inheritedScope(node), { ...response })
  }

  assign(response, ...[node, ...node.children()].map(scopeContribution))

  return response
}

const assignScopes = (environment: Environment<Linked>) => {
  const globalPackages = ['wollok.lang', 'wollok.lib']
  const globalScope = assign({},
    ...environment.children().map(scopeContribution),
    ...globalPackages.flatMap(name => environment.getNodeByFQN<Package>(name).members.map(scopeContribution)),
  )

  function propagateScopeAssignment(
    node: Node<Linked>,
    scope: Scope,
    includeInheritedNames: boolean,
    propagateOn: (child: Node<Linked>) => boolean,
    n: number = 0,
  ) {
    (node as any).scope = scope
    const innerScope = scopeWithin(includeInheritedNames)(node)

    for (const child of node.children())
      if (propagateOn(child)) propagateScopeAssignment(child, innerScope, includeInheritedNames, propagateOn, n + 1)
  }

  propagateScopeAssignment(environment, globalScope, false, node => node.is('Entity'))
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
      try { node.target() } catch (e) { throw new Error(`Unlinked reference to ${node.name} in ${node.source?.file}`) }
    },
  })

  return environment
}