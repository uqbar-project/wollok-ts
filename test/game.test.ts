import { should } from 'chai'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { buildEnvironment } from '../src'
import { RuntimeObject } from '../src/interpreter'
import interpreter, { Evaluation } from '../src/interpreter'
import log from '../src/log'
import natives from '../src/wre/wre.natives'

should()

describe.only('Actions', () => {

  it('addVisual', () => {
    const evaluation = runGame('addVisual')
    visuals(evaluation).should.have.length(1)
  })

  it('removeVisual', () => {
    const evaluation = runGame('removeVisual')
    visuals(evaluation).should.have.length(0)
  })

  it('say', () => {
    const evaluation = runGame('say')
    visualObject(evaluation).get('message')!.innerValue!.should.be.eq('Hi!')
    visualObject(evaluation).get('messageTime')!.innerValue!.should.be.eq(2000)
  })

  it('clear', () => {
    const evaluation = runGame('clear')
    visuals(evaluation).should.have.length(0)
  })

})

const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN('actions.actions.visual').id)

const visuals = (evaluation: Evaluation) => {
  const wVisuals: RuntimeObject = evaluation
    .instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
    .get('visuals')!
  wVisuals.assertIsCollection()
  return wVisuals.innerValue
}

const runGame = (testName: string) => {
  const cwd = join('test', 'game')

  // TODO: Move to runner
  log.clear()
  log.separator('RUN ALL TESTS')

  log.start('Reading tests')
  // TODO: This causes tests with imports to fail when runned alone, cause the imports are not included.
  const testFiles = globby.sync('**/*.wpgm', { cwd })
    .map(name => ({
      name,
      content: readFileSync(join(cwd, name), 'utf8'),
    }))
  log.done('Reading tests')
  log.info(`Will run tests from ${testFiles.length} file(s)`)

  log.start('Building environment')
  const environment = buildEnvironment(testFiles)
  log.done('Building environment')

  const { runProgram, buildEvaluation } = interpreter(environment, natives)
  const evaluation = buildEvaluation()
  runProgram(`actions.actions.${testName}`, evaluation)
  return evaluation
}