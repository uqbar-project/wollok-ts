import { should } from 'chai'
import { resolve } from 'path'
import { restore, stub } from 'sinon'
import { PROGRAM_FILE_EXTENSION } from '../src'
import { interpret } from '../src/interpreter/interpreter'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './assertions'

should()

describe('Wollok Game', () => {
  const results: any[] = []

  after(() => console.table(results))

  describe('flushEvents', () => {

    function benchmark(fqn: string, expectedTime = 0) {
      it(fqn, async () => {
        stub(console)
        const iterations = 30

        const program = `games.${fqn}`
        const message = 'flushEvents'

        let totalTime = 0
        for (let index = 0; index < iterations; index++)
          totalTime += await measure(program, message)


        const time = totalTime / iterations
        const deltaError = Math.max(0.1, expectedTime * 0.1) // 0.1 or 10 %
        restore()

        // console.info(`${message} - ${fqn} - ${time} ms (${iterations} iterations)`)
        results.push({ message, fqn, time, iterations })
        time.should.be.closeTo(expectedTime, deltaError)
      })
    }

    benchmark('empty', 0.55)
    benchmark('visuals_1', 0.4)
    benchmark('visuals_100', 0.3)
    benchmark('ticks_1', 0.8)
    benchmark('ticks_100', 44)
    benchmark('onCollide_1', 0.8)
    benchmark('onCollide_100', 44)

  })
})

async function measure(programFQN: string, message: string): Promise<number> {
  const environment = await buildEnvironment(`**/*.${PROGRAM_FILE_EXTENSION}`, resolve('language', 'benchmarks'))
  const interpreter = interpret(environment, natives)

  interpreter.run(programFQN)
  const game = interpreter.object('wollok.game.game')

  interpreter.send(message, game, interpreter.reify(0)) // Fill caches
  const startTime = performance.now()
  interpreter.send(message, game, interpreter.reify(1))
  const endTime = performance.now()

  const elapsedTime = endTime - startTime
  return elapsedTime
}