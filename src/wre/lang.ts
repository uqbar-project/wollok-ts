import { flatMap, last, zipObj } from '../extensions'
import { CALL, compile, Evaluation, FALSE_ID, Frame, INTERRUPT, Locals, Operations, PUSH, RuntimeObject, SWAP, TRUE_ID, VOID_ID } from '../interpreter'
import log from '../log'
import { Id, Linked, Method, Module, Singleton } from '../model'

const { random, floor, ceil } = Math
const { keys } = Object
const { UTC } = Date

// TODO:
// tslint:disable:variable-name

// TODO: tests

export default {

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
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.String', self.id))
    },

    'kindName': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.String', self.module))
    },

    'className': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.String', self.module))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      // TODO: Improve?
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.String', `${self.module}[${keys(self.fields).map(key =>
        `${key} = ${self.fields[key]}`
      ).join(', ')}]`))
    },
  },

  Collection: {

    initialize: (self: RuntimeObject, ) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      self.innerValue = self.innerValue || []
      pushOperand(VOID_ID)
    },

    fold: (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) =>
      (evaluation: Evaluation) => {
        last(evaluation.frameStack)!.resume.push('return')
        evaluation.frameStack.push({
          instructions: [
            ...flatMap((id: Id) => [
              PUSH(closure.id),
              PUSH(id),
            ])([...self.innerValue].reverse()),
            PUSH(initialValue.id),
            ...flatMap(() => [
              SWAP,
              CALL('apply', 2),
            ])(self.innerValue),
            INTERRUPT('return'),
          ],
          nextInstruction: 0,
          locals: { self: closure.id },
          operandStack: [],
          resume: [],
        })
      },

    add: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      self.innerValue.push(element.id)
      pushOperand(VOID_ID)
    },

    remove: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      self.innerValue = self.innerValue.filter((id: Id) => id !== element.id)
      pushOperand(VOID_ID)
    },

    size: (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.length))
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      self.innerValue.splice(0, self.innerValue.length)
      pushOperand(VOID_ID)
    },
  },

  List: {

    get: (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      const valueId = self.innerValue[index.innerValue]
      if (!valueId) throw new RangeError('index')
      pushOperand(valueId)
    },

  },

  Number: {
    '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '-_': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(evaluation.createInstance(self.module, self.innerValue + other.innerValue))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(evaluation.createInstance(self.module, self.innerValue - other.innerValue))
    },

    '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(evaluation.createInstance(self.module, self.innerValue * other.innerValue))
    },

    '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      if (other.innerValue === 0) throw new RangeError('other')
      pushOperand(evaluation.createInstance(self.module, self.innerValue / other.innerValue))
    },

    '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(evaluation.createInstance(self.module, self.innerValue ** other.innerValue))
    },

    '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(evaluation.createInstance(self.module, self.innerValue % other.innerValue))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.String', `${self.innerValue}`))
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue >= other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue <= other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'abs': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (self.innerValue > 0) pushOperand(self.id)
      else pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    'roundUp': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)

      if (decimals.module !== self.module) throw new TypeError('decimals')
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      pushOperand(evaluation.createInstance(self.module, ceil(self.innerValue * (10 ** decimals.innerValue)) / (10 ** decimals.innerValue)))
    },

    'truncate': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)

      if (decimals.module !== self.module) throw new TypeError('decimals')
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')

      pushOperand(decimalPosition >= 0
        ? evaluation.createInstance(self.module, Number(num.slice(0, decimalPosition + decimals.innerValue + 1)))
        : self.id
      )
    },

    'randomUpTo': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(evaluation.createInstance(self.module, random() * (other.innerValue - self.innerValue) + self.innerValue))
    },

  },


  String: {
    'length': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.length))
    },

    'concat': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance(self.module, self.innerValue + other.innerValue))
    },

    'startsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue.startsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
    },

    'endsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue.endsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
    },

    'indexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      const value = self.innerValue.indexOf(other.innerValue)

      if (other.module !== self.module) throw new TypeError('other')
      if (value < 0) throw new RangeError('other')

      pushOperand(evaluation.createInstance('wollok.lang.Number', value))
    },

    'lastIndexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      const value = self.innerValue.lastIndexOf(other.innerValue)

      if (other.module !== self.module) throw new TypeError('other')
      if (value < 0) throw new RangeError('other')

      pushOperand(evaluation.createInstance('wollok.lang.Number', value))
    },

    'toLowerCase': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance(self.module, self.innerValue.toLowerCase()))
    },

    'toUpperCase': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance(self.module, self.innerValue.toUpperCase()))
    },

    'trim': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance(self.module, self.innerValue.trim()))
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'contains': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue.indexOf(other.innerValue) >= 0 ? TRUE_ID : FALSE_ID)
    },

    'substring': (self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject) =>
      (evaluation: Evaluation) => {
        const { pushOperand } = Operations(evaluation)
        if (startIndex.module !== 'wollok.lang.Number') throw new TypeError('startIndex')
        if (endIndex && endIndex.module !== 'wollok.lang.Number') throw new TypeError('endIndex')
        pushOperand(evaluation.createInstance(self.module, self.innerValue.slice(startIndex.innerValue, endIndex && endIndex.innerValue)))
      },

    'replace': (self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (expression.module !== self.module) throw new TypeError('other')
      if (replacement.module !== self.module) throw new TypeError('other')
      pushOperand(
        evaluation.createInstance(self.module, self.innerValue.replace(new RegExp(expression.innerValue, 'g'), replacement.innerValue))
      )
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(self.id)
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
    },
  },

  Boolean: {

    '&&': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)

      if (self.id === FALSE_ID) return pushOperand(self.id)

      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push({
        instructions: [
          PUSH(closure.id),
          CALL('apply', 0),
          INTERRUPT('return'),
        ],
        nextInstruction: 0,
        locals: {},
        operandStack: [],
        resume: [],
      })
    },

    '||': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)

      if (self.id === TRUE_ID) return pushOperand(self.id)

      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push({
        instructions: [
          PUSH(closure.id),
          CALL('apply', 0),
          INTERRUPT('return'),
        ],
        nextInstruction: 0,
        locals: {},
        operandStack: [],
        resume: [],
      })
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.String', self.innerValue.toString()))
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
      const { getInstance } = Operations(evaluation)
      const start = getInstance(self.fields.start)
      const end = getInstance(self.fields.end)
      const step = getInstance(self.fields.step)

      const values = []
      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue) values.unshift(i)

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue) values.unshift(i)

      const valueIds = values.map(v => evaluation.createInstance('wollok.lang.Number', v)).reverse()

      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push({
        instructions: [
          ...flatMap((id: Id) => [
            PUSH(closure.id),
            PUSH(id),
            CALL('apply', 1),
          ])(valueIds),
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
      const { getInstance, pushOperand } = Operations(evaluation)
      const start = getInstance(self.fields.start)
      const end = getInstance(self.fields.end)
      const step = getInstance(self.fields.step)

      const values = []
      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue) values.unshift(i)

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue) values.unshift(i)

      pushOperand(evaluation.createInstance('wollok.lang.Number', values[floor(random() * values.length)]))
    },
  },

  Closure: {
    // TODO: maybe we can do this better once Closure is a reified node?
    initialize: (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      const context: Frame[] = evaluation.frameStack.slice(0, -2).map(frame => ({
        instructions: [],
        nextInstruction: 0,
        locals: frame.locals,
        operandStack: [],
        resume: [],
      }))

      self.innerValue = context
      pushOperand(VOID_ID)
    },

    apply: (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => {

      const apply = evaluation
        .environment
        .getNodeByFQN<Singleton<Linked>>(self.module)
        .members
        .find(({ name }) => name === '<apply>') as Method<Linked>
      const argIds = args.map(arg => arg ? arg.id : VOID_ID)
      const parameterNames = apply.parameters.map(({ name }) => name)
      const hasVarArg = apply.parameters.some(parameter => parameter.isVarArg)

      if (
        hasVarArg && args.length < apply.parameters.length - 1 ||
        !hasVarArg && args.length !== apply.parameters.length
      ) {
        log.warn('Method not found:', self.module, '>> <apply> /', args.length)

        const messageNotUnderstood = evaluation.environment
          .getNodeByFQN<Module<Linked>>(self.module)
          .lookupMethod('messageNotUnderstood', 2)!
        const nameId = evaluation.createInstance('wollok.lang.String', 'apply')
        const argsId = evaluation.createInstance('wollok.lang.List', argIds)

        last(evaluation.frameStack)!.resume.push('return')
        evaluation.frameStack.push({
          instructions: compile(evaluation.environment)(...messageNotUnderstood.body!.sentences),
          nextInstruction: 0,
          locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]), self: self.id },
          operandStack: [],
          resume: [],
        })

        return
      }

      let locals: Locals
      if (hasVarArg) {
        const restId = evaluation.createInstance('wollok.lang.List', argIds.slice(apply.parameters.length - 1))
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
          ...compile(evaluation.environment)(...apply.body!.sentences),
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
      const { pushOperand } = Operations(evaluation)
      pushOperand(self.fields['<toString>']
        ? self.fields['<toString>']
        : evaluation.createInstance('wollok.lang.String', `Closure#${self.id}`)
      )
    },
  },

  Date: {

    'initialize': (self: RuntimeObject, day?: RuntimeObject, month?: RuntimeObject, year?: RuntimeObject) =>
      (evaluation: Evaluation) => {
        const { pushOperand } = Operations(evaluation)
        self.innerValue = day && month && year
          ? new Date(year.innerValue, month.innerValue - 1, day.innerValue)
          : new Date(new Date().setHours(0, 0, 0, 0))
        pushOperand(VOID_ID)
      },

    'day': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.getDate()))
    },

    'dayOfWeek': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.getDay()))
    },

    'month': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.getMonth() + 1))
    },

    'year': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.getFullYear()))
    },

    'plusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (days.module !== 'wollok.lang.Number') throw new TypeError('days')
      pushOperand(evaluation.createInstance(self.module, new Date(
        self.innerValue.getFullYear(),
        self.innerValue.getMonth(),
        self.innerValue.getDate() + days.innerValue)
      ))
    },

    'plusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (months.module !== 'wollok.lang.Number') throw new TypeError('months')

      const date = new Date(
        self.innerValue.getFullYear(),
        self.innerValue.getMonth() + months.innerValue,
        self.innerValue.getDate()
      )

      while (months.innerValue > 0 && date.getMonth() > (self.innerValue.getMonth() + months.innerValue) % 12)
        date.setDate(date.getDate() - 1)

      pushOperand(evaluation.createInstance(self.module, date))
    },

    'plusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)

      if (years.module !== 'wollok.lang.Number') throw new TypeError('years')

      const date = new Date(
        self.innerValue.getFullYear() + years.innerValue,
        self.innerValue.getMonth(),
        self.innerValue.getDate()
      )

      if (years.innerValue > 0 && date.getDate() !== self.innerValue.getDate()) {
        date.setDate(date.getDate() - 1)
      }

      pushOperand(evaluation.createInstance(self.module, date))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)

      if (other.module !== self.module) throw new TypeError('other')

      const msPerDay = 1000 * 60 * 60 * 24
      const ownUTC = UTC(self.innerValue.getFullYear(), self.innerValue.getMonth(), self.innerValue.getDate())
      const otherUTC = UTC(other.innerValue.getFullYear(), other.innerValue.getMonth(), other.innerValue.getDate())
      pushOperand(evaluation.createInstance('wollok.lang.Number', floor((ownUTC - otherUTC) / msPerDay)))
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      const { pushOperand } = Operations(evaluation)
      if (other.module !== self.module) throw new TypeError('other')
      pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
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
}