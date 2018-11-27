import { should } from 'chai'
import { Evaluation, step } from '../src/interpreter'
import link from '../src/linker'
import { Self as SelfNode } from '../src/model'
import { Class, Package, Self } from './builders'

should()

const WRE = Package('wollok')(
  Class('Object')(),
  Class('Closure')()
)

describe('Wollok interpreter', () => {

  describe('step evaluation', () => {
    it('should evaluate Variable nodes')


    it('should evaluate Return nodes')

    it('should evaluate Assignment nodes')

    it('should evaluate Self nodes', () => {
      const environment = link([WRE])

      const initial: Evaluation = {
        status: 'running',
        environment,
        frameStack: [
          { scope: { self: '1' }, pending: [[Self as SelfNode, 0]], referenceStack: [] },
        ],
        instances: {},
      }

      step(initial).should.deep.equal({
        status: 'running',
        environment,
        frameStack: [
          { scope: { self: '1' }, pending: [], referenceStack: ['1'] },
        ],
        instances: {},
      })

    })

    it('should evaluate Reference nodes')

    it('should evaluate Literal nodes')

    it('should evaluate Send nodes')

    it('should evaluate Super nodes')

    it('should evaluate New nodes')

    it('should evaluate If nodes')

    it('should evaluate Throw nodes')

    it('should evaluate Try nodes')

  })

})