import { Evaluation, RuntimeObject, Natives } from '../interpreter'

const lib: Natives = {

  console: {

    // TODO:
    println: (_self: RuntimeObject, obj: RuntimeObject) => (evaluation: Evaluation): void => {
      const initialFrameCount = evaluation.frameStack.depth
      evaluation.invoke('toString', obj)
      do {
        evaluation.step()
      } while (evaluation.frameStack.depth > initialFrameCount)
      const message: RuntimeObject = evaluation.currentFrame!.operandStack.pop()!
      message.assertIsString()
      evaluation.log.info(message.innerValue)
      evaluation.currentFrame!.pushOperand(undefined)
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
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, newline))
    },

  },

}

export default lib