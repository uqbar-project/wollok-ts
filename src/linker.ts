import { v4 as uuid } from 'uuid'
import { Linked as LinkedBehavior } from './behavior'
import { Environment as buildEnvironment, Package as buildPackage } from './builders'
import { NODE_CACHE, update } from './cache'
import { Entity, Environment, Filled, Linked, List, Package, Raw } from './model'

const mergePackage = (members: List<Entity<Filled> | Entity<Linked>>, isolated: Entity<Filled>): List<Entity<Filled> | Entity<Linked>> => {
  if (!isolated.is('Package')) return [...members, isolated]
  const existent = members.find((member: Entity<Filled>): member is Package<Filled> =>
    member.is('Package') && member.name === isolated.name
  )
  return existent
    ? [
      ...members.filter(member => member !== existent),
      buildPackage(existent.name, existent)(
        ...isolated.members.reduce(mergePackage, existent.members) as List<Entity<Raw>>
      ) as Package<Filled>,
    ]
    : [...members, isolated]
}

export default (newPackages: List<Package<Filled>>, baseEnvironment: Environment = buildEnvironment()): Environment => {

  const mergedEnvironment = buildEnvironment(
    ...newPackages.reduce(mergePackage, baseEnvironment.members) as List<Package<Linked>>,
  )

  const identifiedEnvironment: Environment = LinkedBehavior(mergedEnvironment.transform<Linked, Environment>(node =>
    // TODO: It would make life easier and more performant if we used a fqn where possible as id
    ({ ...node, id: uuid() })
  ))

  identifiedEnvironment.transform(node => {
    update(NODE_CACHE, node.id, node)
    // node.children().forEach(child =>
    //   update(PARENT_CACHE, child.id, node.id)
    // )
    return node
  })

  const environment = LinkedBehavior(identifiedEnvironment)

  environment.transform({
    Reference: node => {
      // TODO: In the future, we should make this fail-resilient
      return node.target()
    },
  })

  // flushAll(NODE_CACHE)

  return environment
}