import { last, zipObj } from '../extensions'
import { CALL, compile, Evaluation, FALSE_ID, INTERRUPT, Locals, NULL_ID, PUSH, RuntimeObject, SWAP, TRUE_ID, VOID_ID } from '../interpreter'
import log from '../log'
import { Id, Module, Singleton } from '../model'

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
      const selfLocals = self.context().locals
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', `${self.module}[${keys(selfLocals).map(key =>
        `${key} = ${selfLocals[key]}`
      ).join(', ')}]`))
    },
  },

  Collection: {

    initialize: (self: RuntimeObject, ) => (evaluation: Evaluation) => {
      self.innerValue = self.innerValue || []
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    fold: (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      evaluation.suspend('return', [
        ...[...self.innerValue].reverse().flatMap((id: Id) => [
          PUSH(closure.id),
          PUSH(id),
        ]),
        PUSH(initialValue.id),
        ...self.innerValue.flatMap(() => [
          SWAP,
          CALL('apply', 2),
        ]),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent, { self: closure.id }))
    },

    add: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      self.innerValue.push(element.id)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    remove: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      self.innerValue = self.innerValue.filter((id: Id) => id !== element.id)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    size: (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.length))
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      self.innerValue.splice(0, self.innerValue.length)
      evaluation.currentFrame().pushOperand(VOID_ID)
    },
  },

  List: {

    get: (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()
      index.assertIsNumber()

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
      self.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue + other.innerValue))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue - other.innerValue))
    },

    '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue * other.innerValue))
    },

    '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()
      if (other.innerValue === 0) throw new RangeError('other')

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue / other.innerValue))
    },

    '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue ** other.innerValue))
    },

    '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue % other.innerValue))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', `${self.innerValue}`))
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(self.innerValue >= other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '<=': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(self.innerValue <= other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'abs': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()

      if (self.innerValue > 0) evaluation.currentFrame().pushOperand(self.id)
      else evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    'roundUp': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      decimals.assertIsNumber()
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      evaluation.currentFrame().pushOperand(
        evaluation.createInstance(self.module, ceil(self.innerValue * (10 ** decimals.innerValue)) / (10 ** decimals.innerValue))
      )
    },

    'truncate': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      decimals.assertIsNumber()
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')

      evaluation.currentFrame().pushOperand(decimalPosition >= 0
        ? evaluation.createInstance(self.module, Number(num.slice(0, decimalPosition + decimals.innerValue + 1)))
        : self.id
      )
    },

    'randomUpTo': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(
        evaluation.createInstance(self.module, random() * (other.innerValue - self.innerValue) + self.innerValue)
      )
    },

  },


  String: {
    'length': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', self.innerValue.length))
    },

    'concat': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue + other.innerValue))
    },

    'startsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame().pushOperand(self.innerValue.startsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
    },

    'endsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame().pushOperand(self.innerValue.endsWith(other.innerValue) ? TRUE_ID : FALSE_ID)
    },

    'indexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      const value = self.innerValue.indexOf(other.innerValue)

      if (value < 0) throw new RangeError('other')

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', value))
    },

    'lastIndexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      const value = self.innerValue.lastIndexOf(other.innerValue)

      if (value < 0) throw new RangeError('other')

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', value))
    },

    'toLowerCase': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.toLowerCase()))
    },

    'toUpperCase': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.toUpperCase()))
    },

    'trim': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.trim()))
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame().pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame().pushOperand(self.innerValue > other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'contains': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame().pushOperand(self.innerValue.indexOf(other.innerValue) >= 0 ? TRUE_ID : FALSE_ID)
    },

    'substring': (self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      startIndex.assertIsNumber()
      if (endIndex) {
        const endIndexInstance: RuntimeObject = endIndex
        endIndexInstance.assertIsNumber()
      }

      const value = self.innerValue.slice(startIndex.innerValue, endIndex && endIndex.innerValue as number)
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, value))
    },

    'replace': (self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()
      expression.assertIsString()
      replacement.assertIsString()

      const value = self.innerValue.replace(new RegExp(expression.innerValue, 'g'), replacement.innerValue)
      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, value))
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
      self.assertIsBoolean()

      if (self.id === FALSE_ID) return evaluation.currentFrame().pushOperand(self.id)

      evaluation.suspend('return', [
        PUSH(closure.id),
        CALL('apply', 0),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))
    },

    '||': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsBoolean()

      if (self.id === TRUE_ID) return evaluation.currentFrame().pushOperand(self.id)

      evaluation.suspend('return', [
        PUSH(closure.id),
        CALL('apply', 0),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsBoolean()

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
      const start: RuntimeObject = self.get('start')!
      const end: RuntimeObject = self.get('end')!
      const step: RuntimeObject = self.get('step')!

      start.assertIsNumber()
      end.assertIsNumber()
      step.assertIsNumber()

      const values = []
      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue) values.unshift(i)

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue) values.unshift(i)

      const valueIds = values.map(v => evaluation.createInstance('wollok.lang.Number', v)).reverse()

      evaluation.suspend('return', [
        ...valueIds.flatMap((id: Id) => [
          PUSH(closure.id),
          PUSH(id),
          CALL('apply', 1),
        ]),
        PUSH(VOID_ID),
        INTERRUPT('return'),
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent, { self: closure.id }))
    },

    anyOne: (self: RuntimeObject) => (evaluation: Evaluation) => {
      const start: RuntimeObject = self.get('start')!
      const end: RuntimeObject = self.get('end')!
      const step: RuntimeObject = self.get('step')!

      start.assertIsNumber()
      end.assertIsNumber()
      step.assertIsNumber()

      const values = []
      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue) values.unshift(i)

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue) values.unshift(i)

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', values[floor(random() * values.length)]))
    },
  },

  Closure: {
    // TODO: improve once contexts are reified.
    initialize: (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.innerValue = last(evaluation.frameStack.slice(0, -2))!.context
      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    apply: (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => {
      const apply = evaluation
        .environment
        .getNodeByFQN<Singleton>(self.module)
        .methods()
        .find(({ name }) => name === '<apply>')!
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

        evaluation.suspend(
          'return',
          compile(evaluation.environment)(...messageNotUnderstood.body!.sentences),
          evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent, {
            ...zipObj(messageNotUnderstood.parameters.map(({ name }) => name), [nameId, argsId]),
            self: self.id,
          })
        )

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

      evaluation.suspend('return', [
        ...compile(evaluation.environment)(...apply.body!.sentences),
        PUSH(VOID_ID),
        INTERRUPT('return'),
      ], evaluation.createContext(self.innerValue as Id, locals))
    },

    toString: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.get('<toString>') ?.id ?? evaluation.createInstance('wollok.lang.String', `Closure#${self.id}`))
    },
  },

  // TODO: No need to save the inner value here. Can just use the fields.
  Date: {
    'initialize': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const day = self.get('day')
      const month = self.get('month')
      const year = self.get('year')

      const today = new Date()

      if (!day || day.id === NULL_ID)
        self.set('day', evaluation.createInstance('wollok.lang.Number', today.getDate()))
      if (!month || month.id === NULL_ID)
        self.set('month', evaluation.createInstance('wollok.lang.Number', today.getMonth() + 1))
      if (!year || year.id === NULL_ID)
        self.set('year', evaluation.createInstance('wollok.lang.Number', today.getFullYear()))

      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    'internalDayOfWeek': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue)

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', value.getDay()))
    },

    'plusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      days.assertIsNumber()

      const instance = evaluation.instance(evaluation.createInstance(self.module))

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue + floor(days.innerValue))
      instance.set('day', evaluation.createInstance('wollok.lang.Number', value.getDate()))
      instance.set('month', evaluation.createInstance('wollok.lang.Number', value.getMonth() + 1))
      instance.set('year', evaluation.createInstance('wollok.lang.Number', value.getFullYear()))


      evaluation.currentFrame().pushOperand(instance.id)
    },

    'plusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      months.assertIsNumber()

      const instance = evaluation.instance(evaluation.createInstance(self.module))

      const value = new Date(year.innerValue, month.innerValue - 1 + floor(months.innerValue), day.innerValue)

      while (months.innerValue > 0 && value.getMonth() > (month.innerValue - 1 + months.innerValue) % 12)
        value.setDate(value.getDate() - 1)

      instance.set('day', evaluation.createInstance('wollok.lang.Number', value.getDate()))
      instance.set('month', evaluation.createInstance('wollok.lang.Number', value.getMonth() + 1))
      instance.set('year', evaluation.createInstance('wollok.lang.Number', value.getFullYear()))

      evaluation.currentFrame().pushOperand(instance.id)
    },

    'plusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      years.assertIsNumber()

      const instance = evaluation.instance(evaluation.createInstance(self.module))

      const value = new Date(year.innerValue + floor(years.innerValue), month.innerValue - 1, day.innerValue)

      if (years.innerValue > 0 && value.getDate() !== day.innerValue) {
        value.setDate(value.getDate() - 1)
      }

      instance.set('day', evaluation.createInstance('wollok.lang.Number', value.getDate()))
      instance.set('month', evaluation.createInstance('wollok.lang.Number', value.getMonth() + 1))
      instance.set('year', evaluation.createInstance('wollok.lang.Number', value.getFullYear()))

      evaluation.currentFrame().pushOperand(instance.id)
    },

    'minusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      days.assertIsNumber()

      const instance = evaluation.instance(evaluation.createInstance(self.module))

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue - floor(days.innerValue))
      instance.set('day', evaluation.createInstance('wollok.lang.Number', value.getDate()))
      instance.set('month', evaluation.createInstance('wollok.lang.Number', value.getMonth() + 1))
      instance.set('year', evaluation.createInstance('wollok.lang.Number', value.getFullYear()))

      evaluation.currentFrame().pushOperand(instance.id)
    },

    'minusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      months.assertIsNumber()

      const instance = evaluation.instance(evaluation.createInstance(self.module))

      const value = new Date(year.innerValue, month.innerValue - 1 - floor(months.innerValue), day.innerValue)
      instance.set('day', evaluation.createInstance('wollok.lang.Number', value.getDate()))
      instance.set('month', evaluation.createInstance('wollok.lang.Number', value.getMonth() + 1))
      instance.set('year', evaluation.createInstance('wollok.lang.Number', value.getFullYear()))


      evaluation.currentFrame().pushOperand(instance.id)
    },

    'minusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      years.assertIsNumber()

      const instance = evaluation.instance(evaluation.createInstance(self.module))

      const value = new Date(year.innerValue - floor(years.innerValue), month.innerValue - 1, day.innerValue)

      if (years.innerValue > 0 && value.getDate() !== day.innerValue) {
        value.setDate(value.getDate() - 1)
      }

      instance.set('day', evaluation.createInstance('wollok.lang.Number', value.getDate()))
      instance.set('month', evaluation.createInstance('wollok.lang.Number', value.getMonth() + 1))
      instance.set('year', evaluation.createInstance('wollok.lang.Number', value.getFullYear()))

      evaluation.currentFrame().pushOperand(instance.id)
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay: RuntimeObject = self.get('day')!
      const ownMonth: RuntimeObject = self.get('month')!
      const ownYear: RuntimeObject = self.get('year')!

      const otherDay: RuntimeObject = other.get('day')!
      const otherMonth: RuntimeObject = other.get('month')!
      const otherYear: RuntimeObject = other.get('year')!

      ownDay.assertIsNumber()
      ownMonth.assertIsNumber()
      ownYear.assertIsNumber()

      otherDay.assertIsNumber()
      otherMonth.assertIsNumber()
      otherYear.assertIsNumber()

      const msPerDay = 1000 * 60 * 60 * 24
      const ownUTC = UTC(ownYear.innerValue, ownMonth.innerValue - 1, ownDay.innerValue)
      const otherUTC = UTC(otherYear.innerValue, otherMonth.innerValue - 1, otherDay.innerValue)
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.Number', floor((ownUTC - otherUTC) / msPerDay)))
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) return evaluation.currentFrame().pushOperand(FALSE_ID)

      const day = self.get('day')!.innerValue
      const month = self.get('month')!.innerValue
      const year = self.get('year')!.innerValue

      const otherDay = other.get('day')!.innerValue
      const otherMonth = other.get('month')!.innerValue
      const otherYear = other.get('year')!.innerValue

      const answer = day === otherDay && month === otherMonth && year === otherYear

      evaluation.currentFrame().pushOperand(answer ? TRUE_ID : FALSE_ID)
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')

      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      const otherDay: RuntimeObject = other.get('day')!
      const otherMonth: RuntimeObject = other.get('month')!
      const otherYear: RuntimeObject = other.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()

      otherDay.assertIsNumber()
      otherMonth.assertIsNumber()
      otherYear.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue)
      const otherValue = new Date(otherYear.innerValue, otherMonth.innerValue - 1, otherDay.innerValue)

      evaluation.currentFrame().pushOperand(value < otherValue ? TRUE_ID : FALSE_ID)
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      if (other.module !== self.module) throw new TypeError('other')

      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      const otherDay: RuntimeObject = other.get('day')!
      const otherMonth: RuntimeObject = other.get('month')!
      const otherYear: RuntimeObject = other.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()

      otherDay.assertIsNumber()
      otherMonth.assertIsNumber()
      otherYear.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue)
      const otherValue = new Date(otherYear.innerValue, otherMonth.innerValue - 1, otherDay.innerValue)

      evaluation.currentFrame().pushOperand(value > otherValue ? TRUE_ID : FALSE_ID)
    },

    'isLeapYear': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const year: RuntimeObject = self.get('year')!

      year.assertIsNumber()

      const value = new Date(year.innerValue, 1, 29)
      evaluation.currentFrame().pushOperand(value.getDate() === 29 ? TRUE_ID : FALSE_ID)
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