import { last } from 'ramda'
import uuid = require('uuid')
import { Evaluation, FALSE_ID, RuntimeObject, TRUE_ID } from '../interpreter'


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
          last(evaluation.frameStack)!.operandStack.push(
            self.id === other.id ? TRUE_ID : FALSE_ID
          )
        },

        'identity': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
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

        'kindName': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
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
        'fold': (_self: RuntimeObject, _initialValue: RuntimeObject, _closure: RuntimeObject) =>
          (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
        'findOrElse': (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) =>
          (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
        'add': (_self: RuntimeObject, _element: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'remove': (_self: RuntimeObject, _element: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'size': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
          /*TODO: */ throw new ReferenceError('To be implemented')
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
          last(evaluation.frameStack)!.operandStack.push(
            self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID
          )
        },

        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue + other.innerValue }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue - other.innerValue }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue * other.innerValue }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue / other.innerValue }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue ** other.innerValue }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue % other.innerValue }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        'div': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.String', fields: {}, innerValue: self.innerValue.toString() }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        'stringValue': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(self.innerValue >= other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(self.innerValue <= other.innerValue ? TRUE_ID : FALSE_ID)
        },

        'abs': (self: RuntimeObject) => (evaluation: Evaluation) => {
          if (self.innerValue > 0) {
            last(evaluation.frameStack)!.operandStack.push(self.id)
          } else {
            const id = uuid()
            evaluation.instances[id] = { id, module: 'wollok.lang.Number', fields: {}, innerValue: -self.innerValue }
            last(evaluation.frameStack)!.operandStack.push(id)
          }
        },

        'invert': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
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
        '+': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'startsWith': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'endsWith': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'indexOf': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'lastIndexOf': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toLowerCase': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toUpperCase': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'trim': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
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
        'toString': (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toSmartString': (_self: RuntimeObject, _alreadyShown: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Boolean: {

        '&&': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(self.innerValue && other.innerValue ? TRUE_ID : FALSE_ID)
        },

        '||': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(self.innerValue || other.innerValue ? TRUE_ID : FALSE_ID)
        },

        'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const id = uuid()
          evaluation.instances[id] = { id, module: 'wollok.lang.String', fields: {}, innerValue: self.innerValue.toString() }
          last(evaluation.frameStack)!.operandStack.push(id)
        },

        'toSmartString': (_self: RuntimeObject, _alreadyShown: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(
            self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID
          )
        },

        '!_': (self: RuntimeObject) => (evaluation: Evaluation) => {
          last(evaluation.frameStack)!.operandStack.push(
            self.innerValue === FALSE_ID ? TRUE_ID : FALSE_ID
          )
        },
      },

      Range: {
        validate: (_self: RuntimeObject, _limit: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        forEach: (_self: RuntimeObject, _closure: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        anyOne: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Closure: {
        apply: (_self: RuntimeObject, ..._args: RuntimeObject[]) => (_evaluation: Evaluation) => {
          /*TODO: */ throw new ReferenceError('To be implemented')
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