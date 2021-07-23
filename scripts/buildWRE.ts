import { promises } from 'fs'
import { sync as listFiles } from 'globby'
import { join } from 'path'
import link from '../src/linker'
import { File } from '../src/parser'
import validate from '../src/validator'

const { writeFile, readFile } = promises

const WRE_SRC_PATH = 'language/src'
const WRE_TARGET_PATH = 'src/wre'

async function buildWRE() {
  console.group('Building WRE')
  console.time('Building WRE')

  console.info('Parsing...')
  console.time('Parsed')
  // TODO: Can we move this to lang? See wollok-language/issues/48
  const targetRawWRE = await Promise.all([
    File('wollok/io.wlk').tryParse(await readFile(`${WRE_TARGET_PATH}/io.wlk`, 'utf8')),
    File('wollok/gameMirror.wlk').tryParse(await readFile(`${WRE_TARGET_PATH}/gameMirror.wlk`, 'utf8')),
  ])

  const sourceFiles = listFiles('**/*.wlk', { cwd: WRE_SRC_PATH })
  const rawWRE = await Promise.all(sourceFiles.map(async sourceFile => {
    const fileContent = await readFile(join(process.cwd(), WRE_SRC_PATH, sourceFile), 'utf8')
    return File(sourceFile).tryParse(fileContent)
  }))
  console.timeEnd('Parsed')

  console.info('Linking...')
  console.time('Linked')
  const wre = link([...rawWRE, ...targetRawWRE])
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

  console.info('Saving...')
  console.time('Saved')
  await writeFile(`${WRE_TARGET_PATH}/wre.json`, JSON.stringify(wre, undefined, 2))
  console.timeEnd('Saved')

  console.groupEnd()
  console.timeEnd('Building WRE')
}

buildWRE()