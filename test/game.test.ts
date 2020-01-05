import { should } from 'chai'
import { join } from 'path'
import { RuntimeObject } from '../src/interpreter'
import { Evaluation } from '../src/interpreter'
import { buildInterpreter } from './runner'

should()

const basePackage = 'actions'

describe.only('Actions', () => {

  const { runProgram, buildEvaluation } = buildInterpreter('**/*.wpgm', join('test', 'game'))

  const gameTest = (programName: string, cb: (evaluation: Evaluation) => void) =>
    it(programName, () => cb(runGame(programName)))

  gameTest('addVisual', (evaluation) => {
    visuals(evaluation).should.have.length(1)
  })

  gameTest('removeVisual', (evaluation) => {
    visuals(evaluation).should.have.length(0)
  })

  gameTest('say', (evaluation) => {
    visualObject(evaluation).get('message')!.innerValue!.should.be.eq('Hi!')
    visualObject(evaluation).get('messageTime')!.innerValue!.should.be.eq(2000)
  })

  gameTest('clear', (evaluation) => {
    visuals(evaluation).should.have.length(0)
  })

  const runGame = (programName: string) => runGameProgram(`${basePackage}.${programName}`)

  const runGameProgram = (programFQN: string) => {
    const evaluation = buildEvaluation()
    runProgram(programFQN, evaluation)
    return evaluation
  }

})

const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN(`${basePackage}.visual`).id)

const visuals = (evaluation: Evaluation) => {
  const wVisuals: RuntimeObject = evaluation
    .instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
    .get('visuals')!
  wVisuals.assertIsCollection()
  return wVisuals.innerValue
}
