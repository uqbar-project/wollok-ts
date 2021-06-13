import { Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'

const mirror: Natives = {

  ObjectMirror: {

    *resolve(self: RuntimeObject, attributeName: RuntimeObject): Execution<RuntimeValue> {
      attributeName.assertIsString()
      return self.get('target')?.get(attributeName.innerValue)
    },

  },

}

export default mirror