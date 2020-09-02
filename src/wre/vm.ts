import { Evaluation, Natives } from '../interpreter'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.frameStack.top!.operandStack.push(evaluation.boolean(false))
    },

  },

}

export default vm