import WRENatives from './wre.natives'
import { Natives } from '../interpreter/runtimeModel'
import { List } from '../extensions'

/**
 * Combines user-provided natives with the `WRENatives` object.
 * User-provided natives take precedence when both define the same native.
 *
 * @param nativeList - A list of `Natives` objects to be merged with `WRENatives`.
 *                     The default value is an empty list `[]`.
 * @returns A `Natives` object containing the WRE and user-provided natives.
 */
const natives = (nativeList: List<Natives> = []): Natives => merge(WRENatives, mergeList(nativeList))

const mergeList = (nativeList: List<Natives> = []): Natives => nativeList.reduce((merged, current) => merge(merged, current), {})

const merge = (base: Natives, incoming: Natives): Natives => {
  const keys = new Set([...Object.keys(base), ...Object.keys(incoming)])
  return [...keys].reduce<Natives>((result, key) => {
    const baseValue = base[key]
    const incomingValue = incoming[key]
    result[key] = isNativesMap(baseValue) && isNativesMap(incomingValue)
      ? merge(baseValue, incomingValue)
      : incomingValue ?? baseValue
    return result
  }, {})
}

const isNativesMap = (value: unknown): value is Natives => typeof value === 'object' && value !== null

export default natives