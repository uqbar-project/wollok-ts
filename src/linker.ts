import { v4 as uuid } from 'uuid'
import { divideOn, discriminate } from './extensions'
import { Entity, Environment, Filled, Linked, List, Name, Node, Package, Scope, Import } from './model'

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
  contributions = new Map<Name, Node<Linked>>()
  includedScopes: Scope[] = []

  constructor(public containerScope?: Scope) { }

  register(contributions: List<[Name, Node<Linked>]>) {
    for(const contribution of contributions)
      this.contributions.set(contribution[0], contribution[1])
  }

  resolve(name: Name, checkContainerScope = true): Node<Linked> | undefined {
    const contributed = this.contributions.get(name)
    if(contributed) return contributed

    for(const includedScope of this.includedScopes) {
      const inherited = (includedScope as LocalScope).resolve(name, false)
      if (inherited) return inherited
    }

    return checkContainerScope ? this.containerScope?.resolve(name) : undefined
  }

  // TODO: unify with resolve?
  resolveQualified(qualifiedName: Name, checkContainerScope = true): Node<Linked> | undefined {
    const [start, rest] = divideOn('.')(qualifiedName)
    const root = this.resolve(start, checkContainerScope)

    if (!root) throw new Error(`Could not resolve qualified name ${start}`)

    return rest.length ? (root.scope as LocalScope).resolveQualified(rest, false) : root
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
    const scope = new LocalScope(
      node.is('Reference') && (parent!.is('Class') || parent!.is('Mixin')) ? parent!.parent().scope : parent?.scope
    )
    assign(node, { scope })

    if(node.is('Entity')) (parent!.scope as LocalScope).register(scopeContribution(node))
  })

  environment.forEach((node, parent) => {
    if(node.is('Environment'))
      (node.scope as LocalScope).register(GLOBAL_PACKAGES.flatMap(globalPackage =>
        (environment.scope.resolveQualified(globalPackage)! as Package<Linked>).members.flatMap(scopeContribution) // TODO: Add Error if not
      ))

    if(node.is('Package') && node.imports.length) {
      const [genericImports, simpleImports] = discriminate((imported: Import<Linked>) => imported.isGeneric)(node.imports)

      const packageScope = node.scope as LocalScope
      const importScope = new LocalScope(packageScope.containerScope)
      
      importScope.register(simpleImports.map(imported => {
        const entity = imported.scope.resolveQualified(imported.entity.name) as Entity<Linked> // TODO: Error if not
        return [entity.name!, entity]
      }))

      importScope.includedScopes.push(...genericImports.map(imported =>
        imported.scope.resolveQualified(imported.entity.name)!.scope //TODO: Add Error if not
      ))

      packageScope.containerScope = importScope
    }

    if(node.is('Module')) {
      (node.scope as LocalScope).includedScopes.push(
        ...node.mixins.map(mixin => node.scope.resolveQualified(mixin.name)!.scope)  //TODO: Add Error if not
      )
        
      if(!node.is('Mixin') && node.superclassRef) {
        (node.scope as LocalScope).includedScopes.push(
          node.scope.resolveQualified(node.superclassRef.name)!.scope  //TODO: Add Error if not
        )
      }
    }

    if(parent && !node.is('Entity')) (parent.scope as LocalScope).register(scopeContribution(node))
  })
}


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (
  newPackages: List<Package<Filled>>,
  baseEnvironment?: Environment<Linked>,
): Environment => {
  // TODO: Would it make life easier if we used fqn where possible as id?
  const environment = new Environment<Linked>({
    id: uuid(),
    scope: null as any,
    members: newPackages.reduce(mergePackage, baseEnvironment?.members ?? []) as List<Package<Linked>>,
  }).transform(node => node.copy({ id: uuid() }))

  environment.forEach((node, parent) => {
    if(parent) node._cache().set('parent()', parent)
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