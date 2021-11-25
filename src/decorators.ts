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
  const originalMethod: Function = descriptor.value
  descriptor.value = function (this: {[CACHE]: Cache | undefined}, ...args: any[]) {
    const cache = getCache(this)
    const key = `${propertyKey}(${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)})`
    if (cache.has(key)) return cache.get(key)
    const result = originalMethod.apply(this, args)
    cache.set(key, result)
    return result
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LAZY
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function lazy(target: any, key: string): void {
  defineProperty(target, key, {
    configurable: true,
    set(value: any) { return defineProperty(this, key, { value, configurable: false }) },
    get() { return undefined },
  })
}