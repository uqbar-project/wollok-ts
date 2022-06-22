import { hash, isEmpty, List } from '../extensions'
import { Evaluation, Execution, Natives, RuntimeObject, RuntimeValue } from '../interpreter/runtimeModel'
import { Class, Node } from '../model'

const { abs, ceil, random, floor, round } = Math
const { isInteger } = Number
const { UTC } = Date

const lang: Natives = {

  Exception: {
    *initialize(self: RuntimeObject): Execution<void> {
      const stackTraceElements: RuntimeObject[] = []
      for(const frame of this.frameStack.slice(0, -1)){
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
      return yield* this.reify(self.module.fullyQualifiedName())
    },

    *className(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.module.fullyQualifiedName())
    },

    *generateDoesNotUnderstandMessage(_self: RuntimeObject, target: RuntimeObject, messageName: RuntimeObject, parametersSize: RuntimeObject): Execution<RuntimeValue> {
      target.assertIsString()
      messageName.assertIsString()
      parametersSize.assertIsNumber()

      const argsText = new Array(parametersSize.innerNumber).fill(null).map((_, i) => `arg ${i}`)
      const text = `${target.innerString} does not understand ${messageName.innerString}(${argsText})`

      return yield* this.reify(text)
    },

    *checkNotNull(_self: RuntimeObject, value: RuntimeObject, message: RuntimeObject): Execution<void> {
      message.assertIsString()

      if (value.innerValue === null) yield* this.send('error', value, message)
    },

  },


  Collection: {
    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
      for(const elem of [...self.innerCollection!])
        if((yield* this.send('apply', predicate, elem))!.innerBoolean) return elem

      return yield* this.send('apply', continuation)
    },
  },


  Set: {

    *anyOne(self: RuntimeObject): Execution<RuntimeValue> {
      const values = self.innerCollection!
      if(isEmpty(values)) throw new RangeError('anyOne')
      return values[floor(random() * values.length)]
    },

    *fold(self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      let acum = initialValue
      for(const elem of [...self.innerCollection!])
        acum = (yield* this.send('apply', closure, acum, elem))!

      return acum
    },

    *filter(self: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      const result: RuntimeObject[] = []
      for(const elem of [...self.innerCollection!])
        if((yield* this.send('apply', closure, elem))!.innerBoolean)
          result.push(elem)

      return yield* this.set(...result)
    },

    *max(self: RuntimeObject): Execution<RuntimeValue> {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('max', 0)!
      return yield* this.invoke(method, self)
    },

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
      for(const elem of [...self.innerCollection!])
        if((yield* this.send('apply', predicate, elem))!.innerBoolean!) return elem

      return yield* this.send('apply', continuation)
    },

    *add(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      if(!(yield* this.send('contains', self, element))!.innerBoolean!)
        yield* this.send('unsafeAdd', self, element)
    },

    *unsafeAdd(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      self.innerCollection!.push(element)
    },

    *remove(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      const values = self.innerCollection!
      const index = values.indexOf(element)
      if (index >= 0) values.splice(index, 1)
    },

    *size(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerCollection!.length)
    },

    *clear(self: RuntimeObject): Execution<void> {
      const values = self.innerCollection!
      values.splice(0, values.length)
    },

    *join(self: RuntimeObject, separator?: RuntimeObject): Execution<RuntimeValue> {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('join', separator ? 1 : 0)!
      return yield* this.invoke(method, self, ...separator ? [separator]: [])
    },

    *contains(self: RuntimeObject, value: RuntimeObject): Execution<RuntimeValue> {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('contains', 1)!
      return yield* this.invoke(method, self, value)
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
      index.assertIsNumber()

      const values = self.innerCollection!
      const indexValue = index.innerNumber

      if(indexValue < 0 || indexValue >= values.length) throw new RangeError('index')

      return values[round(indexValue)]
    },

    *sortBy(self: RuntimeObject, closure: RuntimeObject): Execution<void> {
      function*quickSort(this: Evaluation, list: List<RuntimeObject>): Generator<Node, List<RuntimeObject>> {
        if(list.length < 2) return [...list]

        const [head, ...tail] = list
        const before: RuntimeObject[] = []
        const after: RuntimeObject[] = []

        for(const elem of tail)
          if((yield* this.send('apply', closure, elem, head))!.innerBoolean)
            before.push(elem)
          else
            after.push(elem)

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
      const result: RuntimeObject[] = []
      for(const elem of [...self.innerCollection!])
        if((yield* this.send('apply', closure, elem))!.innerBoolean)
          result.push(elem)

      return yield* this.list(...result)
    },

    *contains(self: RuntimeObject, value: RuntimeObject): Execution<RuntimeValue> {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('contains', 1)!
      return yield* this.invoke(method, self, value)
    },

    *max(self: RuntimeObject): Execution<RuntimeValue> {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('max', 0)!
      return yield* this.invoke(method, self)
    },

    *fold(self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject): Execution<RuntimeValue> {
      let acum = initialValue
      for(const elem of [...self.innerCollection!])
        acum = (yield* this.send('apply', closure, acum, elem))!

      return acum
    },

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject): Execution<RuntimeValue> {
      for(const elem of [...self.innerCollection!])
        if((yield* this.send('apply', predicate, elem))!.innerBoolean) return elem

      return yield* this.send('apply', continuation)
    },

    *add(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      self.innerCollection!.push(element)
    },

    *remove(self: RuntimeObject, element: RuntimeObject): Execution<void> {
      const values = self.innerCollection!
      const index = values.indexOf(element)
      if (index >= 0) values.splice(index, 1)
    },

    *size(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(self.innerCollection!.length)
    },

    *clear(self: RuntimeObject): Execution<void> {
      const values = self.innerCollection!
      values.splice(0, values.length)
    },

    *join(self: RuntimeObject, separator?: RuntimeObject): Execution<RuntimeValue> {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('join', separator ? 1 : 0)!
      return yield* this.invoke(method, self, ...separator ? [separator]: [])
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
      key.assertIsNotNull()
      value.assertIsNotNull()

      const buckets = self.get('<buckets>')!.innerCollection!
      const index = hash(`${key.innerNumber ?? key.innerString ?? key.module.fullyQualifiedName()}`) % buckets.length
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
      const buckets = self.get('<buckets>')!.innerCollection!
      const index = hash(`${key.innerNumber ?? key.innerString ?? key.module.fullyQualifiedName()}`) % buckets.length
      const bucket = buckets[index].innerCollection!

      for (const entry of bucket) {
        const [entryKey, entryValue] = entry.innerCollection!
        if((yield* this.send('==', entryKey, key))!.innerBoolean) return entryValue
      }

      return yield* this.reify(null)
    },

    *remove(self: RuntimeObject, key: RuntimeObject): Execution<void> {
      const buckets = self.get('<buckets>')!.innerCollection!
      const index = hash(`${key.innerNumber ?? key.innerString ?? key.module.fullyQualifiedName()}`) % buckets.length
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
      const buckets = self.get('<buckets>')!.innerCollection!

      for (const bucket of buckets) {
        for (const entry of bucket.innerCollection!) {
          const [entryKey, entryValue] = entry.innerCollection!
          yield* this.send('apply', closure, entryKey, entryValue)
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
      if (self.innerNumber! < 0) throw new RangeError('self')

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
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! + other.innerNumber)
    },

    *['-'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! - other.innerNumber)
    },

    *['*'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! * other.innerNumber)
    },

    *['/'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      if (other.innerNumber === 0) throw new RangeError('other')

      return yield* this.reify(self.innerNumber! / other.innerNumber)
    },

    *['**'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! ** other.innerNumber)
    },

    *['%'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! % other.innerNumber)
    },

    *toString(this: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(`${self.innerNumber}`)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! > other.innerNumber)
    },

    *['<'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

      return yield* this.reify(self.innerNumber! < other.innerNumber)
    },

    *abs(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(abs(self.innerNumber!))
    },

    *invert(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(-self.innerNumber!)
    },

    *roundUp(self: RuntimeObject, decimals: RuntimeObject): Execution<RuntimeValue> {
      decimals.assertIsNumber()

      if (decimals.innerNumber! < 0) throw new RangeError('decimals')

      return yield* this.reify(ceil(self.innerNumber! * 10 ** decimals.innerNumber!) / 10 ** decimals.innerNumber!)
    },

    *truncate(self: RuntimeObject, decimals: RuntimeObject): Execution<RuntimeValue> {
      decimals.assertIsNumber()

      if (decimals.innerNumber < 0) throw new RangeError('decimals')

      const num = self.innerNumber!.toString()
      const decimalPosition = num.indexOf('.')
      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + decimals.innerNumber + 1)))
        : self
    },

    *randomUpTo(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()
      return yield* this.reify(random() * (other.innerNumber! - self.innerNumber!) + self.innerNumber!)
    },

    *round(self: RuntimeObject): Execution<RuntimeValue> {
      return yield* this.reify(round(self.innerNumber!))
    },

    *gcd(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsNumber()

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
      return yield* this.reify(self.innerString! + (yield * this.send('toString', other))!.innerString!)
    },

    *startsWith(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      return yield* this.reify(self.innerString!.startsWith(other.innerString))
    },

    *endsWith(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      return yield* this.reify(self.innerString!.endsWith(other.innerString))
    },

    *indexOf(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      const index = self.innerString!.indexOf(other.innerString)

      if (index < 0) throw new RangeError('other')
      return yield* this.reify(index)
    },

    *lastIndexOf(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      const index = self.innerString!.lastIndexOf(other.innerString)

      if (index < 0) throw new RangeError('other')
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

    *['<'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      return yield* this.reify(self.innerString! < other.innerString)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      return yield* this.reify(self.innerString! > other.innerString)
    },

    *contains(self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      other.assertIsString()

      return yield* this.reify(self.innerString!.indexOf(other.innerString) >= 0)
    },

    *substring(self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject): Execution<RuntimeValue> {
      startIndex.assertIsNumber()

      const start = startIndex.innerNumber
      const end = endIndex?.innerNumber

      if (start < 0) throw new RangeError('startIndex')
      if (endIndex && end === undefined || end !== undefined && end < 0) throw new RangeError('endIndex')

      return yield* this.reify(self.innerString!.substring(start, end))
    },

    *replace(self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject): Execution<RuntimeValue> {
      expression.assertIsString()
      replacement.assertIsString()
      return yield* this.reify(self.innerString!.replace(new RegExp(expression.innerString, 'g'), replacement.innerString))
    },

    *toString(self: RuntimeObject): Execution<RuntimeValue> {
      return self
    },

    *toSmartString(self: RuntimeObject): Execution<RuntimeValue> {
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

    *toSmartString(self: RuntimeObject): Execution<RuntimeValue> {
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
      const start = self.get('start')!.innerNumber!
      const end = self.get('end')!.innerNumber!
      const step = self.get('step')!.innerNumber!

      if (start <= end && step > 0)
        for (let value = start; value <= end; value += step)
          yield* this.send('apply', closure, yield* this.reify(value))

      if (start >= end && step < 0)
        for (let value = start; value >= end; value += step)
          yield* this.send('apply', closure, yield* this.reify(value))
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
      args.assertIsCollection()

      try {
        self.set('self', self.parentContext?.get('self'))
        return yield* this.send('<apply>', self, ...args.innerCollection)
      } finally {
        self.set('self', self)
      }
    },

    *toString(this: Evaluation, self: RuntimeObject): Execution<RuntimeValue> {
      return self.get('<toString>') ?? (yield* this.reify(`${self.module.fullyQualifiedName()}#${self.id}`))
    },

  },

  calendar: {
    *today(_self: RuntimeObject): Execution<RuntimeObject> {
      const today = new Date()
      return yield* this.instantiate('wollok.lang.Date', {
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
      days.assertIsNumber()

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
      days.assertIsNumber()

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
      months.assertIsNumber()

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
      months.assertIsNumber()

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
      years.assertIsNumber()

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
      years.assertIsNumber()

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

    *['-'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay = self.get('day')!.innerNumber!
      const ownMonth = self.get('month')!.innerNumber! - 1
      const ownYear = self.get('year')!.innerNumber!

      const otherDay = other.get('day')!.innerNumber!
      const otherMonth = other.get('month')!.innerNumber! - 1
      const otherYear = other.get('year')!.innerNumber!

      const msPerDay = 1000 * 60 * 60 * 24
      const ownUTC = UTC(ownYear, ownMonth, ownDay)
      const otherUTC = UTC(otherYear, otherMonth, otherDay)

      return yield* this.reify(floor((ownUTC - otherUTC) / msPerDay))
    },

    *['<'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay = self.get('day')!.innerNumber!
      const ownMonth = self.get('month')!.innerNumber! - 1
      const ownYear = self.get('year')!.innerNumber!

      const otherDay = other.get('day')!.innerNumber!
      const otherMonth = other.get('month')!.innerNumber! - 1
      const otherYear = other.get('year')!.innerNumber!

      const value = new Date(ownYear, ownMonth, ownDay)
      const otherValue = new Date(otherYear, otherMonth, otherDay)

      return yield* this.reify(value < otherValue)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject): Execution<RuntimeValue> {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay = self.get('day')!.innerNumber!
      const ownMonth = self.get('month')!.innerNumber! - 1
      const ownYear = self.get('year')!.innerNumber!

      const otherDay = other.get('day')!.innerNumber!
      const otherMonth = other.get('month')!.innerNumber! - 1
      const otherYear = other.get('year')!.innerNumber!

      const value = new Date(ownYear, ownMonth, ownDay)
      const otherValue = new Date(otherYear, otherMonth, otherDay)

      return yield* this.reify(value > otherValue)
    },

  },

}

export default lang