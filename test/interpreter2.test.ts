import { expect, use } from 'chai'
import sinonChai from 'sinon-chai'
import { restore, stub } from 'sinon'
import { Class, Package, Reference } from '../src'
import { Context, Runner, RuntimeObject } from '../src/interpreter2/runtimeModel'
import link from '../src/linker'

use(sinonChai)


const WRE = link([
  new Package({
    name: 'wollok',
    members: [
      new Package({
        name: 'lang',
        members: [
          new Class({ name: 'Object' }),
        ],
      }),
    ],
  }),
])


describe('Wollok Node Interpreter', () => {

  afterEach(restore)

  describe('Runner', () => {


  })

  describe('Execution', () => {

    describe('Reference', () => {

      it('should return the object referenced on the given context, if any', () => {
        const node = new Reference({ name: 'x' })
        const context = new Context(undefined, {
          x: new RuntimeObject(WRE.getNodeByFQN('wollok.lang.Object'), null as any),
          y: new RuntimeObject(WRE.getNodeByFQN('wollok.lang.Object'), null as any),
        })
        const runner = new Runner(WRE, {}, node, context)

        const result = runner.resume()!

        expect(result).to.be.equal(context.get('x'))
        expect(result).not.be.equal(context.get('y'))
      })

      it('should return undefined if the is no referenced object on the given context', () => {
        const node = new Reference({ name: 'x' })
        const context = new Context(undefined, { y: new RuntimeObject(WRE.getNodeByFQN('wollok.lang.Object'), null as any) })
        const runner = new Runner(WRE, {}, node, context)


        const result = runner.resume()

        expect(result).to.be.undefined
      })

      it('should break before executing', () => {
        const node = new Reference({ name: 'x' })
        const context = new Context()
        const runner = new Runner(WRE, {}, node, context)

        stub(context, 'get').throws('Should not have reached this point')

        const result = runner.resume([node])!

        expect(result).to.be.undefined
      })

    })

  })

})