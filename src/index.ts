import { dirname, sep } from 'path'
import * as build from './builders'
import fill from './filler'
import interpret, { Evaluation } from './interpreter'
import link from './linker'
import { Environment } from './model'
import * as parse from './parser'
import validate from './validator'
import wre from './wre/wre.json'


function buildEnvironment(files: { name: string, content: string }[]): Environment {
  return link(files.map(({ name, content }) => {
    try {
      const filePackage = fill(parse.file(name).tryParse(content))
      return dirname(name).split(sep).reduceRight((entity, dirName) => fill(build.Package(dirName)(entity)), filePackage)
    } catch (error) {
      throw new Error(`Failed to parse ${name}: ${error.message}`)
    }
  }), build.fromJSON<Environment>(wre))
}

export * from './model'
export {
  Evaluation,
  buildEnvironment,
  build,
  parse,
  fill,
  link,
  validate,
  interpret,
}