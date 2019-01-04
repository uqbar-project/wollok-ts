import { chain as flatMap, last, reverse, zipObj } from 'ramda'
import uuid = require('uuid')
import { CALL, compile, Evaluation, FALSE_ID, Frame, INTERRUPT, Operations, PUSH, RuntimeObject, SWAP, TRUE_ID, VOID_ID } from '../interpreter'
import { Id } from '../model'
import { Operation } from '../parser'
import utils from '../utils'


// TODO:
// tslint:disable:variable-name
export default {
  wollok: {

    lang: {

      Exception: {
        getFullStackTrace: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        getStackTrace: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Object: {

        '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.id === other.id ? TRUE_ID : FALSE_ID)
        },

        'identity': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', self.id))
        },

        'instanceVariables': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'instanceVariableFor': (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'resolve': (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'kindName': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', self.module))
        },

        'className': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Collection: {
        findOrElse: (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) =>
          (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
      },

      Set: {
        'anyOne': (_self: RuntimeObject, ) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'fold': (_self: RuntimeObject, _initialValue: RuntimeObject, _closure: RuntimeObject) =>
          (_evaluation: Evaluation) => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'findOrElse': (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) =>
          (_evaluation: Evaluation) => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'add': (_self: RuntimeObject, _element: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'remove': (_self: RuntimeObject, _element: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'size': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'clear': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'join': (_self: RuntimeObject, _separator: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/
          if (arguments.length === 0 || arguments.length === 1) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'equals': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      List: {
        'get': (_self: RuntimeObject, _index: RuntimeObject) => (_evaluation: Evaluation) => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        'sortBy': (_self: RuntimeObject, _closure: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'fold': (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) =>
          (evaluation: Evaluation) => {
            last(evaluation.frameStack)!.resume.push('return')
            evaluation.frameStack.push({
              instructions: [
                ...flatMap((id: Id<'Linked'>) => [
                  PUSH(closure.id),
                  PUSH(id),
                ], reverse<string>(self.innerValue)),
                PUSH(initialValue.id),
                ...flatMap(() => [
                  SWAP,
                  CALL('apply', 2, closure.module),
                ], self.innerValue),
                INTERRUPT('return'),
              ],
              pc: 0,
              locals: { self: closure.id },
              operandStack: [],
              resume: [],
            })
          },

        'findOrElse': (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'add': (self: RuntimeObject, element: RuntimeObject) => () => {
          self.innerValue.push(element.id)
        },

        'remove': (self: RuntimeObject, element: RuntimeObject) => () => {
          (self as any).innerValue = self.innerValue.filter((id: string) => id !== element.id)
        },

        'size': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue.length))
        },

        'clear': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'join': (_self: RuntimeObject, _separator: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/
          if (arguments.length === 0 || arguments.length === 1) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'equals': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Dictionary: {
        put: (_self: RuntimeObject, _key: RuntimeObject, _value: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        basicGet: (_self: RuntimeObject, _key: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        remove: (_self: RuntimeObject, _key: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        keys: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        values: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        forEach: (_self: RuntimeObject, _closure: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        clear: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Number: {
        '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '-_': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', -self.innerValue))
        },

        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue + other.innerValue))
        },

        '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue - other.innerValue))
        },

        '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue * other.innerValue))
        },

        '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue / other.innerValue))
        },

        '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue ** other.innerValue))
        },

        '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue % other.innerValue))
        },

        'div': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', Math.round(self.innerValue / other.innerValue)))
        },

        'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue.toString()))
        },

        'stringValue': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue >= other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue <= other.innerValue ? TRUE_ID : FALSE_ID)
        },

        'abs': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          if (self.innerValue > 0) pushOperand(self.id)
          else pushOperand(addInstance('wollok.lang.Number', -self.innerValue))
        },

        'gcd': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'randomUpTo': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },


      String: {
        'length': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'charAt': (_self: RuntimeObject, _index: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', self.innerValue + other.innerValue))
        },

        'startsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue.startsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
        },

        'endsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue.endsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
        },

        'indexOf': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'lastIndexOf': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'toLowerCase': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue.toLowerCase()))
        },

        'toUpperCase': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue.toUpperCase()))
        },

        'trim': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue.trim()))
        },

        '<': (_self: RuntimeObject, _aString: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (_self: RuntimeObject, _aString: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'contains': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'substring': (_self: RuntimeObject, _startIndex: RuntimeObject, _length: RuntimeObject) =>
          (_evaluation: Evaluation) => {
            /* TODO:*/
            if (arguments.length === 1 || arguments.length === 2) throw new ReferenceError('To be implemented')
            throw new ReferenceError('To be implemented')
          },
        'replace': (_self: RuntimeObject, _expression: RuntimeObject, _replacement: RuntimeObject) =>
          (_evaluation: Evaluation) => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },

        'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.id)
        },

        'toSmartString': (_self: RuntimeObject, _alreadyShown: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
        },
      },

      Boolean: {

        '&&': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue && other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '||': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue || other.innerValue ? TRUE_ID : FALSE_ID)
        },

        'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', self.innerValue.toString()))
        },

        'toSmartString': (_self: RuntimeObject, _alreadyShown: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '!_': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue === FALSE_ID ? TRUE_ID : FALSE_ID)
        },
      },

      Range: {
        forEach: (_self: RuntimeObject, _closure: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        anyOne: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Closure: {
        // TODO: delete this once Closure is a reified node
        saveContext: (self: RuntimeObject) => (evaluation: Evaluation) => {
          const context: Frame[] = evaluation.frameStack.slice(0, -1).map(frame => ({
            instructions: [],
            pc: 0,
            locals: frame.locals,
            operandStack: [],
            resume: [],
          }));

          (self as any).innerValue = context
        },

        apply: (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation) => {
          const { methodLookup, resolve } = utils(evaluation.environment)

          const apply = methodLookup('<apply>', args.length, resolve(self.module))!

          last(evaluation.frameStack)!.resume.push('return')
          self.innerValue.forEach((frame: Frame) => evaluation.frameStack.push(frame))
          evaluation.frameStack.push({
            instructions: [
              ...compile(evaluation.environment)(apply.body!),
              PUSH(VOID_ID),
              INTERRUPT('return'),
            ],
            pc: 0,
            locals: { ...zipObj(apply.parameters.map(({ name }) => name), args.map(arg => arg.id)) },
            operandStack: [],
            resume: [],
          })
        },

        toString: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Date: {
        'toString': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _aDate: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusDays': (_self: RuntimeObject, _days: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusMonths': (_self: RuntimeObject, _months: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusYears': (_self: RuntimeObject, _years: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'isLeapYear': (_self: RuntimeObject, ) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'initialize': (_self: RuntimeObject, _day: RuntimeObject, _month: RuntimeObject, _year: RuntimeObject) =>
          (_evaluation: Evaluation) => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'day': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'dayOfWeek': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'month': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'year': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '-': (_self: RuntimeObject, _aDate: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusDays': (_self: RuntimeObject, _days: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusMonths': (_self: RuntimeObject, _months: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusYears': (_self: RuntimeObject, _years: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (_self: RuntimeObject, _aDate: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (_self: RuntimeObject, _aDate: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      console: {
        println: (_self: RuntimeObject, _obj: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        readLine: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        readInt: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        newline: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },
    },
  },
}