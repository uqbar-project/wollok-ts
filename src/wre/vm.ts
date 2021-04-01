import { Execution, Natives, RuntimeValue } from '../interpreter/runtimeModel'

const vm: Natives = {

  runtime: {
    *isInteractive(): Execution<RuntimeValue> {
      return yield* this.reify(false)
    },

  },

}

export default vm