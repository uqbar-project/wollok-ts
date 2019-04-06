import { List } from './model'

const { keys } = Object

export const last = <T>(xs: List<T>): T | undefined => xs[xs.length - 1]

export const flatMap = <T, R = T>(tx: (elem: T) => List<R>) => (elems: List<T>): R[] => {
  const response: R[] = []
  for (const elem of elems) {
    response.push(...tx(elem))
  }
  return response
}

export const zipObj = (fieldNames: List<string>, fieldValues: List<any>): {} => {
  const response: any = {}
  for (let i = 0; i < fieldNames.length; i++) {
    response[fieldNames[i]] = fieldValues[i]
  }
  return response
}

export const mapObject = <T, R = any>(tx: (value: T[keyof T], key: keyof T) => R, obj: T): { [K in keyof T]: R } => {
  const response: any = {}
  for (const key of keys(obj)) {
    response[key] = tx((obj as any)[key], key as keyof T)
  }
  return response
}

export const without = <T>(ignores: List<T>) => (elements: List<T>): List<T> =>
  elements.filter(it => !ignores.includes(it))

