import { promises } from 'fs'
import fastGlob from 'fast-glob'
import { join } from 'path'
import { mapObject } from '../src/extensions'
import link from '../src/linker'
import { Node } from '../src/model'
import { File } from '../src/parser'
import validate from '../src/validator'

const { writeFile, readFile } = promises
const { isArray } = Array

const WRE_SRC_PATH = 'language/src'
const WRE_TARGET_PATH = 'src/wre'

// TODO: Why are we doing this? Can't we just parse it in-site?
async function buildWRE() {
  console.group('Building WRE')
  console.time('Building WRE')

  console.info('Parsing...')
  console.time('Parsed')

  const sourceFiles = fastGlob.sync('**/*.wlk', { cwd: WRE_SRC_PATH })
  const rawWRE = await Promise.all(sourceFiles.map(async sourceFile => {
    const fileContent = await readFile(join(process.cwd(), WRE_SRC_PATH, sourceFile), 'utf8')
    return File(sourceFile).tryParse(fileContent)
  }))
  console.timeEnd('Parsed')

  console.info('Linking...')
  console.time('Linked')
  const wre = link([...rawWRE])
  console.timeEnd('Linked')

  console.info('Validating...')
  console.time('Validated')
  const problems = validate(wre)
  if(problems.length) {
    console.group(`${problems.length} PROBLEM(S) FOUND!:`)
    for(const problem of problems) console.warn(problem)
    console.groupEnd()
  }
  console.timeEnd('Validated')

  console.info(`Saving to ${WRE_TARGET_PATH}/wre.json...`)
  console.time('Saved')
  // TODO: Move from and to JSON logic to Node

  const encode = (v: any): any =>
    isArray(v) ? v.map(encode) :
    v instanceof Node ? encode({ ...v, kind: v.constructor.name }) :
    v instanceof Object ? mapObject(encode, v) :
    v

  await writeFile(`${WRE_TARGET_PATH}/wre.json`, JSON.stringify(encode(wre), (key, value) => key.startsWith('_') ? undefined : value, 2))
  console.timeEnd('Saved')

  console.groupEnd()
  console.timeEnd('Building WRE')
}

buildWRE()