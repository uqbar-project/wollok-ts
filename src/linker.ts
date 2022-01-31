import { v4 as uuid } from 'uuid'
import { Id } from '.'
import { divideOn, List } from './extensions'
import { BaseProblem, Entity, Environment, Level, Name, Node, Package, Scope, Reference, SourceMap } from './model'
const { assign } = Object


export const GLOBAL_PACKAGES = ['wollok.lang', 'wollok.lib', 'wollok.game']


export class LinkError implements BaseProblem {
  constructor(public code: Name){}

  get level(): Level { return 'error' }
  get values(): List<string> { return [] }
  get sourceMap(): SourceMap | undefined { return undefined }
}

const fail = (code: Name) => (node: Reference<Node>) =>
  assign(node, { problems: [...node.problems ?? [], new LinkError(code)] })

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MERGING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const mergePackage = (members: List<Entity>, isolated: Entity): List<Entity> => {
  if (!isolated.is('Package')) return [...members.filter(({ name }) => name !== isolated.name), isolated]
  const existent = members.find((member: Entity): member is Package =>
    member.is('Package') && member.name === isolated.name)
  return existent
    ? [
      ...members.filter(member => member !== existent),
      existent.copy({ members: isolated.members.reduce(mergePackage, existent.members) }) as Package,
    ]
    : [...members, isolated]
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SCOPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class LocalScope implements Scope {
  protected contributions = new Map<Name, Node>()
  protected includedScopes: Scope[] = []

  constructor(public containerScope?: Scope, ...contributions: [ Name, Node][]) {
    this.register(...contributions)
  }

  resolve<N extends Node>(qualifiedName: Name, allowLookup = true):  N | undefined {
    const [start, rest] = divideOn('.')(qualifiedName)

    const step = !allowLookup
      ? this.contributions.get(start)
      : this.includedScopes.reduce((found, included) =>
        found ?? included.resolve(start, false)
      , this.contributions.get(start)) ?? this.containerScope?.resolve(start, allowLookup)

    return rest.length ? step?.scope?.resolve<N>(rest, false) : step as N
  }

  register(...contributions: [ Name, Node][]): void {
    for(const [name, node] of contributions) this.contributions.set(name, node)
  }

  include(...others: Scope[]): void { this.includedScopes.push(...others) }
}


const scopeContribution = (contributor: Node): List<[Name, Node]> => {
  if (
    contributor.is('Entity') ||
    contributor.is('Field') ||
    contributor.is('Parameter')
  ) return contributor.name ? [[contributor.name, contributor]] : []

  return []
}


const assignScopes = (environment: Environment) => {
  environment.forEach((node, parent) => {
    assign(node, {
      scope: new LocalScope(
        node.is('Reference') && parent!.is('ParameterizedType')
          ? parent!.parent.scope
          : parent?.scope
      ),
    })

    if(node.is('Entity'))
      parent!.scope.register(...scopeContribution(node))
  })

  environment.forEach((node, parent) => {
    if(node.is('Environment')){
      for(const globalName of GLOBAL_PACKAGES) {
        const globalPackage = environment.scope.resolve<Package>(globalName)
        if(globalPackage) node.scope.register(...globalPackage.members.flatMap(scopeContribution))
      }
    }

    if(node.is('Package')) {
      for(const imported of node.imports) {
        const entity = node.parent.scope.resolve<Entity>(imported.entity.name)

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
  newPackages: List<Package>,
  baseEnvironment?: Environment,
): Environment => {
  const environment = new Environment({
    id: uuid(),
    scope: null as any,
    members: newPackages.reduce(mergePackage, baseEnvironment?.members ?? []) as List<Package>,
  }).transform(node => node.copy({ id: uuid() }))

  const nodeCache = new Map<Id, Node>()
  environment.forEach((node, parent) => {
    nodeCache.set(node.id, node)
    node.environment = environment
    if(parent) node.parent = parent
  })
  environment.nodeCache = nodeCache

  assignScopes(environment)

  // TODO: Move to validator?
  environment.forEach(node => {
    if(node.is('Reference') && !node.target()) fail('missingReference')(node)
  })

  return environment
}