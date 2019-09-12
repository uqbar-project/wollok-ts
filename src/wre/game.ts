import { last } from '../extensions'
import { CALL, Evaluation, INTERRUPT, Operations, PUSH, RuntimeObject, VOID_ID } from '../interpreter'
import { Id } from '../model'

// TODO: tests

// TODO:
// tslint:disable:variable-name

export default {
  game: {
    addVisual: (self: RuntimeObject, positionable: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand, getInstance } = Operations(evaluation)
      if (!self.fields.visuals) {
        self.fields.visuals = evaluation.createInstance('wollok.lang.List', [])
      }
      getInstance(self.fields.visuals).innerValue.push(positionable.id)
      pushOperand(VOID_ID)
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
      const { pushOperand, getInstance } = Operations(evaluation)
      if (self.fields.visuals) {
        const visuals = getInstance(self.fields.visuals)
        visuals.innerValue = visuals.innerValue.filter((id: Id) => id !== visual.id)
      }
      pushOperand(VOID_ID)
    },

    whenKeyPressedDo: (_self: RuntimeObject, event: RuntimeObject, action: RuntimeObject) => (evaluation: Evaluation) => {
      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push({
        instructions: [
          PUSH(evaluation.environment.getNodeByFQN('wollok.lang.io').id),
          PUSH(event.id),
          PUSH(action.id),
          CALL('addHandler', 2),
          INTERRUPT('return'),
        ],
        nextInstruction: 0,
        locals: {},
        operandStack: [],
        resume: [],
      })
    },

    whenCollideDo: (_self: RuntimeObject, _visual: RuntimeObject, _action: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
    },

    onTick: (_self: RuntimeObject, _ms: RuntimeObject, _name: RuntimeObject, _action: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
    },

    removeTickEvent: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
    },

    getObjectsIn: (_self: RuntimeObject, _position: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
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
      const { pushOperand } = Operations(evaluation)
      if (title) {
        self.fields.title = title.id
        pushOperand(VOID_ID)
      } else pushOperand(self.fields.title)
    },

    width: (self: RuntimeObject, width?: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (width) {
        self.fields.width = width.id
        pushOperand(VOID_ID)
      } else pushOperand(self.fields.width)
    },

    height: (self: RuntimeObject, height?: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (height) {
        self.fields.height = height.id
        pushOperand(VOID_ID)
      } else pushOperand(self.fields.height)
    },

    ground: (self: RuntimeObject, image: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (image) {
        self.fields.ground = image.id
        pushOperand(VOID_ID)
      } else pushOperand(self.fields.ground)
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