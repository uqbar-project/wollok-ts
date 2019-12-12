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

  describe('io events', () => {

    it('whenKeyPressedDo', () => {
      runGame(`
        const event = ["keydown", "KeyA"]
        game.whenKeyPressedDo(event, closureMock)
        io.queueEvent(event)
        io.flushEvents(0)
        assert.that(closureMock.called())
      `)
    })

    it('whenCollideDo', () => {
      runGame(`
        game.whenCollideDo(visual, closureMock)
        game.addVisual(new Visual())
        io.flushEvents(0)
        assert.that(closureMock.called())
      `)
    })

    describe('onTick', () => {

      it('never', () => {
        runGame(`
          game.onTick(1000, "", closureMock)
          io.flushEvents(999)
          assert.notThat(closureMock.called())
        `)
      })

      it('once', () => {
        runGame(`
          game.onTick(1000, "", closureMock)
          io.flushEvents(1000)
          assert.that(closureMock.called())
        `)
      })

      it('many', () => {
        runGame(`
          game.onTick(1000, "", closureMock)
          io.flushEvents(1000)
          io.flushEvents(2000)
          assert.equals(2, closureMock.calledCount())
        `)
      })
    })

    it('removeTickEvent', () => {
      runGame(`
        game.onTick(1000, "event", closureMock)
        game.removeTickEvent("event")
        io.flushEvents(1000)
        assert.notThat(closureMock.called())
      `)
    })

    describe('schedule', () => {

      it('once', () => {
        runGame(`
          game.schedule(1000, closureMock)
          io.flushEvents(1000)
          assert.that(closureMock.called())
        `)
      })

      it('only once', () => {
        runGame(`
          game.schedule(1000, closureMock)
          io.flushEvents(1000)
          io.flushEvents(2000)
          assert.equals(1, closureMock.calledCount())
        `)
      })

    })

  })

})

const visualObject = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN('game.visual').id)

const visuals = (evaluation: Evaluation) => {
  const wVisuals: RuntimeObject = evaluation
    .instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)
    .get('visuals')!
  wVisuals.assertIsCollection()
  return wVisuals.innerValue!
}

const runGame = (content: string = '') => {
  const gameProgram = {
    name: 'game',
    content: `
      import wollok.io.*
      import wollok.game.*

      object closureMock {
        var property calledCount = 0
        method called() = calledCount > 0
        method apply(args...) { calledCount += 1 }
      }

      class Visual {
        method position() = game.origin()
      }

      object visual inherits Visual { }

      program gameTest {
        game.addVisual(visual)
        ${content}
      }
    `,
  }
  const environment = buildEnvironment([gameProgram])
  const { runProgram, buildEvaluation } = interpreter(environment, natives)
  const evaluation = buildEvaluation()
  // tslint:disable-next-line: no-console
  console.log(evaluation.instances)
  runProgram('game.gameTest', evaluation)
  return evaluation
}