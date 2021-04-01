import { Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'

const lib: Natives = {

  console: {

    *println(_self: RuntimeObject, obj: RuntimeObject): Execution<RuntimeValue> {
      const message = yield* this.invoke('toString', obj)
      this.console.log(message!.innerValue)
      return undefined
    },

    *readLine(_self: RuntimeObject): Execution<RuntimeValue> {
      // TODO: Pending Implementation
      throw new Error('Native not yet implemented: console.readLine')
    },

    *readInt(_self: RuntimeObject): Execution<RuntimeValue> {
      // TODO: Pending Implementation
      throw new Error('Native not yet implemented: console.readInt')
    },

    *newline(_self: RuntimeObject): Execution<RuntimeValue> {
      const newline = process.platform.toLowerCase().startsWith('win') ? '\r\n' : '\n'
      return yield* this.reify(newline)
    },

  },

}

export default lib