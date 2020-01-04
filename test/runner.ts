import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { buildEnvironment } from '../src'
import interpreter, { Natives } from '../src/interpreter'
import log from '../src/log'
import natives from '../src/wre/wre.natives'

const { time, timeEnd } = console

export const buildInterpreter = (pattern: string, cwd: string, skip: string[] = []) => {
  time('Reading files')
  // TODO: This causes tests with imports to fail when runned alone, cause the imports are not included.
  const files = globby.sync(pattern, { cwd })
    .filter(name => !skip.includes(name))
    .map(name => ({
      name,
      content: readFileSync(join(cwd, name), 'utf8'),
    }))
  timeEnd('Reading files')

  log.info(`Read ${files.length} file(s). ${skip.length} files skipped.`)

  time('Building environment')
  const environment = buildEnvironment(files)
  timeEnd('Building environment')

  return interpreter(environment, natives as Natives)
}