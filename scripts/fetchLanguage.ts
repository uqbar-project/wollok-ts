import { existsSync, mkdirSync } from 'fs'
import gitClient from 'simple-git/promise'
import log, { enableLogs, LogLevel } from '../src/log'

const WOLLOK_LANGUAGE_REPO = 'https://github.com/uqbar-project/wollok-language.git'
const WOLLOK_LANGUAGE_FOLDER = 'language'

enableLogs(LogLevel.INFO)

const fetchLanguage = async () => {
  log.start('Obtaining the Wollok Language specification')
  if (existsSync(WOLLOK_LANGUAGE_FOLDER)) {
    log.info('\tFound local version of Wollok Language!')
    const diff = await gitClient(WOLLOK_LANGUAGE_FOLDER).diff()
    if (diff.length) {
      log.error(`\tCan't pull the Wollok Language project because the local version has uncommited changes. Commit your changes and try again.`)
      process.exit(-1)
    }

    log.info(`\tPulling the Wollok Language project to the latest version from ${WOLLOK_LANGUAGE_REPO}`)
    await gitClient(WOLLOK_LANGUAGE_FOLDER).pull()
  } else {
    log.info(`\tChecking out the Wollok Language project to ./${WOLLOK_LANGUAGE_FOLDER} from ${WOLLOK_LANGUAGE_REPO}`)
    mkdirSync(WOLLOK_LANGUAGE_FOLDER)
    await gitClient(WOLLOK_LANGUAGE_FOLDER).clone(WOLLOK_LANGUAGE_REPO, '.')
  }
  log.done('Obtaining the Wollok Language specification')
}

fetchLanguage()