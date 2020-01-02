import { should } from 'chai'
import { buildEnvironment } from '../src'
import { RuntimeObject } from '../src/interpreter'
import interpreter, { Evaluation } from '../src/interpreter'
import natives from '../src/wre/wre.natives'

should()

describe('Wollok Game', () => {

  it('addVisual', () => {
    const evaluation = runGame()
    visuals(evaluation).should.have.length(1)
  })

  it('removeVisual', () => {
    const evaluation = runGame('game.removeVisual(visual)')
    visuals(evaluation).should.have.length(0)
  })

  it('say', () => {
    const evaluation = runGame('game.say(visual, "Hi!")')
    visualObject(evaluation).get('message')!.innerValue!.should.be.eq('Hi!')
    visualObject(evaluation).get('messageTime')!.innerValue!.should.be.eq(2000)
  })

  it('clear', () => {
    const evaluation = runGame('game.clear()')
    visuals(evaluation).should.have.length(0)
  })

})

const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN('test.game.visual').id)

const visuals = (evaluation: Evaluation) => {
  const wVisuals: RuntimeObject = evaluation
    .instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
    .get('visuals')!
  wVisuals.assertIsCollection()
  return wVisuals.innerValue!
}

const runGame = (content: string = '') => {
  const gameProgram = {
    name: 'test/game.wpgm',
    content: `
      import wollok.game.*

      object visual {
        method position() = game.origin()
      }

      program gameTest {
        game.addVisual(visual)
        ${content}
      }
    `,
  }
  const environment = buildEnvironment([gameProgram])
  const { runProgram, buildEvaluation } = interpreter(environment, natives)
  const evaluation = buildEvaluation()
  runProgram('test.game.gameTest', evaluation)
  return evaluation
}