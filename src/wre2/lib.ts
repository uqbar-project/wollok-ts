/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Natives, RuntimeObject } from '../interpreter2/runtimeModel'

const lib: Natives = {

  console: {

    // TODO: Pending Implementation
    // *println(_self: RuntimeObject, obj: RuntimeObject) { },

    // TODO: Pending Implementation
    // readLine(_self: RuntimeObject),

    // TODO:
    // readInt(_self: RuntimeObject) { }

    *newline(_self: RuntimeObject) {
      const newline = process.platform.toLowerCase().startsWith('win') ? '\r\n' : '\n'
      return yield* this.reify(newline)
    },

  },

}

export default lib