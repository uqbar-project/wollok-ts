import { Execution, InnerValue, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'

const game: Natives = {
  game: {
    *addVisual(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      visual.assertIsNotNull()
      if (!visual.module.lookupMethod('position', 0)) throw new TypeError('position')

      const visuals: RuntimeObject = self.get('visuals')!
      if (!visuals) self.set('visuals', yield* this.list([visual]))
      else {
        visuals.assertIsCollection()
        if(visuals.innerValue.includes(visual)) throw new TypeError(visual.module.fullyQualifiedName())
        visuals.innerValue.push(visual)
      }

      return undefined
    },

    *addVisualIn(self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject): Execution<RuntimeValue> {
      visual.assertIsNotNull()
      position.assertIsNotNull()

      const visuals: RuntimeObject = self.get('visuals')!
      if (!visuals) self.set('visuals', yield* this.list([visual]))
      else {
        visuals.assertIsCollection()
        if(visuals.innerValue.includes(visual)) throw new TypeError(visual.module.fullyQualifiedName())
        visuals.innerValue.push(visual)
      }

      visual.set('position', position)

      return undefined
    },

    *addVisualCharacter(_self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('addVisualCharacter', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual)
    },

    *addVisualCharacterIn(_self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('addVisualCharacterIn', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual, position)
    },

    *removeVisual(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      const visuals = self.get('visuals')
      if (visuals) yield* this.invoke('remove', visuals, visual)
      return undefined
    },

    *whenKeyPressedDo(_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('whenKeyPressedDo', this.currentContext.get('wollok.gameMirror.gameMirror')!, event, action)
    },

    *whenCollideDo(_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('whenCollideDo', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual, action)
    },

    *onCollideDo(_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('onCollideDo', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual, action)
    },

    *onTick(_self: RuntimeObject, milliseconds: RuntimeObject, name: RuntimeObject, action: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('onTick', this.currentContext.get('wollok.gameMirror.gameMirror')!, milliseconds, name, action)
    },

    *schedule(_self: RuntimeObject, milliseconds: RuntimeObject, action: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('schedule', this.currentContext.get('wollok.gameMirror.gameMirror')!, milliseconds, action)
    },

    *removeTickEvent(_self: RuntimeObject, event: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.invoke('removeTickEvent', this.currentContext.get('wollok.gameMirror.gameMirror')!, event)
    },

    *allVisuals(self: RuntimeObject): Execution<RuntimeValue> {
      const visuals: RuntimeObject = self.get('visuals')!
      if (!visuals) return yield* this.list([])
      visuals.assertIsCollection()
      return yield* this.list(visuals.innerValue)
    },

    *hasVisual(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      const visuals: RuntimeObject = self.get('visuals')!
      return yield* !visuals ? this.reify(false) : this.invoke('contains', visuals, visual)
    },

    *getObjectsIn(self: RuntimeObject, position: RuntimeObject): Execution<RuntimeValue> {
      const visuals: RuntimeObject = (yield* this.invoke('allVisuals', self))!
      visuals.assertIsCollection()

      const samePosition = (position1: RuntimeObject, position2: RuntimeObject): Boolean => {
        
        const truncateAxis = (position: RuntimeObject, axis: string) => { 
          const wPosition = position.get(axis)
          wPosition?.assertIsNumber()
          const tsPosition = wPosition?.innerValue
          return Math.trunc(Number(tsPosition)) 
        }

        const x1 = truncateAxis.call(self, position1, 'x')
        const y1 = truncateAxis.call(self, position1, 'y')
        const x2 = truncateAxis.call(self, position2, 'x')
        const y2 = truncateAxis.call(self, position2, 'y')

        return x1 == x2 && y1 == y2
      }

      const result: RuntimeObject[] = []
      for(const otherVisual of visuals.innerValue) {
        const otherPosition = otherVisual.get('position') ?? (yield* this.invoke('position', otherVisual))!
        if(samePosition.call(self, position, otherPosition))
          result.push(otherVisual)
      }

      return yield* this.list(result)
    },

    *say(_self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject): Execution<RuntimeValue> {
      const currentTime: RuntimeObject = (yield* this.invoke('currentTime', this.currentContext.get('wollok.gameMirror.gameMirror')!))!
      currentTime.assertIsNumber()

      const messageTime = yield* this.reify(currentTime.innerValue + 2 * 1000)

      visual.set('message', message)
      visual.set('messageTime', messageTime)

      return undefined
    },

    *clear(self: RuntimeObject): Execution<RuntimeValue> {
      yield* this.invoke('clear', this.currentContext.get('wollok.gameMirror.gameMirror')!)

      self.set('visuals', yield* this.list([]))
      return undefined
    },

    *colliders(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      visual.assertIsNotNull()

      const position = visual.get('position') ?? (yield* this.invoke('position', visual))!
      const visualsAtPosition: RuntimeObject = (yield* this.invoke('getObjectsIn', self, position))!

      yield* this.invoke('remove', visualsAtPosition, visual)

      return visualsAtPosition
    },

    *title(self: RuntimeObject, title?: RuntimeObject): Execution<RuntimeValue> {
      if(!title) return self.get('title')
      self.set('title', title)
      return undefined
    },

    *width(self: RuntimeObject, width?: RuntimeObject): Execution<RuntimeValue> {
      if(!width) return self.get('width')
      self.set('width', width)
      return undefined
    },

    *height(self: RuntimeObject, height?: RuntimeObject): Execution<RuntimeValue> {
      if(!height) return self.get('height')
      self.set('height', height)
      return undefined
    },

    *ground(self: RuntimeObject, ground: RuntimeObject): Execution<RuntimeValue> {
      self.set('ground', ground)
      return undefined
    },

    *boardGround(self: RuntimeObject, boardGround: RuntimeObject): Execution<RuntimeValue> {
      self.set('boardGround', boardGround)
      return undefined
    },

    *doCellSize(self: RuntimeObject, size: RuntimeObject): Execution<RuntimeValue> {
      self.set('cellSize', size)
      return undefined
    },

    *stop(self: RuntimeObject): Execution<RuntimeValue> {
      self.set('running', yield* this.reify(false))
      return undefined
    },

    *showAttributes(_self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      visual.set('showAttributes', yield* this.reify(true))
      return undefined
    },

    *hideAttributes(_self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      visual.set('showAttributes', yield* this.reify(false))
      return undefined
    },

    *errorReporter(self: RuntimeObject, visual: RuntimeObject): Execution<RuntimeValue> {
      self.set('errorReporter', visual)
      return undefined
    },

    *doStart(self: RuntimeObject): Execution<RuntimeValue> {
      self.set('running', yield* this.reify(true))
      return yield* this.invoke('doStart', this.currentContext.get('wollok.gameMirror.gameMirror')!)
    },
  },

  Sound: {
    *play(self: RuntimeObject): Execution<RuntimeValue> {
      const game = this.currentContext.get('wollok.game.game')!
      if (!game.get('running')?.innerValue) throw new Error('You cannot play a sound if game has not started')

      const sounds: RuntimeObject = game.get('sounds')!
      if (!game.get('sounds')) game.set('sounds', yield* this.list([self]))
      else {
        sounds.assertIsCollection()
        if (sounds.innerValue.includes(self)) throw new TypeError(self.module.fullyQualifiedName())
        else sounds.innerValue.push(self)
      }

      self.set('status', this.reify('played'))

      return undefined
    },

    *stop(self: RuntimeObject): Execution<RuntimeValue> {
      if (self.get('status')?.innerValue !== 'played') throw new Error('You cannot stop a sound that is not played')

      const game = this.currentContext.get('wollok.game.game')!
      const sounds = game.get('sounds')
      if(sounds) yield* this.invoke('remove', sounds, self)

      self.set('status', yield * this.reify('stopped'))

      return undefined
    },

    *pause(self: RuntimeObject): Execution<RuntimeValue> {
      if (self.get('status')?.innerValue !== 'played') throw new Error('You cannot pause a sound that is not played')

      self.set('status', this.reify('paused'))

      return undefined
    },

    *resume(self: RuntimeObject): Execution<RuntimeValue> {
      if (self.get('status')?.innerValue !== 'paused') throw new Error('You cannot resume a sound that is not paused')

      self.set('status', this.reify('played'))

      return undefined
    },

    *played(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.get('status')?.innerValue === 'played')
    },

    *paused(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.get('status')?.innerValue === 'paused')
    },

    *volume(self: RuntimeObject, newVolume?: RuntimeObject): Execution<RuntimeValue> {
      if(!newVolume) return self.get('volume')

      const volume: RuntimeObject = newVolume
      volume.assertIsNumber()

      if (volume.innerValue < 0 || volume.innerValue > 1) throw new RangeError('newVolume')

      self.set('volume', volume)

      return undefined
    },

    *shouldLoop(self: RuntimeObject, looping?: RuntimeObject): Execution<RuntimeValue> {
      if(!looping) return self.get('loop')
      self.set('loop', looping)
      return undefined
    },

  },
}

export default game