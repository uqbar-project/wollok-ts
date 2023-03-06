export const keys = Object.keys as <T>(o: T) => (Extract<keyof T, string>)[]

export const last = <T>(xs: ReadonlyArray<T>): T | undefined => xs[xs.length - 1]

export const divideOn = (separator: string) => (str: string): [string, string] => {
  const [head, ...tail] = str.split(separator)
  return [head, tail.join(separator)]
}

export const get = <T>(obj: any, path: string): T | undefined => path.split('.').reduce((current, step) => current?.[step], obj)

export function discriminate<A, B = unknown>(isA: (obj: A|B) => obj is A): (list: ReadonlyArray<A | B>) => [A[], B[]]
export function discriminate<T>(isA: (obj: T) => boolean): (list: ReadonlyArray<T>) => [T[], T[]]
export function discriminate<T>(isA: (obj: T) => boolean) {
  return (list: ReadonlyArray<T>): [T[], T[]] => {
    const as: T[] = []
    const bs: T[] = []

    for(const member of list)
      if(isA(member)) as.push(member)
      else bs.push(member)

    return [as, bs]
  }
}

export const zipObj = (fieldNames: ReadonlyArray<string>, fieldValues: ReadonlyArray<any>): Record<string, any> => {
  const response: any = {}
  for (let i = 0; i < fieldNames.length; i++) {
    response[fieldNames[i]] = fieldValues[i]
  }
  return response
}

export const mapObject = <T, R = any>(tx: (value: T[keyof T], key: keyof T) => R, obj: T): { [K in keyof T]: R } => {
  const response = {} as { [K in keyof T]: R }
  for (const key of keys(obj)) {
    response[key] = tx(obj[key], key)
  }
  return response
}


export const sum = (array: ReadonlyArray<number>): number => array.reduce((acum, elem) => acum + elem, 0)
export const sumBy = <T>(array: ReadonlyArray<T>, tx: (elem: T) => number): number => array.reduce((acum, elem) => acum + tx(elem), 0)

export const traverse = <R>(generator: Generator<unknown, R>): R => {
  let result = generator.next()
  while(!result.done) result = generator.next()
  return result.value
}

export const hash = (str: string): number => {
  let hashValue = 0
  for (let index = 0; index < str.length; index++) {
    hashValue += str.charCodeAt(index) << index * 8
  }
  return hashValue
}

export type List<T> = ReadonlyArray<T>

export const isEmpty = <T>(value: List<T> | undefined): boolean => !notEmpty(value)

export const notEmpty = <T>(value: List<T> | undefined): boolean => (value?.length ?? 0) > 0

export const duplicates = <T>(list: List<T>): List<T> => list.filter((element: T, i: number) => list.includes(element, i + 1))

export const count = <T>(list: List<T>, condition: (element: T) => boolean): number => list.filter(condition).length

export function raise(error: Error): never { throw error }


export const MIXINS = Symbol('mixins')

export type TypeDefinition<T> = ClassDefinition<T> | MixinDefinition<T>
export type ClassDefinition<T> = abstract new (...args: any) => T
export type MixinDefinition<T> = (...args: any) => ClassDefinition<T>
export type Mixable<T> = ClassDefinition<T> & {[MIXINS]?: MixinDefinition<T>[]}

export type ConstructorFor<D extends TypeDefinition<any>> = D extends TypeDefinition<infer T> ? ClassDefinition<T> : never
export type InstanceOf<D extends TypeDefinition<any>> = InstanceType<ConstructorFor<D>>

export const is = <D extends TypeDefinition<any>>(definition: D) => (obj: any): obj is InstanceOf<D> => {
  return !!obj && (obj instanceof definition || (obj.constructor as any)[MIXINS]?.includes(definition))
}

export const match = <T>(matched: T) =>
  <R, Cs extends any[]>(...cases: {[i in keyof Cs]: readonly [TypeDefinition<Cs[i]>, (m: Cs[i]) => R] }): R => {
    for(const [key, handler] of cases)
      if(is(key)(matched)) return handler(matched)
    throw new Error(`${matched} exhausted all cases without a match`)
  }

export const when = <T>(definition: TypeDefinition<T>) => <R>(handler: (m: T) => R) => [definition, handler] as const