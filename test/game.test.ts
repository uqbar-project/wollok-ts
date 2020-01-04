import { should } from 'chai'
import { join } from 'path'
import { RuntimeObject } from '../src/interpreter'
import { Evaluation } from '../src/interpreter'
import { runProgramIn } from './runner'

should()

describe('Actions', () => {

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

const basePackage = 'actions.actions'

const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN(`${basePackage}.visual`).id)

const visuals = (evaluation: Evaluation) => {
  const wVisuals: RuntimeObject = evaluation
    .instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
    .get('visuals')!
  wVisuals.assertIsCollection()
  return wVisuals.innerValue
}

const runGame = (programName: string) =>
  runProgramIn(join('test', 'game'), `${basePackage}.${programName}`)
