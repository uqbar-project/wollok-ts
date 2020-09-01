import { Evaluation, Natives } from '../interpreter'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.currentFrame()!.pushOperand(evaluation.boolean(false))
    },

  },

}

export default vm