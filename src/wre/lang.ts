import { CALL, CONDITIONAL_JUMP, DUP, Evaluation, FALSE_ID, INSTANTIATE, JUMP, LOAD, NULL_ID, POP, PUSH, RETURN, RuntimeObject, STORE, SWAP, TRUE_ID, VOID_ID } from '../interpreter'
import { Id } from '../model'

const { random, floor, ceil } = Math
const { UTC } = Date

// TODO:
// tslint:disable:variable-name

const Collections = {

  findOrElse: (self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) => (evaluation: Evaluation) => {
    self.assertIsCollection()

    evaluation.pushFrame([
      ...self.innerValue.flatMap((id: Id) => [
        PUSH(predicate.id),
        PUSH(id),
        CALL('apply', 1, false),
        CONDITIONAL_JUMP(2),
        PUSH(id),
        RETURN,
      ]),
      PUSH(continuation.id),
      CALL('apply', 0, false),
      RETURN,
    ], evaluation.createContext(self.id))
  },

  add: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
    self.assertIsCollection()

    self.innerValue.push(element.id)
    evaluation.currentFrame().pushOperand(VOID_ID)
  },

  fold: (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
    self.assertIsCollection()

    evaluation.pushFrame([
      ...[...self.innerValue].reverse().flatMap((id: Id) => [
        PUSH(closure.id),
        PUSH(id),
      ]),
      PUSH(initialValue.id),
      ...self.innerValue.flatMap(() => [
        SWAP(),
        CALL('apply', 2, false),
      ]),
      RETURN,
    ], evaluation.createContext(self.id))
  },

  filter: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
    self.assertIsCollection()

    evaluation.pushFrame([
      PUSH(self.id),
      CALL('copy', 0),
      ...[...self.innerValue].reverse().flatMap((id: Id) => [
        DUP,
        PUSH(closure.id),
        PUSH(id),
        CALL('apply', 1, false),
        CALL('negate', 0),
        CONDITIONAL_JUMP(3),
        PUSH(id),
        CALL('remove', 1),
        POP,
      ]),
      RETURN,
    ], evaluation.createContext(self.id))
  },

  max: (self: RuntimeObject) => (evaluation: Evaluation) => {
    evaluation.pushFrame([
      PUSH(self.id),
      CALL('max', 0, true, self.module),
      RETURN,
    ], evaluation.createContext(self.id))
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

  join: (self: RuntimeObject, separator?: RuntimeObject) => (evaluation: Evaluation) => {
    evaluation.pushFrame([
      PUSH(self.id),
      ...separator ? [PUSH(separator.id)] : [],
      CALL('join', separator ? 1 : 0, true, self.module),
      RETURN,
    ], evaluation.createContext(self.id))
  },

  contains: (self: RuntimeObject, value: RuntimeObject) => (evaluation: Evaluation) => {
    evaluation.pushFrame([
      PUSH(self.id),
      PUSH(value.id),
      CALL('contains', 1, true, self.module),
      RETURN,
    ], evaluation.createContext(self.id))
  },

  equals: (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
    evaluation.pushFrame([
      PUSH(self.id),
      PUSH(other.id),
      CALL('==', 1),
      RETURN,
    ], evaluation.createContext(self.id))
  },


}

export default {

  Exception: {

    // TODO:
    getFullStackTrace: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    getStackTrace: (_self: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

  },


  Object: {

    identity: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.id))
    },

    // TODO:
    instanceVariables: (_self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.List', []))
    },

    // TODO:
    instanceVariableFor: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    resolve: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation) => {
      throw new ReferenceError('To be implemented')
    },

    kindName: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.module))
    },

    className: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.module))
    },

    generateDoesNotUnderstandMessage:
      (_self: RuntimeObject, target: RuntimeObject, messageName: RuntimeObject, parametersSize: RuntimeObject) =>
        (evaluation: Evaluation) => {
          target.assertIsString()
          messageName.assertIsString()
          parametersSize.assertIsNumber()

          const argsText = new Array(parametersSize.innerValue).fill(null).map((_, i) => `arg ${i}`)
          const text = `${target.innerValue} does not undersand ${messageName.innerValue}(${argsText})`

          evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', text))
        },

    checkNotNull: (_self: RuntimeObject, value: RuntimeObject, message: RuntimeObject) => (evaluation: Evaluation) => {
      message.assertIsString()

      if (value.id === NULL_ID) throw new TypeError(message.innerValue)
      else evaluation.currentFrame().pushOperand(VOID_ID)
    },

  },


  Collection: {

    findOrElse: Collections.findOrElse,

  },


  Set: {

    'anyOne': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      evaluation.currentFrame().pushOperand(self.innerValue[floor(random() * self.innerValue.length)])
    },

    'fold': Collections.fold,

    'filter': Collections.filter,

    'max': Collections.max,

    'findOrElse': Collections.findOrElse,

    'add': (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.pushFrame([
        PUSH(self.id),
        PUSH(element.id),
        CALL('contains', 1),
        CALL('negate', 0),
        CONDITIONAL_JUMP(3),
        PUSH(self.id),
        PUSH(element.id),
        CALL('unsafeAdd', 1),
        PUSH(VOID_ID),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    'unsafeAdd': Collections.add,

    'remove': Collections.remove,

    'size': Collections.size,

    'clear': Collections.clear,

    'join': Collections.join,

    'contains': Collections.contains,

    'equals': Collections.equals,

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()
      other.assertIsCollection()

      if (self.module !== other.module) return evaluation.currentFrame().pushOperand(FALSE_ID)
      if (self.innerValue.length !== other.innerValue.length) return evaluation.currentFrame().pushOperand(FALSE_ID)
      if (!self.innerValue.length) return evaluation.currentFrame().pushOperand(TRUE_ID)

      evaluation.pushFrame([
        ...[...self.innerValue].reverse().flatMap((id: Id) => [
          PUSH(other.id),
          PUSH(id),
          CALL('contains', 1),
          DUP,
          CALL('negate', 0),
          CONDITIONAL_JUMP(1),
          RETURN,
        ]),
        PUSH(TRUE_ID),
        RETURN,
      ], evaluation.createContext(self.id))
    },

  },


  List: {

    'get': (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()
      index.assertIsNumber()

      const valueId = self.innerValue[index.innerValue]
      if (!valueId) throw new RangeError('index')
      evaluation.currentFrame().pushOperand(valueId)
    },

    'sortBy': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      if (self.innerValue.length < 2) return evaluation.currentFrame().pushOperand(self.id)

      evaluation.pushFrame([
        PUSH(self.id),
        CALL('newInstance', 0),
        STORE('<lessers>', false),
        PUSH(self.id),
        CALL('newInstance', 0),
        STORE('<biggers>', false),
        ...[...self.innerValue.slice(1)].flatMap((id: Id) => [
          PUSH(closure.id),
          PUSH(id),
          PUSH(self.innerValue[0]),
          CALL('apply', 2, false),
          CONDITIONAL_JUMP(4),
          LOAD('<lessers>'),
          PUSH(id),
          CALL('add', 1),
          JUMP(3),
          LOAD('<biggers>'),
          PUSH(id),
          CALL('add', 1),
        ]),
        LOAD('<lessers>'),
        PUSH(closure.id),
        CALL('sortBy', 1),
        LOAD('<biggers>'),
        PUSH(closure.id),
        CALL('sortBy', 1),
        PUSH(self.id),
        CALL('clear', 0),
        PUSH(self.id),
        LOAD('<lessers>'),
        CALL('addAll', 1),
        PUSH(self.id),
        PUSH(self.innerValue[0]),
        CALL('add', 1),
        PUSH(self.id),
        LOAD('<biggers>'),
        CALL('addAll', 1),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    'filter': Collections.filter,

    'contains': Collections.contains,

    'max': Collections.max,

    'fold': Collections.fold,

    'findOrElse': Collections.findOrElse,

    'add': Collections.add,

    'remove': Collections.remove,

    'size': Collections.size,

    'clear': Collections.clear,

    'join': Collections.join,

    'equals': Collections.equals,

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      if (self.module !== other.module) return evaluation.currentFrame().pushOperand(FALSE_ID)

      other.assertIsCollection()

      if (self.innerValue.length !== other.innerValue.length) return evaluation.currentFrame().pushOperand(FALSE_ID)
      if (!self.innerValue.length) return evaluation.currentFrame().pushOperand(TRUE_ID)

      evaluation.pushFrame([
        PUSH(self.id),
        CALL('first', 0),
        PUSH(other.id),
        CALL('first', 0),
        CALL('==', 1),
        DUP,
        CALL('negate', 0),
        CONDITIONAL_JUMP(1),
        RETURN,
        PUSH(self.id),
        INSTANTIATE('wollok.lang.Number', 1),
        CALL('subList', 1),
        PUSH(other.id),
        INSTANTIATE('wollok.lang.Number', 1),
        CALL('subList', 1),
        CALL('==', 1),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    'withoutDuplicates': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsCollection()

      evaluation.pushFrame([
        PUSH(self.id),
        CALL('newInstance', 0),
        STORE('<answer>', false),
        ...self.innerValue.flatMap((id: Id) => [
          LOAD('<answer>'),
          PUSH(id),
          CALL('contains', 1),
          CALL('negate', 0),
          CONDITIONAL_JUMP(3),
          LOAD('<answer>'),
          PUSH(id),
          CALL('add', 1),
        ]),
        LOAD('<answer>'),
        RETURN,
      ], evaluation.createContext(self.id))
    },

  },

  Dictionary: {

    initialize: (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.set('<keys>', evaluation.createInstance('wollok.lang.List', []))
      self.set('<values>', evaluation.createInstance('wollok.lang.List', []))

      evaluation.currentFrame().pushOperand(VOID_ID)
    },

    put: (self: RuntimeObject, key: RuntimeObject, value: RuntimeObject) => (evaluation: Evaluation) => {
      if (key.id === NULL_ID) throw new TypeError('key')
      if (value.id === NULL_ID) throw new TypeError('value')

      evaluation.pushFrame([
        PUSH(self.id),
        PUSH(key.id),
        CALL('remove', 1),
        LOAD('<keys>'),
        PUSH(key.id),
        CALL('add', 1),
        LOAD('<values>'),
        PUSH(value.id),
        CALL('add', 1),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    basicGet: (self: RuntimeObject, key: RuntimeObject) => (evaluation: Evaluation) => {
      const keys: RuntimeObject = self.get('<keys>')!

      keys.assertIsCollection()

      evaluation.pushFrame([
        ...keys.innerValue.flatMap((id, index) => [
          PUSH(key.id),
          PUSH(id),
          CALL('==', 1),
          CONDITIONAL_JUMP(4),
          LOAD('<values>'),
          INSTANTIATE('wollok.lang.Number', index),
          CALL('get', 1),
          RETURN,
        ]),
        PUSH(NULL_ID),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    remove: (self: RuntimeObject, key: RuntimeObject) => (evaluation: Evaluation) => {
      const keys: RuntimeObject = self.get('<keys>')!

      keys.assertIsCollection()

      evaluation.pushFrame([
        ...keys.innerValue.flatMap((id, index) => [
          PUSH(key.id),
          PUSH(id),
          CALL('==', 1),
          CONDITIONAL_JUMP(index === 0 ? 10 : 12),
          ...index === 0
            ? [
              LOAD('<values>'),
              CALL('newInstance', 0),
            ]
            : [
              LOAD('<values>'),
              INSTANTIATE('wollok.lang.Number', 0),
              INSTANTIATE('wollok.lang.Number', index - 1),
              CALL('subList', 2),
            ],

          LOAD('<values>'),
          INSTANTIATE('wollok.lang.Number', index + 1),
          CALL('subList', 1),
          CALL('+', 1),
          STORE('<values>', false),

          LOAD('<keys>'),
          PUSH(id),
          CALL('remove', 1),
        ]),
        PUSH(VOID_ID),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    keys: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.get('<keys>')!.id)
    },

    values: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.get('<values>')!.id)
    },

    forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      const keys: RuntimeObject = self.get('<keys>')!
      const values: RuntimeObject = self.get('<values>')!

      keys.assertIsCollection()
      values.assertIsCollection()

      const keyList = [...keys.innerValue].reverse()
      const valueList = [...values.innerValue].reverse()

      evaluation.pushFrame([
        ...keyList.flatMap((key, index) => [
          PUSH(closure.id),
          PUSH(key),
          PUSH(valueList[index]),
          CALL('apply', 2, false),
        ]),
        PUSH(VOID_ID),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.set('<keys>', evaluation.createInstance('wollok.lang.List', []))
      self.set('<values>', evaluation.createInstance('wollok.lang.List', []))

      evaluation.currentFrame().pushOperand(VOID_ID)
    },

  },

  Number: {

    'coerceToInteger': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')

      evaluation.currentFrame().pushOperand(decimalPosition >= 0
        ? evaluation.createInstance(self.module, Number(num.slice(0, decimalPosition + 1)))
        : self.id
      )
    },

    'coerceToPositiveInteger': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()

      if (self.innerValue < 0) throw new RangeError('self')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')

      evaluation.currentFrame().pushOperand(decimalPosition >= 0
        ? evaluation.createInstance(self.module, Number(num.slice(0, decimalPosition + 1)))
        : self.id
      )
    },

    '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
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

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame().pushOperand(self.innerValue < other.innerValue ? TRUE_ID : FALSE_ID)
    },

    'abs': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()

      if (self.innerValue > 0) evaluation.currentFrame().pushOperand(self.id)
      else evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, -self.innerValue))
    },

    'invert': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, -self.innerValue))
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

    'gcd': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()
      other.assertIsNumber()

      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, gcd(self.innerValue, other.innerValue)))
    },

    'isInteger': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsNumber()

      evaluation.currentFrame().pushOperand(self.innerValue % 1 === 0 ? TRUE_ID : FALSE_ID)
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

    'reverse': (self: RuntimeObject) => (evaluation: Evaluation) => {
      self.assertIsString()

      evaluation.currentFrame().pushOperand(evaluation.createInstance(self.module, self.innerValue.split('').reverse().join('')))
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

    'toSmartString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.id)
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.innerValue === other.innerValue ? TRUE_ID : FALSE_ID)
    },
  },

  Boolean: {

    '&&': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      if (self.id === FALSE_ID) return evaluation.currentFrame().pushOperand(self.id)

      evaluation.pushFrame([
        PUSH(closure.id),
        CALL('apply', 0, false),
        RETURN,
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))
    },

    '||': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation) => {
      if (self.id === TRUE_ID) return evaluation.currentFrame().pushOperand(self.id)

      evaluation.pushFrame([
        PUSH(closure.id),
        CALL('apply', 0, false),
        RETURN,
      ], evaluation.createContext(evaluation.context(evaluation.currentFrame().context).parent))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.id === TRUE_ID ? 'true' : 'false'))
    },

    'toSmartString': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', self.id === TRUE_ID ? 'true' : 'false'))
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.id === other.id ? TRUE_ID : FALSE_ID)
    },

    'negate': (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.id === TRUE_ID ? FALSE_ID : TRUE_ID)
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

      evaluation.pushFrame([
        ...valueIds.flatMap((id: Id) => [
          PUSH(closure.id),
          PUSH(id),
          CALL('apply', 1, false),
        ]),
        PUSH(VOID_ID),
        RETURN,
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

    apply: (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation) => {
      evaluation.pushFrame([
        PUSH(self.id),
        ...args.map(arg => PUSH(arg?.id ?? VOID_ID)),
        CALL('<apply>', args.length, false),
        RETURN,
      ], evaluation.createContext(self.id))
    },

    toString: (self: RuntimeObject) => (evaluation: Evaluation) => {
      evaluation.currentFrame().pushOperand(self.get('<toString>')?.id ?? evaluation.createInstance('wollok.lang.String', `Closure#${self.id} `))
    },

  },

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

    'isLeapYear': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const year: RuntimeObject = self.get('year')!

      year.assertIsNumber()

      const value = new Date(year.innerValue, 1, 29)
      evaluation.currentFrame().pushOperand(value.getDate() === 29 ? TRUE_ID : FALSE_ID)
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

    'shortDescription': (self: RuntimeObject) => (evaluation: Evaluation) => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      evaluation.currentFrame().pushOperand(evaluation.createInstance('wollok.lang.String', `${month.innerValue}/${day.innerValue}/${year.innerValue}`))
    },

  },

}