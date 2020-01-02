import commandLineArgs from 'command-line-args'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { buildEnvironment } from '../src'
import interpreter from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import natives from '../src/wre/wre.natives'

const ARGS = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'files', alias: 'f', multiple: true, defaultOption: true, defaultValue: '**/*.@(wlk|wtest)' },
])

const SKIPPED: string[] = []

// TODO: use mocha to run this ?
enableLogs(ARGS.verbose ? LogLevel.DEBUG : LogLevel.INFO)

const runAll = (cwd: string, skip: string[] = []) => {
  log.clear()
  log.separator('RUN ALL TESTS')

  log.start('Reading tests')
  // TODO: This causes tests with imports to fail when runned alone, cause the imports are not included.
  const testFiles = globby.sync(ARGS.files, { cwd })
    .filter(name => !skip.includes(name))
    .map(name => ({
      name,
      content: readFileSync(join(cwd, name), 'utf8'),
    }))
  log.done('Reading tests')
  log.info(`Will run tests from ${testFiles.length} file(s)`)

  log.start('Building environment')
  const environment = buildEnvironment(testFiles)
  log.done('Building environment')

  log.start('Running tests')
  const { runTests } = interpreter(environment, natives)
  const [passed, total, errors] = runTests()
  log.done('Running tests')

  log.separator('Results');

  (total === passed ? log.success : log.error)(`Passed ${passed}/${total} tests on ${testFiles.length} test files. ${SKIPPED.length} files skipped.`)
  if (errors.length) {
    log.error(`${errors.length} error(s) found:`)
    errors.forEach(err => log.error(`  ${err}`))
  }

  process.exit(errors.length ? 1 : total - passed)
}

export const runAllTests = (cwd: string, skip: string[] = []) => {
  try {
    runAll(cwd, skip)
  } catch (error) {
    log.error(error)
    process.exit(1)
  }
}