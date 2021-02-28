import { dirname } from 'path'
import link from './linker'
import { Environment, fromJSON, Package } from './model'
import * as parse from './parser'
import validate from './validator'
import WRE from './wre/wre.json'
import WRENatives from './wre/wre.natives'
import compile from './interpreter/compiler'
import garbageCollect from './interpreter/garbageCollector'


function buildEnvironment(files: { name: string, content: string }[], baseEnvironment: Environment = fromJSON<Environment>(WRE)): Environment {

  return link(files.map(({ name, content }) => {
    try {
      const filePackage = parse.File(name).tryParse(content)
      const dir = dirname(name)
      return (dir === '.' ? [] : dir.split('/')).reduceRight((entity, name) => new Package({ name, members:[entity] }), filePackage)
    } catch (error) {
      throw new Error(`Failed to parse ${name}: ${error.message}`)
    }
  }), baseEnvironment)
}


export * from './model'
export * from './interpreter/runtimeModel'
export * from './interpreter/log'
export {
  WRE,
  WRENatives,
  compile,
  garbageCollect,
  buildEnvironment,
  parse,
  link,
  validate,
}