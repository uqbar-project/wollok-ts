import { Evaluation, Natives, RuntimeObject } from '../interpreter'
import { Id } from '../model'

const returnVoid = (evaluation: Evaluation) => {
  evaluation.currentFrame!.pushOperand(undefined)
}

const get = (self: RuntimeObject, key: string) => (evaluation: Evaluation) => {
  evaluation.currentFrame!.pushOperand(self.get(key))
}

const set = (self: RuntimeObject, key: string, value: RuntimeObject) => (evaluation: Evaluation) => {
  self.set(key, value)
  returnVoid(evaluation)
}

const property = (self: RuntimeObject, key: string, value?: RuntimeObject) => (evaluation: Evaluation) => {
  if (value)
    set(self, key, value)(evaluation)
  else
    get(self, key)(evaluation)
}

//TODO: Do we still need this?
const redirectTo = (receiver: (evaluation: Evaluation) => string, voidMessage = true) => (message: string, ...params: string[]) =>
  (evaluation: Evaluation) => {
    const receiverInstance = evaluation.instance(receiver(evaluation))
    evaluation.invoke(message, receiverInstance, ...params.map(param => evaluation.instance(param)))
    if (voidMessage) returnVoid(evaluation)
  }

const mirror = (evaluation: Evaluation) => evaluation.environment.getNodeByFQN('wollok.gameMirror.gameMirror').id

const wGame = (evaluation: Evaluation) => evaluation.instance(evaluation.environment.getNodeByFQN('wollok.game.game').id)

const getPosition = (id: Id) => (evaluation: Evaluation) => {
  const instance = evaluation.instance(id)
  const position = instance.get('position')
  if (position) return position
  const currentFrame = evaluation.currentFrame!
  const initialFrameCount = evaluation.frameStack.depth
  evaluation.invoke('position', instance)
  do {
    evaluation.step() // TODO: we should avoid steping in all these cases. Create the frame to execute, so it can be debugged
  } while (evaluation.frameStack.depth > initialFrameCount)
  return currentFrame.popOperand()
}

const samePosition = (evaluation: Evaluation, position: RuntimeObject) => (id: Id) => {
  const visualPosition = getPosition(id)(evaluation)!
  return position.get('x') === visualPosition.get('x')
    && position.get('y') === visualPosition.get('y')
}

const addToInnerCollection = (evaluation: Evaluation, wObject: RuntimeObject, element: RuntimeObject, fieldName: string) => {
  if (!wObject.get(fieldName))
    wObject.set(fieldName, RuntimeObject.list(evaluation, []))

  const fieldList: RuntimeObject = wObject.get(fieldName)!
  fieldList.assertIsCollection()
  if (fieldList.innerValue.includes(element.id)) throw new TypeError(element.module.fullyQualifiedName())
  else fieldList.innerValue.push(element.id)
}

const addSound = (evaluation: Evaluation, gameObject: RuntimeObject, sound: RuntimeObject) => {
  return addToInnerCollection(evaluation, gameObject, sound, 'sounds')
}

const removeFromInnerCollection = (wObject: RuntimeObject, elementToRemove: RuntimeObject, fieldName: string) => {
  const fieldList = wObject.get(fieldName)
  if (fieldList) {
    const currentElements: RuntimeObject = fieldList
    currentElements.assertIsCollection()
    currentElements.innerValue.splice(0, currentElements.innerValue.length)
    currentElements.innerValue.push(...currentElements.innerValue.filter((id: Id) => id !== elementToRemove.id))
  }
}

const removeSound = (gameObject: RuntimeObject, sound: RuntimeObject) => {
  removeFromInnerCollection(gameObject, sound, 'sounds')
}

const game: Natives = {
  game: {
    addVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      if (visual === RuntimeObject.null(evaluation)) throw new TypeError('visual')
      if (!visual.module.lookupMethod('position', 0)) throw new TypeError('position')
      addToInnerCollection(evaluation, self, visual, 'visuals')
      returnVoid(evaluation)
    },

    addVisualIn: (self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject) => (evaluation: Evaluation): void => {
      if (visual === RuntimeObject.null(evaluation)) throw new TypeError('visual')
      if (position === RuntimeObject.null(evaluation)) throw new TypeError('position')
      visual.set('position', position)
      addToInnerCollection(evaluation, self, visual, 'visuals')
      returnVoid(evaluation)
    },

    addVisualCharacter: (_self: RuntimeObject, visual: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('addVisualCharacter', visual.id),


    addVisualCharacterIn: (_self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('addVisualCharacterIn', visual.id, position.id),

    removeVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      const visuals = self.get('visuals')
      if (visuals) evaluation.invoke('remove', visuals, visual)
      else evaluation.currentFrame!.pushOperand(undefined)
    },

    whenKeyPressedDo: (_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('whenKeyPressedDo', event.id, action.id),

    whenCollideDo: (_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('whenCollideDo', visual.id, action.id),

    onCollideDo: (_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('onCollideDo', visual.id, action.id),

    onTick: (_self: RuntimeObject, milliseconds: RuntimeObject, name: RuntimeObject, action: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('onTick', milliseconds.id, name.id, action.id),

    schedule: (_self: RuntimeObject, milliseconds: RuntimeObject, action: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('schedule', milliseconds.id, action.id),

    removeTickEvent: (_self: RuntimeObject, event: RuntimeObject): (evaluation: Evaluation) => void =>
      redirectTo(mirror)('removeTickEvent', event.id),

    allVisuals: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      const visuals = self.get('visuals')
      if (!visuals) return evaluation.currentFrame!.pushOperand(RuntimeObject.list(evaluation, []))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      evaluation.currentFrame!.pushOperand(RuntimeObject.list(evaluation, currentVisuals.innerValue))
    },

    hasVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      const visuals = self.get('visuals')
      if (!visuals) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, currentVisuals.innerValue.includes(visual.id)))
    },

    getObjectsIn: (self: RuntimeObject, position: RuntimeObject) => (evaluation: Evaluation): void => {
      const visuals = self.get('visuals')
      if (!visuals) return evaluation.currentFrame!.pushOperand(RuntimeObject.list(evaluation, []))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      const result = RuntimeObject.list(evaluation, currentVisuals.innerValue.filter(samePosition(evaluation, position)))
      evaluation.currentFrame!.pushOperand(result)
    },

    say: (_self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject) => (evaluation: Evaluation): void => {
      const currentFrame = evaluation.currentFrame!
      const initialFrameCount = evaluation.frameStack.depth
      const ioInstance = evaluation.instance(mirror(evaluation))
      evaluation.invoke('currentTime', ioInstance)
      do {
        evaluation.step()
      } while (evaluation.frameStack.depth > initialFrameCount)

      const currentTime: RuntimeObject = currentFrame.popOperand()!
      currentTime.assertIsNumber()
      const messageTime = RuntimeObject.number(evaluation, currentTime.innerValue + 2 * 1000)
      set(visual, 'message', message)(evaluation)
      set(visual, 'messageTime', messageTime)(evaluation)
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      const initialFrameCount = evaluation.frameStack.depth
      evaluation.invoke('clear', evaluation.instance(mirror(evaluation)))
      do {
        evaluation.step()
      } while (evaluation.frameStack.depth > initialFrameCount)


      self.set('visuals', RuntimeObject.list(evaluation, []))
      returnVoid(evaluation)
    },

    colliders: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      if (visual === RuntimeObject.null(evaluation)) throw new TypeError('visual')
      const visuals = self.get('visuals')
      if (!visuals) return evaluation.currentFrame!.pushOperand(RuntimeObject.list(evaluation, []))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      const position = getPosition(visual.id)(evaluation)!
      const result = RuntimeObject.list(evaluation, currentVisuals.innerValue
        .filter(samePosition(evaluation, position))
        .filter(id => id !== visual.id)
      )
      evaluation.currentFrame!.pushOperand(result)
    },

    title: (self: RuntimeObject, title?: RuntimeObject): (evaluation: Evaluation) => void => property(self, 'title', title),

    width: (self: RuntimeObject, width?: RuntimeObject): (evaluation: Evaluation) => void => property(self, 'width', width),

    height: (self: RuntimeObject, height?: RuntimeObject): (evaluation: Evaluation) => void => property(self, 'height', height),

    ground: (self: RuntimeObject, ground: RuntimeObject): (evaluation: Evaluation) => void => set(self, 'ground', ground),

    boardGround: (self: RuntimeObject, boardGround: RuntimeObject): (evaluation: Evaluation) => void => set(self, 'boardGround', boardGround),

    doCellSize: (self: RuntimeObject, size: RuntimeObject): (evaluation: Evaluation) => void => set(self, 'cellSize', size),

    stop: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.set('running', RuntimeObject.boolean(evaluation, false))
      returnVoid(evaluation)
    },

    hideAttributes: (_self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      visual.set('showAttributes', RuntimeObject.boolean(evaluation, false))
      returnVoid(evaluation)
    },

    showAttributes: (_self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      visual.set('showAttributes', RuntimeObject.boolean(evaluation, true))
      returnVoid(evaluation)
    },

    errorReporter: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      self.set('errorReporter', visual)
      returnVoid(evaluation)
    },

    doStart: (self: RuntimeObject, _isRepl: RuntimeObject) => (evaluation: Evaluation): void => {
      self.set('running', RuntimeObject.boolean(evaluation, true))
      evaluation.invoke('doStart', evaluation.instance(evaluation.environment.getNodeByFQN('wollok.gameMirror.gameMirror').id))
    },
  },

  Sound: {
    play: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      if (wGame(evaluation).get('running') === RuntimeObject.boolean(evaluation, true))
        throw new Error('You cannot play a sound if game has not started')
      self.set('status', RuntimeObject.string(evaluation, 'played'))
      addSound(evaluation, wGame(evaluation), self)
      returnVoid(evaluation)
    },

    played: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.get('status')?.innerValue === 'played'))
    },

    stop: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self.get('status')?.innerValue !== 'played')
        throw new Error('You cannot stop a sound that is not played')
      self.set('status', RuntimeObject.string(evaluation, 'stopped'))
      removeSound(wGame(evaluation), self)
      returnVoid(evaluation)
    },

    pause: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self.get('status')?.innerValue !== 'played')
        throw new Error('You cannot pause a sound that is not played')
      self.set('status', RuntimeObject.string(evaluation, 'paused'))
      returnVoid(evaluation)
    },

    resume: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self.get('status')?.innerValue !== 'paused')
        throw new Error('You cannot resume a sound that is not paused')
      self.set('status', RuntimeObject.string(evaluation, 'played'))
      returnVoid(evaluation)
    },

    paused: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.get('status')?.innerValue === 'paused'))
    },

    volume: (self: RuntimeObject, newVolume?: RuntimeObject) => (evaluation: Evaluation): void => {
      if (newVolume) {
        const volume: RuntimeObject = newVolume
        volume.assertIsNumber()
        if (volume.innerValue < 0 || volume.innerValue > 1)
          throw new RangeError('newVolume')
      }
      property(self, 'volume', newVolume)(evaluation)
    },

    shouldLoop: (self: RuntimeObject, looping?: RuntimeObject): (evaluation: Evaluation) => void => property(self, 'loop', looping),

  },
}

export default game