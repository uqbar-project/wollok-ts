import * as build from '../builders'
import { flatMap, last, zipObj } from '../extensions'
import { CALL, compile, Evaluation, FALSE_ID, Frame, INTERRUPT, Locals, PUSH, RuntimeObject, SWAP, TRUE_ID, VOID_ID } from '../interpreter'
import log from '../log'
import { Id, Method, Module, Singleton } from '../model'

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
      evaluation.currentFrame().pushOperand(self.id === other.id ? TRUE_ID : FALSE_ID)
    },

    'identity': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.id))
    },

    'kindName': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.module))
    },

    'className': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.module))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      // TODO: Improve?

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', `${self.module}[${keys(self.fields).map(key =>
        `${key} = ${self.fields[key]}`
      ).join(', ')}]`))
    },
  },

  Collection: {

    initialize: (self: RuntimeObject, ) => (evaluation: Evaluation) => {

      self.innerValue = self.innerValue || []
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    fold: (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) =>
      (evaluation: Evaluation) => {
        last(evaluation.frameStack)!.resume.push('return')
        evaluation.frameStack.push(build.Frame({
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
          locals: { self: closure.id },
        }))
      },

    add: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {

      self.innerValue.push(element.id)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    remove: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {

      self.innerValue = self.innerValue.filter((id: Id) => id !== element.id)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    size: (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.length))
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation) => {

      self.innerValue.splice(0, self.innerValue.length)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },
  },

  List: {

    get: (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation) => {

      const valueId = self.innerValue[index.innerValue]
      if (!valueId) throw new RangeError('index')
      evaluation.currentFrame().pushOperand(valueId)
    },

  },

  Number: {
    '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '-_': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue + other.innerValue))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue - other.innerValue))
    },

    '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue * other.innerValue))
    },

    '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      if (other.innerValue === 0) throw new RangeError('other')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue / other.innerValue))
    },

    '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue ** other.innerValue))
    },

    '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue % other.innerValue))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', `${self.innerValue}`))
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue >= other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue <= other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'abs': (self: RuntimeObject) => (evaluation: Evaluation) => {

      if (self.innerValue > 0) evaluation.currentFrame().pushOperand(self.id)
      else evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    'roundUp': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation) => {


      if (decimals.module !== self.module) throw new TypeError('decimals')
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      evaluation.currentFrame().pushOperand(
        evaluation.createInstance(self.module, ceil(self.innerValue * (10 ** decimals.innerValue)) / (10 ** decimals.innerValue))
      )
    },

    'truncate': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation) => {


      if (decimals.module !== self.module) throw new TypeError('decimals')
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')

      evaluation.currentFrame().pushOperand(decimalPosition >= 0
        ? evaluation.createInstance(self.module, Number(num.slice(0, decimalPosition + decimals.innerValue + 1)))
        : self.id
      )
    },

    'randomUpTo': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(
        evaluation.createInstance(self.module, random() * (other.innerValue - self.innerValue) + self.innerValue)
      )
    },

  },


  String: {
    'length': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.length))
    },

    'concat': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue + other.innerValue))
    },

    'startsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue.startsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
    },

    'endsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue.endsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
    },

    'indexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      const value = self.innerValue.indexOf(other.innerValue)

      if (other.module !== self.module) throw new TypeError('other')
      if (value < 0) throw new RangeError('other')

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', value))
    },

    'lastIndexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      const value = self.innerValue.lastIndexOf(other.innerValue)

      if (other.module !== self.module) throw new TypeError('other')
      if (value < 0) throw new RangeError('other')

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', value))
    },

    'toLowerCase': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.toLowerCase()))
    },

    'toUpperCase': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.toUpperCase()))
    },

    'trim': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.trim()))
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'contains': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue.indexOf(other.innerValue) >= 0 ? TRUE_ID : FALSE_ID)
    },

    'substring': (self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject) =>
      (evaluation: Evaluation) => {

        if (startIndex.module !== 'wollok.lang.Number') throw new TypeError('startIndex')
        if (endIndex && endIndex.module !== 'wollok.lang.Number') throw new TypeError('endIndex')
        evaluation.currentFrame().pushOperand(
          evaluation.createInstance(self.module, self.innerValue.slice(startIndex.innerValue, endIndex && endIndex.innerValue))
        )
      },

    'replace': (self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject) => (evaluation: Evaluation) => {

      if (expression.module !== self.module) throw new TypeError('other')
      if (replacement.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(
        evaluation.createInstance(self.module, self.innerValue.replace(new RegExp(expression.innerValue, 'g'), replacement.innerValue))
      )
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.id)
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
    },
  },

  Boolean: {

    '&&': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {


      if (self.id === FALSE_ID) return evaluation.currentFrame().pushOperand(self.id)

      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push(build.Frame({
        instructions: [
          PUSH(closure.id),
          CALL('apply', 0),
          INTERRUPT('return'),
        ],
      }))
    },

    '||': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {


      if (self.id === TRUE_ID) return evaluation.currentFrame().pushOperand(self.id)

      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push(build.Frame({
        instructions: [
          PUSH(closure.id),
          CALL('apply', 0),
          INTERRUPT('return'),
        ],
      }))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.innerValue.toString()))
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '!_': (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.innerValue ? FALSE_ID : TRUE_ID)
    },
  },

  Range: {
    forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      const start = evaluation.instance(self.fields.start)
      const end = evaluation.instance(self.fields.end)
      const step = evaluation.instance(self.fields.step)

      const values = []
      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue) values.unshift(i)

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue) values.unshift(i)

      const valueIds = values.map(v => evaluation.createInstance('wollok.lang.Number', v)).reverse()

      last(evaluation.frameStack)!.resume.push('return')
      evaluation.frameStack.push(build.Frame({
        instructions: [
          ...flatMap((id: Id) => [
            PUSH(closure.id),
            PUSH(id),
            CALL('apply', 1),
          ])(valueIds),
          PUSH(VOID_ID),
          INTERRUPT('return'),
        ],
        locals: { self: self.id },
      }))
    },

    anyOne: (self: RuntimeObject) => (evaluation: Evaluation) => {

      const start = evaluation.instance(self.fields.start)
      const end = evaluation.instance(self.fields.end)
      const step = evaluation.instance(self.fields.step)

      const values = []
      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue) values.unshift(i)

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue) values.unshift(i)

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', values[floor(random() * values.length)]))
    },
  },

  Closure: {
    // TODO: maybe we can do this better once Closure is a reified node?
    initialize: (self: RuntimeObject) => (evaluation: Evaluation) => {

      const context: Frame[] = evaluation.frameStack.slice(0, -2).map(({ locals }) =>
        build.Frame(({ locals }))
      )

      self.innerValue = context
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    apply: (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => {

      const apply = evaluation
        .environment
        .getNodeByFQN<Singleton>(self.module)
        .members
        .find(({ name }) => name === '<apply>') as Method
      const argIds = args.map(arg => arg ? arg.id : VOID_ID)
      const parameterNames = apply.parameters.map(({ name }) => name)
      const hasVarArg = apply.parameters.some(parameter => parameter.isVarArg)

      if (
        hasVarArg && args.length < apply.parameters.length - 1 ||
        !hasVarArg && args.length !== apply.parameters.length
      ) {
        log.warn('Method not found:', self.module, '>> <apply> /', args.length)

        const messageNotUnderstood = evaluation.environment
          .getNodeByFQN<Module>(self.module)
          .lookupMethod('messageNotUnderstood', 2)!
        const nameId = evaluation.createInstance('wollok.lang.String', 'apply')
        const argsId = evaluation.createInstance('wollok.lang.List', argIds)

        last(evaluation.frameStack)!.resume.push('return')
        evaluation.frameStack.push(build.Frame({
          instructions: compile(evaluation.environment)(...messageNotUnderstood.body!.sentences),
          locals: { ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]), self: self.id },
        }))

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

      evaluation.frameStack.push(build.Frame({
        locals,
        instructions: [
          ...compile(evaluation.environment)(...apply.body!.sentences),
          PUSH(VOID_ID),
          INTERRUPT('return'),
        ],
      }))

    },

    toString: (self: RuntimeObject) => (evaluation: Evaluation) => {

      evaluation.currentFrame().pushOperand(self.fields['<toString>']
        ? self.fields['<toString>']
        : evaluation.createInstance('wollok.lang.String', `Closure#${self.id}`)
      )
    },
  },

  // TODO: No need to save the inner value here. Can just use the fields.
  Date: {

    'initialize': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const today = new Date(new Date().setHours(0, 0, 0, 0))

      if (!self.fields.day) self.fields.day = evaluation.createInstance('wollok.lang.Number', today.getDate())
      if (!self.fields.month) self.fields.month = evaluation.createInstance('wollok.lang.Number', today.getMonth() + 1)
      if (!self.fields.year) self.fields.year = evaluation.createInstance('wollok.lang.Number', today.getFullYear())

      const day = evaluation.instance(self.fields.day)
      const month = evaluation.instance(self.fields.month)
      const year = evaluation.instance(self.fields.year)

      self.innerValue = new Date(year.innerValue, month.innerValue - 1, day.innerValue)

      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    'internalDayOfWeek': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.getDay()))
    },

    'plusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation) => {
      if (days.module !== 'wollok.lang.Number') throw new TypeError('days')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, new Date(
        self.innerValue.getFullYear(),
        self.innerValue.getMonth(),
        self.innerValue.getDate() + days.innerValue)
      ))
    },

    'plusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation) => {
      if (months.module !== 'wollok.lang.Number') throw new TypeError('months')

      const date = new Date(
        self.innerValue.getFullYear(),
        self.innerValue.getMonth() + months.innerValue,
        self.innerValue.getDate()
      )

      while (months.innerValue > 0 && date.getMonth() > (self.innerValue.getMonth() + months.innerValue) % 12)
        date.setDate(date.getDate() - 1)

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, date))
    },

    'plusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation) => {
      if (years.module !== 'wollok.lang.Number') throw new TypeError('years')

      const date = new Date(
        self.innerValue.getFullYear() + years.innerValue,
        self.innerValue.getMonth(),
        self.innerValue.getDate()
      )

      if (years.innerValue > 0 && date.getDate() !== self.innerValue.getDate()) {
        date.setDate(date.getDate() - 1)
      }

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, date))
    },
    'minusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation) => {
      if (days.module !== 'wollok.lang.Number') throw new TypeError('days')
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, new Date(
        self.innerValue.getFullYear(),
        self.innerValue.getMonth(),
        self.innerValue.getDate() - days.innerValue)
      ))
    },

    'minusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation) => {
      if (months.module !== 'wollok.lang.Number') throw new TypeError('months')

      const date = new Date(
        self.innerValue.getFullYear(),
        self.innerValue.getMonth() - months.innerValue,
        self.innerValue.getDate()
      )

      while (months.innerValue > 0 && date.getMonth() > (self.innerValue.getMonth() + months.innerValue) % 12)
        date.setDate(date.getDate() - 1)

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, date))
    },

    'minusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation) => {
      if (years.module !== 'wollok.lang.Number') throw new TypeError('years')

      const date = new Date(
        self.innerValue.getFullYear() - years.innerValue,
        self.innerValue.getMonth(),
        self.innerValue.getDate()
      )

      if (years.innerValue > 0 && date.getDate() !== self.innerValue.getDate()) {
        date.setDate(date.getDate() - 1)
      }

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, date))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')

      const msPerDay = 1000 * 60 * 60 * 24
      const ownUTC = UTC(self.innerValue.getFullYear(), self.innerValue.getMonth(), self.innerValue.getDate())
      const otherUTC = UTC(other.innerValue.getFullYear(), other.innerValue.getMonth(), other.innerValue.getDate())
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', floor((ownUTC - otherUTC) / msPerDay)))
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')
      const day = evaluation.instance(self.fields.day).innerValue
      const month = evaluation.instance(self.fields.month).innerValue
      const year = evaluation.instance(self.fields.year).innerValue
      const otherDay = evaluation.instance(other.fields.day).innerValue
      const otherMonth = evaluation.instance(other.fields.month).innerValue
      const otherYear = evaluation.instance(other.fields.year).innerValue
      const answer = day === otherDay && month === otherMonth && year === otherYear
      evaluation.currentFrame().pushOperand(answer ? TRUE_ID : FALSE_ID)
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')
      evaluation.currentFrame().pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'isLeapYear': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(new Date(self.innerValue.getFullYear(), 1, 29).getDate() === 29 ? TRUE_ID : FALSE_ID)
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