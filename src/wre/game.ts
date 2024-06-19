import { GAME_MODULE } from '../constants'
import { Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'
const { round } = Math

const game: Natives = {
  game: {
    *addVisual(self: RuntimeObject, visual: RuntimeObject): Execution<void> {
      visual.assertIsNotNull()
      if (!visual.module.lookupMethod('position', 0)) throw new TypeError('position')

      const visuals = self.get('visuals')!.innerCollection!

      if(visuals.includes(visual)) throw new TypeError(visual.module.fullyQualifiedName)

      visuals.push(visual)
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
      const result: RuntimeObject[] = []
      const x = position.get('x')?.innerNumber
      const y = position.get('y')?.innerNumber


      if(x != undefined && y != undefined) {
        const roundedX = round(x)
        const roundedY = round(y)
        for(const visual of visuals.innerCollection!) {

          // Every visual understand position(), it is checked in addVisual(visual).
          // Avoid to invoke method position() for optimisation reasons.
          //    -> If method isSynthetic then it is a getter, we can access to the field directly
          const method = visual.module.lookupMethod('position', 0)!
          const otherPosition = method.isSynthetic ? visual.get('position') :yield* this.invoke(method, visual)

          const otherX = otherPosition?.get('x')?.innerNumber
          const otherY = otherPosition?.get('y')?.innerNumber

          if(otherX == undefined || otherY == undefined) continue

          if(roundedX == round(otherX) && roundedY == round(otherY))
            result.push(visual)
        }
      }

      return yield* this.list(...result)
    },

    *say(self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject): Execution<void> {
      const currentTime = (yield* this.send('currentTime', self))!.innerNumber!
      const MESSAGE_SAY_TIME = 2000 // ms
      const messageTime = yield* this.reify(currentTime + MESSAGE_SAY_TIME)

      visual.set('message', message)
      visual.set('messageTime', messageTime)
    },

    *colliders(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      visual.assertIsNotNull()

      const position = (yield* this.send('position', visual))!
      const visualsAtPosition: RuntimeObject = (yield* this.send('getObjectsIn', self, position))!

      yield* this.send('remove', visualsAtPosition, visual)

      return visualsAtPosition
    },

    *title(self: RuntimeObject, title?: RuntimeObject): Execution<RuntimeValue> {
      if(!title) return self.get('title')
      self.set('title', title)
    },

    *width(self: RuntimeObject, width?: RuntimeObject): Execution<RuntimeValue> {
      if(!width) return self.get('width')
      self.set('width', width)
    },

    *height(self: RuntimeObject, height?: RuntimeObject): Execution<RuntimeValue> {
      if(!height) return self.get('height')
      self.set('height', height)
    },

    *ground(self: RuntimeObject, ground: RuntimeObject): Execution<void> {
      self.set('ground', ground)
    },

    *boardGround(self: RuntimeObject, boardGround: RuntimeObject): Execution<void> {
      self.set('boardGround', boardGround)
    },

    *doCellSize(self: RuntimeObject, size: RuntimeObject): Execution<void> {
      self.set('cellSize', size)
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
        if (sounds.includes(self)) throw new TypeError(self.module.fullyQualifiedName)
        else sounds.push(self)
      }

      self.set('status', this.reify('played'))
    },

    *stop(self: RuntimeObject): Execution<void> {
      if (self.get('status')?.innerString !== 'played') throw new Error('You cannot stop a sound that is not played')

      const game = this.object(GAME_MODULE)!
      const sounds = game.get('sounds')
      if(sounds) yield* this.send('remove', sounds, self)

      self.set('status', yield * this.reify('stopped'))
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
      if(!newVolume) return self.get('volume')

      const volume: RuntimeObject = newVolume
      volume.assertIsNumber()

      if (volume.innerNumber < 0 || volume.innerNumber > 1) throw new RangeError('newVolume')

      self.set('volume', volume)
    },

    *shouldLoop(self: RuntimeObject, looping?: RuntimeObject): Execution<RuntimeValue> {
      if(!looping) return self.get('loop')
      self.set('loop', looping)
    },

  },
}

export default game
