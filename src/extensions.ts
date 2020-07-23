export const keys = Object.keys as <T>(o: T) => (Extract<keyof T, string>)[]

export const last = <T>(xs: ReadonlyArray<T>): T | undefined => xs[xs.length - 1]

export const divideOn = (separator: string) => (str: string): [string, string] => {
  const [head, ...tail] = str.split(separator)
  return [head, tail.join(separator)]
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