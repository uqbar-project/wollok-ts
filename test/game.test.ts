import { should } from 'chai'
import { join } from 'path'
import { buildEnvironment } from './assertions'
import natives from '../src/wre/wre.natives'
import { Environment, Program, Evaluation } from '../src'
import { traverse } from '../src/extensions'

should()

// TODO: Move the wollok code to language

describe('Wollok Game', () => {

  describe('actions', () => {

    let environment!: Environment

    before(async () => {
      environment = await buildEnvironment('**/*.wpgm', join('test', 'game'))
    })

    const runGameProgram = (programFQN: string) => {
      const evaluation = Evaluation.build(environment, natives)
      const program = environment.getNodeByFQN<Program>(programFQN)

      console.info('Running program', programFQN)

      const gen = evaluation.exec(program.body)
      traverse(gen)

      console.info('Done!')

      return evaluation
    }

    it('addVisual', () => {
      const evaluation = runGameProgram('actions.addVisual')
      const visuals = evaluation.currentContext.get('wollok.game.game')!.get('visuals')!.innerValue!
      visuals.should.have.length(1)
    })

    it('removeVisual', () => {
      const evaluation = runGameProgram('actions.removeVisual')
      const visuals = evaluation.currentContext.get('wollok.game.game')!.get('visuals')!.innerValue!
      visuals.should.have.length(0)
    })

    it('say', () => {
      const evaluation = runGameProgram('actions.say')
      evaluation.currentContext.get('actions.visual')!.get('message')!.innerValue!.should.equal('Hi!')
      evaluation.currentContext.get('actions.visual')!.get('messageTime')!.innerValue!.should.equal(2000)
    })

    it('clear', () => {
      const evaluation = runGameProgram('actions.clear')
      const visuals = evaluation.currentContext.get('wollok.game.game')!.get('visuals')!.innerValue!
      visuals.should.have.length(0)
    })

    it('flush event', () => traverse(function*() {
      const evaluation = Evaluation.build(environment, natives)
      const gameMirror = evaluation.currentContext.get('wollok.gameMirror.gameMirror')!
      const time = yield* evaluation.reify(1)
      yield* evaluation.invoke('flushEvents', gameMirror, time)
    }()))
  })
})