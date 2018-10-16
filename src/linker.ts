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


  const mergedEnvironment = { ...baseEnvironment, members: newPackages.reduce(mergePackage, baseEnvironment.members) }

  const linkedEnvironment: Environment = {
    ...mergedEnvironment,
    members: mergedEnvironment.members.map(member => transform(node => ({ ...node, id: uuid() }))(member as any) as Package),
  }

  const scopes = new ScopeBuilder(linkedEnvironment).build()

  const scopedEnvironment = {
    ...linkedEnvironment,
    members: linkedEnvironment.members.map(transform(node => ({ ...node, scope: scopes[node.id] }))),
  }

  return scopedEnvironment
}

type LazyScope = Scope | (() => Scope)
class ScopeBuilder {
  private environment: Environment
  private innerContributions: { [id: string]: LazyScope } = {}
  private outerContributions: { [id: string]: LazyScope } = {}
  private scopes: { [id: string]: LazyScope } = {}

  constructor(environment: Environment) {
    this.environment = environment

    descendants(environment).reduce((sb, node) => {
      sb.innerContributions[node.id] = sb.innerContributionFrom(node)
      sb.outerContributions[node.id] = sb.outerContributionFrom(node)
      return sb
    }, this)
  }

  private innerContribution(id: Id): Scope {
    const lazyContribution = this.innerContributions[id]
    if (lazyContribution instanceof Function) {
      const contribution = lazyContribution()
      this.innerContributions[id] = contribution
      return contribution
    }
    return lazyContribution
  }

  private outerContribution(id: Id): Scope {
    const lazyContribution = this.outerContributions[id]
    if (lazyContribution instanceof Function) {
      const contribution = lazyContribution()
      this.outerContributions[id] = contribution
      return contribution
    }
    return lazyContribution
  }

  private innerContributionFrom(contributor: Node): LazyScope {
    return () => [
      ...isModule(contributor)
        ? this.ancestors(contributor).map(ancestor => this.innerContribution(ancestor.id))
        : [],
      ...[contributor, ...children(contributor)].map(c => this.outerContribution(c.id)),
    ].reduce(merge)
  }

  private outerContributionFrom(contributor: Node): LazyScope {
    switch (contributor.kind) {
      // TODO: Resolve fully qualified names
      case 'Import':
        return () => {
          const referencedId = this.scopeFor(contributor)[contributor.reference.name]
          const referenced = getNodeById(this.environment, referencedId)
          return contributor.isGeneric
            ? children(referenced)
              .map(child => ({ [(child as Entity).name || '']: child.id }))
              .reduce(merge)
            : { [(referenced as Entity).name || '']: referenced.id }
        }
      case 'Package':
        return () => {
          const globalContributions: Scope = contributor.name === 'wollok'
            ? children(contributor).map(c => this.outerContribution(c.id)).reduce(merge)
            : {}
          return {
            [contributor.name]: contributor.id,
            ...globalContributions,
          }
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
    const scope = this.scopeFor(module)
    const ObjectClass = getNodeById<Class>(this.environment, scope['wollok.Object'])
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

  private scopeFor(node: Node): Scope {
    if (node === this.environment) return this.environment.scope
    const parent = parentOf(this.environment)(node)
    if (!this.scopes[parent.id]) {
      this.scopes[parent.id] = this.scopeFor(parent)
    }

    return merge(this.scopes[parent.id], this.innerContribution(parent.id))
  }

build(): { [id: string]: Scope } {
    return descendants(this.environment).reduce((scope, node) =>
      merge(scope, { [node.id]: this.scopeFor(node) })
      , {})
  }
}

  // TODO: get node from id / reference?