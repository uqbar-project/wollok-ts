import { v4 as uuid } from 'uuid'
import { Entity, Environment, Package, transform } from './model'

export default (newPackages: Package[], baseEnvironment: Environment = { members: [] }): Environment => {

  const mergePackage = (members: ReadonlyArray<Entity>, isolated: Entity): ReadonlyArray<Entity> => {
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

  const linkedEnvironment: Environment = {
    ...mergedEnvironment,
    members: mergedEnvironment.members.map(transform(node => ({ ...node, id: uuid() }))),
  }

  return linkedEnvironment
}

// export const scope = (node: Linked<Node>) => {

//   const contributions = (contributor: Linked<Node>): { [name: string]: Id } => {
//     switch (contributor.kind) {
//       case 'Package':
//         return contributor.name === 'wollok'
//           ? children(contributor).map(contributions).reduce(merge, { [contributor.name]: contributor.id })
//           : { [contributor.name]: contributor.id }
//       case 'Singleton':
//       case 'Class':
//       case 'Mixin':
//         return ancestors(contributor).map(contributions).reduce(merge, contributor.name ? { [contributor.name]: contributor.id } : {})
//       case 'Variable':
//       case 'Field':
//       case 'Parameter':
//         return { [contributor.name]: contributor.id }
//       default: return {}
//     }
//   }

//   const entries = (source: Linked<Node>): { [name: string]: Id } => {
//     const parent = parentOf(source)
//     const entriesFromParent = scope(parent)
//     const entriesFromSiblings = children(parent).map(contributions).reduce(merge, {}) // TODO: What about If?
//     const entriesFromAncestors = isModule(parent) ? contributions(parent) : {}

//     return { ...entriesFromParent, ...entriesFromSiblings, ...entriesFromAncestors }
//   }

//   return entries(node)
// }

// ---------------------------------------------------------------------------------------------------------------


// case class Environment(members: Seq[Member[Package]] = Nil) extends Node {
//   implicit val self: Environment = this

// TODO: get node from id / reference?
// TODO: parenthood
