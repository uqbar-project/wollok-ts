import { Evaluation, FALSE_ID, Natives } from '../interpreter'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.currentFrame()!.pushOperand(evaluation.instance(FALSE_ID))
    },

  },

}

export default vm