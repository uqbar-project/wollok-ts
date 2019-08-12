import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, join } from 'path'
import simplegit from 'simple-git/promise'
import { buildEnvironment } from '../src'
import interpreter from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import natives from '../src/wre/wre.natives'

enableLogs(LogLevel.INFO)

const SANITY_TESTS_REPO = 'https://github.com/uqbar-project/wollok-sanity-tests.git'
const SANITY_TESTS_FOLDER = join('test', 'sanity')

const SKIP = [
  // TODO: Describes with methods
  join('test', 'sanity', 'src', 'describe', 'testWithMethodInvocation.wtest'),
  join('test', 'sanity', 'src', 'describe', 'variableOfDescribeDoesntHaveSideEffectsBetweenTests.wtest'),

  // TODO: Fixtures
  join('test', 'sanity', 'src', 'describe', 'testIssue1221NPEForConstDefinedInFixtures.wtest'), // TODO: Why not?

  // TODO: Inherited constructor with parameter
  join('test', 'sanity', 'src', 'constructors', 'inheritedOneArgumentConstructorInheritedFromSuperclass.wtest'),
]

const git = simplegit()

const getTestsInDir = (path: string): string[] =>
  readdirSync(path).reduce((tests, file) => {
    const filePath = join(path, file)
    return statSync(filePath).isDirectory()
      ? [...tests, ...getTestsInDir(filePath)]
      : filePath.endsWith('.wtest') || filePath.endsWith('.wlk') ? [...tests, filePath] : tests
  }, [] as string[])

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

  if (!process.argv.includes('--skip-fetch')) {
    log.start('Fetching tests')
    await fetchTests()
    log.done('Fetching tests')
  } else log.info('Will use local version of tests.')

  log.start('Reading tests')
  const testFiles = getTestsInDir(join(SANITY_TESTS_FOLDER, 'src'))
  const nonSkipedTestFiles = testFiles
    .filter(file => !SKIP.includes(file))
    .map(testFile => ({ name: basename(testFile), content: readFileSync(testFile, 'utf8') }))
  log.done('Reading tests')

  log.start('Building environment')
  const environment = buildEnvironment(nonSkipedTestFiles)
  log.done('Building environment')

  log.start('Running tests')
  const { runTests } = interpreter(environment, natives)
  const [passed, total] = await runTests()
  log.done('Running tests')
  log.info(`Passed ${passed}/${total} tests on ${testFiles.length} test files`)

  process.exit(total - passed)
}

runAll()
