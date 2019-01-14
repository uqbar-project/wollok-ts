import { List } from './model'

export const last = <T>(xs: List<T>): T | undefined => xs[xs.length - 1]

export const flatMap = <T, R>(tx: (elem: T) => List<R>) => (elems: List<T>): R[] => {
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