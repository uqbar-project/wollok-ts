import WRENatives from './wre.natives'
import { Natives } from '../interpreter/runtimeModel'
import { List } from '../extensions'

/**
 * Combines a list of `Natives` objects with the `WRENatives` object.
 * If no values are passed, the function will return `WRENatives` alone.
 *
 * @param nativeList - A list of `Natives` objects to be merged with `WRENatives`.
 *                     The default value is an empty list `[]`.
 * @returns A `Natives` object resulting from merging `WRENatives` with the objects
 *          in the `nativeList`. If the list is empty, only `WRENatives` is returned.
 */
const natives = (nativeList: List<Natives> = []): Natives => merge(mergeList(nativeList), WRENatives)

const mergeList = (nativeList: List<Natives> = []): Natives => nativeList.reduce((merged, current) => merge(merged, current), {})

const merge = (base: Natives, incoming: Natives): Natives => {
  const keys = new Set([...Object.keys(base), ...Object.keys(incoming)])
  return [...keys].reduce<Natives>((result, key) => {
    const baseValue = base[key]
    const incomingValue = incoming[key]
    result[key] = baseValue && incomingValue
      ? merge(baseValue as Natives, incomingValue as Natives)
      : baseValue ?? incomingValue
    return result
  }, {})
}

export default natives