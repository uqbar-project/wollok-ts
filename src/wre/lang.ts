import { CALL, CONDITIONAL_JUMP, DUP, Evaluation, INSTANTIATE, JUMP, LOAD, POP, PUSH, RETURN, RuntimeObject, STORE, SWAP, Frame, INIT, CALL_CONSTRUCTOR, compile } from '../interpreter'
import { Id } from '../model'
import { Natives } from '../interpreter'

const { random, floor, ceil } = Math
const { UTC } = Date

const Collections: Natives = {

  findOrElse: (self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    evaluation.pushFrame(new Frame(self, [
      ...self.innerValue.flatMap((id: Id) => [
        PUSH(predicate.id),
        PUSH(id),
        CALL('apply', 1),
        CALL('negate', 0),
        CONDITIONAL_JUMP(2),
        PUSH(id),
        RETURN,
      ]),
      PUSH(continuation.id),
      CALL('apply', 0),
      RETURN,
    ]))
  },

  add: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    self.innerValue.push(element.id)
    evaluation.currentFrame!.pushOperand(undefined)
  },

  fold: (self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    evaluation.pushFrame(new Frame(self, [
      ...[...self.innerValue].reverse().flatMap((id: Id) => [
        PUSH(closure.id),
        PUSH(id),
      ]),
      PUSH(initialValue.id),
      ...self.innerValue.flatMap(() => [
        SWAP(),
        CALL('apply', 2),
      ]),
      RETURN,
    ]))
  },

  filter: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    evaluation.pushFrame(new Frame(self, [
      INSTANTIATE(self.module.fullyQualifiedName(), [...self.innerValue]),
      ...[...self.innerValue].reverse().flatMap((id: Id) => [
        DUP,
        PUSH(closure.id),
        PUSH(id),
        CALL('apply', 1),
        CONDITIONAL_JUMP(3),
        PUSH(id),
        CALL('remove', 1),
        POP,
      ]),
      RETURN,
    ]))
  },

  max: (self: RuntimeObject) => (evaluation: Evaluation): void => {
    const method = evaluation.environment.getNodeByFQN<'Class'>('wollok.lang.Collection').lookupMethod('max', 0)!
    evaluation.invoke(method, self)
  },

  remove: (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    const index = self.innerValue.indexOf(element.id)
    if (index >= 0) self.innerValue.splice(index, 1)

    evaluation.currentFrame!.pushOperand(undefined)
  },

  size: (self: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue.length))
  },

  clear: (self: RuntimeObject) => (evaluation: Evaluation): void => {
    self.assertIsCollection()

    self.innerValue.splice(0, self.innerValue.length)
    evaluation.currentFrame!.pushOperand(undefined)
  },

  join: (self: RuntimeObject, separator?: RuntimeObject) => (evaluation: Evaluation): void => {
    const method = evaluation.environment.getNodeByFQN<'Class'>('wollok.lang.Collection').lookupMethod('join', separator ? 1 : 0)!
    evaluation.invoke(method, self, ...separator ? [separator] : [])
  },

  contains: (self: RuntimeObject, value: RuntimeObject) => (evaluation: Evaluation): void => {
    const method = evaluation.environment.getNodeByFQN<'Class'>('wollok.lang.Collection').lookupMethod('contains', 1)!
    evaluation.invoke(method, self, value)
  },

}

const lang: Natives = {

  Exception: {

    // TODO:
    getFullStackTrace: (_self: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    getStackTrace: (_self: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

  },


  Object: {

    identity: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.id))
    },

    // TODO:
    instanceVariables: (_self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.list(evaluation, []))
    },

    // TODO:
    instanceVariableFor: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    // TODO:
    resolve: (_self: RuntimeObject, _name: RuntimeObject) => (_evaluation: Evaluation): void => {
      throw new ReferenceError('To be implemented')
    },

    kindName: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.module.fullyQualifiedName()))
    },

    className: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.module.fullyQualifiedName()))
    },

    generateDoesNotUnderstandMessage:
      (_self: RuntimeObject, target: RuntimeObject, messageName: RuntimeObject, parametersSize: RuntimeObject) =>
        (evaluation: Evaluation): void => {
          target.assertIsString()
          messageName.assertIsString()
          parametersSize.assertIsNumber()

          const argsText = new Array(parametersSize.innerValue).fill(null).map((_, i) => `arg ${i}`)
          const text = `${target.innerValue} does not undersand ${messageName.innerValue}(${argsText})`

          evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, text))
        },

    checkNotNull: (_self: RuntimeObject, value: RuntimeObject, message: RuntimeObject) => (evaluation: Evaluation): void => {
      message.assertIsString()

      if (value === RuntimeObject.null(evaluation)) throw new TypeError(message.innerValue)
      else evaluation.currentFrame!.pushOperand(undefined)
    },

  },


  Collection: { findOrElse: Collections.findOrElse },


  Set: {

    'anyOne': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsCollection()

      evaluation.currentFrame!.pushOperand(evaluation.instance(self.innerValue[floor(random() * self.innerValue.length)]))
    },

    'fold': Collections.fold,

    'filter': Collections.filter,

    'max': Collections.max,

    'findOrElse': Collections.findOrElse,

    'add': (self: RuntimeObject, element: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.pushFrame(new Frame(self, [
        PUSH(self.id),
        PUSH(element.id),
        CALL('contains', 1),
        CONDITIONAL_JUMP(3),
        PUSH(self.id),
        PUSH(element.id),
        CALL('unsafeAdd', 1),
        PUSH(),
        RETURN,
      ]))
    },

    'unsafeAdd': Collections.add,

    'remove': Collections.remove,

    'size': Collections.size,

    'clear': Collections.clear,

    'join': Collections.join,

    'contains': Collections.contains,

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self.module !== other.module) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))

      self.assertIsCollection()
      other.assertIsCollection()

      if (self.innerValue.length !== other.innerValue.length) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))
      if (!self.innerValue.length) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, true))

      evaluation.pushFrame(new Frame(self, [
        ...[...self.innerValue].flatMap((id: Id) => [
          PUSH(other.id),
          PUSH(id),
          CALL('contains', 1),
          DUP,
          CONDITIONAL_JUMP(1),
          RETURN,
        ]),
        PUSH(RuntimeObject.boolean(evaluation, true).id),
        RETURN,
      ]))
    },

  },


  List: {

    'get': (self: RuntimeObject, index: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsCollection()
      index.assertIsNumber()

      const valueId = self.innerValue[index.innerValue]
      if (!valueId) throw new RangeError('index')
      evaluation.currentFrame!.pushOperand(evaluation.instance(valueId))
    },

    'sortBy': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsCollection()

      if (self.innerValue.length < 2) return evaluation.currentFrame!.pushOperand(self)

      evaluation.pushFrame(new Frame(self, [
        PUSH(self.id),
        INSTANTIATE(self.module.fullyQualifiedName(), []),
        INIT([]),
        CALL_CONSTRUCTOR(0, self.module.fullyQualifiedName()),
        STORE('<lessers>', false),
        PUSH(self.id),
        INSTANTIATE(self.module.fullyQualifiedName(), []),
        INIT([]),
        CALL_CONSTRUCTOR(0, self.module.fullyQualifiedName()),
        STORE('<biggers>', false),
        ...[...self.innerValue.slice(1)].flatMap((id: Id) => [
          PUSH(closure.id),
          PUSH(id),
          PUSH(self.innerValue[0]),
          CALL('apply', 2),
          CONDITIONAL_JUMP(2),
          LOAD('<biggers>'),
          JUMP(1),
          LOAD('<lessers>'),
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
      ]))
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

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsCollection()

      if (self.module !== other.module) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))

      other.assertIsCollection()

      if (self.innerValue.length !== other.innerValue.length) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))
      if (!self.innerValue.length) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, true))

      evaluation.pushFrame(new Frame(self, [
        ...self.innerValue.flatMap((id, index) => [
          PUSH(id),
          PUSH(other.innerValue[index]),
          CALL('==', 1),
          DUP,
          CONDITIONAL_JUMP(1),
          RETURN,
          POP,
        ]),
        PUSH(RuntimeObject.boolean(evaluation, true).id),
        RETURN,
      ]))
    },

    'withoutDuplicates': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsCollection()

      evaluation.pushFrame(new Frame(self, [
        PUSH(self.id),
        INSTANTIATE(self.module.fullyQualifiedName(), []),
        INIT([]),
        CALL_CONSTRUCTOR(0, self.module.fullyQualifiedName()),
        STORE('<answer>', false),
        ...self.innerValue.flatMap((id: Id) => [
          LOAD('<answer>'),
          PUSH(id),
          CALL('contains', 1),
          CONDITIONAL_JUMP(3),
          LOAD('<answer>'),
          PUSH(id),
          CALL('add', 1),
        ]),
        LOAD('<answer>'),
        RETURN,
      ]))
    },

  },

  Dictionary: {

    initialize: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.invoke('clear', self)
    },

    put: (self: RuntimeObject, key: RuntimeObject, value: RuntimeObject) => (evaluation: Evaluation): void => {
      if (key === RuntimeObject.null(evaluation)) throw new TypeError('key')
      if (value === RuntimeObject.null(evaluation)) throw new TypeError('value')

      evaluation.pushFrame(new Frame(self, [
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
      ]))
    },

    basicGet: (self: RuntimeObject, key: RuntimeObject) => (evaluation: Evaluation): void => {
      const keys: RuntimeObject = self.get('<keys>')!

      keys.assertIsCollection()

      evaluation.pushFrame(new Frame(self, [
        ...keys.innerValue.flatMap((id, index) => [
          PUSH(key.id),
          PUSH(id),
          CALL('!=', 1),
          CONDITIONAL_JUMP(4),
          LOAD('<values>'),
          INSTANTIATE('wollok.lang.Number', index),
          CALL('get', 1),
          RETURN,
        ]),
        PUSH(RuntimeObject.null(evaluation).id),
        RETURN,
      ]))
    },

    remove: (self: RuntimeObject, key: RuntimeObject) => (evaluation: Evaluation): void => {
      const keys: RuntimeObject = self.get('<keys>')!
      const values: RuntimeObject = self.get('<values>')!

      keys.assertIsCollection()
      values.assertIsCollection()

      evaluation.pushFrame(new Frame(self, [
        ...keys.innerValue.flatMap((id, index) => {
          return [
            PUSH(key.id),
            PUSH(id),
            CALL('!=', 1),
            CONDITIONAL_JUMP(6),

            INSTANTIATE(values.module.fullyQualifiedName(), [...values.innerValue.slice(0, index), ...values.innerValue.slice(index + 1)]),
            STORE('<values>', true),

            INSTANTIATE(keys.module.fullyQualifiedName(), [...keys.innerValue.slice(0, index), ...keys.innerValue.slice(index + 1)]),
            STORE('<keys>', true),

            PUSH(),
            RETURN,
          ]
        }),
        PUSH(),
        RETURN,
      ]))
    },

    keys: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(self.get('<keys>'))
    },

    values: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(self.get('<values>'))
    },

    forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
      const keys: RuntimeObject = self.get('<keys>')!
      const values: RuntimeObject = self.get('<values>')!

      keys.assertIsCollection()
      values.assertIsCollection()

      const keyList = [...keys.innerValue].reverse()
      const valueList = [...values.innerValue].reverse()

      evaluation.pushFrame(new Frame(self, [
        ...keyList.flatMap((key, index) => [
          PUSH(closure.id),
          PUSH(key),
          PUSH(valueList[index]),
          CALL('apply', 2),
        ]),
        PUSH(),
        RETURN,
      ]))
    },

    clear: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.set('<keys>', RuntimeObject.list(evaluation, []))
      self.set('<values>', RuntimeObject.list(evaluation, []))

      evaluation.currentFrame!.pushOperand(undefined)
    },

  },

  Number: {

    'coerceToInteger': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')
      const coerced = decimalPosition >= 0
        ? RuntimeObject.number(evaluation, Number(num.slice(0, decimalPosition + 1)))
        : self

      evaluation.currentFrame!.pushOperand(coerced)
    },

    'coerceToPositiveInteger': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()

      if (self.innerValue < 0) throw new RangeError('self')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')
      const coerced = decimalPosition >= 0
        ? RuntimeObject.number(evaluation, Number(num.slice(0, decimalPosition + 1)))
        : self

      evaluation.currentFrame!.pushOperand(coerced)
    },

    '===': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue === other.innerValue))
    },

    '+': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue + other.innerValue))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue - other.innerValue))
    },

    '*': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue * other.innerValue))
    },

    '/': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()
      if (other.innerValue === 0) throw new RangeError('other')

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue / other.innerValue))
    },

    '**': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue ** other.innerValue))
    },

    '%': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue % other.innerValue))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, `${self.innerValue}`))
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue > other.innerValue))
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue < other.innerValue))
    },

    'abs': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()

      if (self.innerValue > 0) evaluation.currentFrame!.pushOperand(self)
      else evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, -self.innerValue))
    },

    'invert': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, -self.innerValue))
    },

    'roundUp': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      decimals.assertIsNumber()
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, ceil(self.innerValue * 10 ** decimals.innerValue) / 10 ** decimals.innerValue))
    },

    'truncate': (self: RuntimeObject, decimals: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      decimals.assertIsNumber()
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')
      const truncated = decimalPosition >= 0
        ? RuntimeObject.number(evaluation, Number(num.slice(0, decimalPosition + decimals.innerValue + 1)))
        : self

      evaluation.currentFrame!.pushOperand(truncated)
    },

    'randomUpTo': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, random() * (other.innerValue - self.innerValue) + self.innerValue))
    },

    'gcd': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()
      other.assertIsNumber()

      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, gcd(self.innerValue, other.innerValue)))
    },

    'isInteger': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsNumber()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue % 1 === 0))
    },

  },


  String: {

    'length': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, self.innerValue.length))
    },

    'concat': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.innerValue + other.innerValue))
    },

    'startsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue.startsWith(other.innerValue)))
    },

    'endsWith': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue.endsWith(other.innerValue)))
    },

    'indexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      const value = self.innerValue.indexOf(other.innerValue)

      if (value < 0) throw new RangeError('other')

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, value))
    },

    'lastIndexOf': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      const value = self.innerValue.lastIndexOf(other.innerValue)

      if (value < 0) throw new RangeError('other')

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, value))
    },

    'toLowerCase': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.innerValue.toLowerCase()))
    },

    'toUpperCase': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.innerValue.toUpperCase()))
    },

    'trim': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.innerValue.trim()))
    },

    'reverse': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self.innerValue.split('').reverse().join('')))
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue < other.innerValue))
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue > other.innerValue))
    },

    'contains': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      other.assertIsString()

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue.indexOf(other.innerValue) >= 0))
    },

    'substring': (self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      startIndex.assertIsNumber()

      if (startIndex.innerValue < 0) throw new RangeError('startIndex')

      if (endIndex) {
        const endIndexInstance: RuntimeObject = endIndex
        endIndexInstance.assertIsNumber()
        if (endIndexInstance.innerValue < 0) throw new RangeError('endIndex')
      }

      const value = self.innerValue.substring(startIndex.innerValue, endIndex && endIndex.innerValue as number)
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, value))
    },

    'replace': (self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject) => (evaluation: Evaluation): void => {
      self.assertIsString()
      expression.assertIsString()
      replacement.assertIsString()

      const value = self.innerValue.replace(new RegExp(expression.innerValue, 'g'), replacement.innerValue)
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, value))
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(self)
    },

    'toSmartString': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(self)
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self.innerValue === other.innerValue))
    },
  },

  Boolean: {

    '&&': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self === RuntimeObject.boolean(evaluation, false)) return evaluation.currentFrame!.pushOperand(self)

      evaluation.invoke('apply', closure)
    },

    'and': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self === RuntimeObject.boolean(evaluation, false)) return evaluation.currentFrame!.pushOperand(self)

      evaluation.invoke('apply', closure)
    },

    '||': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self === RuntimeObject.boolean(evaluation, true)) return evaluation.currentFrame!.pushOperand(self)

      evaluation.invoke('apply', closure)
    },

    'or': (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
      if (self === RuntimeObject.boolean(evaluation, true)) return evaluation.currentFrame!.pushOperand(self)

      evaluation.invoke('apply', closure)
    },

    'toString': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self === RuntimeObject.boolean(evaluation, true) ? 'true' : 'false'))
    },

    'toSmartString': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, self === RuntimeObject.boolean(evaluation, true) ? 'true' : 'false'))
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self === other))
    },

    'negate': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, self === RuntimeObject.boolean(evaluation, false)))
    },
  },

  Range: {

    forEach: (self: RuntimeObject, closure: RuntimeObject) => (evaluation: Evaluation): void => {
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

      const valueIds = values.map(v => RuntimeObject.number(evaluation, v).id).reverse()

      evaluation.pushFrame(new Frame(self, [
        ...valueIds.flatMap((id: Id) => [
          PUSH(closure.id),
          PUSH(id),
          CALL('apply', 1),
          POP,
        ]),
        PUSH(),
        RETURN,
      ]))
    },

    anyOne: (self: RuntimeObject) => (evaluation: Evaluation): void => {
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

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, values[floor(random() * values.length)]))
    },

  },

  Closure: {

    apply: (self: RuntimeObject, ...args: (RuntimeObject | undefined)[]) => (evaluation: Evaluation): void => {
      const method = self.module.lookupMethod('<apply>', args.length)!
      evaluation.pushFrame(new Frame(self.parentContext,
        compile(method),
        new Map(method.parameters.map(({ name, isVarArg }, index) =>
          [name, isVarArg ? RuntimeObject.list(evaluation, args.map(arg => arg!.id).slice(index)) : args[index]]
        ))
      ))
    },

    toString: (self: RuntimeObject) => (evaluation: Evaluation): void => {
      evaluation.currentFrame!.pushOperand(self.get('<toString>') ?? RuntimeObject.string(evaluation, `Closure#${self.id} `))
    },

  },

  Date: {

    'initialize': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      const day = self.get('day')
      const month = self.get('month')
      const year = self.get('year')

      const today = new Date()

      if (!day || day === RuntimeObject.null(evaluation))
        self.set('day', RuntimeObject.number(evaluation, today.getDate()))
      if (!month || month === RuntimeObject.null(evaluation))
        self.set('month', RuntimeObject.number(evaluation, today.getMonth() + 1))
      if (!year || year === RuntimeObject.null(evaluation))
        self.set('year', RuntimeObject.number(evaluation, today.getFullYear()))

      evaluation.currentFrame!.pushOperand(undefined)
    },

    '==': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
      if (other.module !== self.module) return evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, false))

      const day = self.get('day')!.innerValue
      const month = self.get('month')!.innerValue
      const year = self.get('year')!.innerValue

      const otherDay = other.get('day')!.innerValue
      const otherMonth = other.get('month')!.innerValue
      const otherYear = other.get('year')!.innerValue

      const answer = day === otherDay && month === otherMonth && year === otherYear

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, answer))
    },

    'plusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      days.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue + floor(days.innerValue))

      const instance = RuntimeObject.object(evaluation, self.module, {
        day: RuntimeObject.number(evaluation, value.getDate()),
        month: RuntimeObject.number(evaluation, value.getMonth() + 1),
        year: RuntimeObject.number(evaluation, value.getFullYear()),
      })

      evaluation.currentFrame!.pushOperand(instance)
    },

    'plusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      months.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1 + floor(months.innerValue), day.innerValue)
      while (months.innerValue > 0 && value.getMonth() > (month.innerValue - 1 + months.innerValue) % 12)
        value.setDate(value.getDate() - 1)

      const instance = RuntimeObject.object(evaluation, self.module, {
        day: RuntimeObject.number(evaluation, value.getDate()),
        month: RuntimeObject.number(evaluation, value.getMonth() + 1),
        year: RuntimeObject.number(evaluation, value.getFullYear()),
      })

      evaluation.currentFrame!.pushOperand(instance)
    },

    'plusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      years.assertIsNumber()

      const value = new Date(year.innerValue + floor(years.innerValue), month.innerValue - 1, day.innerValue)
      if (years.innerValue > 0 && value.getDate() !== day.innerValue) {
        value.setDate(value.getDate() - 1)
      }

      const instance = RuntimeObject.object(evaluation, self.module, {
        day: RuntimeObject.number(evaluation, value.getDate()),
        month: RuntimeObject.number(evaluation, value.getMonth() + 1),
        year: RuntimeObject.number(evaluation, value.getFullYear()),
      })

      evaluation.currentFrame!.pushOperand(instance)
    },

    'isLeapYear': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      const year: RuntimeObject = self.get('year')!

      year.assertIsNumber()

      const value = new Date(year.innerValue, 1, 29)
      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, value.getDate() === 29))
    },

    'internalDayOfWeek': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue)

      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, value.getDay()))
    },

    '-': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
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
      evaluation.currentFrame!.pushOperand(RuntimeObject.number(evaluation, floor((ownUTC - otherUTC) / msPerDay)))
    },

    'minusDays': (self: RuntimeObject, days: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      days.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue - floor(days.innerValue))

      const instance = RuntimeObject.object(evaluation, self.module, {
        day: RuntimeObject.number(evaluation, value.getDate()),
        month: RuntimeObject.number(evaluation, value.getMonth() + 1),
        year: RuntimeObject.number(evaluation, value.getFullYear()),
      })

      evaluation.currentFrame!.pushOperand(instance)
    },

    'minusMonths': (self: RuntimeObject, months: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      months.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1 - floor(months.innerValue), day.innerValue)

      const instance = RuntimeObject.object(evaluation, self.module, {
        day: RuntimeObject.number(evaluation, value.getDate()),
        month: RuntimeObject.number(evaluation, value.getMonth() + 1),
        year: RuntimeObject.number(evaluation, value.getFullYear()),
      })

      evaluation.currentFrame!.pushOperand(instance)
    },

    'minusYears': (self: RuntimeObject, years: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      day.assertIsNumber()
      month.assertIsNumber()
      year.assertIsNumber()
      years.assertIsNumber()

      const value = new Date(year.innerValue - floor(years.innerValue), month.innerValue - 1, day.innerValue)
      if (years.innerValue > 0 && value.getDate() !== day.innerValue) {
        value.setDate(value.getDate() - 1)
      }

      const instance = RuntimeObject.object(evaluation, self.module, {
        day: RuntimeObject.number(evaluation, value.getDate()),
        month: RuntimeObject.number(evaluation, value.getMonth() + 1),
        year: RuntimeObject.number(evaluation, value.getFullYear()),
      })

      evaluation.currentFrame!.pushOperand(instance)
    },

    '<': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
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

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, value < otherValue))
    },

    '>': (self: RuntimeObject, other: RuntimeObject) => (evaluation: Evaluation): void => {
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

      evaluation.currentFrame!.pushOperand(RuntimeObject.boolean(evaluation, value > otherValue))
    },

    'shortDescription': (self: RuntimeObject) => (evaluation: Evaluation): void => {
      const day: RuntimeObject = self.get('day')!
      const month: RuntimeObject = self.get('month')!
      const year: RuntimeObject = self.get('year')!

      evaluation.currentFrame!.pushOperand(RuntimeObject.string(evaluation, `${month.innerValue}/${day.innerValue}/${year.innerValue}`))
    },

  },

}

export default lang