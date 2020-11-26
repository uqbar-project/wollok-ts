import { should } from 'chai'
import { join } from 'path'
import { RuntimeObject } from '../src/interpreter'
import { Evaluation } from '../src/interpreter'
import { buildInterpreter } from './assertions'

should()

// TODO: We should have these type of tests for all natives (and maybe move this to an according file)
// TODO: Move the wollok code to language

const basePackage = 'actions'

describe('Wollok Game', () => {

  describe(basePackage, () => {

    const { runProgram, buildEvaluation, sendMessage } = buildInterpreter('**/*.wpgm', join('test', 'game'))

    const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN(`${basePackage}.visual`).id)

    const visuals = (evaluation: Evaluation) => {
      const wVisuals: RuntimeObject = evaluation
        .instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
        .get('visuals')!
      wVisuals.assertIsCollection()
      return wVisuals.innerValue
    }

    const runGameProgram = (programFQN: string) => {
      const evaluation = buildEvaluation()
      runProgram(programFQN, evaluation)
      return evaluation
    }

    const gameTest = (programName: string, cb: (evaluation: Evaluation) => void) =>
      it(programName, () => cb(runGameProgram(`${basePackage}.${programName}`)))

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

    it('flush event', () => {
      const evaluation = buildEvaluation()
      const time = evaluation.createInstance('wollok.lang.Number', 1)
      sendMessage('flushEvents', evaluation.environment.getNodeByFQN('wollok.gameMirror.gameMirror').id, time)(evaluation)
    })
  })
})