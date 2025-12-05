import { REPL, Evaluation, WRENatives, buildEnvironment } from '../src'
import { interprete, Interpreter } from '../src/interpreter/interpreter'
import natives from '../src/wre/natives'
import { beforeEach, describe, expect, it } from 'vitest'

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
  it('using an empty list of user natives is the same as using WRENatives', () => {
    expect(natives()).toEqual(WRENatives)
  })

  it('merge a user native with WRENatives', () => {
    const nat = natives([myModelNative])
    expect(nat['wollok']).toBe(WRENatives['wollok'])
    expect(nat['model']).toBe(myModelNative['model'])
  })

  describe('evaluation with wre native functions only', () => {
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

    it('works using wre native method', () => {
      const { error, result } = interprete(interpreter, 'testit.listSize()')
      expect(result).toBe('2')
      expect(error).toBeUndefined()
    })
  })

  describe('evaluation with user native functions', () => {
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

    it('works using user native method', () => {
      const { error, result } = interprete(interpreter, 'testit.nativeOne()')
      expect(result).toBe('1')
      expect(error).toBeUndefined()
    })
  })
})