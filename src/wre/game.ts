import { interpret } from '..'
import { CALL, Evaluation, INTERRUPT, PUSH, RuntimeObject, VOID_ID } from '../interpreter'
import { Id } from '../model'
import wreNatives from './wre.natives'

// TODO: tests

// TODO:
// tslint:disable:variable-name

export default {
  game: {
    addVisual: (self: RuntimeObject, positionable: RuntimeObject) => (evaluation: Evaluation) => {
      if (!self.get('visuals')) {
        self.set('visuals', evaluation.createInstance('wollok.lang.List', []))
      }

      const visuals: RuntimeObject = self.get('visuals')!

      visuals.assertIsCollection()

      visuals.innerValue.push(positionable.id)
      evaluation.currentFrame().pushOperand(VOID_ID)
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
        const currentVisuals: RuntimeObject = visuals!
        currentVisuals.assertIsCollection()
        currentVisuals.innerValue = currentVisuals.innerValue.filter((id: Id) => id !== visual.id)
      }
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    whenKeyPressedDo: (_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.suspend('return', [
        PUSH(evaluation.environment.getNodeByFQN('wollok.lang.io').id),
        PUSH(event.id),
        PUSH(action.id),
        CALL('addHandler', 2),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))
    },

    whenCollideDo: (_self: RuntimeObject, _visual: RuntimeObject, _action: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    removeTickEvent: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    getObjectsIn: (self: RuntimeObject, position: RuntimeObject) => (evaluation: Evaluation) => {
      const { sendMessage } = interpret(evaluation.environment, wreNatives)
      const visuals = self.get('visuals')
      if (visuals) {
        // TODO: Validate visuals
      }
      const inPosition = (id: Id) => {
        const currentFrame = evaluation.frameStack[evaluation.frameStack.length - 1]
        sendMessage('position', id)(evaluation)
        const visualPosition = evaluation.instances[currentFrame.operandStack.pop()!]
        return  position.get('x') === visualPosition.get('x')
        &&      position.get('y') === visualPosition.get('y')
      }
      const currentVisuals: RuntimeObject = visuals!
      currentVisuals.assertIsCollection()
      const result = evaluation.createInstance('wollok.lang.List', [])
      const wResult: RuntimeObject = evaluation.instance(result)
      wResult.assertIsCollection()
      wResult.innerValue = currentVisuals.innerValue.filter(inPosition)
      evaluation.currentFrame().pushOperand(result)
    },

    say: (_self: RuntimeObject, _visual: RuntimeObject, _message: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    clear: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    colliders: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    stop: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

    title: (self: RuntimeObject, title?: RuntimeObject) => (evaluation: Evaluation) => {
      // TODO: Add behavior for runtime objects to read and write fields
      if (title) {
        self.set('title', title.id)
        evaluation.currentFrame().pushOperand(VOID_ID)
      } else evaluation.currentFrame().pushOperand(self.get('title') ?.id ?? VOID_ID)
    },

    width: (self: RuntimeObject, width?: RuntimeObject) => (evaluation: Evaluation) => {
      if (width) {
        self.set('width', width.id)
        evaluation.currentFrame().pushOperand(VOID_ID)
      } else evaluation.currentFrame().pushOperand(self.get('width') ?.id ?? VOID_ID)
    },

    height: (self: RuntimeObject, height?: RuntimeObject) => (evaluation: Evaluation) => {
      if (height) {
        self.set('height', height.id)
        evaluation.currentFrame().pushOperand(VOID_ID)
      } else evaluation.currentFrame().pushOperand(self.get('height') ?.id ?? VOID_ID)
    },

    ground: (self: RuntimeObject, ground: RuntimeObject) => (evaluation: Evaluation) => {
      self.set('ground', ground.id)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    boardGround: (_self: RuntimeObject, _image: RuntimeObject) => (_evaluation: Evaluation) => {
      /*TODO: */ throw new ReferenceError('To be implemented')
    },

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