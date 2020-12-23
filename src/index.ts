import { dirname } from 'path'
import * as build from './builders'
import fill from './filler'
import { Evaluation, Natives } from './interpreter'
import link from './linker'
import { Environment } from './model'
import * as parse from './parser'
import validate from './validator'
import WRE from './wre/wre.json'
import WRENatives from './wre/wre.natives'

function buildEnvironment(files: { name: string, content: string }[], baseEnvironment: Environment = build.fromJSON<Environment>(WRE)): Environment {

  return link(files.map(({ name, content }) => {
    try {
      const filePackage = fill(parse.File(name).tryParse(content))
      const dir = dirname(name)
      return (dir === '.' ? [] : dir.split('/')).reduceRight((entity, dirName) => fill(build.Package(dirName)(entity)), filePackage)
    } catch (error) {
      throw new Error(`Failed to parse ${name}: ${error.message}`)
    }
  }), baseEnvironment)
}

export * from './model'
export {
  WRE,
  WRENatives,
  Evaluation,
  Natives,
  buildEnvironment,
  build,
  parse,
  fill,
  link,
  validate,
}