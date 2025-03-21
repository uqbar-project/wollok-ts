import { GAME_MODULE } from '../constants'
import { assertIsNotNull, assertIsNumber, Evaluation, Execution, NativeFunction, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'
const { round } = Math


/**
 * Avoid to invoke getters method from properties by accessing directly to the variable
 */
const getter = (message: string): NativeFunction => function* (obj: RuntimeObject): Execution<RuntimeValue> {
  const method = obj.module.lookupMethod(message, 0)!
  return method.isSynthetic ? obj.get(message)! : yield* this.invoke(method, obj)
}

const getPosition = getter('position')
const getX = getter('x')
const getY = getter('y')

const getObjectsIn = function* (this: Evaluation, position: RuntimeObject, ...visuals: RuntimeObject[]): Execution<RuntimeObject> {
  const result: RuntimeObject[] = []

  const x = (yield* getX.call(this, position))?.innerNumber
  const y = (yield* getY.call(this, position))?.innerNumber

  if (x == undefined || y == undefined) throw new RangeError('Position without coordinates')

  const roundedX = round(x)
  const roundedY = round(y)
  for (const visual of visuals) {
    const otherPosition = (yield* getPosition.call(this, visual))!
    const otherX = (yield* getX.call(this, otherPosition))?.innerNumber
    const otherY = (yield* getY.call(this, otherPosition))?.innerNumber

    if (otherX == undefined || otherY == undefined) continue // Do NOT throw exception

    if (roundedX == round(otherX) && roundedY == round(otherY))
      result.push(visual)
  }

  return yield* this.list(...result)
}

const game: Natives = {
  game: {
    *addVisual(self: RuntimeObject, positionable: RuntimeObject): Execution<void> {
      assertIsNotNull(positionable, 'addVisual', 'positionable')
      if (!positionable.module.lookupMethod('position', 0)) throw new TypeError('Message addVisual: positionable lacks a position message')

      const visuals = self.get('visuals')!.innerCollection!
      if (visuals.includes(positionable)) throw new RangeError('Visual is already in the game! You cannot add duplicate elements')
      visuals.push(positionable)
    },

    *removeVisual(self: RuntimeObject, visual: RuntimeObject): Execution<void> {
      const visuals = self.get('visuals')!
      yield* this.send('remove', visuals, visual)
    },

    *allVisuals(self: RuntimeObject): Execution<RuntimeValue> {
      const visuals = self.get('visuals')!
      return yield* this.list(...visuals.innerCollection ?? [])
    },

    *hasVisual(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      const visuals = self.get('visuals')!
      return yield* this.send('contains', visuals, visual)
    },

    *getObjectsIn(self: RuntimeObject, position: RuntimeObject): Execution<RuntimeValue> {
      const visuals = self.get('visuals')!
      return yield* getObjectsIn.call(this, position, ...visuals.innerCollection!)
    },

    *say(self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject): Execution<void> {
      const currentTime = (yield* this.send('currentTime', self))!.innerNumber!
      const MESSAGE_SAY_TIME = 2000 // ms
      const messageTime = yield* this.reify(currentTime + MESSAGE_SAY_TIME)

      visual.set('message', message)
      visual.set('messageTime', messageTime)
    },

    *colliders(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(visual, 'colliders', 'visual')

      const visuals = self.get('visuals')!
      const otherVisuals = visuals.innerCollection!.filter(obj => obj != visual)
      const position = (yield* getPosition.call(this, visual))!

      return yield* getObjectsIn.call(this, position, ...otherVisuals)
    },

    *showAttributes(_self: RuntimeObject, visual: RuntimeObject): Execution<void> {
      visual.set('showAttributes', yield* this.reify(true))
    },

    *hideAttributes(_self: RuntimeObject, visual: RuntimeObject): Execution<void> {
      visual.set('showAttributes', yield* this.reify(false))
    },

  },

  Sound: {
    *play(self: RuntimeObject): Execution<void> {
      const game = this.object(GAME_MODULE)!

      const sounds = game.get('sounds')?.innerCollection
      if (!sounds) game.set('sounds', yield* this.list(self))
      else {
        if (sounds.includes(self)) throw new RangeError('Sound is already in the game! You cannot add duplicate elements')
        else sounds.push(self)
      }

      self.set('status', this.reify('played'))
    },

    *stop(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'played') throw new Error('You cannot stop a sound that is not played')

      const game = this.object(GAME_MODULE)!
      const sounds = game.get('sounds')
      if (sounds) yield* this.send('remove', sounds, self)

      self.set('status', yield* this.reify('stopped'))
    },

    *pause(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'played') throw new Error('You cannot pause a sound that is not played')

      self.set('status', this.reify('paused'))
    },

    *resume(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'paused') throw new Error('You cannot resume a sound that is not paused')

      self.set('status', this.reify('played'))
    },

    *played(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.get('status')?.innerString === 'played')
    },

    *paused(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.get('status')?.innerString === 'paused')
    },

    *volume(self: RuntimeObject, newVolume?: RuntimeObject): Execution<RuntimeValue> {
      if (!newVolume) return self.get('volume')

      const volume: RuntimeObject = newVolume
      assertIsNumber(volume, 'volume', 'newVolume', false)

      if (volume.innerNumber < 0 || volume.innerNumber > 1) throw new RangeError('volumen: newVolume should be between 0 and 1')

      self.set('volume', volume)
    },

    *shouldLoop(self: RuntimeObject, looping?: RuntimeObject): Execution<RuntimeValue> {
      if (!looping) return self.get('loop')
      self.set('loop', looping)
    },

  },
}

export default game