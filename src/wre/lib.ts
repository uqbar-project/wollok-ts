import { Evaluation, RuntimeObject, Natives } from '../interpreter'

const lib: Natives = {

  console: {

    // TODO:
    println: (_self: RuntimeObject, _obj: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented: console.println')
    },

    // TODO:
    readLine: (_self: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented console.readLine')
    },

    // TODO:
    readInt: (_self: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented console.readInt')
    },

    newline: (_self: RuntimeObject) => (evaluation: Evaluation): void => {
      const newline = process.platform.toLowerCase().startsWith('win') ? '\r\n' : '\n'
      evaluation.currentFrame()!.pushOperand(evaluation.string(newline))
    },

  },

}

export default lib