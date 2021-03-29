/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Natives, RuntimeObject } from '../interpreter/runtimeModel'

const mirror: Natives = {

  ObjectMirror: {

    *resolve(self: RuntimeObject, attributeName: RuntimeObject) {
      attributeName.assertIsString()
      return self.get('target')?.get(attributeName.innerValue)
    },

  },

}

export default mirror