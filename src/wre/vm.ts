import { Evaluation, FALSE_ID } from '../interpreter'

export default {

  runtime: {

    isInteractive: () => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(FALSE_ID)
    },

  },

}