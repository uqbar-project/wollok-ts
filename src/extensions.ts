import { List } from './model'

export const keys = <T>(obj: T) => Object.keys(obj) as (keyof T)[]

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
  const response = {} as { [K in keyof T]: R }
  for (const key of keys(obj)) {
    response[key] = tx(obj[key], key)
  }
  return response
}

export const copy = <T extends {}>(target: T): T => ({ ...target })
