import { Evaluation, RuntimeObject } from '../interpreter'

// TODO:
// tslint:disable:variable-name

export default {

  console: {

    // TODO:
    println: (_self: RuntimeObject, _obj: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    readLine: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    readInt: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    newline: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

  },

}