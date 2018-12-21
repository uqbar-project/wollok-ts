import { should } from 'chai'
import rewiremock from 'rewiremock'
import link from '../src/linker'
import { Package as PackageNode, Sentence } from '../src/model'
import utils from '../src/utils'
import { Assignment, Class, evaluationBuilders, Field, Package, Reference, Variable } from './builders'

should()

const mockTargets = async (targets: { [name: string]: any }) => rewiremock.around(
  () => import('../src/interpreter'),
  mock => {
    mock(() => import('../src/utils'))
      .withDefault(env => ({
        ...utils(env),
        resolveTarget: reference => targets[reference.name],
      }))
  }
)

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure', { superclass: Reference('wollok.lang.Object') })()
  )
) as unknown as PackageNode<'Filled'>

const environment = link([WRE])

const { Evaluation, Frame, RuntimeObject } = evaluationBuilders(environment)

describe('Wollok Interpreter', () => {

  describe('step evaluation', () => {

    describe('Variable', () => {

      const sentence = Variable('v', { value: Reference('x') }) as Sentence<'Linked'>

      it('should be initialized and saved to the current frame locals', async () => {
        const { compile, run } = await mockTargets({
          x: Variable('x'),
        })

        run(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { x: '1' }, pending: compile(environment)(sentence) }),
            Frame({ locals: { v: '2' } }),
          )
        ).should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { v: '1', x: '1' } }),
            Frame({ locals: { v: '2' } }),
          )
        )
      })

      it('should be initializable with values from a lower frame', async () => {
        const { compile, run } = await mockTargets({
          x: Variable('x'),
        })

        run(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: {}, pending: compile(environment)(sentence) }),
            Frame({ locals: { x: '1' } }),
          )
        ).should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { v: '1' } }),
            Frame({ locals: { x: '1' } }),
          )
        )
      })

    })


    describe('Assignment', () => {

      const sentence = Assignment(Reference('x'), Reference('y')) as Sentence<'Linked'>

      it('should reasing current frame locals', async () => {
        const { compile, run } = await mockTargets({
          x: Variable('x'),
          y: Variable('y'),
        })

        run(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { x: '1' }, pending: compile(environment)(sentence) }),
            Frame({ locals: { x: '1', y: '2' } }),
          )
        ).should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { x: '2' } }),
            Frame({ locals: { x: '1', y: '2' } }),
          )
        )
      })

      it('should reasing lower frame locals', async () => {
        const { compile, run } = await mockTargets({
          x: Variable('x'),
          y: Variable('y'),
        })

        run(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { y: '2' }, pending: compile(environment)(sentence) }),
            Frame({ locals: { x: '1' } }),
          )
        ).should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', {}),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { y: '2' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('should reasing object fields', async () => {
        const { compile, run } = await mockTargets({
          x: Field('x'),
          y: Variable('y'),
        })

        run(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '1' }),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { self: '1', y: '2' }, pending: compile(environment)(sentence) }),
            Frame({ locals: {} }),
          )
        ).should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
            2: RuntimeObject('2', 'wollok.lang.Object', {}),
          })(
            Frame({ locals: { self: '1', y: '2' }, pending: [] }),
            Frame({ locals: {} }),
          )
        )
      })

    })

    // describe('Return')

    // describe('Self')

    // describe('Reference')

    // describe('Literal')

    // describe('Send')

    // describe('Super')

    // describe('New')

    // describe('If')

    // describe('Throw')

    // describe('Try')

  })

})