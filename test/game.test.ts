import { should } from 'chai'
import { resolve } from 'path'
import { buildEnvironment } from './assertions'
import natives from '../src/wre/wre.natives'
import { Environment } from '../src'
import interpret, { Interpreter } from '../src/interpreter/interpreter'

should()

// TODO: Move the wollok code to language -> We need to run programs!

describe('Wollok Game', () => {

  describe('actions', () => {

    let environment: Environment
    let interpreter: Interpreter 


    before(async () => {
      environment = await buildEnvironment('**/*.wpgm', resolve('language', 'test', 'game'))
    })

    beforeEach(() => {
      interpreter = interpret(environment, natives)
    })

    it('addVisual', () => {
      interpreter.run('actions.addVisual')
      const visuals = interpreter.object('wollok.game.game').get('visuals')!.innerValue!
      visuals.should.have.length(1)
    })

    it('removeVisual', () => {
      interpreter.run('actions.removeVisual')
      const visuals = interpreter.object('wollok.game.game').get('visuals')!.innerValue!
      visuals.should.have.length(0)
    })

    it('say', () => {
      interpreter.run('actions.say')
      interpreter.object('actions.visual').get('message')!.innerValue!.should.equal('Hi!')
      interpreter.object('actions.visual').get('messageTime')!.innerValue!.should.equal(2000)
    })

    it('clear', () => {
      interpreter.run('actions.clear')
      const visuals = interpreter.object('wollok.game.game')!.get('visuals')!.innerValue!
      visuals.should.have.length(0)

    })

    it('flush event', () => {
      const game = interpreter.object('wollok.game.game')!
      const time = interpreter.reify(1)
      interpreter.send('flushEvents', game, time)
    })

    it('with file name game (devil test)', () => {
      interpreter.run('game.juego')
    })
  })
})