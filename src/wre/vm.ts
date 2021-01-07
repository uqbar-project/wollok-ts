import { Evaluation, Natives, RuntimeObject } from '../interpreter/runtimeModel'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))
    },

  },

}

export default vm