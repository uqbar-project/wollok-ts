import link from './linker'
import { Environment, fromJSON, List } from './model'
import * as parse from './parser'
import validate from './validator'
import WRE from './wre/wre.json'
import WRENatives from './wre/wre.natives'


function buildEnvironment(files: List<{ name: string, content: string }>, baseEnvironment: Environment = fromJSON<Environment>(WRE)): Environment {

  return link(files.map(({ name, content }) => {
    try {
      return parse.File(name).tryParse(content)
    } catch (error) {
      throw new Error(`Failed to parse ${name}: ${error.message}`)
    }
  }), baseEnvironment)
}


export * from './model'
export * from './interpreter/runtimeModel'
export {
  WRE,
  WRENatives,
  buildEnvironment,
  parse,
  link,
  validate,
}