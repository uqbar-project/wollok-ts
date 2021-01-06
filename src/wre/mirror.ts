import { Evaluation, Natives, RuntimeObject } from '../interpreter'

const mirror: Natives = {

  ObjectMirror: {

    resolve: (self: RuntimeObject, attributeName: RuntimeObject) => (evaluation: Evaluation): void => {
      attributeName.assertIsString()
      evaluation.currentFrame!.pushOperand(self.get('target')?.get(attributeName.innerValue))
    },

  },

}

export default mirror