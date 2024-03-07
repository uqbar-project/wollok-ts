import link from './linker'
import { Environment } from './model'
import { List } from './extensions'
import { fromJSON } from './jsonUtils'
import * as parse from './parser'
import { ParseError } from './parser'
import validate from './validator'
import print from './printer/print'
import WRE from './wre/wre.json'
import WRENatives from './wre/wre.natives'

export type FileContent = {
  name: string,
  content: string,
}

function buildEnvironment(files: List<FileContent>, baseEnvironment: Environment = fromJSON<Environment>(WRE)): Environment {

  return link(files.map(({ name, content }) => {
    try {
      return parse.File(name).tryParse(content)
    } catch (error) {
      throw new Error(`Failed to parse ${name}: ${(error as Error).message}`)
    }
  }), baseEnvironment)
}

export * from './constants'
export * from './extensions'
export * from './helpers'
export * from './linker'
export * from './jsonUtils'
export * from './model'
export * from './interpreter/runtimeModel'
export * from './printer/exceptions'
export * from './printer/print'
export * from './printer/utils'
export * from './typeSystem/constraintBasedTypeSystem'
export * from './typeSystem/typeVariables'
export * from './typeSystem/wollokTypes'
export * as natives from './wre/wre.natives'
export {
  buildEnvironment,
  link,
  parse,
  ParseError,
  validate,
  print,
  WRE,
  WRENatives,
}