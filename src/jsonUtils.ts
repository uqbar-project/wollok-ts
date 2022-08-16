import { mapObject } from './extensions'
import * as Models from './model'

const { isArray } = Array

export function fromJSON<T>(json: any): T {
  const propagate = (data: any) => {
    if (isArray(data)) return data.map(fromJSON)
    if (data instanceof Object) {
      if ('kind' in data) {
        const { kind, ...payload } = mapObject(fromJSON, data)
        const constructor = Models[kind as keyof typeof Models] as new (...args: any) => any
        return new constructor(payload)
      } else return mapObject(fromJSON, data)
    }
    return data
  }
  return propagate(json) as T
}