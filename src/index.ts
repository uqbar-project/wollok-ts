import { dirname, sep } from 'path'

import * as behavior from './behavior'
import * as build from './builders'
import fill from './filler'
import interpret, { Evaluation } from './interpreter'
import link from './linker'
import { Environment } from './model'
import * as parse from './parser'
import validate from './validator'
import wre from './wre/wre.json'

const wollokCoreLibraries = behavior.Linked(wre as any)

function buildEnvironment(files: { name: string, content: string }[], baseEnvironment: Environment = wollokCoreLibraries): Environment {
  return link(files.map(({ name, content }) => {
    try {
      const filePackage = fill(parse.file(name).tryParse(content))
      return dirname(name).split(sep).reduceRight((entity, dirName) => fill(build.Package(dirName)(entity)), filePackage)
    } catch (error) {
      throw new Error(`Failed to parse ${name}: ${error.message}`)
    }
  }), baseEnvironment)
}

export * from './model'
export {
  behavior,
  Evaluation,
  buildEnvironment,
  build,
  parse,
  fill,
  link,
  validate,
  interpret,
}