// import { chain as flatMap, merge } from 'ramda'
import { merge } from 'ramda'
import { v4 as uuid } from 'uuid'
import { children, Class, descendants, Entity, Environment, getNodeById, Id, isModule, Module, Node, Package, parentOf, Scope, transform, Unlinked } from './model'

const mergePackage = (
  members: ReadonlyArray<Entity | Unlinked<Entity>>,
  isolated: Unlinked<Entity>
): ReadonlyArray<Entity | Unlinked<Entity>> => {

  if (isolated.kind !== 'Package') return [...members, isolated]

  const existent = members.find(member => member.kind === isolated.kind && member.name === isolated.name) as Package

  return existent ? [
    ...members.filter(member => member !== existent),
    { ...existent, members: isolated.members.reduce(mergePackage, existent.members) },
  ] : [...members, isolated]
}

export default (
  newPackages: Unlinked<Package>[],
  baseEnvironment: Environment = { kind: 'Environment', members: [], scope: {}, id: uuid() }
): Environment => {

  const mergedEnvironment = { ...baseEnvironment, members: newPackages.reduce(mergePackage, baseEnvironment.members) } as Environment

  const identifiedEnvironment = transform(node => ({ ...node, id: node.id || uuid() }))(mergedEnvironment)

  const scopes = new ScopeBuilder(identifiedEnvironment).build()

  // TODO: const scopedEnvironment = transform(node => ({ ...node, scope: scopes[node.id] }))(linkedEnvironment)
  const scopedEnvironment = {
    ...identifiedEnvironment,
    members: identifiedEnvironment.members.map(transform(node => ({ ...node, scope: scopes[node.id] }))),
  }

  // TODO: assign parent
  // TODO: assign target

  return scopedEnvironment
}

class ScopeBuilder {
  private environment: Environment
  private scopes: Map<Id, Scope | (() => Scope)> = new Map([])

  constructor(environment: Environment) {
    this.environment = environment
    this.scopes.set(environment.id, () => ({}))

    descendants(environment).forEach(node =>
      this.scopes.set(node.id, this.scopeFor(node))
    )
  }

  private innerContributionFrom(contributor: Node): Scope {
    return [
      ...isModule(contributor) ? this.ancestors(contributor).map(ancestor => this.innerContributionFrom(ancestor)) : [],
      ...[contributor, ...children(contributor)].map(c => this.outerContributionFrom(c)),
    ].reduce(merge)
  }

  private outerContributionFrom(contributor: Node): Scope {
    switch (contributor.kind) {
      // TODO: Resolve fully qualified names
      case 'Import':
        const referencedId = this.getScope(contributor.id)[contributor.reference.name]
        const referenced = getNodeById(this.environment, referencedId)
        return contributor.isGeneric
          ? children(referenced)
            .map(child => ({ [(child as Entity).name || '']: child.id }))
            .reduce(merge)
          : { [(referenced as Entity).name || '']: referenced.id }
      case 'Package':
        const globalContributions: Scope = contributor.name === 'wollok'
          ? children(contributor).map(c => this.outerContributionFrom(c)).reduce(merge)
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
        return contributor.name ? { [contributor.name]: contributor.id } : {}
      case 'Variable':
      case 'Field':
      case 'Parameter':
        return { [contributor.name]: contributor.id }
      default:
        return {}
    }
  }

  private ancestors(module: Module): ReadonlyArray<Module> {
    const scope = this.getScope(module.id)

    // TODO: change this to 'wollok.Object' and make getNodeById resolve composed references
    const ObjectClass = getNodeById<Class>(this.environment, scope.Object)

    let superclass

    switch (module.kind) {
      case 'Class':
        superclass = module.superclass
          ? getNodeById<Module>(this.environment, scope[module.superclass.name])
          : ObjectClass

        return [
          ...superclass === module ? [] : [superclass, ...this.ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module>(this.environment, scope[m.name])),
        ]

      case 'Singleton':
        superclass = module.superCall
          ? getNodeById<Module>(this.environment, scope[module.superCall.superclass.name])
          : ObjectClass

        return [
          ...[superclass, ...this.ancestors(superclass)],
          ...module.mixins.map(m => getNodeById<Module>(this.environment, scope[m.name])),
        ]

      case 'Mixin':
        return module.mixins.map(m => getNodeById<Module>(this.environment, scope[m.name]))
    }
  }

  private getScope(id: Id): Scope {
    const scope = this.scopes.get(id)
    if (!scope) throw new Error(`Missing scope for node ${id}`)
    if (scope instanceof Function) {
      const resolvedScope = scope()
      this.scopes.set(id, resolvedScope)
      return resolvedScope
    }
    return scope
  }

  private scopeFor(node: Node): () => Scope {
    return () => {
      const parent = parentOf(this.environment)(node)
      return merge(this.getScope(parent.id), this.innerContributionFrom(parent))
    }
  }

  build(): { [id: string]: Scope } {
    return descendants(this.environment).reduce((scope, node) =>
      merge(scope, { [node.id]: this.scopeFor(node)() })
      , {})
  }
}