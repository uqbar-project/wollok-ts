import { Evaluation, RuntimeObject, Natives } from '../interpreter'
import { returnVoid } from './game'
import { interpret } from '..'
import WRENatives from './wre.natives'

const getObjectAsString = (obj: RuntimeObject) => (evaluation: Evaluation): string => {
  const currentFrame = evaluation.currentFrame()!
  const { sendMessage } = interpret(evaluation.environment, WRENatives)
  sendMessage('toString', obj.id)(evaluation)
  const objectString: RuntimeObject = evaluation.instance(currentFrame.operandStack.pop()!)
  objectString.assertIsString()
  return objectString.innerValue
}

const lib: Natives = {

  console: {
    println: (_self: RuntimeObject, obj: RuntimeObject) => (evaluation: Evaluation): void => {
      const message: string = getObjectAsString(obj)(evaluation)
      // eslint-disable-next-line no-console
      console.log(message)
      returnVoid(evaluation)
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
      evaluation.currentFrame()!.pushOperand(evaluation.createInstance('wollok.lang.String', newline))
    },

  },

}

export default lib