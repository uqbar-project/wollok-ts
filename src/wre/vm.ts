import { Evaluation, Natives, RuntimeObject } from '../interpreter'

const vm: Natives = {

  runtime: {

    isInteractive: () => (evaluation: Evaluation): void => {
      evaluation.frameStack.top!.operandStack.push(RuntimeObject.boolean(evaluation, false))
    },

  },

}

export default vm