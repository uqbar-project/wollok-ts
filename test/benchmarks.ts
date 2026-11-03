import { should } from 'chai'
import { resolve } from 'path'
import { restore, stub } from 'sinon'
import { PROGRAM_FILE_EXTENSION, WOLLOK_FILE_EXTENSION } from '../src'
import { interpret } from '../src/interpreter/interpreter'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './utils'

should()

describe('Benchmarks', () => {
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
        const deltaError = expectedTime * 0.2
        restore()

        // console.info(`${message} - ${fqn} - ${time} ms (${iterations} iterations)`)
        results.push({ message, fqn, time, iterations })
        time.should.be.closeTo(expectedTime, deltaError)
      })
    }

    benchmark('empty', 6)
    benchmark('visuals_1', 4.5)
    benchmark('visuals_100', 4.5)
    benchmark('ticks_1', 12)
    benchmark('ticks_100', 657)
    benchmark('onCollide_1', 11)
    benchmark('onCollide_10_same_position', 5000)
    benchmark('onCollide_100_diff_positions', 675)

  })

  describe('constant literal methods', () => {

    it('are faster than equivalent interpreted methods', async () => {
      stub(console)
      const message = 'image'
      const sends = 50000

      const compiledTime = await measureSends('constants.constantMethod', message, sends)
      const interpretedTime = await measureSends('constants.computedMethod', message, sends)
      restore()

      results.push({ message, fqn: 'constants.constantMethod', time: compiledTime, iterations: sends })
      results.push({ message, fqn: 'constants.computedMethod', time: interpretedTime, iterations: sends })

      compiledTime.should.be.lessThan(interpretedTime)
    })

  })
})

async function measure(programFQN: string, message: string): Promise<number> {
  const environment = await buildEnvironment(`**/*.${PROGRAM_FILE_EXTENSION}`, resolve('language', 'benchmarks'))
  const interpreter = interpret(environment, natives)

  interpreter.run(programFQN)
  const game = interpreter.object('wollok.game.game')

  interpreter.send(message, game, interpreter.reify(0)) // Fill caches
  const startTime = performance.now()
  for (let ms = 1; ms < 10; ms++)
    interpreter.send(message, game, interpreter.reify(ms))
  const endTime = performance.now()

  const elapsedTime = endTime - startTime
  return elapsedTime
}

async function measureSends(objectFQN: string, message: string, sends: number): Promise<number> {
  const environment = await buildEnvironment(`**/*.${WOLLOK_FILE_EXTENSION}`, resolve('language', 'benchmarks'))
  const interpreter = interpret(environment, natives)
  const receiver = interpreter.object(objectFQN)

  interpreter.send(message, receiver) // Fill caches
  const startTime = performance.now()
  for (let send = 0; send < sends; send++)
    interpreter.send(message, receiver)
  const endTime = performance.now()

  return endTime - startTime
}