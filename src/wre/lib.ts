import { Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'

const lib: Natives = {

  console: {

    *println(_self: RuntimeObject, obj: RuntimeObject): Execution<void> {
      this.console.log((yield* this.send('toString', obj))!.innerString)
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
      const platform = process?.platform?.toLowerCase() ?? ''
      const newline =
        platform.indexOf('win') >= 0 ? '\r\n' :
        platform.indexOf('mac') >= 0 ? '\r' :
        '\n'

      return yield* this.reify(newline)
    },

  },

}

export default lib