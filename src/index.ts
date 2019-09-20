import * as behavior from './behavior'
import * as build from './builders'
import fill from './filler'
import interpret, { Evaluation } from './interpreter'
import link from './linker'
import { Environment } from './model'
import * as parse from './parser'
import validate from './validator'
import wre from './wre/wre.json'


function buildEnvironment(files: { name: string, content: string }[]): Environment {
  return link(files.map(({ name, content }) => fill(parse.file(name).tryParse(content))), behavior.Linked(wre as any))
}

export * from './model'
export * from './cache'
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