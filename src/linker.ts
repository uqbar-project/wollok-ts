import { mergeDeepWith, uniqBy } from 'ramda'
import { Environment, isClassMember, isEntity, isNode, Package } from './model'

const { isArray } = Array

export default (newPackages: Package[], baseEnvironment: Environment = { members: [] }): Environment =>
  // const merge = (members: ReadonlyArray<Entity>, isolated: Entity): ReadonlyArray<Entity> => {
  //   if (isolated.kind !== 'Package') return [...members, isolated]

  //   const existent = members.find(member => member.kind === isolated.kind && member.name === isolated.name) as Package

  //   return existent ? [
  //     ...members.filter(member => member !== existent),
  //     { ...existent, members: isolated.members.reduce(merge, existent.members) },
  //   ] : [...members, isolated]
  // }

  // return { ...baseEnvironment, members: newPackages.reduce(merge, baseEnvironment.members) }

  mergeDeepWith<Environment, Environment>((left, right) =>
    isArray(left) && isArray(right)
      ? uniqBy(obj => {
        if (!isNode(obj)) return obj
        switch (obj.kind) {
          case 'Test': return obj.description
          case 'Constructor': return `<init ${obj.parameters.length}>`
          default: return isEntity(obj) || isClassMember(obj) ? obj.name : obj
        }
      })([...right.reverse(), ...left.reverse()]).reverse()
      : right
  )(baseEnvironment, { members: newPackages })


// ---------------------------------------------------------------------------------------------------------------


// case class Environment(members: Seq[Member[Package]] = Nil) extends Node {
//   implicit val self: Environment = this

//   def apply[T <: Node](id: Id): T = cache(id).asInstanceOf[T]
//   def apply[T <: Node](fqr: FullyQualifiedReference): T = fqr.target.asInstanceOf[T]
//   def apply[T <: Node](fqr: String): T = ((this: Node) /: fqr.split('.')){ case (parent, step) =>
//     parent.children.collectFirst { case c: Referenceable if c.name == step => c }.getOrElse {
//       throw new RuntimeException(s"Reference to missing module $fqr")
//     }
//   }.asInstanceOf[T]

//   lazy val cache: Map[Id, Node] = {
//     def entries(node: Node): Seq[(Id, Node)] = (node.id -> node) +: node.children.flatMap(entries)
//     entries(this).toMap
//   }

//   lazy val parenthood: Map[Id, Id] = {
//     def entries(node: Node): Seq[(Id, Id)] = node.children.map { _.id -> node.id } ++ node.children.flatMap(entries)
//     entries(this).toMap
//   }

//   private val scopes = collection.mutable.Map[Id, Map[Name, Id]]()
//   def scopeFor(node: Node): Map[Name,Id] = {

//     def scopeContributions(node: Node): Map[Name, Id] = node match {
//       case node: Singleton                => if (node.name != "") Map(node.name -> node.id) else Map()
//       case node: Package if node.name == "wollok" => Map((node.name -> node.id) +: node.children.flatMap(scopeContributions):_*)
//       case node: Referenceable            => Map(node.name -> node.id)
//       case _                              => Map()
//     }

//     def scopeEntries(node: Node): Map[Name,Id] = Map(node.parent.map { parent =>
//       val entriesFromParent: Seq[(Name,Id)] = scopeFor(parent).toSeq
//       val entriesFromSiblings: Seq[(Name,Id)] = parent.children.flatMap(scopeContributions)
//       val entriesFromAncestors: Seq[(Name,Id)] = parent match {
//         case node: Module => node.allMembers.flatMap(scopeContributions)
//         case _ => Nil
//       }

//       entriesFromParent ++ entriesFromSiblings ++ entriesFromAncestors
//     }.getOrElse(Nil) : _*)

//     scopes.getOrElseUpdate(node.id, scopeEntries(node))
//   }
// }
