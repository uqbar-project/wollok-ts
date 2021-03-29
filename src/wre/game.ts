/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Natives, RuntimeObject } from '../interpreter/runtimeModel'

const game: Natives = {
  game: {
    *addVisual(self: RuntimeObject, visual: RuntimeObject) {
      if (visual === (yield* this.reify(null))) throw new TypeError('visual')
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

    *addVisualIn(self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject) {
      if (visual === (yield* this.reify(null))) throw new TypeError('visual')
      if (position === (yield* this.reify(null))) throw new TypeError('position')

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

    *addVisualCharacter(_self: RuntimeObject, visual: RuntimeObject) {
      return yield* this.invoke('addVisualCharacter', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual)
    },

    *addVisualCharacterIn(_self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject) {
      return yield* this.invoke('addVisualCharacterIn', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual, position)
    },

    *removeVisual(self: RuntimeObject, visual: RuntimeObject) {
      const visuals = self.get('visuals')
      if (visuals) yield* this.invoke('remove', visuals, visual)
      return undefined
    },

    *whenKeyPressedDo(_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject){
      return yield* this.invoke('whenKeyPressedDo', this.currentContext.get('wollok.gameMirror.gameMirror')!, event, action)
    },

    *whenCollideDo(_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject) {
      return yield* this.invoke('whenCollideDo', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual, action)
    },

    *onCollideDo(_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject){
      return yield* this.invoke('onCollideDo', this.currentContext.get('wollok.gameMirror.gameMirror')!, visual, action)
    },

    *onTick(_self: RuntimeObject, milliseconds: RuntimeObject, name: RuntimeObject, action: RuntimeObject){
      return yield* this.invoke('onTick', this.currentContext.get('wollok.gameMirror.gameMirror')!, milliseconds, name, action)
    },

    *schedule(_self: RuntimeObject, milliseconds: RuntimeObject, action: RuntimeObject){
      return yield* this.invoke('schedule', this.currentContext.get('wollok.gameMirror.gameMirror')!, milliseconds, action)
    },

    *removeTickEvent(_self: RuntimeObject, event: RuntimeObject){
      return yield* this.invoke('removeTickEvent', this.currentContext.get('wollok.gameMirror.gameMirror')!, event)
    },

    *allVisuals(self: RuntimeObject) {
      const visuals: RuntimeObject = self.get('visuals')!
      if (!visuals) return yield* this.list([])
      visuals.assertIsCollection()
      return yield* this.list(visuals.innerValue)
    },

    *hasVisual(self: RuntimeObject, visual: RuntimeObject) {
      const visuals: RuntimeObject = self.get('visuals')!
      return yield* !visuals ? this.reify(false) : this.invoke('contains', visuals, visual)
    },

    *getObjectsIn(self: RuntimeObject, position: RuntimeObject) {
      const visuals: RuntimeObject = (yield* this.invoke('allVisuals', self))!
      visuals.assertIsCollection()

      const result: RuntimeObject[] = []
      for(const otherVisual of visuals.innerValue) {
        const otherPosition = otherVisual.get('position') ?? (yield* this.invoke('position', otherVisual))!
        if((yield *this.invoke('==', position, otherPosition))!.innerValue)
          result.push(otherVisual)
      }

      return yield* this.list(result)
    },

    *say(_self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject) {
      const currentTime: RuntimeObject = (yield* this.invoke('currentTime', this.currentContext.get('wollok.gameMirror.gameMirror')!))!
      currentTime.assertIsNumber()

      const messageTime = yield* this.reify(currentTime.innerValue + 2 * 1000)

      visual.set('message', message)
      visual.set('messageTime', messageTime)

      return undefined
    },

    *clear(self: RuntimeObject) {
      yield* this.invoke('clear', this.currentContext.get('wollok.gameMirror.gameMirror')!)

      self.set('visuals', yield* this.list([]))
      return undefined
    },

    *colliders(self: RuntimeObject, visual: RuntimeObject) {
      if (visual === (yield* this.reify(null))) throw new TypeError('visual')

      const position = visual.get('position') ?? (yield* this.invoke('position', visual))!
      const visualsAtPosition: RuntimeObject = (yield* this.invoke('getObjectsIn', self, position))!

      yield* this.invoke('remove', visualsAtPosition, visual)

      return visualsAtPosition
    },

    *title(self: RuntimeObject, title?: RuntimeObject) {
      if(!title) return self.get('title')
      self.set('title', title)
      return undefined
    },

    *width(self: RuntimeObject, width?: RuntimeObject) {
      if(!width) return self.get('width')
      self.set('width', width)
      return undefined
    },

    *height(self: RuntimeObject, height?: RuntimeObject) {
      if(!height) return self.get('height')
      self.set('height', height)
      return undefined
    },

    *ground(self: RuntimeObject, ground: RuntimeObject) {
      self.set('ground', ground)
      return undefined
    },

    *boardGround(self: RuntimeObject, boardGround: RuntimeObject) {
      self.set('boardGround', boardGround)
      return undefined
    },

    *doCellSize(self: RuntimeObject, size: RuntimeObject) {
      self.set('cellSize', size)
      return undefined
    },

    *stop(self: RuntimeObject) {
      self.set('running', yield* this.reify(false))
      return undefined
    },

    *showAttributes(_self: RuntimeObject, visual: RuntimeObject) {
      visual.set('showAttributes', yield* this.reify(true))
      return undefined
    },

    *hideAttributes(_self: RuntimeObject, visual: RuntimeObject) {
      visual.set('showAttributes', yield* this.reify(false))
      return undefined
    },

    *errorReporter(self: RuntimeObject, visual: RuntimeObject) {
      self.set('errorReporter', visual)
      return undefined
    },

    *doStart(self: RuntimeObject) {
      self.set('running', yield* this.reify(true))
      return yield* this.invoke('doStart', this.currentContext.get('wollok.gameMirror.gameMirror')!)
    },
  },

  Sound: {
    *play(self: RuntimeObject) {
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

    *stop(self: RuntimeObject) {
      if (self.get('status')?.innerValue !== 'played') throw new Error('You cannot stop a sound that is not played')

      const game = this.currentContext.get('wollok.game.game')!
      const sounds = game.get('sounds')
      if(sounds) yield* this.invoke('remove', sounds, self)

      self.set('status', yield * this.reify('stopped'))

      return undefined
    },

    *pause(self: RuntimeObject) {
      if (self.get('status')?.innerValue !== 'played') throw new Error('You cannot pause a sound that is not played')

      self.set('status', this.reify('paused'))

      return undefined
    },

    *resume(self: RuntimeObject) {
      if (self.get('status')?.innerValue !== 'paused') throw new Error('You cannot resume a sound that is not paused')

      self.set('status', this.reify('played'))

      return undefined
    },

    *played(self: RuntimeObject) {
      return yield* this.reify(self.get('status')?.innerValue === 'played')
    },

    *paused(self: RuntimeObject) {
      return yield* this.reify(self.get('status')?.innerValue === 'paused')
    },

    *volume(self: RuntimeObject, newVolume?: RuntimeObject) {
      if(!newVolume) return self.get('volume')

      const volume: RuntimeObject = newVolume
      volume.assertIsNumber()

      if (volume.innerValue < 0 || volume.innerValue > 1) throw new RangeError('newVolume')

      self.set('volume', volume)

      return undefined
    },

    *shouldLoop(self: RuntimeObject, looping?: RuntimeObject) {
      if(!looping) return self.get('loop')
      self.set('loop', looping)
      return undefined
    },

  },
}

export default game