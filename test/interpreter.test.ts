import { should } from 'chai'
import { STORE } from '../src/interpreter'
import link from '../src/linker'
import { Package as PackageNode, Self as SelfNode } from '../src/model'
import { Class, evaluationBuilders, Package, Self } from './builders'

should()

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure')()
  )
) as unknown as PackageNode<'Filled'>

const environment = link([WRE])

const { Evaluation, Frame, RuntimeObject } = evaluationBuilders(environment)

describe('Wollok Interpreter', () => {

  describe('Instructions', () => {

    it('STORE', () => {

      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as SelfNode<'Linked'>, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as SelfNode<'Linked'>, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1', v: '1' }, pending: [[Self as SelfNode<'Linked'>, 0]], referenceStack: [] }),
        Frame({ locals: { a: '1' }, pending: [[Self as SelfNode<'Linked'>, 0]], referenceStack: ['1'] }),
      )

      STORE('v')(before).should.deep.equal(after)

    })

    it('LOAD')

    it('SET')

    it('POP_PENDING')

    it('PUSH_PENDING')

    it('INC_PC')

    it('PUSH_REFERENCE')

    it('POP_REFERENCE')

    it('PUSH_FRAME')

    it('POP_FRAME')

    it('INSTANTIATE')

  })


  describe('step evaluation', () => {

    it('should evaluate Variable nodes')

    it('should evaluate Return nodes')

    it('should evaluate Assignment nodes')

    it('should evaluate Self nodes')

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