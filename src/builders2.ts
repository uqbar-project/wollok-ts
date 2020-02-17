import { mapObject } from './extensions'
import * as Model from './model2'
import { isNode } from './model2'

const { isArray } = Array

export function fromJSON<T>(json: any): T {
  const propagate = (data: any) => {
    if (isNode(data)) {
      const constructor: new (...args: any[]) => any = Model[data.kind]
      return new constructor(mapObject(fromJSON, data))
    }
    if (isArray(data)) return data.map(fromJSON)
    if (data instanceof Object) return mapObject(fromJSON, data)
    return data
  }
  return propagate(json) as T
}
