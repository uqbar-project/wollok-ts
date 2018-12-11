import { should } from 'chai'
import { INC_PC, INSTANTIATE, LOAD, POP_FRAME, POP_PENDING, POP_REFERENCE, PUSH_FRAME, PUSH_PENDING, PUSH_REFERENCE, SET, STORE } from '../src/interpreter'
import link from '../src/linker'
import { Package as PackageNode, Sentence } from '../src/model'
import utils from '../src/utils'
import { Class, evaluationBuilders, Package, Reference, Self } from './builders'

should()

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure', { superclass: Reference('wollok.lang.Object') })()
  )
) as unknown as PackageNode<'Filled'>

const environment = link([WRE])
const { resolve } = utils(environment)

const { Evaluation, Frame, RuntimeObject } = evaluationBuilders(environment)

describe('Wollok Interpreter', () => {

  describe('Instructions', () => {

    it('STORE', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1', b: '1' }, pending: [[Self as any, 0]], referenceStack: [] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      STORE('b')(before).should.deep.equal(after)
    })

    it('LOAD', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('2', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '2' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '2' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('2', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '2' }, pending: [[Self as any, 0]], referenceStack: ['2', '1'] }),
        Frame({ locals: { a: '2' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      LOAD('a')(before).should.deep.equal(after)
    })

    it('SET', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object', { a: '1', b: '1' }),
        2: RuntimeObject('2', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1', '2', '1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object', { a: '2', b: '1' }),
        2: RuntimeObject('2', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      SET('a')(before).should.deep.equal(after)
    })

    it('POP_PENDING', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Reference('a') as any, 0], [Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      POP_PENDING(before).should.deep.equal(after)
    })

    it('PUSH_PENDING', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Reference('a') as any, 0], [Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      PUSH_PENDING(Reference('a') as Sentence<'Linked'>)(before).should.deep.equal(after)
    })

    it('INC_PC', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 1]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      INC_PC(before).should.deep.equal(after)
    })

    it('PUSH_REFERENCE', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['2', '1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      PUSH_REFERENCE('2')(before).should.deep.equal(after)
    })

    it('POP_REFERENCE', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1', '2'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['2'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      POP_REFERENCE(before).should.deep.equal(after)
    })

    it('PUSH_FRAME', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Reference('a') as any, 0], [Self as any, 0]], referenceStack: [] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      PUSH_FRAME([Reference('a'), Self as any])(before).should.deep.equal(after)
    })

    it('POP_FRAME', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['2'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1', '2'] }),
      )

      POP_FRAME(before).should.deep.equal(after)
    })

    it('INSTANTIATE', () => {
      const before = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      const after = Evaluation({
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('2', 'wollok.lang.Object'),
      })(
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['2', '1'] }),
        Frame({ locals: { a: '1' }, pending: [[Self as any, 0]], referenceStack: ['1'] }),
      )

      INSTANTIATE(resolve('wollok.lang.Object'), undefined, '2')(before).should.deep.equal(after)
    })

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