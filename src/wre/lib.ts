/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Natives, RuntimeObject } from '../interpreter/runtimeModel'

const lib: Natives = {

  console: {

    *println(_self: RuntimeObject, obj: RuntimeObject) {
      const message = yield* this.invoke('toString', obj)
      this.console.log(message!.innerValue)
      return undefined
    },

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