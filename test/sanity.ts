import commandLineArgs from 'command-line-args'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import globby from 'globby'
import { basename, join } from 'path'
import simplegit from 'simple-git/promise'
import { buildEnvironment } from '../src'
import interpreter from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import natives from '../src/wre/wre.natives'

const SANITY_TESTS_REPO = 'https://github.com/uqbar-project/wollok-sanity-tests.git'
const SANITY_TESTS_FOLDER = join('test', 'sanity')
const ARGS = commandLineArgs([
  { name: 'local', type: Boolean, defaultValue: false },
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'files', alias: 'f', multiple: true, defaultOption: true, defaultValue: '**/*.@(wlk|wtest)' },
])


enableLogs(ARGS.verbose ? LogLevel.DEBUG : LogLevel.INFO)

// TODO: Don't skip tests
const SKIP = globby.sync([
  // TODO: Describes with methods
  '**/describe/testWithMethodInvocation.wtest',
  '**/describe/variableOfDescribeDoesntHaveSideEffectsBetweenTests.wtest',

  // TODO: Fixtures
  '**/describe/testIssue1221NPEForConstDefinedInFixtures.wtest',

  // TODO: Inherited constructor with parameter
  '**/constructors/inheritedOneArgumentConstructorInheritedFromSuperclass.wtest',
], { cwd: 'test/sanity/src' })

const git = simplegit()

const fetchTests = async () => {
  if (existsSync(SANITY_TESTS_FOLDER)) {
    await git.fetch()
  } else {
    mkdirSync(SANITY_TESTS_FOLDER)
    await git.clone(SANITY_TESTS_REPO, SANITY_TESTS_FOLDER)
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
  const testFiles = globby.sync(ARGS.files, { cwd: 'test/sanity/src' })
  const nonSkipedTestFiles = testFiles
    .filter(file => !SKIP.includes(file))
    .map(testFile => ({ name: basename(testFile), content: readFileSync(join(SANITY_TESTS_FOLDER, 'src', testFile), 'utf8') }))
  log.done('Reading tests')
  log.info(`Will run tests from ${nonSkipedTestFiles.length} file(s)`)

  log.start('Building environment')
  const environment = buildEnvironment(nonSkipedTestFiles)
  log.done('Building environment')

  log.start('Running tests')
  const { runTests } = interpreter(environment, natives)
  const [passed, total] = await runTests()
  log.done('Running tests')

  enableLogs(LogLevel.SUCCESS);
  (total === passed ? log.success : log.error)(`Passed ${passed}/${total} tests on ${testFiles.length} test files`)

  process.exit(total - passed)
}

runAll()
