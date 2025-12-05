import { describe, it, expect, afterAll, vi } from 'vitest'
import { resolve } from 'path'
import { PROGRAM_FILE_EXTENSION } from '../src'
import { interpret } from '../src/interpreter/interpreter'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './utils'

describe('Benchmarks', () => {
  const results: any[] = []

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.table(results)
  })

  describe('flushEvents', () => {

    function benchmark(fqn: string, expectedTime = 0) {
      it(fqn, async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})

        const iterations = 30
        const program = `games.${fqn}`
        const message = 'flushEvents'

        let totalTime = 0
        for (let index = 0; index < iterations; index++)
          totalTime += await measure(program, message)

        const time = totalTime / iterations
        const deltaError = expectedTime * 0.2

        vi.restoreAllMocks()

        results.push({ message, fqn, time, iterations })

        expect(time).toBeCloseTo(expectedTime, deltaError)
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
})

async function measure(programFQN: string, message: string): Promise<number> {
  const environment = await buildEnvironment(
    `**/*.${PROGRAM_FILE_EXTENSION}`,
    resolve('language', 'benchmarks')
  )

  const interpreter = interpret(environment, natives)
  interpreter.run(programFQN)

  const game = interpreter.object('wollok.game.game')

  // fill caches
  interpreter.send(message, game, interpreter.reify(0))

  const startTime = performance.now()
  for (let ms = 1; ms < 10; ms++)
    interpreter.send(message, game, interpreter.reify(ms))
  const endTime = performance.now()

  return endTime - startTime
}