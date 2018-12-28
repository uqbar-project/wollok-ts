import uuid = require('uuid')
import { Evaluation, FALSE_ID, RuntimeObject, TRUE_ID } from '../interpreter'


// TODO:
// tslint:disable:variable-name
export default {
  wollok: {
    lang: {

      Exception: {
        getFullStackTrace: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        getStackTrace: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Object: {

        '===': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.id === other.id ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        'identity': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'instanceVariables': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'instanceVariableFor': (_self: RuntimeObject, _name: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'resolve': (_self: RuntimeObject, _name: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'kindName': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'className': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Collection: {
        findOrElse: (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
      },

      Set: {
        'anyOne': (_self: RuntimeObject, ) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'fold': (_self: RuntimeObject, _initialValue: RuntimeObject, _closure: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'findOrElse': (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'add': (_self: RuntimeObject, _element: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'remove': (_self: RuntimeObject, _element: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'size': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'clear': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'join': (_self: RuntimeObject, _separator: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
          /* TODO:*/
          if (arguments.length === 0 || arguments.length === 1) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'equals': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      List: {
        'get': (_self: RuntimeObject, _index: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        'sortBy': (_self: RuntimeObject, _closure: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'fold': (_self: RuntimeObject, _initialValue: RuntimeObject, _closure: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
        'findOrElse': (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
          },
        'add': (_self: RuntimeObject, _element: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'remove': (_self: RuntimeObject, _element: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'size': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        'clear': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'join': (_self: RuntimeObject, _separator: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
          /* TODO:*/
          if (arguments.length === 0 || arguments.length === 1) throw new ReferenceError('To be implemented')
          throw new ReferenceError('To be implemented')
        },
        'equals': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Dictionary: {
        put: (_self: RuntimeObject, _key: RuntimeObject, _value: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        basicGet: (_self: RuntimeObject, _key: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        remove: (_self: RuntimeObject, _key: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        keys: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        values: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        forEach: (_self: RuntimeObject, _closure: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        clear: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Integer: {
        '===': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        '+': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue + other.innerValue },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        '-': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue - other.innerValue },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        '*': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue * other.innerValue },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        '/': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue / other.innerValue },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        '**': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue ** other.innerValue },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        '%': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: self.innerValue % other.innerValue },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        'div': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'toString': (self: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          const id = uuid()
          return {
            ...evaluation,
            instances: {
              id: { id, module: 'wollok.lang.String', fields: {}, innerValue: self.innerValue.toString() },
              ...evaluation.instances,
            },
            frameStack: [
              {
                ...evaluation.frameStack[0],
                operandStack: [
                  id,
                  ...evaluation.frameStack[0].operandStack,
                ],
              },
              ...evaluation.frameStack.slice(1),
            ],
          }
        },

        'stringValue': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '>': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        '>=': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue >= other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        '<': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        '<=': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue <= other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        'abs': (self: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => {
          if (self.innerValue > 0) {
            return {
              ...evaluation,
              frameStack: [
                {
                  ...evaluation.frameStack[0],
                  operandStack: [
                    self.id,
                    ...evaluation.frameStack[0].operandStack,
                  ],
                },
                ...evaluation.frameStack.slice(1),
              ],
            }
          } else {
            const id = uuid()
            return {
              ...evaluation,
              instances: {
                id: { id, module: 'wollok.lang.Number', fields: {}, innerValue: -self.innerValue },
                ...evaluation.instances,
              },
              frameStack: [
                {
                  ...evaluation.frameStack[0],
                  operandStack: [
                    id,
                    ...evaluation.frameStack[0].operandStack,
                  ],
                },
                ...evaluation.frameStack.slice(1),
              ],
            }
          }
        },

        'invert': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'gcd': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'randomUpTo': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Double: {
        '===': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '+': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '-': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '*': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '/': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '**': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '%': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'div': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'stringValue': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>=': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<=': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'abs': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'invert': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'gcd': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'randomUpTo': (_self: RuntimeObject, _max: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'roundUp': (_self: RuntimeObject, _decimals: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'truncate': (_self: RuntimeObject, _decimals: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      String: {
        'length': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'charAt': (_self: RuntimeObject, _index: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '+': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'startsWith': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'endsWith': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'indexOf': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'lastIndexOf': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toLowerCase': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toUpperCase': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'trim': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (_self: RuntimeObject, _aString: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (_self: RuntimeObject, _aString: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'contains': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'substring': (_self: RuntimeObject, _startIndex: RuntimeObject, _length: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
            /* TODO:*/
            if (arguments.length === 1 || arguments.length === 2) throw new ReferenceError('To be implemented')
            throw new ReferenceError('To be implemented')
          },
        'replace': (_self: RuntimeObject, _expression: RuntimeObject, _replacement: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'toString': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toSmartString': (_self: RuntimeObject, _alreadyShown: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _other: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Boolean: {

        '&&': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue && other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        '||': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue || other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        'toString': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'toSmartString': (_self: RuntimeObject, _alreadyShown: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },

        '==': (self: RuntimeObject, other: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),

        '!_': (self: RuntimeObject) => async (evaluation: Evaluation): Promise<Evaluation> => ({
          ...evaluation,
          frameStack: [
            {
              ...evaluation.frameStack[0],
              operandStack: [
                self.id === TRUE_ID ? FALSE_ID : TRUE_ID,
                ...evaluation.frameStack[0].operandStack,
              ],
            },
            ...evaluation.frameStack.slice(1),
          ],
        }),
      },

      Range: {
        validate: (_self: RuntimeObject, _limit: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        forEach: (_self: RuntimeObject, _closure: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        anyOne: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Closure: {
        apply: (_self: RuntimeObject, ..._args: RuntimeObject[]) => async (_evaluation: Evaluation): Promise<Evaluation> => {
          /*TODO: */ throw new ReferenceError('To be implemented')
        },
        toString: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      Date: {
        'toString': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '==': (_self: RuntimeObject, _aDate: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusDays': (_self: RuntimeObject, _days: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusMonths': (_self: RuntimeObject, _months: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'plusYears': (_self: RuntimeObject, _years: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'isLeapYear': (_self: RuntimeObject, ) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'initialize': (_self: RuntimeObject, _day: RuntimeObject, _month: RuntimeObject, _year: RuntimeObject) =>
          async (_evaluation: Evaluation): Promise<Evaluation> => {
            /* TODO:*/
            throw new ReferenceError('To be implemented')
          },
        'day': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'dayOfWeek': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'month': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'year': (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '-': (_self: RuntimeObject, _aDate: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusDays': (_self: RuntimeObject, _days: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusMonths': (_self: RuntimeObject, _months: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        'minusYears': (_self: RuntimeObject, _years: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '<': (_self: RuntimeObject, _aDate: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        '>': (_self: RuntimeObject, _aDate: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      console: {
        println: (_self: RuntimeObject, _obj: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        readLine: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        readInt: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
        newline: (_self: RuntimeObject) => async (_evaluation: Evaluation): Promise<Evaluation> => {
/* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },
    },
  },
}