import { APPLY_METHOD, CLOSURE_EVALUATE_METHOD, CLOSURE_TO_STRING_METHOD, COLLECTION_MODULE, DATE_MODULE, KEYWORDS, TO_STRING_METHOD } from '../constants'
import { hash, isEmpty, List } from '../extensions'
import { assertNotVoid, showParameter } from '../helpers'
import { assertIsCollection, assertIsNumber, assertIsString, assertIsNotNull, Evaluation, Execution, Frame, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'
import { Class, Node, Singleton } from '../model'

const { abs, ceil, random, floor, round } = Math
const { isInteger } = Number
const { UTC } = Date


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMON FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function *internalFilter(evaluation: Evaluation, self: RuntimeObject, closure: RuntimeObject, newCollection: (evaluation: Evaluation, result: RuntimeObject[]) => Execution<RuntimeValue>): Execution<RuntimeValue> {
  assertIsNotNull(closure, 'filter', 'closure')

  const result: RuntimeObject[] = []
  for(const elem of [...self.innerCollection!]) {
    const satisfies = (yield* evaluation.send(APPLY_METHOD, closure, elem)) as RuntimeObject
    assertNotVoid(satisfies, 'Message filter: closure produces no value. Check the return type of the closure (missing return?)')
    if (satisfies!.innerBoolean) {
      result.push(elem)
    }
  }

  return yield* newCollection(evaluation, result)
}

function *internalFindOrElse(evaluation: Evaluation, self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
  assertIsNotNull(predicate, 'findOrElse', 'predicate')
  assertIsNotNull(continuation, 'findOrElse', 'continuation')

  for(const elem of [...self.innerCollection!]) {
    const value = (yield* evaluation.send(APPLY_METHOD, predicate, elem)) as RuntimeObject
    assertNotVoid(value, 'Message findOrElse: predicate produces no value. Check the return type of the closure (missing return?)')
    if (value!.innerBoolean!) return elem
  }

  return yield* evaluation.send(APPLY_METHOD, continuation)
}

function *internalFold(evaluation: Evaluation, self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
  assertIsNotNull(closure, 'fold', 'closure')

  let acum = initialValue
  for(const elem of [...self.innerCollection!]) {
    acum = (yield* evaluation.send(APPLY_METHOD, closure, acum, elem))!
    assertNotVoid(acum, 'Message fold: closure produces no value. Check the return type of the closure (missing return?)')
  }

  return acum
}

function *internalMax(evaluation: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
  const method = evaluation.environment.getNodeByFQN<Class>(COLLECTION_MODULE).lookupMethod('max', 0)!
  return yield* evaluation.invoke(method, self)
}

function *internalRemove(self: RuntimeObject, element: RuntimeObject): Execution<void> {
  const values = self.innerCollection!
  const index = values.indexOf(element)
  if (index >= 0) values.splice(index, 1)
}

function *internalSize(evaluation: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
  return yield* evaluation.reify(self.innerCollection!.length)
}

function *internalClear(self: RuntimeObject): Execution<void> {
  const values = self.innerCollection!
  values.splice(0, values.length)
}

function *internalJoin(evaluation: Evaluation, self: RuntimeObject, separator?: RuntimeObject): Execution<RuntimeValue> {
  const method = evaluation.environment.getNodeByFQN<Class>(COLLECTION_MODULE).lookupMethod('join', separator ? 1 : 0)!
  return yield* evaluation.invoke(method, self, ...separator ? [separator]: [])
}

function *internalContains(evaluation: Evaluation, self: RuntimeObject, value: RuntimeObject): Execution<RuntimeValue> {
  const method = evaluation.environment.getNodeByFQN<Class>(COLLECTION_MODULE).lookupMethod('contains', 1)!
  return yield* evaluation.invoke(method, self, value)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NATIVE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const lang: Natives = {

  Exception: {
    *initialize(self: RuntimeObject): Execution<void> {
      const stackTraceElements: RuntimeObject[] = []
      const customFrames = this.frameStack.slice(0, -1).filter(frame => frame.isCustom())
      for(const frame of customFrames){
        const stackTraceElement = yield* this.send('createStackTraceElement', self, yield* this.reify(frame.description), yield* this.reify(frame.sourceInfo))
        stackTraceElements.unshift(stackTraceElement!)
      }
      self.set('<stackTrace>', yield* this.list(...stackTraceElements))
    },

    *getFullStackTrace(self: RuntimeObject): Execution<RuntimeValue> {
      return self.get('<stackTrace>')
    },

    *getStackTrace(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.send('getFullStackTrace', self)
    },
  },


  Object: {

    *identity(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.id)
    },

    *kindName(self: RuntimeObject): Execution<RuntimeValue> {
      if (self.innerValue === null) return yield* this.reify('null')

      const onlyModuleName = self.module.fullyQualifiedName.split('.').pop()!
      const aOrAn = onlyModuleName.match(/^[AEIOUaeiou]+.*/) ? 'an' : 'a'

      const kindName =
        self.module.is(Singleton) && self.module.name ||
        aOrAn + ' ' + onlyModuleName

      return yield* this.reify(kindName)
    },

    *className(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.module.fullyQualifiedName)
    },

    *generateDoesNotUnderstandMessage(_self: RuntimeObject, target: RuntimeObject, messageName: RuntimeObject, parametersSize: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(target, 'generateDoesNotUnderstandMessage', 'target', false)
      assertIsString(messageName, 'generateDoesNotUnderstandMessage', 'messageName', false)
      assertIsNumber(parametersSize, 'generateDoesNotUnderstandMessage', 'parametersSize', false)

      const argsText = new Array(parametersSize.innerNumber).fill(null).map((_, i) => `arg ${i}`)
      const text = `${target.innerString} does not understand ${messageName.innerString}(${argsText})`

      return yield* this.reify(text)
    },

    *checkNotNull(_self: RuntimeObject, value: RuntimeObject, message: RuntimeObject): Execution<void> {
      assertIsString(message, 'checkNotNull', 'message', false)

      if (value.innerValue === null) throw new RangeError(`Message ${message.innerValue} does not allow to receive null values`)
    },

  },


  Collection: {

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFindOrElse(this, self, predicate, continuation)
    },

  },


  Set: {
    *anyOne(self: RuntimeObject): Execution<RuntimeValue> {
      const values = self.innerCollection!
      if(isEmpty(values)) throw new RangeError('anyOne: list should not be empty')
      return values[floor(random() * values.length)]
    },

    *fold(self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFold(this, self, initialValue, closure)
    },

    *filter(self: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFilter(this, self, closure, (evaluation: Evaluation, result: RuntimeObject[]) => evaluation.set(...result))
    },

    *max(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalMax(this, self)
    },

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFindOrElse(this, self, predicate, continuation)
    },

    *add(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      if(!(yield* this.send('contains', self, element))!.innerBoolean!)
        yield* this.send('unsafeAdd', self, element)
    },

    *unsafeAdd(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      self.innerCollection!.push(element)
    },

    *remove(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      return yield* internalRemove(self, element)
    },

    *size(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalSize(this, self)
    },

    *clear(self: RuntimeObject): Execution<void> {
      return yield* internalClear(self)
    },

    *join(self: RuntimeObject, separator?: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalJoin(this, self, separator)
    },

    *contains(self: RuntimeObject, value: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalContains(this, self, value)
    },

    *['=='](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      if (self.module !== other.module) return yield* this.reify(false)
      if (self.innerCollection!.length !== other.innerCollection!.length) return yield* this.reify(false)

      for(const elem of [...self.innerCollection!])
        if(!(yield* this.send('contains', other, elem))!.innerBoolean)
          return yield* this.reify(false)

      return yield* this.reify(true)
    },
  },


  List: {
    *get(self: RuntimeObject, index: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(index, 'get', 'index')

      const values = self.innerCollection!
      const indexValue = index.innerNumber

      if(indexValue < 0 || indexValue >= values.length) throw new RangeError(`get: index should be between 0 and ${values.length - 1}`)

      return values[round(indexValue)]
    },

    *sortBy(self: RuntimeObject, closure: RuntimeObject): Execution<void> {
      assertIsNotNull(closure, 'sortBy', 'closure')

      function*quickSort(this: Evaluation, list: List<RuntimeObject>): Generator<Node, List<RuntimeObject>> {
        if(list.length < 2) return [...list]

        const [head, ...tail] = list
        const before: RuntimeObject[] = []
        const after: RuntimeObject[] = []

        for(const elem of tail) {
          const comparison = (yield* this.send(APPLY_METHOD, closure, elem, head)) as RuntimeObject
          assertNotVoid(comparison, 'Message sortBy: closure produces no value. Check the return type of the closure (missing return?)')
          if (comparison!.innerBoolean)
            before.push(elem)
          else
            after.push(elem)
        }

        const sortedBefore = yield* quickSort.call(this, before)
        const sortedAfter = yield* quickSort.call(this, after)

        return [...sortedBefore, head, ...sortedAfter]
      }

      const values = self.innerCollection!
      const sorted = yield* quickSort.call(this, values)
      values.splice(0, values.length)
      values.push(...sorted)
    },

    *filter(self: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFilter(this, self, closure, (evaluation: Evaluation, result: RuntimeObject[]) => evaluation.list(...result))
    },

    *contains(self: RuntimeObject, value: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalContains(this, self, value)
    },

    *max(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalMax(this, self)
    },

    *fold(self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFold(this, self, initialValue, closure)
    },

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalFindOrElse(this, self, predicate, continuation)
    },

    *add(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      self.innerCollection!.push(element)
    },

    *remove(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      return yield* internalRemove(self, element)
    },

    *size(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalSize(this, self)
    },

    *clear(self: RuntimeObject): Execution<void> {
      return yield* internalClear(self)
    },

    *join(self: RuntimeObject, separator?: RuntimeObject): Execution<RuntimeValue> {
      return yield* internalJoin(this, self, separator)
    },

    *['=='](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      if (self.module !== other.module) return yield* this.reify(false)

      const values = self.innerCollection!
      const otherValues = other.innerCollection!

      if (values.length !== otherValues.length) return yield* this.reify(false)

      for(let index = 0; index < values.length; index++)
        if(!(yield* this.send('==', values[index], otherValues[index]))!.innerBoolean)
          return yield* this.reify(false)

      return yield* this.reify(true)
    },

    *withoutDuplicates(self: RuntimeObject): Execution<RuntimeValue> {
      const result: RuntimeObject[] = []
      for(const elem of [...self.innerCollection!]) {
        let alreadyIncluded = false
        for(const included of result)
          if((yield* this.send('==', elem, included))!.innerBoolean) {
            alreadyIncluded = true
            break
          }
        if(!alreadyIncluded) result.push(elem)
      }

      return yield* this.list(...result)
    },
  },

  Dictionary: {

    *initialize(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.send('clear', self)
    },

    *put(self: RuntimeObject, key: RuntimeObject, value: RuntimeObject): Execution<void> {
      assertIsNotNull(key, 'put', '_key')
      assertIsNotNull(value, 'put', '_value')

      const buckets = self.get('<buckets>')!.innerCollection!
      const index = hash(`${key.innerNumber ?? key.innerString ?? key.module.fullyQualifiedName}`) % buckets.length
      const bucket = buckets[index].innerCollection!

      for (let i = 0; i < bucket.length; i++) {
        const entry = bucket[i].innerCollection!
        if((yield* this.send('==', entry[0], key))!.innerBoolean) {
          entry[1] = value
          return
        }
      }

      bucket.push(yield* this.list(key, value))
    },

    *basicGet(self: RuntimeObject, key: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(key, 'basicGet', '_key')

      const buckets = self.get('<buckets>')!.innerCollection!
      const index = hash(`${key.innerNumber ?? key.innerString ?? key.module.fullyQualifiedName}`) % buckets.length
      const bucket = buckets[index].innerCollection!

      for (const entry of bucket) {
        const [entryKey, entryValue] = entry.innerCollection!
        if((yield* this.send('==', entryKey, key))!.innerBoolean) return entryValue
      }

      return yield* this.reify(null)
    },

    *remove(self: RuntimeObject, key: RuntimeObject): Execution<void> {
      const buckets = self.get('<buckets>')!.innerCollection!
      const index = hash(`${key.innerNumber ?? key.innerString ?? key.module.fullyQualifiedName}`) % buckets.length
      const bucket = buckets[index].innerCollection!

      for (let i = 0; i < bucket.length; i++) {
        const [entryKey] = bucket[i].innerCollection!
        if((yield* this.send('==', entryKey, key))!.innerBoolean) {
          bucket.splice(i, 1)
          return
        }
      }
    },

    *keys(self: RuntimeObject): Execution<RuntimeValue> {
      const buckets = self.get('<buckets>')!.innerCollection!

      const response: RuntimeObject[] = []
      for (const bucket of buckets) {
        for (const entry of bucket.innerCollection!) {
          const [entryKey] = entry.innerCollection!
          response.push(entryKey)
        }
      }

      return yield* this.list(...response)
    },

    *values(self: RuntimeObject): Execution<RuntimeValue> {
      const buckets = self.get('<buckets>')!.innerCollection!

      const response: RuntimeObject[] = []
      for (const bucket of buckets) {
        for (const entry of bucket.innerCollection!) {
          const [, entryValue] = entry.innerCollection!
          response.push(entryValue)
        }
      }

      return yield* this.list(...response)
    },

    *forEach(self: RuntimeObject, closure: RuntimeObject): Execution<void> {
      assertIsNotNull(closure, 'forEach', 'closure')

      const buckets = self.get('<buckets>')!.innerCollection!

      for (const bucket of buckets) {
        for (const entry of bucket.innerCollection!) {
          const [entryKey, entryValue] = entry.innerCollection!
          yield* this.send(APPLY_METHOD, closure, entryKey, entryValue)
        }
      }
    },

    *clear(self: RuntimeObject): Execution<void> {
      const buckets: RuntimeObject[] = []
      for(let i=0; i< 16; i++) buckets.push(yield* this.list())

      self.set('<buckets>', yield* this.list(...buckets))
    },

  },

  Number: {

    *coerceToInteger(self: RuntimeObject): Execution<RuntimeValue> {
      const num = self.innerNumber!.toString()
      const decimalPosition = num.indexOf('.')

      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + 1)))
        : self
    },

    *coerceToPositiveInteger(self: RuntimeObject): Execution<RuntimeValue> {
      if (self.innerNumber! < 0) throw new RangeError('coerceToPositiveInteger: self should be zero or positive number')

      const num = self.innerNumber!.toString()
      const decimalPosition = num.indexOf('.')
      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + 1)))
        : self
    },

    *['==='](self: RuntimeObject, other?: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerNumber === other?.innerNumber)
    },

    *['+'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(+)', 'other')

      return yield* this.reify(self.innerNumber! + other.innerNumber)
    },

    *['-'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(-)', 'other')

      return yield* this.reify(self.innerNumber! - other.innerNumber)
    },

    *['*'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(*)', 'other')

      return yield* this.reify(self.innerNumber! * other.innerNumber)
    },

    *['/'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(/)', 'other')

      if (other.innerNumber === 0) throw new RangeError('Message (/): quotient should not be zero')

      return yield* this.reify(self.innerNumber! / other.innerNumber)
    },

    *['**'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(**)', 'other')

      return yield* this.reify(self.innerNumber! ** other.innerNumber)
    },

    *['%'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(%)', 'other')

      return yield* this.reify(self.innerNumber! % other.innerNumber)
    },

    *toString(this: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(`${self.innerNumber}`)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(>)', 'other')

      return yield* this.reify(self.innerNumber! > other.innerNumber)
    },

    *['<'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, '(<)', 'other')

      return yield* this.reify(self.innerNumber! < other.innerNumber)
    },

    *abs(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(abs(self.innerNumber!))
    },

    *invert(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(-self.innerNumber!)
    },

    *roundUp(self: RuntimeObject, decimals: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(decimals, 'roundUp', '_decimals')

      if (decimals.innerNumber! < 0) throw new RangeError('roundUp: decimals should be zero or positive number')
      if (!isInteger(decimals.innerNumber!)) throw new RangeError('roundUp: decimals should be an integer number')
      return yield* this.reify(ceil(self.innerNumber! * 10 ** decimals.innerNumber!) / 10 ** decimals.innerNumber!)
    },

    *roundDown(self: RuntimeObject, decimals: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(decimals, 'roundDown', '_decimals')

      if (decimals.innerNumber! < 0) throw new RangeError('roundDown: decimals should be zero or positive number')
      if (!isInteger(decimals.innerNumber!)) throw new RangeError('roundDown: decimals should be an integer number')
      return yield* this.reify(floor(self.innerNumber! * 10 ** decimals.innerNumber!) / 10 ** decimals.innerNumber!)
    },

    *truncate(self: RuntimeObject, decimals: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(decimals, 'truncate', '_decimals')

      if (decimals.innerNumber < 0) throw new RangeError('truncate: decimals should be zero or positive number')
      if (!isInteger(decimals.innerNumber!)) throw new RangeError('truncate: decimals should be an integer number')
      const num = self.innerNumber!.toString()
      const decimalPosition = num.indexOf('.')
      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + decimals.innerNumber + 1)))
        : self
    },

    *randomUpTo(self: RuntimeObject, max: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(max, 'randomUpTo', 'max')
      return yield* this.reify(random() * (max.innerNumber! - self.innerNumber!) + self.innerNumber!)
    },

    *round(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(round(self.innerNumber!))
    },

    *gcd(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(other, 'gcd', 'other')

      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)

      return yield* this.reify(gcd(self.innerNumber!, other.innerNumber!))
    },

    *isInteger(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(isInteger(self.innerNumber!))
    },

  },


  String: {

    *length(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerString!.length)
    },

    *concat(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(other, 'concat', 'other')
      return yield* this.reify(self.innerString! + (yield * this.send(TO_STRING_METHOD, other))!.innerString!)
    },

    *startsWith(self: RuntimeObject, prefix: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(prefix, 'startsWith', 'prefix')

      return yield* this.reify(self.innerString!.startsWith(prefix.innerString))
    },

    *endsWith(self: RuntimeObject, suffix: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(suffix, 'startsWith', 'suffix')

      return yield* this.reify(self.innerString!.endsWith(suffix.innerString))
    },

    *indexOf(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(other, 'indexOf', 'other')

      const index = self.innerString!.indexOf(other.innerString)

      if (index < 0) throw new RangeError('indexOf: other should be zero or positive number')
      return yield* this.reify(index)
    },

    *lastIndexOf(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(other, 'lastIndexOf', 'other')

      const index = self.innerString!.lastIndexOf(other.innerString)

      if (index < 0) throw new RangeError('lastIndexOf: other should be zero or positive nummber')
      return yield* this.reify(index)
    },

    *toLowerCase(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerString!.toLowerCase())
    },

    *toUpperCase(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerString!.toUpperCase())
    },

    *trim(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerString!.trim())
    },

    *reverse(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerString!.split('').reverse().join(''))
    },

    *['<'](self: RuntimeObject, aString: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(aString, '(<)', 'aString')

      return yield* this.reify(self.innerString! < aString.innerString)
    },

    *['>'](self: RuntimeObject, aString: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(aString, '(>)', 'aString')

      return yield* this.reify(self.innerString! > aString.innerString)
    },

    *contains(self: RuntimeObject, element: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(element, 'contains', 'element')

      return yield* this.reify(self.innerString!.indexOf(element.innerString) >= 0)
    },

    *substring(self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(startIndex, 'substring', 'startIndex')

      const start = startIndex.innerNumber
      const end = endIndex?.innerNumber

      if (start < 0) throw new RangeError('substring: startIndex should be zero or positive number')
      if (endIndex && end === undefined || end !== undefined && end < 0) throw new RangeError('substring: endIndex should be zero or positive number')

      return yield* this.reify(self.innerString!.substring(start, end))
    },

    *replace(self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject): Execution<RuntimeValue> {
      assertIsString(expression, 'replace', 'expression')
      assertIsString(replacement, 'replace', 'replacement')
      return yield* this.reify(self.innerString!.replace(new RegExp(expression.innerString, 'g'), replacement.innerString))
    },

    *toString(self: RuntimeObject): Execution<RuntimeValue> {
      return self
    },

    *['=='](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerString! === other.innerString)
    },
  },

  Boolean: {
    *['&&'](_self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return other
    },

    *and(_self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return other
    },

    *['||'](_self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return other
    },

    *or(_self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return other
    },

    *toString(this: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(`${self.innerBoolean!}`)
    },

    *['=='](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self === other)
    },

    *negate(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(!self.innerBoolean!)
    },
  },

  Range: {

    *forEach(self: RuntimeObject, closure: RuntimeObject): Execution<void> {
      assertIsNotNull(closure, 'forEach', 'closure')

      const start = self.get('start')!.innerNumber!
      const end = self.get('end')!.innerNumber!
      const step = self.get('step')!.innerNumber!

      if (start <= end && step > 0)
        for (let value = start; value <= end; value += step)
          yield* this.send(APPLY_METHOD, closure, yield* this.reify(value))

      if (start >= end && step < 0)
        for (let value = start; value >= end; value += step)
          yield* this.send(APPLY_METHOD, closure, yield* this.reify(value))
    },

    *anyOne(self: RuntimeObject): Execution<RuntimeValue> {
      const start = self.get('start')!.innerNumber!
      const end = self.get('end')!.innerNumber!
      const step = self.get('step')!.innerNumber!
      const values: number[] = []

      if (start <= end && step > 0)
        for (let value = start; value <= end; value += step)
          values.push(value)

      if (start >= end && step < 0)
        for (let value = start; value >= end; value += step)
          values.push(value)

      return yield* this.reify(values[floor(random() * values.length)])
    },

  },

  Closure: {

    *apply(this: Evaluation, self: RuntimeObject, args: RuntimeObject): Execution<RuntimeValue> {
      assertIsCollection(args)

      const method = self.module.lookupMethod(CLOSURE_EVALUATE_METHOD, args.innerCollection.length)
      if (!method) return yield* this.send('messageNotUnderstood', self, yield* this.reify(APPLY_METHOD), args)

      const locals = yield* this.localsFor(method, args.innerCollection)
      const frame = new Frame(method, self, locals)

      frame.set(KEYWORDS.SELF, self.parentContext?.get(KEYWORDS.SELF))

      const result = yield* this.exec(method, frame)
      return result === undefined ? yield* this.reifyVoid() : result
    },

    *toString(this: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
      return self.get(CLOSURE_TO_STRING_METHOD) ?? (yield* this.reify(`${self.module.fullyQualifiedName}#${self.id}`))
    },

  },

  calendar: {
    *today(_self: RuntimeObject): Execution<RuntimeObject> {
      const today = new Date()
      return yield* this.instantiate(DATE_MODULE, {
        day: yield* this.reify(today.getDate()),
        month: yield* this.reify(today.getMonth() + 1),
        year: yield* this.reify(today.getFullYear()),
      })
    },
  },

  Date: {

    *shortDescription(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(`${self.get('month')!.innerNumber!}/${self.get('day')!.innerNumber!}/${self.get('year')!.innerNumber!}`)
    },

    *isLeapYear(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(new Date(self.get('year')!.innerNumber!, 1, 29).getDate() === 29)
    },

    *internalDayOfWeek(self: RuntimeObject): Execution<RuntimeValue> {
      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year, month, day)

      return yield* this.reify(value.getDay() == 0 ? 7 : value.getDay())
    },

    *plusDays(self: RuntimeObject, days: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(days, 'plusDays', '_days')

      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year, month, day + floor(days.innerNumber!))

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *minusDays(self: RuntimeObject, days: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(days, 'minusDays', '_days')

      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year, month, day - floor(days.innerNumber))

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *plusMonths(self: RuntimeObject, months: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(months, 'plusMonths', '_months')

      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year, month + floor(months.innerNumber), day)
      while (months.innerNumber > 0 && value.getMonth() > (month + months.innerNumber) % 12)
        value.setDate(value.getDate() - 1)

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *minusMonths(self: RuntimeObject, months: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(months, 'minusMonths', '_months')

      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year, month - floor(months.innerNumber), day)

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *plusYears(self: RuntimeObject, years: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(years, 'plusYears', '_years')

      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year + floor(years.innerNumber), month, day)
      if (years.innerNumber > 0 && value.getDate() !== day) {
        value.setDate(value.getDate() - 1)
      }

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *minusYears(self: RuntimeObject, years: RuntimeObject): Execution<RuntimeValue> {
      assertIsNumber(years, 'minusYears', '_years')

      const day = self.get('day')!.innerNumber!
      const month = self.get('month')!.innerNumber! - 1
      const year = self.get('year')!.innerNumber!

      const value = new Date(year - floor(years.innerNumber), month, day)
      if (years.innerNumber > 0 && value.getDate() !== day) {
        value.setDate(value.getDate() - 1)
      }

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *['=='](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(
        self.module === other.module &&
        self.get('day') === other.get('day') &&
        self.get('month') === other.get('month') &&
        self.get('year') === other.get('year')
      )
    },

    *['-'](self: RuntimeObject, aDate: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(aDate, '(-)', '_aDate')
      if (aDate.module !== self.module) throw new TypeError(`Message (-): parameter ${showParameter(aDate)} should be a Date`)

      const ownDay = self.get('day')!.innerNumber!
      const ownMonth = self.get('month')!.innerNumber! - 1
      const ownYear = self.get('year')!.innerNumber!

      const otherDay = aDate.get('day')!.innerNumber!
      const otherMonth = aDate.get('month')!.innerNumber! - 1
      const otherYear = aDate.get('year')!.innerNumber!

      const msPerDay = 1000 * 60 * 60 * 24
      const ownUTC = UTC(ownYear, ownMonth, ownDay)
      const otherUTC = UTC(otherYear, otherMonth, otherDay)

      return yield* this.reify(floor((ownUTC - otherUTC) / msPerDay))
    },

    *['<'](self: RuntimeObject, aDate: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(aDate, '(<)', '_aDate')
      if (aDate.module !== self.module) throw new TypeError(`Message (<): parameter ${showParameter(aDate)} should be a Date`)

      const ownDay = self.get('day')!.innerNumber!
      const ownMonth = self.get('month')!.innerNumber! - 1
      const ownYear = self.get('year')!.innerNumber!

      const otherDay = aDate.get('day')!.innerNumber!
      const otherMonth = aDate.get('month')!.innerNumber! - 1
      const otherYear = aDate.get('year')!.innerNumber!

      const value = new Date(ownYear, ownMonth, ownDay)
      const otherValue = new Date(otherYear, otherMonth, otherDay)

      return yield* this.reify(value < otherValue)
    },

    *['>'](self: RuntimeObject, aDate: RuntimeObject): Execution<RuntimeValue> {
      assertIsNotNull(aDate, '(>)', '_aDate')
      if (aDate.module !== self.module) throw new TypeError(`Message (>): parameter ${showParameter(aDate)} should be a Date`)

      const ownDay = self.get('day')!.innerNumber!
      const ownMonth = self.get('month')!.innerNumber! - 1
      const ownYear = self.get('year')!.innerNumber!

      const otherDay = aDate.get('day')!.innerNumber!
      const otherMonth = aDate.get('month')!.innerNumber! - 1
      const otherYear = aDate.get('year')!.innerNumber!

      const value = new Date(ownYear, ownMonth, ownDay)
      const otherValue = new Date(otherYear, otherMonth, otherDay)

      return yield* this.reify(value > otherValue)
    },

  },

  io: {
    *serve(): Execution<RuntimeValue> {
      return yield* this.reify(false)
    },
  },
}

export default lang