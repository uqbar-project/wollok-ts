import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { buildEnvironment } from '../src'
import interpreter from '../src/interpreter'
import { Natives } from '../src/interpreter'
import log from '../src/log'
import natives from '../src/wre/wre.natives'

const buildEnvironmentFrom = (pattern: string, cwd: string, skip: string[] = []) => {
  log.start('Reading files')
  // TODO: This causes tests with imports to fail when runned alone, cause the imports are not included.
  const testFiles = globby.sync(pattern, { cwd })
    .filter(name => !skip.includes(name))
    .map(name => ({
      name,
      content: readFileSync(join(cwd, name), 'utf8'),
    }))
  log.done('Reading files')
  log.info(`Read ${testFiles.length} file(s). ${skip.length} files skipped.`)

  log.start('Building environment')
  const environment = buildEnvironment(testFiles)
  log.done('Building environment')

  return environment
}

// const runAllTestFiles = (cwd: string, skip: string[] = []) => {
//   log.clear()
//   log.separator('RUN ALL TESTS')

//   const environment = buildEnvironmentFrom('**/*.@(wlk|wtest)', cwd, skip)

//   log.start('Running tests')
//   const { runTests } = interpreter(environment, natives as Natives)
//   const [passed, total, errors] = runTests()
//   log.done('Running tests')

//   log.separator('Results');

//   (total === passed ? log.success : log.error)(`Passed ${passed}/${total} tests.`)
//   if (errors.length) {
//     log.error(`${errors.length} error(s) found:`)
//     errors.forEach(err => log.error(`  ${err}`))
//   }

//   process.exit(errors.length ? 1 : total - passed)
// }

// export const runAllTestsIn = (cwd: string, skip: string[] = []) => {
//   try {
//     runAllTestFiles(cwd, skip)
//   } catch (error) {
//     log.error(error)
//     process.exit(1)
//   }
// }

export const runProgramIn = (cwd: string, programFQN: string) => {
  log.clear()
  log.separator(`RUN PROGRAM ${programFQN}`)

  const environment = buildEnvironmentFrom('**/*.wpgm', cwd)

  log.start('Running program')
  const { runProgram, buildEvaluation } = interpreter(environment, natives as Natives)
  const evaluation = buildEvaluation()
  runProgram(programFQN, evaluation)
  log.start('Running program')

  return evaluation
}
