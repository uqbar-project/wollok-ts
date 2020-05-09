import { interpret } from '..'
import { Evaluation, FALSE_ID, Natives, NULL_ID, RuntimeObject, TRUE_ID, VOID_ID } from '../interpreter'
import { Id, Module } from '../model'
import natives from './wre.natives'

// TODO:
// tslint:disable:variable-name

const newList = (evaluation: Evaluation, ...elements: Id[]) => evaluation.createInstance('wollok.lang.List', elements)

const returnValue = (evaluation: Evaluation, id: Id) => {
  evaluation.currentFrame()!.pushOperand(id)
}

const returnVoid = (evaluation: Evaluation) => {
  returnValue(evaluation, VOID_ID)
}

const get = (self: RuntimeObject, key: string) => (evaluation: Evaluation) => {
  evaluation.currentFrame()!.pushOperand(self.get(key)?.id ?? VOID_ID)
}

const set = (self: RuntimeObject, key: string, value: RuntimeObject) => (evaluation: Evaluation) => {
  self.set(key, value.id)
  returnVoid(evaluation)
}

const property = (self: RuntimeObject, key: string, value?: RuntimeObject) => (evaluation: Evaluation) => {
  if (value)
    set(self, key, value)(evaluation)
  else
    get(self, key)(evaluation)
}

const redirectTo = (receiver: (evaluation: Evaluation) => string, voidMessage = true) => (message: string, ...params: string[]) =>
  (evaluation: Evaluation) => {
    const { sendMessage } = interpret(evaluation.environment, natives as Natives)
    sendMessage(message, receiver(evaluation), ...params)(evaluation)
    if (voidMessage) returnVoid(evaluation)
  }

const checkNotNull = (obj: RuntimeObject, name: string) => {
  if (obj.id === NULL_ID) throw new TypeError(name)
}

const mirror = (evaluation: Evaluation) => evaluation.environment.getNodeByFQN('wollok.gameMirror.gameMirror').id

const io = (evaluation: Evaluation) => evaluation.environment.getNodeByFQN('wollok.io.io').id

const getPosition = (id: Id) => (evaluation: Evaluation) => {
  const position = evaluation.instance(id).get('position')
  if (position) return position
  const { sendMessage } = interpret(evaluation.environment, natives as Natives)
  const currentFrame = evaluation.frameStack[evaluation.frameStack.length - 1]
  sendMessage('position', id)(evaluation)
  return evaluation.instances[currentFrame.operandStack.pop()!]
}

const samePosition = (evaluation: Evaluation, position: RuntimeObject) => (id: Id) => {
  const visualPosition = getPosition(id)(evaluation)
  return position.get('x') === visualPosition.get('x')
    && position.get('y') === visualPosition.get('y')
}

const addVisual = (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
  if (!self.get('visuals')) {
    self.set('visuals', newList(evaluation))
  }
  const visuals: RuntimeObject = self.get('visuals')!
  visuals.assertIsCollection()
  if (visuals.innerValue.includes(visual.id)) throw new TypeError(visual.moduleFQN)
  else visuals.innerValue.push(visual.id)
}

const lookupMethod = (self: RuntimeObject, message: string) => (evaluation: Evaluation) =>
  evaluation.environment.getNodeByFQN<Module>(self.moduleFQN).lookupMethod(message, 0)

export default {
  game: {
    addVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      checkNotNull(visual, 'visual')
      const message = 'position' // TODO
      if (!lookupMethod(visual, message)(evaluation)) throw new TypeError(message)
      addVisual(self, visual)(evaluation)
      returnVoid(evaluation)
    },

    addVisualIn: (self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject) => (evaluation: Evaluation) => {
      checkNotNull(visual, 'visual')
      checkNotNull(position, 'position')
      visual.set('position', position.id)
      addVisual(self, visual)(evaluation)
      returnVoid(evaluation)
    },

    addVisualCharacter: (_self: RuntimeObject, visual: RuntimeObject) =>
      redirectTo(mirror)('addVisualCharacter', visual.id),


    addVisualCharacterIn: (_self: RuntimeObject, visual: RuntimeObject, position: RuntimeObject) =>
      redirectTo(mirror)('addVisualCharacterIn', visual.id, position.id),

    removeVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      const visuals = self.get('visuals')
      if (visuals) {
        const currentVisuals: RuntimeObject = visuals
        currentVisuals.assertIsCollection()
        currentVisuals.innerValue = currentVisuals.innerValue.filter((id: Id) => id !== visual.id)
      }
      returnVoid(evaluation)
    },

    whenKeyPressedDo: (_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject) =>
      redirectTo(io)('addEventHandler', event.id, action.id),

    whenCollideDo: (_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject) =>
      redirectTo(mirror)('whenCollideDo', visual.id, action.id),

    onCollideDo: (_self: RuntimeObject, visual: RuntimeObject, action: RuntimeObject) =>
      redirectTo(mirror)('onCollideDo', visual.id, action.id),

    onTick: (_self: RuntimeObject, milliseconds: RuntimeObject, name: RuntimeObject, action: RuntimeObject) =>
      redirectTo(mirror)('onTick', milliseconds.id, name.id, action.id),

    schedule: (_self: RuntimeObject, milliseconds: RuntimeObject, action: RuntimeObject) =>
      redirectTo(mirror)('schedule', milliseconds.id, action.id),

    removeTickEvent: (_self: RuntimeObject, event: RuntimeObject) =>
      redirectTo(io)('removeTimeHandler', event.id),

    allVisuals: (self: RuntimeObject) => (evaluation: Evaluation) => {
      const visuals = self.get('visuals')
      if (!visuals) return returnValue(evaluation, newList(evaluation))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      const result = newList(evaluation, ...currentVisuals.innerValue)
      returnValue(evaluation, result)
    },

    hasVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      const visuals = self.get('visuals')
      if (!visuals) return returnValue(evaluation, FALSE_ID)
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      returnValue(evaluation, currentVisuals.innerValue.includes(visual.id) ? TRUE_ID : FALSE_ID)
    },

    getObjectsIn: (self: RuntimeObject, position: RuntimeObject) => (evaluation: Evaluation) => {
      const visuals = self.get('visuals')
      if (!visuals) return returnValue(evaluation, newList(evaluation))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      const result = newList(evaluation, ...currentVisuals.innerValue.filter(samePosition(evaluation, position)))
      returnValue(evaluation, result)
    },

    say: (_self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject) => (evaluation: Evaluation) => {
      const currentFrame = evaluation.frameStack[evaluation.frameStack.length - 1]
      const { sendMessage } = interpret(evaluation.environment, natives as Natives)
      sendMessage('currentTime', io(evaluation))(evaluation)
      const wCurrentTime: RuntimeObject = evaluation.instances[currentFrame.operandStack.pop()!]
      wCurrentTime.assertIsNumber()
      const currentTime = wCurrentTime.innerValue
      const messageTimeId = evaluation.createInstance('wollok.lang.Number', currentTime + 2 * 1000)
      const messageTime = evaluation.instance(messageTimeId)
      set(visual, 'message', message)(evaluation)
      set(visual, 'messageTime', messageTime)(evaluation)
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { sendMessage } = interpret(evaluation.environment, natives as Natives)
      sendMessage('clear', io(evaluation))(evaluation)
      self.set('visuals', newList(evaluation))
      returnVoid(evaluation)
    },

    colliders: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      const visuals = self.get('visuals')
      if (!visuals) return returnValue(evaluation, newList(evaluation))
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      const position = getPosition(visual.id)(evaluation)
      const result = newList(evaluation, ...currentVisuals.innerValue
        .filter(samePosition(evaluation, position))
        .filter(id => id !== visual.id)
      )
      returnValue(evaluation, result)
    },

    title: (self: RuntimeObject, title?: RuntimeObject) => property(self, 'title', title),

    width: (self: RuntimeObject, width?: RuntimeObject) => property(self, 'width', width),

    height: (self: RuntimeObject, height?: RuntimeObject) => property(self, 'height', height),

    ground: (self: RuntimeObject, ground: RuntimeObject) => set(self, 'ground', ground),

    boardGround: (self: RuntimeObject, boardGround: RuntimeObject) => set(self, 'boardGround', boardGround),

    stop: (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.set('running', FALSE_ID)
      returnVoid(evaluation)
    },

    hideAttributes: (_self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      visual.set('showAttributes', FALSE_ID)
      returnVoid(evaluation)
    },

    showAttributes: (_self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      visual.set('showAttributes', TRUE_ID)
      returnVoid(evaluation)
    },

    errorReporter: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation) => {
      self.set('errorReporter', visual.id)
      returnVoid(evaluation)
    },

    // TODO:
    sound: (_self: RuntimeObject, _audioFile: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    doStart: (self: RuntimeObject, _isRepl: RuntimeObject) => (evaluation: Evaluation) => {
      self.set('running', TRUE_ID)
      returnVoid(evaluation)
    },
  },
}