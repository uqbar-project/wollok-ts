import { promises } from 'fs'
import { sync as listFiles } from 'globby'
import { join } from 'path'
import link from '../src/linker'
import { ConsoleLogger, LogLevel } from '../src/interpreter/log'
import { File } from '../src/parser'
import { Package } from '../src/model'

const { writeFile, readFile } = promises

const WRE_SRC_PATH = 'language/src'
const WRE_TARGET_PATH = 'src/wre'

const log = new ConsoleLogger(LogLevel.INFO)

async function buildWRE() {
  log.start('Building WRE')

  // TODO: Can we move this to lang? See wollok-language/issues/48
  const targetRawWRE = new Package({
    name: 'wollok',
    members: await Promise.all([
      File('io').tryParse(await readFile(`${WRE_TARGET_PATH}/io.wlk`, 'utf8')),
      File('gameMirror').tryParse(await readFile(`${WRE_TARGET_PATH}/gameMirror.wlk`, 'utf8')),
    ]),
  })

  const sourceFiles = listFiles('**/*.wlk', { cwd: WRE_SRC_PATH })

  log.start('\tParsing...')
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

  log.done('\tParsing...')

  log.start('\tLinking...')
  const wre = link([...rawWRE, targetRawWRE])
  log.done('\tLinking...')

  log.start('\tSaving...')
  await writeFile(`${WRE_TARGET_PATH}/wre.json`, JSON.stringify(wre, undefined, 2))
  log.done('\tSaving...')

  log.done('Building WRE')
}

buildWRE()