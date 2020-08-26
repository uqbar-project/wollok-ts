import { dirname } from 'path'
import * as build from './builders'
import fill from './filler'
import interpret, { Evaluation, Natives } from './interpreter'
import link from './linker'
import { Environment } from './model'
import * as parse from './parser'
import validate from './validator'
import wre from './wre/wre.json'

const WRENatives = wre as Natives

function buildEnvironment(files: { name: string, content: string }[], baseEnvironment: Environment = build.fromJSON<Environment>(WRENatives)): Environment {
  
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
  WRENatives,
  Evaluation,
  Natives,
  buildEnvironment,
  build,
  parse,
  fill,
  link,
  validate,
  interpret,
}