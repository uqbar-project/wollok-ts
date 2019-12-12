import { interpret } from '..'
import { Evaluation, RuntimeObject, VOID_ID } from '../interpreter'
import { Id } from '../model'
import wreNatives from './wre.natives'

// TODO: tests

// TODO:
// tslint:disable:variable-name

const newList = (evaluation: Evaluation) => evaluation.createInstance('wollok.lang.List', [])

const returnValue = (evaluation: Evaluation, id: Id) => {
  evaluation.currentFrame()!.pushOperand(id)
}

const returnVoid = (evaluation: Evaluation) => {
  returnValue(evaluation, VOID_ID)
}

const get = (self: RuntimeObject, key: string) => (evaluation: Evaluation) => {
  evaluation.currentFrame()!.pushOperand(self.get(key) ?.id ?? VOID_ID)
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

const redirectTo = (receiver: (evaluation: Evaluation) => string, voidMessage: boolean = true) => (message: string, ...params: string[]) =>
  (evaluation: Evaluation) => {
    const { sendMessage } = interpret(evaluation.environment, wreNatives)
    sendMessage(message, receiver(evaluation), ...params)(evaluation)
    if (voidMessage) returnVoid(evaluation)
  }

const mirror = (evaluation: Evaluation) => evaluation.environment.getNodeByFQN('wollok.gameMirror.gameMirror').id

const io = (evaluation: Evaluation) => evaluation.environment.getNodeByFQN('wollok.io.io').id

const samePosition = (evaluation: Evaluation, position: RuntimeObject) => (id: Id) => {
  const { sendMessage } = interpret(evaluation.environment, wreNatives)
  const currentFrame = evaluation.frameStack[evaluation.frameStack.length - 1]
  sendMessage('position', id)(evaluation)
  const visualPosition = evaluation.instances[currentFrame.operandStack.pop()!]
  return  position.get('x') === visualPosition.get('x')
  &&      position.get('y') === visualPosition.get('y')
}

export default {
  game: {
    addVisual: (self: RuntimeObject, positionable: RuntimeObject) => (evaluation: Evaluation) => {
      if (!self.get('visuals')) {
        self.set('visuals', newList(evaluation))
      }
      const visuals: RuntimeObject = self.get('visuals')!
      visuals.assertIsCollection()
      visuals.innerValue.push(positionable.id)
      returnVoid(evaluation)
    },

    // TODO:
    addVisualIn: (_self: RuntimeObject, _element: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    addVisualCharacter: (_self: RuntimeObject, _positionable: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    addVisualCharacterIn: (_self: RuntimeObject, _element: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

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

    onTick: (_self: RuntimeObject, milliseconds: RuntimeObject, name: RuntimeObject, action: RuntimeObject) =>
      redirectTo(mirror)('onTick', milliseconds.id, name.id, action.id),

    schedule: (_self: RuntimeObject, milliseconds: RuntimeObject, action: RuntimeObject) =>
      redirectTo(mirror)('schedule', milliseconds.id, action.id),

    removeTickEvent: (_self: RuntimeObject, event: RuntimeObject) =>
      redirectTo(io)('removeTimeHandler', event.id),

    getObjectsIn: (self: RuntimeObject, position: RuntimeObject) => (evaluation: Evaluation) => {
      const visuals = self.get('visuals')
      const result = newList(evaluation)
      if (!visuals) {
        return returnValue(evaluation, result)
      }
      const currentVisuals: RuntimeObject = visuals
      currentVisuals.assertIsCollection()
      const wResult: RuntimeObject = evaluation.instance(result)
      wResult.assertIsCollection()
      wResult.innerValue = currentVisuals.innerValue.filter(samePosition(evaluation, position))
      returnValue(evaluation, result)
    },

    say: (_self: RuntimeObject, visual: RuntimeObject, message: RuntimeObject) => (evaluation: Evaluation) => {
      const currentFrame = evaluation.frameStack[evaluation.frameStack.length - 1]
      const { sendMessage } = interpret(evaluation.environment, wreNatives)
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
      const { sendMessage } = interpret(evaluation.environment, wreNatives)
      sendMessage('clear', io(evaluation))(evaluation)
      self.set('visuals', newList(evaluation))
      returnVoid(evaluation)
    },

    colliders: (_self: RuntimeObject, visual: RuntimeObject) =>
      redirectTo(mirror, false)('colliders', visual.id),

    title: (self: RuntimeObject, title?: RuntimeObject) => property(self, 'title', title),

    width: (self: RuntimeObject, width?: RuntimeObject) => property(self, 'width', width),

    height: (self: RuntimeObject, height?: RuntimeObject) => property(self, 'height', height),

    ground: (self: RuntimeObject, ground: RuntimeObject) => set(self, 'ground', ground),

    boardGround: (self: RuntimeObject, boardGround: RuntimeObject) => set(self, 'boardGround', boardGround),

    // TODO:
    stop: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    hideAttributes: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    showAttributes: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    errorReporter: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    sound: (_self: RuntimeObject, _audioFile: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    doStart: (_self: RuntimeObject, _isRepl: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },
  },
}