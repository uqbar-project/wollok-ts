import { Evaluation, FALSE_ID, Natives } from '../interpreter'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.currentFrame()!.pushOperand(FALSE_ID)
    },

  },

}

export default vm