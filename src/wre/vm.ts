/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Natives } from '../interpreter/runtimeModel'

const vm: Natives = {

  runtime: {
    *isInteractive() {
      return yield* this.reify(false)
    },

  },

}

export default vm