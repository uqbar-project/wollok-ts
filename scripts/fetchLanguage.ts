import { existsSync, mkdirSync } from 'fs'
import gitClient from 'simple-git/promise'
import log, { enableLogs, LogLevel } from '../src/log'

const WOLLOK_LANGUAGE_REPO = 'https://github.com/uqbar-project/wollok-language.git'
const WOLLOK_LANGUAGE_VERSION = process.env.npm_package_wollokVersion
const WOLLOK_LANGUAGE_FOLDER = 'language'

enableLogs(LogLevel.INFO)

const fetchLanguage = async () => {
  log.start('Obtaining the Wollok Language specification')
  if (existsSync(WOLLOK_LANGUAGE_FOLDER)) {
    log.info('\tFound local version of Wollok Language!')
  } else {
    log.info(`\tChecking out the Wollok Language project to ./${WOLLOK_LANGUAGE_FOLDER} from ${WOLLOK_LANGUAGE_REPO} at tag: v${WOLLOK_LANGUAGE_VERSION}`)
    mkdirSync(WOLLOK_LANGUAGE_FOLDER)
    const client = gitClient(WOLLOK_LANGUAGE_FOLDER)
    await client.clone(WOLLOK_LANGUAGE_REPO, '.')
    await client.checkout(`v${WOLLOK_LANGUAGE_VERSION}`)
  }
  log.done('Obtaining the Wollok Language specification')
}

fetchLanguage()