import commandLineArgs from 'command-line-args'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { buildEnvironment } from '../src'
import interpreter from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import natives from '../src/wre/wre.natives'

const { keys, values } = Object

const SANITY_TESTS_FOLDER = join('language', 'test', 'sanity')
const ARGS = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'files', alias: 'f', multiple: true, defaultOption: true, defaultValue: '**/*.@(wlk|wtest)' },
])

// TODO: Don't skip
const SKIPPED = globby.sync([
  'game/**',
], { cwd: SANITY_TESTS_FOLDER })

// TODO: use mocha to run this ?
enableLogs(ARGS.verbose ? LogLevel.DEBUG : LogLevel.INFO)

const runAll = async () => {
  log.clear()
  log.separator('RUN ALL TESTS')

  log.start('Reading tests')
  // TODO: This causes tests with imports to fail when runned alone, cause the imports are not included.
  const testFiles = globby.sync(ARGS.files, { cwd: SANITY_TESTS_FOLDER })
    .filter(name => !SKIPPED.includes(name))
    .map(name => ({
      name,
      content: readFileSync(join(SANITY_TESTS_FOLDER, name), 'utf8'),
    }))
  log.done('Reading tests')
  log.info(`Will run tests from ${testFiles.length} file(s)`)

  log.start('Building environment')
  const environment = buildEnvironment(testFiles)
  log.done('Building environment')

  log.start('Running tests')
  const { runTests } = interpreter(environment, natives)
  const results = runTests()
  const total = keys(results).length
  const passed = values(results).filter(({ error }) => !error).length
  log.separator('Results')
  log.done('Running tests')

  enableLogs(LogLevel.SUCCESS);
  (total === passed ? log.success : log.error)(`Passed ${passed}/${total} tests on ${testFiles.length} test files. ${SKIPPED.length} files skipped.`)

  process.exit(total - passed)
}

try {
  runAll()
} catch (error) {
  log.error(error)
  process.exit(1)
}