import { promises } from 'fs'
import { sync as listFiles } from 'globby'
import { join } from 'path'
import link from '../src/linker'
import { File } from '../src/parser'
import { Package } from '../src/model'

const { writeFile, readFile } = promises

const WRE_SRC_PATH = 'language/src'
const WRE_TARGET_PATH = 'src/wre'

async function buildWRE() {
  console.group('Building WRE')
  console.time('Building WRE')

  // TODO: Can we move this to lang? See wollok-language/issues/48
  const targetRawWRE = new Package({
    name: 'wollok',
    members: await Promise.all([
      File('io').tryParse(await readFile(`${WRE_TARGET_PATH}/io.wlk`, 'utf8')),
      File('gameMirror').tryParse(await readFile(`${WRE_TARGET_PATH}/gameMirror.wlk`, 'utf8')),
    ]),
  })

  const sourceFiles = listFiles('**/*.wlk', { cwd: WRE_SRC_PATH })

  console.info('Parsing...')
  console.time('Parsed')
  const rawWRE = await Promise.all(sourceFiles.map(async sourceFile => {
    const sourceFilePath = sourceFile.split('/')
    const sourceFileName = sourceFilePath.splice(-1)[0].split('.')[0]
    const fileContent = await readFile(join(process.cwd(), WRE_SRC_PATH, sourceFile), 'utf8')

    return sourceFilePath.reduce(
      (node, name) => new Package({ name, members: [node] }),
      File(sourceFileName).tryParse(fileContent)
    )
  })
  )

  console.timeEnd('Parsed')

  console.info('Linking...')
  console.time('Linked')
  const wre = link([...rawWRE, targetRawWRE])
  console.timeEnd('Linked')

  console.info('Saving...')
  console.time('Saved')
  await writeFile(`${WRE_TARGET_PATH}/wre.json`, JSON.stringify(wre, undefined, 2))
  console.timeEnd('Saved')

  console.groupEnd()
  console.timeEnd('Building WRE')
}

buildWRE()