import { should } from 'chai'
import { resolve } from 'path'
import { Environment, Execution, get, Natives, PROGRAM_FILE_EXTENSION, RuntimeObject } from '../src'
import { interpret, Interpreter } from '../src/interpreter/interpreter'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './utils'

should()

describe('Wollok Game', () => {

  describe('actions', () => {

    let environment: Environment
    let interpreter: Interpreter
    const logs: string[] = []

    const mockNativeFunction = function* (_self: RuntimeObject, obj: RuntimeObject): Execution<void> {
      logs.push(obj.innerString!)
    }

    before(async () => {
      environment = await buildEnvironment(`**/*.${PROGRAM_FILE_EXTENSION}`, resolve('language', 'test', 'game'))
      const wConsole = get<Natives>(natives, 'wollok.lib.console')!
      wConsole.println = mockNativeFunction
    })

    beforeEach(() => {
      interpreter = interpret(environment, natives)
    })

    it('say set message and time to visual', () => {
      interpreter.run('actions.say')
      interpreter.object('actions.visual').get('message')!.innerValue!.should.equal('Hi!')
      interpreter.object('actions.visual').get('messageTime')!.innerValue!.should.equal(2000)
    })

    it('on DomainError, visual source says the message', () => {
      interpreter.run('actions.domainError')
      interpreter.object('actions.visual').get('message')!.innerValue!.should.equal('DOMAIN_ERROR')
      interpreter.object('actions.visual').get('messageTime')!.innerValue!.should.equal(2000)
    })

    it('on DomainError with error reporter, it says the message', () => {
      interpreter.run('actions.domainErrorWithReporter')
      interpreter.object('actions.reporter').get('message')!.innerValue!.should.equal('DOMAIN_ERROR')
      interpreter.object('actions.reporter').get('messageTime')!.innerValue!.should.equal(2000)
    })

    it('on Error, console should print stack trace', () => {
      interpreter.run('actions.genericError')
      logs.should.be.deep.eq([
        'wollok.lang.Exception: ERROR',
        '\tat actions.genericError [actions.wpgm:37]'])
    })

    it('with file name game (devil test)', () => {
      interpreter.run('game.juego')
    })

    it('detects colliders in the same position using spatial grid', () => {
      interpreter.run('actions.collisions')
      const game = interpreter.object('wollok.game.game')
      const m1 = interpreter.object('actions.movable1')
      const m2 = interpreter.object('actions.movable2')
      const far = interpreter.object('actions.farAway')

      const collidersM1 = interpreter.send('colliders', game, m1)
      collidersM1!.innerCollection!.should.deep.equal([m2])

      const collidersFar = interpreter.send('colliders', game, far)
      collidersFar!.innerCollection!.should.deep.equal([])
    })

    it('updates spatial grid when an object changes position', () => {
      interpreter.run('actions.collisions')
      const game = interpreter.object('wollok.game.game')
      const m1 = interpreter.object('actions.movable1')
      const m2 = interpreter.object('actions.movable2')
      const far = interpreter.object('actions.farAway')

      // Move m1 to farAway's position
      interpreter.send('position', m1, interpreter.send('position', far)!)

      const collidersFar = interpreter.send('colliders', game, far)
      collidersFar!.innerCollection!.should.deep.equal([m1])

      const collidersM2 = interpreter.send('colliders', game, m2)
      collidersM2!.innerCollection!.should.deep.equal([])
    })

    it('removes visual from spatial grid when removeVisual is called', () => {
      interpreter.run('actions.collisions')
      const game = interpreter.object('wollok.game.game')
      const m1 = interpreter.object('actions.movable1')
      const m2 = interpreter.object('actions.movable2')

      interpreter.send('removeVisual', game, m2)

      const collidersM1 = interpreter.send('colliders', game, m1)
      collidersM1!.innerCollection!.should.deep.equal([])
    })

    it('finds objects at given position with getObjectsIn', () => {
      interpreter.run('actions.collisions')
      const game = interpreter.object('wollok.game.game')
      const m1 = interpreter.object('actions.movable1')
      const m2 = interpreter.object('actions.movable2')
      const pos = interpreter.send('position', m1)!

      const objectsInPos = interpreter.send('getObjectsIn', game, pos)
      objectsInPos!.innerCollection!.should.deep.equal([m1, m2])
    })  })
})