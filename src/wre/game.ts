import { CALL, Evaluation, PUSH, RETURN, RuntimeObject, VOID_ID } from '../interpreter'
import { Id } from '../model'

// TODO: tests

// TODO:
// tslint:disable:variable-name

export default {
  game: {
    addVisual: (self: RuntimeObject, positionable: RuntimeObject) => (evaluation: Evaluation): void => {
      if (!self.get('visuals')) {
        self.set('visuals', evaluation.createInstance('wollok.lang.List', []))
      }

      const visuals: RuntimeObject = self.get('visuals')!

      visuals.assertIsCollection()

      visuals.innerValue.push(positionable.id)
      evaluation.currentFrame()!.pushOperand(VOID_ID)
    },

    // TODO:
    addVisualIn: (_self: RuntimeObject, _element: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    addVisualCharacter: (_self: RuntimeObject, _positionable: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    addVisualCharacterIn: (_self: RuntimeObject, _element: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    removeVisual: (self: RuntimeObject, visual: RuntimeObject) => (evaluation: Evaluation): void => {
      const visuals = self.get('visuals')
      if (visuals) {
        (visuals as any).assertCollection()
        visuals.innerValue = (visuals.innerValue as Id[]).filter((id: Id) => id !== visual.id)
      }
      evaluation.currentFrame()!.pushOperand(VOID_ID)
    },

    whenKeyPressedDo: (self: RuntimeObject, event: RuntimeObject, action: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.pushFrame([
        PUSH(evaluation.environment.getNodeByFQN('wollok.lang.io').id),
        PUSH(event.id),
        PUSH(action.id),
        CALL('addHandler', 2),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    // TODO:
    whenCollideDo: (_self: RuntimeObject, _visual: RuntimeObject, _action: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    onTick: (_self: RuntimeObject, _ms: RuntimeObject, _name: RuntimeObject, _action: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    removeTickEvent: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    getObjectsIn: (_self: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    say: (_self: RuntimeObject, _visual: RuntimeObject, _message: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.set('visuals', evaluation.createInstance('wollok.lang.List', []))
    },

    // TODO:
    colliders: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    stop: (_self: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    title: (self: RuntimeObject, title?: RuntimeObject) => (evaluation: Evaluation): void => {
      // TODO: Add behavior for runtime objects to read and write fields
      if (title) {
        self.set('title', title.id)
        evaluation.currentFrame()!.pushOperand(VOID_ID)
      } else evaluation.currentFrame()!.pushOperand(self.get('title')?.id ?? VOID_ID)
    },

    width: (self: RuntimeObject, width?: RuntimeObject) => (evaluation: Evaluation): void => {
      if (width) {
        self.set('width', width.id)
        evaluation.currentFrame()!.pushOperand(VOID_ID)
      } else evaluation.currentFrame()!.pushOperand(self.get('width')?.id ?? VOID_ID)
    },

    height: (self: RuntimeObject, height?: RuntimeObject) => (evaluation: Evaluation): void => {
      if (height) {
        self.set('height', height.id)
        evaluation.currentFrame()!.pushOperand(VOID_ID)
      } else evaluation.currentFrame()!.pushOperand(self.get('height')?.id ?? VOID_ID)
    },

    ground: (self: RuntimeObject, ground: RuntimeObject) => (evaluation: Evaluation): void => {
      self.set('ground', ground.id)
      evaluation.currentFrame()!.pushOperand(VOID_ID)
    },

    // TODO:
    boardGround: (_self: RuntimeObject, _image: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    hideAttributes: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    showAttributes: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    errorReporter: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    sound: (_self: RuntimeObject, _audioFile: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    doStart: (_self: RuntimeObject, _isRepl: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },
  },
}