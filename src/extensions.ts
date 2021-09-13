import { List } from './model'
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

export const isEmpty = <T>(value: ConcatArray<T> | List<T> | undefined): boolean => (value?.length || 0) === 0

export const notEmpty = <T>(value: ConcatArray<T> | List<T> | undefined): boolean => (value?.length || 0) > 0