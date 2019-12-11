import { interpret } from '..'
import { CALL, Evaluation, INTERRUPT, PUSH, RuntimeObject, VOID_ID } from '../interpreter'
import { Id } from '../model'
import wreNatives from './wre.natives'

// TODO: tests

// TODO:
// tslint:disable:variable-name

const newList = (evaluation: Evaluation) => evaluation.createInstance('wollok.lang.List', [])

const returnValue = (evaluation: Evaluation, id: Id) => {
  evaluation.currentFrame().pushOperand(id)
}

const returnVoid = (evaluation: Evaluation) => {
  returnValue(evaluation, VOID_ID)
}

const get = (self: RuntimeObject, key: string) => (evaluation: Evaluation) => {
  evaluation.currentFrame().pushOperand(self.get(key) ?.id ?? VOID_ID)
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

    addVisualIn: (_self: RuntimeObject, _element: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    addVisualCharacter: (_self: RuntimeObject, _positionable: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    addVisualCharacterIn: (_self: RuntimeObject, _element: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
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

    whenKeyPressedDo: (_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.suspend('return', [
        PUSH(evaluation.environment.getNodeByFQN('wollok.lang.io').id),
        PUSH(event.id),
        PUSH(action.id),
        CALL('addEventHandler', 2),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))
    },

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
      const io = evaluation.environment.getNodeByFQN('wollok.lang.io').id
      const currentFrame = evaluation.frameStack[evaluation.frameStack.length - 1]
      const { sendMessage } = interpret(evaluation.environment, wreNatives)
      sendMessage('currentTime', io)(evaluation)
      const wCurrentTime: RuntimeObject = evaluation.instances[currentFrame.operandStack.pop()!]
      wCurrentTime.assertIsNumber()
      const currentTime = wCurrentTime.innerValue
      const messageTimeId = evaluation.createInstance('wollok.lang.Number', currentTime + 2 * 1000)
      const messageTime = evaluation.instance(messageTimeId)
      set(visual, 'message', message)(evaluation)
      set(visual, 'messageTime', messageTime)(evaluation)
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.suspend('return', [
        PUSH(evaluation.environment.getNodeByFQN('wollok.lang.io').id),
        CALL('clear', 0),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))

      self.set('visuals', newList(evaluation))
      returnVoid(evaluation)
    },

    stop: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    title: (self: RuntimeObject, title?: RuntimeObject) => property(self, 'title', title),

    width: (self: RuntimeObject, width?: RuntimeObject) => property(self, 'width', width),

    height: (self: RuntimeObject, height?: RuntimeObject) => property(self, 'height', height),

    ground: (self: RuntimeObject, ground: RuntimeObject) => set(self, 'ground', ground),

    boardGround: (self: RuntimeObject, boardGround: RuntimeObject) => set(self, 'boardGround', boardGround),

    hideAttributes: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    showAttributes: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    errorReporter: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    sound: (_self: RuntimeObject, _audioFile: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    doStart: (_self: RuntimeObject, _isRepl: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },
  },
}