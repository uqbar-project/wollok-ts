// import { chain as flatMap, merge } from 'ramda'
import { v4 as uuid } from 'uuid'
import { Entity, Environment, Package, transform, Unlinked } from './model'

export default (newPackages: Unlinked<Package>[], baseEnvironment: Environment = { members: [] }): Environment => {

  const mergePackage = (members: ReadonlyArray<Entity | Unlinked<Entity>>,
                        isolated: Unlinked<Entity>): ReadonlyArray<Entity | Unlinked<Entity>> => {
    if (isolated.kind !== 'Package') return [...members, isolated]

    const existent = members.find(member => member.kind === isolated.kind && member.name === isolated.name) as Package

    return existent ? [
      ...members.filter(member => member !== existent),
      { ...existent, members: isolated.members.reduce(mergePackage, existent.members) },
    ] : [...members, isolated]

    // TODO: Alternative merge
    // const identifier = (node: Entity) => {
    //   switch (node.kind) {
    //     case 'Test': return node.description
    //     default: return node.name
    //   }
    // }

    // const mergeInto = (entities: ReadonlyArray<Entity>, entity: Entity): ReadonlyArray<Entity> => {
    //   switch (entity.kind) {
    //     case 'Package':
    //       const preExistent = entities.findIndex(child => identifier(child) === identifier(entity))
    //       if (preExistent >= 0) {
    //         const preExistentNode = entities[preExistent]
    //         if (preExistentNode.kind === 'Package') {
    //           return adjust(over(lensProp('members'), ms => entity.members.reduce(mergeInto, ms)), preExistent, entities)
    //         } else return update(preExistent, entity, entities)
    //       } else return [...entities, entity]
    //     default: return uniqBy(identifier)([entity, ...entities])
    //   }
    // }

    // return over(lensProp('members'), ms => newPackages.reduce(mergeInto, ms), baseEnvironment)
  }

  const mergedEnvironment = { ...baseEnvironment, members: newPackages.reduce(mergePackage, baseEnvironment.members) }

  // TODO: Environment should be a node to avoid all this mapping and reducing
  const linkedEnvironment: Environment = {
    ...mergedEnvironment,
    members: mergedEnvironment.members.map(member => transform(node => ({ ...node, id: uuid() }))(member as any) as Package),
  }

  return linkedEnvironment

  // const scopes = new ScopeBuilder(linkedEnvironment).build()

  // const scopedEnvironment = {
  //   ...linkedEnvironment,
  //   members: linkedEnvironment.members.map(transform(node => ({ ...node, scope: scopes[node.id] }))),
  // }

  // return scopedEnvironment
}

// type LazyScope = Scope | (() => Scope)
// class ScopeBuilder {
//   private environment: Environment
//   private innerContributions: { [id: string]: LazyScope } = {}
//   private outerContributions: { [id: string]: LazyScope } = {}
//   private scopes: { [id: string]: LazyScope } = {}

//   constructor(environment: Environment) {
//     this.environment = environment

//     environment.members.reduce<ScopeBuilder>(
//       reduce((sb, node) => {
//         sb.innerContributions[node.id] = sb.innerContributionFrom(node)
//         sb.outerContributions[node.id] = sb.outerContributionFrom(node)
//         return sb
//       })
//       , this)
//   }

//   private innerContribution(id: Id): Scope {
//     const lazyContribution = this.innerContributions[id]
//     if (lazyContribution instanceof Function) {
//       const contribution = lazyContribution()
//       this.innerContributions[id] = contribution
//       return contribution
//     }
//     return lazyContribution
//   }

//   private outerContribution(id: Id): Scope {
//     const lazyContribution = this.outerContributions[id]
//     if (lazyContribution instanceof Function) {
//       const contribution = lazyContribution()
//       this.outerContributions[id] = contribution
//       return contribution
//     }
//     return lazyContribution
//   }

//   private innerContributionFrom(contributor: Linked<Node>): LazyScope {
//     return () => [
//       ...isModule(contributor)
//         ? flatMap(ancestor =>
//           this.innerContribution(ancestor.id)
//           , this.ancestors(contributor))
//         : [],
//       ...[contributor, ...children(contributor)].map(c => this.outerContribution(c.id)),
//     ].reduce(merge)
//   }

//   private outerContributionFrom(contributor: Linked<Node>): LazyScope {
//     switch (contributor.kind) {
//       // TODO: Resolve fully qualified names
//       case 'Import':
//         return () => {
//           const referencedId = this.scopeFor(contributor)[contributor.reference.name]
//           const referenced = getNodeById(this.environment, referencedId)
//           return contributor.isGeneric
//             ? children(referenced)
//               .map(child => ({ [(child as Entity).name]: child.id }))
//               .reduce(merge)
//             : { [(referenced as Entity).name]: referenced.id }
//         }
//       case 'Package':
//         return () => {
//           const globalContributions: Scope = contributor.name === 'wollok'
//             ? children(contributor).map(c => this.outerContribution(c.id)).reduce(merge)
//             : {}
//           return {
//             [contributor.name]: contributor.id,
//             ...globalContributions,
//           }
//         }
//       case 'Singleton':
//       case 'Class':
//       case 'Mixin':
//       case 'Program':
//         // TODO: rename Test.description to Test.name
//         // case 'Test':
//         return contributor.name ? { [contributor.name]: contributor.id } : {}
//       case 'Variable':
//       case 'Field':
//       case 'Parameter':
//         return { [contributor.name]: contributor.id }
//       default:
//         return {}
//     }
//   }

//   private ancestors(module: Linked<Module>): ReadonlyArray<Linked<Module>> {
//     switch (module.kind) {
//       case 'Class': return [
//         ...module.superclass ? [module.superclass.id] : [],
//         ...module.mixins.map(m => this.scopeFor(module)[m.name]),
//         ...this.ancestors(getNodeById<Linked<Module>>(this.environment, module.superclass
// ? module.superclass.id : this.scopeFor(module).Object)),
//       ]

//       case 'Singleton': return [
//         ...module.superCall ? [module.superCall.superclass.id] : [],
//         ...module.mixins.map(m => m.id),
//         ...this.ancestors(getNodeById(this.environment, module.superCall
// ? module.superCall.superclass.id : this.scopeFor(module).Object)),
//       ]

//       case 'Mixin': return [
//         ...module.mixins.map(m => m.id),
//       ]
//     }
//   }

//   private scopeFor(node: Linked<Node>): Scope {
//     const parent = parentOf(this.environment)(node)
//     if (!this.scopes[parent.id]) {
//       this.scopes[parent.id] = this.scopeFor(parent)
//     }

//     return merge(this.scopes[parent.id], this.innerContribution(parent.id))
//   }

//   build(): { [id: string]: Scope } {
//     return this.environment.members.reduce<{ [id: string]: Scope }>(
//       reduce((scope, node) => merge(scope, { [node.id]: this.scopeFor(node) }))
//       , {})
//   }
// }

  // TODO: get node from id / reference?