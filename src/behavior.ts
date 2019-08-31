import { flatMap } from './extensions'
import { Filled as FilledStage, is, isNode, Linked as LinkedStage, List, Node, Raw as RawStage } from './model'

const { isArray } = Array
const { values } = Object

// TODO: Test all behaviors

export type Methods<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T]

export const Raw = <N extends Node<RawStage>>(obj: Partial<N>): N => {
  const node = { ...obj } as N

  node.children = function <T extends Node<RawStage>>(): List<T> {
    const extractChildren = (owner: any): List<T> => {
      if (isNode(owner)) return [owner as T]
      if (isArray(owner)) return flatMap(extractChildren)(owner)
      if (owner instanceof Object) return flatMap(extractChildren)(values(owner))
      return []
    }
    return flatMap(extractChildren)(values(this))
  }

  node.descendants = function <T extends Node<RawStage>>(filter?: (node: Node<RawStage>) => node is T): List<T> {
    const directDescendants = this.children<Node<RawStage>>()
    const indirectDescendants = flatMap<Node<RawStage>>(child => child.descendants(filter))(directDescendants)
    const descendants = [...directDescendants, ...indirectDescendants]
    return filter ? descendants.filter(filter) : descendants as any
  }

  // TODO: Can we do this with transformByKind?
  // TODO: If this is used on Filled and Linked we shouldn't hardcode it to RawStage
  if (is('Class')(node)) {
    node.methods = function () { return this.members.filter(is('Method')) }
    node.fields = function () { return this.members.filter(is('Field')) }
    node.constructors = function () { return this.members.filter(is('Constructor')) }
  }

  if (is('Mixin')(node)) {
    node.methods = function () { return this.members.filter(is('Method')) }
    node.fields = function () { return this.members.filter(is('Field')) }
  }

  if (is('Singleton')(node)) {
    node.methods = function () { return this.members.filter(is('Method')) }
    node.fields = function () { return this.members.filter(is('Field')) }
  }

  if (is('Describe')(node)) {
    node.tests = function () { return this.members.filter(is('Test')) }
  }

  return node
}

export const Filled = <N extends Node<FilledStage>>(obj: Partial<N>): N => {
  const node = Raw(obj) as N

  return node
}

export const Linked = <N extends Node<LinkedStage>>(obj: Partial<N>): N => {
  const node = Filled(obj as Node<FilledStage>) as N

  return node
}