import { should } from 'chai'
import { buildEnvironment } from '../src'
import { RuntimeObject } from '../src/interpreter'
import interpreter, { Evaluation } from '../src/interpreter'
import natives from '../src/wre/wre.natives'

should()

describe.only('Wollok Game', () => {

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

  // TODO: Move these to .wtest
  describe('io events', () => {

    it.skip('addVisualCharacter', () => {
      runGame(`
        const character = new Visual()
        game.addVisualCharacter(character)
        io.queueEvent(["keydown", "KeyUp"])
        io.flushEvents(0)
        assert.equals(game.at(0, 1), character.position())
      `)
    })

    it('whenKeyPressedDo', () => {
      runGame(`
        const event = ["keydown", "KeyA"]
        game.whenKeyPressedDo(event, closureMock)
        io.queueEvent(event)
        io.flushEvents(0)
        assert.that(closureMock.called())
      `)
    })

    describe('whenCollideDo', () => {

      it('never', () => {
        runGame(`
          game.whenCollideDo(visual, closureMock)
          io.flushEvents(0)
          assert.notThat(closureMock.called())
        `)
      })

      it('once', () => {
        runGame(`
          game.whenCollideDo(visual, closureMock)
          game.addVisual(new Visual())
          io.flushEvents(0)
          assert.that(closureMock.called())
        `)
      })

      it('many times', () => {
        runGame(`
          game.whenCollideDo(visual, closureMock)
          game.addVisual(new Visual())
          io.flushEvents(0)
          io.flushEvents(1)
          assert.equals(2, closureMock.calledCount())
        `)
      })
    })

    describe('onCollideDo', () => {

      it('never', () => {
        runGame(`
          game.onCollideDo(visual, closureMock)
          io.flushEvents(0)
          assert.notThat(closureMock.called())
        `)
      })

      it('once', () => {
        runGame(`
          game.onCollideDo(visual, closureMock)
          game.addVisual(new Visual())
          io.flushEvents(0)
          assert.that(closureMock.called())
        `)
      })

      it('only once in same collision', () => {
        runGame(`
          game.onCollideDo(visual, closureMock)
          game.addVisual(new Visual())
          io.flushEvents(0)
          io.flushEvents(1)
          assert.equals(1, closureMock.calledCount())
        `)
      })

      it('many times in many collisions', () => {
        runGame(`
          game.onCollideDo(visual, closureMock)
          const collider = new Visual()
          game.addVisual(collider)
          io.flushEvents(0)
          collider.position(game.at(1, 1))
          io.flushEvents(1)
          collider.position(game.origin())
          io.flushEvents(2)
          assert.equals(2, closureMock.calledCount())
        `)
      })
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

      it('many times', () => {
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
      import wollok.io.*
      import wollok.game.*

      object closureMock {
        var property calledCount = 0
        method called() = calledCount > 0
        method apply(args...) { calledCount += 1 }
      }

      class Visual {
        var property position = game.origin()
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
  runProgram('test.game.gameTest', evaluation)
  return evaluation
}