import { Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'

const mirror: Natives = {

  ObjectMirror: {

    *resolve(self: RuntimeObject, attributeName: RuntimeObject): Execution<RuntimeValue> {
      attributeName.assertIsString()
      return self.get('target')?.get(attributeName.innerString)
    },

    *instanceVariableFor(self: RuntimeObject, name: RuntimeObject): Execution<RuntimeValue> {
      name.assertIsString()

      return yield* this.instantiate('wollok.mirror.InstanceVariableMirror', {
        target: self,
        name,
      })
    },

    // Returns a List<InstanceVariableMirror>
    *instanceVariables(self: RuntimeObject): Execution<RuntimeValue> {
      const fields =  self.get('target')!.module.defaultFieldValues.keys()
      const values: RuntimeObject[] = []
      for(const field of fields)
        values.push((yield* this.send('instanceVariableFor', self, yield* this.reify(field.name)))!)

      return yield* this.list(...values)
    },

  },

}

export default mirror