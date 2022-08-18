import { raise } from './extensions'

const { defineProperty } = Object

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CACHE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Cache = Map<string, any>

const CACHE = Symbol('cache')

export function getCache(target: any): Cache {
  if(!target[CACHE]) defineProperty(target, CACHE, { value: new Map() })
  return target[CACHE]
}

export function cached(_target: any, propertyKey: string, descriptor: PropertyDescriptor): void {
  const handler =
      typeof descriptor.value === 'function' ? { get(){ return descriptor.value }, set(value: any){ descriptor.value = value } } :
      typeof descriptor.get === 'function' ? { get(){ return descriptor.get }, set(value: any){ descriptor.get = value } } :
      raise(new TypeError(`Can't cache ${propertyKey}: Only methods and properties can be cached`))

  const originalDefinition = handler.get()
  handler.set(function (this: any, ...args: any[]) {
    const cache = getCache(this)
    const key = `${propertyKey}(${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)})`
    if (cache.has(key)) return cache.get(key)
    const result = originalDefinition.apply(this, args)
    cache.set(key, result)
    return result
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LAZY
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function lazy(target: any, key: string): void {
  defineProperty(target, key, {
    configurable: true,
    set(value: any) { return defineProperty(this, key, { value, configurable: false }) },
    get() { throw new Error(`Tried to access uninitialized lazy property ${key}`) },
  })
}