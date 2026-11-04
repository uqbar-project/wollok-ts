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

    it('Works using wre native method', () => {

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

    it('Works using wre native method', () => {
      const { error, result } = interprete(interpreter, 'testit.nativeOne()')
      expect(result).to.equal('1')
      expect(error).to.be.undefined
    })
  })

  describe('Dictionary', () => {
    let interpreter: Interpreter

    beforeEach(() => {
      const replEnvironment = buildEnvironment([{
        name: REPL, content: `
        import wollok.game.*

        object counter {
          var property count = 0
          method increment() { count += 1 }
        }

        object dictionaries {
          method visitedRemovingEach(size) {
            const dictionary = new Dictionary()
            (1 .. size).forEach({ i => dictionary.put(i, i) })
            var visited = 0
            dictionary.forEach({ key, value =>
              visited += 1
              dictionary.remove(key)
            })
            return visited
          }
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, natives()))
    })

    it('forEach visits every entry even if the closure removes them', () => {
      const { error, result } = interprete(interpreter, 'dictionaries.visitedRemovingEach(50)')
      expect(result).to.equal('50')
      expect(error).to.be.undefined
    })

    it('schedules due at the same time run on the same flush', () => {
      interprete(interpreter, '(1 .. 50).forEach({ i => game.schedule(100, { counter.increment() }) })')
      interprete(interpreter, 'io.flushEvents(100)')

      const { error, result } = interprete(interpreter, 'counter.count()')
      expect(result).to.equal('50')
      expect(error).to.be.undefined
    })
  })
})