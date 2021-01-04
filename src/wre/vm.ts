import { Evaluation, Natives, RuntimeObject } from '../interpreter'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))
    },

  },

}

export default vm