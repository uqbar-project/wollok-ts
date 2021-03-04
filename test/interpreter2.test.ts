import { expect, use } from 'chai'
import sinonChai from 'sinon-chai'
import { restore, stub } from 'sinon'
import { Class, Node, Package, Reference } from '../src'
import { Context, Natives, Runner, RuntimeObject } from '../src/interpreter2/runtimeModel'
import link from '../src/linker'
import { buildEnvironment } from './assertions'

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

  describe('Sanity', () => {
    it('Correr todos a ver qué pasa', async () => {
      const nativesFalopa: Natives = {
        wollok:{ //
          game:{ //
            game: { //
              *title(this: Runner): Generator<Node, RuntimeObject | undefined> { return yield* this.reify('') },
              *width(this: Runner): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(10) },
              *height(this: Runner): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(10) },
              *doCellSize(this: Runner): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(10) },
              *ground(this: Runner): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(null) },
            },
          },
          lang:{ //
            Number: { //
              *['<'](this: Runner, self: RuntimeObject, other: RuntimeObject): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(self.innerValue as number < (other.innerValue as number)) },
              *['*'](this: Runner, self: RuntimeObject, other: RuntimeObject): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(self.innerValue as number * (other.innerValue as number)) },
            },
            Boolean: { //
              *['||'](this: Runner, self: RuntimeObject, other: RuntimeObject): Generator<Node, RuntimeObject | undefined> { return yield* this.reify(self === self.get('true') || other === self.get('true')) },
            },
            Dictionary: { //
              *initialize(this: Runner, self: RuntimeObject): Generator<Node, RuntimeObject | undefined> { return yield * this.invoke('clear', self) },
              *clear(this: Runner, self: RuntimeObject): Generator<Node, RuntimeObject | undefined> {
                self.set('<keys>', yield * this.list([]))
                self.set('<values>', yield * this.list([]))
                return
              },
            },
          },
        },
      }

      const environment = await buildEnvironment('**/*.@(wlk|wtest)', 'language/test/sanity', true)
      // TODO: Maybe runner should have a message run(node) that returns a controller, so the node is not an argument at creation
      const rootContext = new Runner(environment, nativesFalopa, environment).rootContext

      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.time('CORRIENDO TESTS')
      const results = environment.reduce((results, node) => {
        if(!node.is('Test')) return results

        try {
          new Runner(environment, nativesFalopa, node.body).resume()
          return { success: results.success + 1, failure: results.failure }
        } catch (error) {
          console.log('######', error)
          return { success: results.success, failure: results.failure + 1 }
        }
      }, { success: 0, failure: 0 })
      console.timeEnd('CORRIENDO TESTS')
      console.log(results)
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
    })
  })

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