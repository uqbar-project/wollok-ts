import { expect, should, use } from 'chai'
import { restore } from 'sinon'
import sinonChai from 'sinon-chai'
import {  REPL, Evaluation, WRENatives, buildEnvironment } from '../src'
import { interprete, Interpreter } from '../src/interpreter/interpreter'
import natives from '../src/wre/natives'
import { compareAssertions } from './assertions'

use(sinonChai)
use(compareAssertions)
should()

const myModelNative = {
  model: {
    myModel: {
      *nativeOne(this: any, _self: any): any {
        return yield* this.reify(1)
      },
    },
  },
}


describe('Native functions', () => {

  afterEach(restore)

  it('"Using an empty list of user natives is the same as using WRENatives',  () => {
    expect(natives()).to.deepEquals(WRENatives)
  })

  it('"merge a user native with WRENatives',  () => {
    const nat = natives([myModelNative] )
    expect(nat['wollok']).to.be.equals( WRENatives['wollok'])
    expect(nat['model']).to.be.equals( myModelNative['model'])
  })

  describe('Evaluation with wre native functions only', () => {
    let interpreter: Interpreter

    beforeEach(() => {
      const replEnvironment = buildEnvironment([{
        name: 'model.wlk', content: `
        object myModel {
            method listSize() {
              return [1,2].size()
            }
        }`,
      },
      {
        name: REPL, content: `
        import model.*

        object testit {
         method listSize() = myModel.listSize()
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, natives()))
    })

    it('Using wre native method return ok', () => {

      const { error, result } = interprete(interpreter, 'testit.listSize()')
      expect(result).to.equal('2')
      expect(error).to.be.undefined
    })
  })

  describe('Evaluation with user native functions', () => {
    let interpreter: Interpreter

    beforeEach(() => {
      const replEnvironment = buildEnvironment([{
        name: 'model.wlk', content: `
        object myModel {
            method listSize() {
              return [1,2].size()
            }
            method nativeOne() native
        }`,
      },
      {
        name: REPL, content: `
        import model.*

        object testit {
         method listSize() = myModel.listSize()
         method nativeOne() = myModel.nativeOne()
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, natives([myModelNative])))
    })

    it('Using wre native method return ok', () => {
      const { error, result } = interprete(interpreter, 'testit.nativeOne()')
      expect(result).to.equal('1')
      expect(error).to.be.undefined
    })
  })
})