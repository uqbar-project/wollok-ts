import { Filled as FilledStage, is, Linked as LinkedStage, Node, Raw as RawStage } from './model'

export type Methods<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T]

export const Raw = <N extends Node<RawStage>>(obj: Partial<N>): N => {
  const node = { ...obj } as N

  if (is('Class')<RawStage>(node)) {
    node.methods = () => node.members.filter(is('Method'))
    node.fields = () => node.members.filter(is('Field'))
    node.constructors = () => node.members.filter(is('Constructor'))
  }

  if (is('Mixin')<RawStage>(node)) {
    node.methods = () => node.members.filter(is('Method'))
    node.fields = () => node.members.filter(is('Field'))
  }

  if (is('Singleton')<RawStage>(node)) {
    node.methods = () => node.members.filter(is('Method'))
    node.fields = () => node.members.filter(is('Field'))
  }

  if (is('Describe')<RawStage>(node)) {
    node.tests = () => node.members.filter(is('Test'))
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