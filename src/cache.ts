import { Id, Linked, Node } from './model'

export type Cache<T> = { [key: string]: T }

// TODO: What if... Cache was a saved on the environment?
// Since we have immutable nodes, you always need to change the root to make a change.
// Maybe that can be used as auto-flush?
export const NODE_CACHE: Cache<Node<Linked>> = {}
export const PARENT_CACHE: Cache<Id> = {}


export const getOrUpdate = <T>(cache: Cache<T>, key: string) => (definition: () => T): T => {
  const cached = cache[key] as T
  if (cached !== undefined) return cached
  return update(cache, key, definition())
}

export const update = <T>(cache: Cache<T>, key: string, value: T): T => cache[key] = value

export const flush = (cache: Cache<any>, key: string) => {
  delete cache[key]
}

export const flushAll = (cache: Cache<any>) => {
  for (const key in cache) flush(cache, key)
}