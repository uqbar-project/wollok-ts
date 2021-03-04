import { expect, use } from 'chai'
import sinonChai from 'sinon-chai'
import { restore, stub } from 'sinon'
import { Reference } from '../src'
import { Runner, RuntimeObject } from '../src/interpreter2/runtimeModel'

use(sinonChai)

describe('Wollok Node Interpreter', () => {

  afterEach(restore)

  describe('Runner', () => {


  })

  describe('Execution', () => {

    describe('Reference', () => {

      it('should return the object referenced on the given context, if any', () => {
        const node = new Reference({ name: 'x' })
        const context = new Map([
          ['x', new RuntimeObject()],
          ['y', new RuntimeObject()],
        ])

        const runner = new Runner(node, context)

        const result = runner.resume()!

        expect(result).to.be.equal(context.get('x'))
        expect(result).not.be.equal(context.get('y'))
      })

      it('should return undefined if the is no referenced object on the given context', () => {
        const node = new Reference({ name: 'x' })
        const context = new Map([
          ['y', new RuntimeObject()],
        ])

        const runner = new Runner(node, context)

        const result = runner.resume()

        expect(result).to.be.undefined
      })

      it('should break before executing', () => {
        const node = new Reference({ name: 'x' })
        const context = new Map()
        stub(context, 'get').throws('Should not have reached this point')

        const runner = new Runner(node, context)

        const result = runner.resume([node])!

        expect(result).to.be.undefined
      })

    })

  })

})