import { Id, Node } from './model'

export type Cache<T> = { [key: string]: T }


export const NODE_CACHE: Cache<Node<'Linked'>> = {}
export const PARENT_CACHE: Cache<Id<'Linked'>> = {}


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