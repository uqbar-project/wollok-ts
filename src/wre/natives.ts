import { chain as flatMap, last, reverse, zipObj } from 'ramda'
import { CALL, compile, Evaluation, FALSE_ID, Frame, INTERRUPT, Locals, Operations, PUSH, RuntimeObject, SWAP, TRUE_ID, VOID_ID } from '../interpreter'
import log from '../log'
import { Id, Method, Singleton } from '../model'
import utils from '../utils'

const { random, floor } = Math

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

        'className': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', self.module))
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

        '==': (_self: RuntimeObject, _other: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },
      },

      List: {
        // TODO: Throw error if no element?
        get: (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          pushOperand(self.innerValue[index.innerValue])
        },

        sortBy: (_self: RuntimeObject, _closure: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        fold: (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) =>
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
              nextInstruction: 0,
              locals: { self: closure.id },
              operandStack: [],
              resume: [],
            })
          },

        findOrElse: (_self: RuntimeObject, _predicate: RuntimeObject, _continuation: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        add: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          self.innerValue.push(element.id)
          pushOperand(VOID_ID)
        },

        remove: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, getInstance } = Operations(evaluation)
          const index = self.innerValue.findIndex((id: string) => getInstance(id).innerValue === element.innerValue)
          if (index > -1) self.innerValue.splice(index, 1)
          pushOperand(VOID_ID)
        },

        size: (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue.length))
        },

        clear: (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          self.innerValue.splice(0, self.innerValue.length)
          pushOperand(VOID_ID)
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
          pushOperand(addInstance(self.module, -self.innerValue))
        },

        '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue + other.innerValue))
        },

        '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue - other.innerValue))
        },

        '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue * other.innerValue))
        },

        '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue / other.innerValue))
        },

        '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue ** other.innerValue))
        },

        '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue % other.innerValue))
        },

        'div': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance(self.module, Math.round(self.innerValue / other.innerValue)))
        },

        'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { addInstance, pushOperand } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', `${self.innerValue}`))
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
        'length': (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.Number', self.innerValue.length))
        },

        'charAt': (_self: RuntimeObject, _index: RuntimeObject) => (_evaluation: Evaluation) => {
          /* TODO:*/ throw new ReferenceError('To be implemented')
        },

        'concat': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance(self.module, self.innerValue + other.innerValue))
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
          pushOperand(self.innerValue ? FALSE_ID : TRUE_ID)
        },
      },

      Range: {
        forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
          const { getInstance, addInstance } = Operations(evaluation)
          const start = getInstance(self.fields.start)
          const end = getInstance(self.fields.end)
          const step = getInstance(self.fields.step)

          const values = []
          if (
            start.innerValue <= end.innerValue && step.innerValue > 0 ||
            start.innerValue >= end.innerValue && step.innerValue < 0
          ) {
            for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue)
              values.unshift(i)
          }

          const valueIds = values.map(v => addInstance('wollok.lang.Number', v))

          last(evaluation.frameStack)!.resume.push('return')
          evaluation.frameStack.push({
            instructions: [
              ...flatMap((id: Id<'Linked'>) => [
                PUSH(closure.id),
                PUSH(id),
                CALL('apply', 1, closure.module),
              ], reverse(valueIds)),
              PUSH(VOID_ID),
              INTERRUPT('return'),
            ],
            nextInstruction: 0,
            locals: { self: self.id },
            operandStack: [],
            resume: [],
          })
        },
        anyOne: (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { getInstance, addInstance } = Operations(evaluation)
          const start = getInstance(self.fields.start)
          const end = getInstance(self.fields.end)
          const step = getInstance(self.fields.step)

          const values = []
          if (
            start.innerValue <= end.innerValue && step.innerValue > 0 ||
            start.innerValue >= end.innerValue && step.innerValue < 0
          ) {
            for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue)
              values.unshift(i)
          }

          addInstance('wollok.lang.Number', values[floor(random() * values.length)])
        },
      },

      Closure: {
        // TODO: maybe we can do this better once Closure is a reified node?
        saveContext: (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand } = Operations(evaluation)
          const context: Frame[] = evaluation.frameStack.slice(0, -1).map(frame => ({
            instructions: [],
            nextInstruction: 0,
            locals: frame.locals,
            operandStack: [],
            resume: [],
          }));

          (self as any).innerValue = context
          pushOperand(VOID_ID)
        },

        apply: (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => {
          const { resolve, methodLookup } = utils(evaluation.environment)
          const { addInstance } = Operations(evaluation)

          const apply = resolve<Singleton<'Linked'>>(self.module).members.find(({ name }) => name === '<apply>') as Method<'Linked'>
          const argIds = args.map(arg => arg ? arg.id : VOID_ID)
          const parameterNames = apply.parameters.map(({ name }) => name)
          const hasVarArg = apply.parameters.some(parameter => parameter.isVarArg)

          if (
            hasVarArg && args.length < apply.parameters.length - 1 ||
            !hasVarArg && args.length !== apply.parameters.length
          ) {
            log.warn('Method not found:', self.module, '>> <apply> /', args.length)

            const messageNotUnderstood = methodLookup('messageNotUnderstood', 2, resolve(self.module))!
            const nameId = addInstance('wollok.lang.String', 'apply')
            const argsId = addInstance('wollok.lang.List', argIds)

            last(evaluation.frameStack)!.resume.push('return')
            evaluation.frameStack.push({
              instructions: compile(evaluation.environment)(messageNotUnderstood.body!),
              nextInstruction: 0,
              locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]), self: self.id },
              operandStack: [],
              resume: [],
            })

            return
          }

          let locals: Locals
          if (hasVarArg) {
            const restId = addInstance('wollok.lang.List', argIds.slice(apply.parameters.length - 1))
            locals = {
              ...zipObj(parameterNames.slice(0, -1), argIds),
              [last(apply.parameters)!.name]: restId,
            }
          } else {
            locals = { ...zipObj(parameterNames, argIds) }
          }

          last(evaluation.frameStack)!.resume.push('return')

          self.innerValue.forEach((frame: Frame) => evaluation.frameStack.push(frame))

          evaluation.frameStack.push({
            instructions: [
              ...compile(evaluation.environment)(apply.body!),
              PUSH(VOID_ID),
              INTERRUPT('return'),
            ],
            nextInstruction: 0,
            locals,
            operandStack: [],
            resume: [],
          })

        },

        toString: (self: RuntimeObject) => (evaluation: Evaluation) => {
          const { pushOperand, addInstance } = Operations(evaluation)
          pushOperand(addInstance('wollok.lang.String', `Closure#${self.id}`))
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