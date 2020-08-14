import { v4 as uuid } from 'uuid'
import { divideOn } from './extensions'
import { Entity, Environment, Filled, Linked, List, Name, Node, Package, Scope } from './model'

const { assign } = Object


const GLOBAL_PACKAGES = ['wollok.lang', 'wollok.lib']

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MERGING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const mergePackage = (members: List<Entity<Filled>>, isolated: Entity<Filled>): List<Entity<Filled>> => {
  if (!isolated.is('Package')) return [...members.filter(({ name }) => name !== isolated.name), isolated]
  const existent = members.find((member: Entity<Filled>): member is Package<Filled> =>
    member.is('Package') && member.name === isolated.name)
  return existent
    ? [
      ...members.filter(member => member !== existent),
      new Package({
        ...existent,
        members: isolated.members.reduce(mergePackage, existent.members),
      }),
    ]
    : [...members, isolated]
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SCOPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

class LocalScope implements Scope {
  protected contributions = new Map<Name, Node<Linked>>()
  protected includedScopes: Scope[] = []

  constructor(public containerScope?: Scope) { }

  register(...contributions: [ Name, Node<Linked>][]): void {
    for(const [name, node] of contributions) this.contributions.set(name, node)
  }

  include(...others: Scope[]) { this.includedScopes.push(...others) }

  resolve(qualifiedName: Name, allowLookup = true): Node<Linked> | undefined {
    const [start, rest] = divideOn('.')(qualifiedName)

    const step = !allowLookup
      ? this.contributions.get(start)
      : this.includedScopes.reduce((found, included) =>
        found ?? included.resolve(start, false)
      , this.contributions.get(start)) ?? this.containerScope?.resolve(start, allowLookup)

    return rest.length ? step?.scope?.resolve(rest, false) : step
  }
}


const scopeContribution = (contributor: Node<Linked>): List<[Name, Node]> => {
  if (
    contributor.is('Entity') ||
    contributor.is('Field') ||
    contributor.is('Parameter')
  ) return contributor.name ? [[contributor.name, contributor]] : []

  return []
}


const assignScopes = (environment: Environment<Linked>) => {
  environment.forEach((node, parent) => {
    assign(node, {
      scope: new LocalScope(
        node.is('Reference') && (parent!.is('Class') || parent!.is('Mixin'))
          ? parent!.parent().scope
          : parent?.scope
      ),
    })

    if(node.is('Entity'))
      parent!.scope.register(...scopeContribution(node))
  })

  environment.forEach((node, parent) => {
    if(node.is('Environment'))
      node.scope.register(...GLOBAL_PACKAGES.flatMap(globalPackage =>
        environment.getNodeByFQN<'Package'>(globalPackage).members.flatMap(scopeContribution) // TODO: Add Error if not found (and test)
      ))
    
    if(node.is('Package'))
      node.scope.include(...node.imports.map(imported => {
        const entity = node.getNodeByQN(imported.entity.name) // TODO: Error if not found (and test)
        
        if(imported.isGeneric) return entity!.scope //TODO: Add Error if not
        else {
          const importScope = new LocalScope()
          importScope.register([entity.name!, entity])
          return importScope
        }
      }))

    if(node.is('Module'))
      node.scope.include(...node.hierarchy().slice(1).map(supertype => supertype.scope)) //TODO: Add Error if ancestor is missing (also test)

    if(parent && !node.is('Entity'))
      parent!.scope.register(...scopeContribution(node))
  })
}


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (
  newPackages: List<Package<Filled>>,
  baseEnvironment?: Environment<Linked>,
): Environment => {
  const environment = new Environment<Linked>({
    id: uuid(),
    scope: null as any,
    members: newPackages.reduce(mergePackage, baseEnvironment?.members ?? []) as List<Package<Linked>>,
  }).transform(node => node.copy({ id: uuid() }))

  environment.forEach((node, parent) => {
    if(parent) node._cache().set('parent()', parent) // TODO: These strings are rather ugly...
    node._cache().set('environment()', environment)
    environment._cache().set(`getNodeById(${node.id})`, node)
  })

  assignScopes(environment)

  // TODO: Move this to validations so it becomes fail-resilient
  environment.forEach(node => {
    if(node.is('Reference') && !node.target())
      throw new Error(`Unlinked reference to ${node.name} in ${JSON.stringify(node.source)}`)
  })

  return environment
}