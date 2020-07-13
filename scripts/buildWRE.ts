import { readFileSync, writeFileSync } from 'fs'
import { sync as listFiles } from 'globby'
import { join, sep as pathSeparator } from 'path'
import { Package } from '../src/builders'
import fill from '../src/filler'
import link from '../src/linker'
import log, { enableLogs, LogLevel } from '../src/log'
import { File } from '../src/parser'

const WRE_SRC_PATH = 'language/src'
const WRE_TARGET_PATH = 'src/wre'

enableLogs(LogLevel.INFO)

log.start('Building WRE')

const sourceFiles = listFiles('**/*.wlk', { cwd: WRE_SRC_PATH })

log.start('\tParsing...')
const rawWRE = sourceFiles.map(sourceFile => {
  const sourceFilePath = sourceFile.split(pathSeparator)
  const sourceFileName = sourceFilePath.splice(-1)[0].split('.')[0]
  return sourceFilePath.reduce(
    (node, path) => Package(path)(node),
    File(sourceFileName).tryParse(readFileSync(join(process.cwd(), WRE_SRC_PATH, sourceFile), 'utf8'))
  )
})
log.done('\tParsing...')

log.start('\tFilling...')
const filledWRE = rawWRE.map(fill)
log.done('\tFilling...')

log.start('\tLinking...')
const wre = link([...filledWRE])
log.done('\tLinking...')

log.start('\tSaving...')
writeFileSync(`${WRE_TARGET_PATH}/wre.json`, JSON.stringify(wre, undefined, 2))
log.done('\tSaving...')

log.done('Building WRE')