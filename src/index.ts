import * as build from './builders'
import fill from './filler'
import { Evaluation } from './interpreter'
import interpret from './interpreter'
import link from './linker'
import validate from './linker'
import { Environment } from './model'
import * as parse from './parser'
import * as tools from './tools'
import wre from './wre/wre.json'


const buildEnvironment = (files: { name: string, content: string }[]): Environment =>
  link(files.map(({ name, content }) => fill(parse.file(name).tryParse(content))), wre as Environment)

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
  tools
}