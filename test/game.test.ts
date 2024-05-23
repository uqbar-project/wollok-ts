import { should } from 'chai'
import { resolve } from 'path'
import { buildEnvironment } from './assertions'
import natives from '../src/wre/wre.natives'
import { Environment, GAME_MODULE, PROGRAM_FILE_EXTENSION } from '../src'
import { interpret, Interpreter } from '../src/interpreter/interpreter'

should()

describe('Wollok Game', () => {

  describe('actions', () => {

    let environment: Environment
    let interpreter: Interpreter


    before(async () => {
      environment = await buildEnvironment(`**/*.${PROGRAM_FILE_EXTENSION}`, resolve('language', 'test', 'game'))
    })

    beforeEach(() => {
      interpreter = interpret(environment, natives)
    })

    it('say set message and time to visual', () => {
      interpreter.run('actions.say')
      interpreter.object('actions.visual').get('message')!.innerValue!.should.equal('Hi!')
      interpreter.object('actions.visual').get('messageTime')!.innerValue!.should.equal(2000)
    })

    it('clear', () => {
      interpreter.run('actions.clear')
      const visuals = interpreter.object(GAME_MODULE)!.get('visuals')!.innerValue!
      visuals.should.have.length(0)

    })

    it('flush event', () => {
      const game = interpreter.object(GAME_MODULE)!
      const time = interpreter.reify(1)
      interpreter.send('flushEvents', game, time)
    })

    it('with file name game (devil test)', () => {
      interpreter.run('game.juego')
    })
  })
})