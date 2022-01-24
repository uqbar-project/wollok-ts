import { isNode, Kind } from './model'
import { mapObject } from './extensions'
import * as Models from './model'

const { isArray } = Array

export function fromJSON<T>(json: any): T {
  const propagate = (data: any) => {
    if (isNode(data)) {
      const payload = mapObject(fromJSON, data) as {kind: Kind}
      const constructor = Models[payload.kind] as any
      return new constructor(payload)
    }
    if (isArray(data)) return data.map(fromJSON)
    if (data instanceof Object) return mapObject(fromJSON, data)
    return data
  }
  return propagate(json) as T
}