import { assertIsString, Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'

const mirror: Natives = {

  ObjectMirror: {

    *resolve(self: RuntimeObject, attributeName: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(attributeName, 'resolve', 'attributeName')
      return self.get('target')?.get(attributeName.innerString)
    },

    *instanceVariableFor(self: RuntimeObject, name: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(name, 'instanceVariableFor', 'name')

      return yield* this.instantiate('wollok.mirror.InstanceVariableMirror', {
        target: self,
        name,
      })
    },

    *instanceVariables(self: RuntimeObject): Execution<RuntimeValue> {
      const values: RuntimeObject[] = []
      for(const field of self.get('target')!.module.allFields)
        values.push((yield* this.send('instanceVariableFor', self, yield* this.reify(field.name)))!)

      return yield* this.list(...values)
    },

  },

}

export default mirror