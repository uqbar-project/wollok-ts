import { Evaluation, RuntimeObject } from '../interpreter'

// TODO: Must be async

export default {
  wollok: {
    lang: {

      Exception: {
        getFullStackTrace: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        getStackTrace: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Object: {
        identity: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        instanceVariables: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        instanceVariableFor: (self: RuntimeObject, name: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        resolve: (self: RuntimeObject, name: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        kindName: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        className: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Collection: {
        findOrElse: (self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) =>
          (evaluation: Evaluation): Evaluation => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
      },

      Set: {
        'anyOne': (self: RuntimeObject, ) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'fold': (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO:*/
          throw new ReferenceError('To be implemented')
        },
        'findOrElse': (self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) =>
          (evaluation: Evaluation): Evaluation => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'add': (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'remove': (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'size': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'clear': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'join': (self: RuntimeObject, separator: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO:*/
          if (arguments.length === 0 || arguments.length === 1) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'equals': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      List: {
        'get': (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        'sortBy': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'fold': (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'findOrElse': (self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) =>
          (evaluation: Evaluation): Evaluation => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
        'add': (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'remove': (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'size': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        'clear': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'join': (self: RuntimeObject, separator: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO:*/
          if (arguments.length === 0 || arguments.length === 1) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'equals': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Dictionary: {
        put: (self: RuntimeObject, key: RuntimeObject, value: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        basicGet: (self: RuntimeObject, key: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        remove: (self: RuntimeObject, key: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        keys: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        values: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        clear: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Integer: {
        '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO: */ throw new ReferenceError('To be implemented')
        },
        '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO */ throw new ReferenceError('To be implemented')
        },
        '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'div': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toString': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'stringValue': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'abs': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'invert': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'gcd': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'randomUpTo': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Double: {
        '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'div': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'stringValue': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'abs': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'invert': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'gcd': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'randomUpTo': (self: RuntimeObject, max: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'roundUp': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'truncate': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      String: {
        'length': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'charAt': (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'startsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'endsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'indexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'lastIndexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toLowerCase': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toUpperCase': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'trim': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (self: RuntimeObject, aString: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (self: RuntimeObject, aString: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'contains': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'substring': (self: RuntimeObject, startIndex: RuntimeObject, length: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO:*/
          if (arguments.length === 1 || arguments.length === 2) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'replace': (self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
          /* TODO:*/
          throw new ReferenceError('To be implemented')
        },
        'toString': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toSmartString': (self: RuntimeObject, alreadyShown: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Boolean: {
        '&&': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '||': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toString': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toSmartString': (self: RuntimeObject, alreadyShown: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'negate': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Range: {
        validate: (self: RuntimeObject, limit: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        anyOne: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Closure: {
        apply: (self: RuntimeObject, ...args: RuntimeObject[]) => (evaluation: Evaluation): Evaluation => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        toString: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Date: {
        'toString': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (self: RuntimeObject, aDate: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'isLeapYear': (self: RuntimeObject, ) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'initialize': (self: RuntimeObject, day: RuntimeObject, month: RuntimeObject, year: RuntimeObject) =>
          (evaluation: Evaluation): Evaluation => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'day': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'dayOfWeek': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'month': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'year': (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '-': (self: RuntimeObject, aDate: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (self: RuntimeObject, aDate: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (self: RuntimeObject, aDate: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      console: {
        println: (self: RuntimeObject, obj: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        readLine: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        readInt: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        newline: (self: RuntimeObject) => (evaluation: Evaluation): Evaluation => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },
    },
  },
}