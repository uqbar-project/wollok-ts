import { should } from 'chai'
import { resolve } from 'path'
import { Environment, PROGRAM_FILE_EXTENSION } from '../src'
import { interpret, Interpreter } from '../src/interpreter/interpreter'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './assertions'

should()

describe('Wollok Game', () => {

  describe('flushEvents', () => {

    let environment: Environment
    let interpreter: Interpreter
    
    beforeEach(async() => {
      environment = await buildEnvironment(`**/*.${PROGRAM_FILE_EXTENSION}`, resolve('language', 'benchmarks'))
      interpreter = interpret(environment, natives)
    })

    function benchmark(fqn: string, expectedTime = 0) {
      it(fqn, () => {
        interpreter.run(`games.${fqn}`)
        const game = interpreter.object('wollok.game.game')
        const message = 'flushEvents'
        const ms = interpreter.reify(1)
        
        const startTime = performance.now()
        interpreter.send(message, game, ms)
        const endTime = performance.now()
        const elapsedTime = endTime - startTime

        const deltaError = 0.3 * expectedTime
        console.log(`${fqn} - ${message} - ${elapsedTime}`)
        elapsedTime.should.be.closeTo(expectedTime, deltaError)
      })
    }

    benchmark('empty', 2.5)
    benchmark('visuals_1', 2.5)
    benchmark('visuals_100', 0.6) // lookup cache
    benchmark('ticks_1', 4)
    benchmark('ticks_100', 61)
    benchmark('onCollide_1', 1.2) // lookup cache
    benchmark('onCollide_100', 52)

  })
})