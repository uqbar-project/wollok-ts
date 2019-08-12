import { Evaluation, RuntimeObject } from '../interpreter'

// TODO: tests

// TODO:
// tslint:disable:variable-name

export default {
   game: {
      addVisual: (_self: RuntimeObject, _positionable: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
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

      removeVisual: (_self: RuntimeObject, _visual: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
      },

      whenKeyPressedDo: (_self: RuntimeObject, _key: RuntimeObject, _action: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
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

      title: (_self: RuntimeObject, _title?: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
      },

      width: (_self: RuntimeObject, _width?: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
      },

      height: (_self: RuntimeObject, _height?: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
      },

      ground: (_self: RuntimeObject, _image: RuntimeObject) => (_evaluation: Evaluation) => {
           /*TODO: */ throw new ReferenceError('To be implemented')
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