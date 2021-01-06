import { should } from 'chai'
import { join } from 'path'
import { RuntimeObject, Frame, compile } from '../src/interpreter'
import { Evaluation } from '../src/interpreter'
import { buildEnvironment } from './assertions'
import natives from '../src/wre/wre.natives'

should()

// TODO: We should have these type of tests for all natives (and maybe move this to an according file)
// TODO: Move the wollok code to language

const basePackage = 'actions'

describe('Wollok Game', () => {

  describe(basePackage, () => {

    const environment = buildEnvironment('**/*.wpgm', join('test', 'game'))

    const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN(`${basePackage}.visual`).id)

    const visuals = (evaluation: Evaluation) => {
      const game = evaluation.instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
      console.log('!!!!!!!!!!!!!!!!')
      console.log(game.locals)
      console.log('!!!!!!!!!!!!!!!!')
      const wVisuals: RuntimeObject = game.get('visuals')!
      wVisuals.assertIsCollection()
      return wVisuals.innerValue
    }

    const runGameProgram = (programFQN: string) => {
      const evaluation = Evaluation.create(environment, natives)
      const program = environment.getNodeByFQN<'Program'>(programFQN)

      evaluation.log.info('Running program', programFQN)

      evaluation.pushFrame(new Frame(evaluation.rootContext, compile(program)))
      evaluation.stepAll()

      evaluation.log.success('Done!')

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
      const evaluation = Evaluation.create(environment, natives)
      const time = RuntimeObject.number(evaluation, 1)
      evaluation.invoke('flushEvents', evaluation.instance(evaluation.environment.getNodeByFQN('wollok.gameMirror.gameMirror').id), time)
      evaluation.stepAll()
    })
  })
})