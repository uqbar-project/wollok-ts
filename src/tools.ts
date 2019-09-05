import { mapObject } from './extensions'
import { isNode, Kind, KindOf, Node, NodeOfKind, Stage } from './model'

const { isArray } = Array

// TODO: Test all this

// TODO: Extract applyTransform into single propagate function
// TODO: Or join transform and transformByKind in the same method
export const transform = <S extends Stage, R extends Stage = S>(tx: (node: Node<S>) => Node<R>) =>
  <N extends Node<S>, U extends Node<R> = N extends Node<R> ? N : Node<R>>(node: N): U => {
    const applyTransform = (obj: any): any =>
      typeof obj === 'function' ? obj :
        isNode<S>(obj) ? mapObject(applyTransform, tx(obj) as any) :
          isArray(obj) ? obj.map(applyTransform) :
            obj instanceof Object ? mapObject(applyTransform, obj) :
              obj

    return applyTransform(node)
  }

export const transformByKind = <S extends Stage, R extends Stage = S>(
  tx: { [K in Kind]?: (after: NodeOfKind<K, R>, before: NodeOfKind<K, S>) => NodeOfKind<K, R> },
  defaultTx: (transformed: Node<R>, node: Node<S>) => Node<R> = node => node,
) =>
  <N extends Node<S>, K extends KindOf<N> = KindOf<N>>(node: N): NodeOfKind<K, R> => {
    const applyTransform = (obj: any): any =>
      typeof obj === 'function' ? obj :
        isNode<S>(obj) ? (tx[obj.kind] || defaultTx as any)(mapObject(applyTransform, obj as any), obj) :
          isArray(obj) ? obj.map(applyTransform) :
            obj instanceof Object ? mapObject(applyTransform, obj) :
              obj

    return applyTransform(node)
  }

export const reduce = <T, S extends Stage>(tx: (acum: T, node: Node<S>) => T) => (initial: T, node: Node<S>): T =>
  (node as any).children().reduce(reduce(tx), tx(initial, node))