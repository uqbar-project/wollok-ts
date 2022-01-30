import { existsSync, mkdirSync } from 'fs'
import gitClient from 'simple-git/promise'
import { wollokVersion } from '../package.json'

const WOLLOK_LANGUAGE_REPO = 'git@github.com:uqbar-project/wollok-language.git'
const WOLLOK_LANGUAGE_TAG = wollokVersion.includes(':') ? wollokVersion.split(':')[1] : `v${wollokVersion}`
const WOLLOK_LANGUAGE_FOLDER = 'language'

const fetchLanguage = async (): Promise<void> => {
  console.group('Obtaining the Wollok Language specification')
  console.time('Obtaining the Wollok Language specification')
  if (existsSync(WOLLOK_LANGUAGE_FOLDER)) {
    console.info('Found local version of Wollok Language!')
  } else {
    console.info(`Checking out the Wollok Language project to ./${WOLLOK_LANGUAGE_FOLDER} from ${WOLLOK_LANGUAGE_REPO} at tag: ${WOLLOK_LANGUAGE_TAG}`)
    mkdirSync(WOLLOK_LANGUAGE_FOLDER)
    const client = gitClient(WOLLOK_LANGUAGE_FOLDER)
    await client.clone(WOLLOK_LANGUAGE_REPO, '.')
    await client.checkout(WOLLOK_LANGUAGE_TAG)
  }
  console.groupEnd()
  console.timeEnd('Obtaining the Wollok Language specification')
}

fetchLanguage()