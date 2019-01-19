import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, join } from 'path'
import * as simplegit from 'simple-git/promise'
import fill from '../src/filler'
import interpreter from '../src/interpreter'
import link from '../src/linker'
import log, { enableLogs } from '../src/log'
import { Package } from '../src/model'
import { File } from '../src/parser'
import natives from '../src/wre/natives'

enableLogs()

const SANITY_TESTS_REPO = 'https://github.com/uqbar-project/wollok-sanity-tests.git'
const SANITY_TESTS_FOLDER = join('test', 'sanity')
const WRE_PATH = join('src', 'wre', 'lang.wlk')

// TODO: Don't skip tests
const SKIP = [

  // TODO: Dictionary
  join('test', 'sanity', 'src', 'dictionaryTestCase.wtest'),

  // TODO: Dates
  join('test', 'sanity', 'src', 'date.wtest'),

  // TODO: Named parámeters
  join('test', 'sanity', 'src', 'constructors', 'namedParametersWithInheritance.wtest'),
  join('test', 'sanity', 'src', 'constructors', 'namedParametersWithLiterals.wtest'),
  join('test', 'sanity', 'src', 'namedObjects', 'namedObjectInheritanceTest', 'objectInheritingFromAClassNamedParameters.wtest'),
  join('test', 'sanity', 'src', 'namedObjects', 'unnamedObjectInheritanceTest', 'objectInheritingFromAClassNamedParameters.wtest'),
  join('test', 'sanity', 'src', 'exceptionTestCase', 'testCanCreateExceptionUsingNamedParametersWithoutCause.wtest'),
  join('test', 'sanity', 'src', 'mixins', 'namedObjects', 'namedObjectInheritanceTest', 'objectInheritingFromAClassNamedParameters.wtest'),
  join('test', 'sanity', 'src', 'mixins', 'namedObjects', 'unnamedObjectInheritanceTest',
    'objectInheritingFromAClassNamedParameters.wtest'),

  // TODO: Properties
  join('test', 'sanity', 'src', 'propertiesTestCase', 'badSetterForPropertyConstInClass.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'badSetterForPropertyConstInObject.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'customGetterForPropertyConstInClass.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'getterAndSetterForPropertyVarInClass.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'getterAndSetterForPropertyVarInWko.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'getterForPropertyConstInClass.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'getterForPropertyConstInWko.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'setterForPropertyConstInClass.wtest'),
  join('test', 'sanity', 'src', 'propertiesTestCase', 'setterForPropertyConstInObject.wtest'),
  join('test', 'sanity', 'src', 'namedObjects', 'namedObjectInheritanceTest', 'objectInheritingFromAClass.wtest'),
  join('test', 'sanity', 'src', 'namedObjects', 'unnamedObjectInheritanceTest', 'objectInheritingFromAClass.wtest'),

  // TODO: Describes with non-test definitions
  join('test', 'sanity', 'src', 'describe', 'describeCanGroupASetOfIsolatedTestsWithInstanceVariables.wtest'),
  join('test', 'sanity', 'src', 'describe', 'testWithMethodInvocation.wtest'),
  join('test', 'sanity', 'src', 'describe', 'variableOfDescribeDoesntHaveSideEffectsBetweenTests.wtest'),

  // TODO: Fixtures
  join('test', 'sanity', 'src', 'describe', 'constReferencesCannotBeAssignedInAFixture.wtest'),
  join('test', 'sanity', 'src', 'describe', 'testFixture.wtest'),
  join('test', 'sanity', 'src', 'describe', 'testIssue1221NPEForConstDefinedInFixtures.wtest'),
  join('test', 'sanity', 'src', 'describe', 'testConstReferencesCanBeInitiallyAssignedInAFixture.wtest'),

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

  log.start('Parsing WRE')
  const wreSource = readFileSync(WRE_PATH, 'utf8')
  const wre: Package<'Filled'> = {
    kind: 'Package',
    id: undefined,
    name: 'wollok',
    imports: [],
    members: [fill(File('lang').tryParse(wreSource))],
  }
  log.done('Parsing WRE')

  log.start('Parsing tests')
  const testFiles = getTestsInDir(join(SANITY_TESTS_FOLDER, 'src'))
  const nonSkipedTestFiles = testFiles.filter(file => !SKIP.includes(file))
  log.done('Parsing tests')

  const testNodes = nonSkipedTestFiles.map(testFile =>
    fill(File(basename(testFile).split('.')[0]).tryParse(readFileSync(testFile, 'utf8')))
  )

  log.start('Linking')
  const environment = link([wre, ...testNodes])
  log.done('Linking')

  log.start('Running tests')
  const { runTests } = interpreter(environment, natives)
  await runTests()
  log.done('Running tests')
  log.success('Runned', testFiles.length, 'test files')
}

runAll()
