import { v4 as uuid } from 'uuid'
import { divideOn } from './extensions'
import { Entity, Environment, Filled, Linked, List, Name, Node, Package, Scope, Problem, Reference, NodeOfKindOrCategory, Kind, Category, Stage } from './model'
const { assign } = Object


const GLOBAL_PACKAGES = ['wollok.lang', 'wollok.lib']


export class LinkError extends Problem {
  constructor(public code: Name){ super() }
}

const fail = (code: Name) => (node: Reference<any, Linked>) =>
  assign(node, { problems: [...node.problems ?? [], new LinkError(code)] })

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

  constructor(public containerScope?: Scope, ...contributions: [ Name, Node<Linked>][]) {
    this.register(...contributions)
  }
  
  resolve(qualifiedName: Name, allowLookup = true): Node<Linked> | undefined {
    const [start, rest] = divideOn('.')(qualifiedName)
  
    const step = !allowLookup
      ? this.contributions.get(start)
      : this.includedScopes.reduce((found, included) =>
        found ?? included.resolve(start, false)
      , this.contributions.get(start)) ?? this.containerScope?.resolve(start, allowLookup)
  
    return rest.length ? step?.scope?.resolve(rest, false) : step
  }

  register(...contributions: [ Name, Node<Linked>][]): void {
    for(const [name, node] of contributions) this.contributions.set(name, node)
  }

  include(...others: Scope[]) { this.includedScopes.push(...others) }
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
    if(node.is('Environment')){
      for(const globalName of GLOBAL_PACKAGES) {
        const globalPackage = environment.scope.resolve(globalName) as Package<Linked>
        if(globalPackage) node.scope.register(...globalPackage.members.flatMap(scopeContribution))
      }
    }
    
    if(node.is('Package')) {
      for(const imported of node.imports) {
        const entity = node.scope.resolve(imported.entity.name) as Entity<Linked>
          
        if(entity) node.scope.include(imported.isGeneric
          ? entity.scope
          : new LocalScope(undefined, [entity.name!, entity])
        )
      }
    }

    if(node.is('Module'))
      node.scope.include(...node.hierarchy().slice(1).map(supertype => supertype.scope))

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

  // TODO: Move to validator?
  environment.forEach(node => {
    if(node.is('Reference') && !node.target()) fail('missingReference')(node)
  })  

  return environment
}