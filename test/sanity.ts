import commandLineArgs from 'command-line-args'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import globby from 'globby'
import { basename, join } from 'path'
import gitClient from 'simple-git/promise'
import { buildEnvironment } from '../src'
import interpreter from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import natives from '../src/wre/wre.natives'

const WOLLOK_LANGUAGE_REPO = 'https://github.com/uqbar-project/wollok-language.git'
const SANITY_TESTS_FOLDER = join('test', 'sanity')
const ARGS = commandLineArgs([
  { name: 'local', alias: 'l', type: Boolean, defaultValue: false },
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'files', alias: 'f', multiple: true, defaultOption: true, defaultValue: '**/*.@(wlk|wtest)' },
])


enableLogs(ARGS.verbose ? LogLevel.DEBUG : LogLevel.INFO)

const fetchTests = async () => {
  if (existsSync(SANITY_TESTS_FOLDER)) {
    const diff = await gitClient(SANITY_TESTS_FOLDER).diff()
    if (diff.length) {
      log.error(`Can't pull the sanity tests project because the local has uncommited changes. Commit your changes or run with --local to skip pull.`)
      process.exit(-1)
    }
    await gitClient(SANITY_TESTS_FOLDER).pull()
  } else {
    mkdirSync(SANITY_TESTS_FOLDER)
    await gitClient(SANITY_TESTS_FOLDER).clone(WOLLOK_LANGUAGE_REPO, '.')
  }
}

const runAll = async () => {
  log.clear()
  log.separator('RUN ALL TESTS')

  if (!ARGS.local) {
    log.start('Fetching tests')
    await fetchTests()
    log.done('Fetching tests')
  } else log.info('Will use local version of tests.')

  log.start('Reading tests')
  const testFiles = globby.sync(ARGS.files, { cwd: 'test/sanity/test/sanity' }).map(testFile => ({
    name: basename(testFile),
    content: readFileSync(join(SANITY_TESTS_FOLDER, 'test', 'sanity', testFile), 'utf8'),
  }))
  log.done('Reading tests')
  log.info(`Will run tests from ${testFiles.length} file(s)`)

  log.start('Building environment')
  const environment = buildEnvironment(testFiles)
  log.done('Building environment')

  log.start('Running tests')
  const { runTests } = interpreter(environment, natives)
  const [passed, total] = await runTests()
  log.separator('Results')
  log.done('Running tests')

  enableLogs(LogLevel.SUCCESS);
  (total === passed ? log.success : log.error)(`Passed ${passed}/${total} tests on ${testFiles.length} test files`)

  process.exit(total - passed)
}

runAll()
