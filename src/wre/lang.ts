/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Natives, Runner, RuntimeObject } from '../interpreter/runtimeModel'
import { Class, List, Node } from '../model'

const { abs, ceil, random, floor } = Math
const { UTC } = Date

const lang: Natives = {

  Exception: {
    // TODO: Pending Implementation
    // *getFullStackTrace(_self: RuntimeObject) { },

    // TODO:
    // *getStackTrace(_self: RuntimeObject) { },
  },


  Object: {

    *identity(self: RuntimeObject) {
      return yield* this.reify(self.id)
    },

    // TODO: Pending Implementation
    // *instanceVariables(self: RuntimeObject) { },

    // TODO: Pending Implementation
    // *instanceVariableFor(self: RuntimeObject, name: RuntimeObject) { }

    // TODO: Pending Implementation
    // *resolve(self: RuntimeObject, name: RuntimeObject) { },

    *kindName(self: RuntimeObject) {
      return yield* this.reify(self.module.fullyQualifiedName())
    },

    *className(self: RuntimeObject) {
      return yield* this.reify(self.module.fullyQualifiedName())
    },

    *generateDoesNotUnderstandMessage(_self: RuntimeObject, target: RuntimeObject, messageName: RuntimeObject, parametersSize: RuntimeObject) {
      target.assertIsString()
      messageName.assertIsString()
      parametersSize.assertIsNumber()

      const argsText = new Array(parametersSize.innerValue).fill(null).map((_, i) => `arg ${i}`)
      const text = `${target.innerValue} does not undersand ${messageName.innerValue}(${argsText})`

      return yield* this.reify(text)
    },

    *checkNotNull(_self: RuntimeObject, value: RuntimeObject, message: RuntimeObject) {
      message.assertIsString()

      if (value === (yield * this.reify(null))) throw new TypeError(message.innerValue)
      return undefined
    },

  },


  Collection: {
    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) {
      self.assertIsCollection()

      for(const elem of [...self.innerValue])
        if((yield* this.invoke('apply', predicate, elem))!.innerValue) return elem

      return yield* this.invoke('apply', continuation)
    },
  },


  Set: {

    *anyOne(self: RuntimeObject) {
      self.assertIsCollection()

      if(self.innerValue.length === 0) throw new RangeError('anyOne')

      return self.innerValue[floor(random() * self.innerValue.length)]
    },

    *fold(self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) {
      self.assertIsCollection()

      let acum = initialValue
      for(const elem of [...self.innerValue])
        acum = (yield* this.invoke('apply', closure, acum, elem))!

      return acum
    },

    *filter(self: RuntimeObject, closure: RuntimeObject) {
      self.assertIsCollection()

      const result: RuntimeObject[] = []
      for(const elem of [...self.innerValue])
        if((yield* this.invoke('apply', closure, elem))!.innerValue)
          result.push(elem)

      return yield* this.set(result)
    },

    *max(self: RuntimeObject) {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('max', 0)!
      return yield* this.invoke(method, self)
    },

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) {
      self.assertIsCollection()

      for(const elem of [...self.innerValue])
        if((yield* this.invoke('apply', predicate, elem))!.innerValue) return elem

      return yield* this.invoke('apply', continuation)
    },

    *add(self: RuntimeObject, element: RuntimeObject) {
      if(!(yield* this.invoke('contains', self, element))!.innerValue)
        return yield* this.invoke('unsafeAdd', self, element)

      return undefined
    },

    *unsafeAdd(self: RuntimeObject, element: RuntimeObject) {
      self.assertIsCollection()

      self.innerValue.push(element)
      return undefined
    },

    *remove(self: RuntimeObject, element: RuntimeObject) {
      self.assertIsCollection()

      const index = self.innerValue.indexOf(element)
      if (index >= 0) self.innerValue.splice(index, 1)

      return undefined
    },

    *size(self: RuntimeObject) {
      self.assertIsCollection()

      return yield* this.reify(self.innerValue.length)
    },

    *clear(self: RuntimeObject) {
      self.assertIsCollection()

      self.innerValue.splice(0, self.innerValue.length)
      return undefined
    },

    *join(self: RuntimeObject, separator?: RuntimeObject) {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('join', separator ? 1 : 0)
      return yield* this.invoke(method, self, ...separator ? [separator]: [])
    },

    *contains(self: RuntimeObject, value: RuntimeObject) {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('contains', 1)!
      return yield* this.invoke(method, self, value)
    },

    *['=='](self: RuntimeObject, other: RuntimeObject) {
      if (self.module !== other.module) return yield* this.reify(false)

      self.assertIsCollection()
      other.assertIsCollection()

      if (self.innerValue.length !== other.innerValue.length) return yield* this.reify(false)

      for(const elem of [...self.innerValue])
        if(!(yield* this.invoke('contains', other, elem))!.innerValue)
          return yield* this.reify(false)

      return yield* this.reify(true)
    },
  },


  List: {

    *get(self: RuntimeObject, index: RuntimeObject) {
      self.assertIsCollection()
      index.assertIsNumber()

      if(index.innerValue < 0 || index.innerValue >= self.innerValue.length) throw new RangeError('index')

      return self.innerValue[index.innerValue]
    },

    *sortBy(self: RuntimeObject, closure: RuntimeObject) {
      function* quickSort(this: Runner, list: List<RuntimeObject>): Generator<Node, List<RuntimeObject>> {
        if(list.length < 2) return [...list]

        const [head, ...tail] = list
        const before: RuntimeObject[] = []
        const after: RuntimeObject[] = []

        for(const elem of tail)
          if((yield* this.invoke('apply', closure, elem, head))!.innerValue)
            before.push(elem)
          else
            after.push(elem)

        const sortedBefore = yield* quickSort.bind(this)(before)
        const sortedAfter = yield* quickSort.bind(this)(after)

        return [...sortedBefore, head, ...sortedAfter]
      }

      self.assertIsCollection()

      const sorted = yield* quickSort.bind(this)(self.innerValue)

      self.innerValue.splice(0, self.innerValue.length)
      self.innerValue.push(...sorted)

      return undefined
    },

    *filter(self: RuntimeObject, closure: RuntimeObject) {
      self.assertIsCollection()

      const result: RuntimeObject[] = []
      for(const elem of [...self.innerValue])
        if((yield* this.invoke('apply', closure, elem))!.innerValue)
          result.push(elem)

      return yield* this.list(result)
    },

    *contains(self: RuntimeObject, value: RuntimeObject) {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('contains', 1)!
      return yield* this.invoke(method, self, value)
    },

    *max(self: RuntimeObject) {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('max', 0)!
      return yield* this.invoke(method, self)
    },

    *fold(self: RuntimeObject, initialValue: RuntimeObject, closure: RuntimeObject) {
      self.assertIsCollection()

      let acum = initialValue
      for(const elem of [...self.innerValue])
        acum = (yield* this.invoke('apply', closure, acum, elem))!

      return acum
    },

    *findOrElse(self: RuntimeObject, predicate: RuntimeObject, continuation: RuntimeObject) {
      self.assertIsCollection()

      for(const elem of [...self.innerValue])
        if((yield* this.invoke('apply', predicate, elem))!.innerValue) return elem

      return yield* this.invoke('apply', continuation)
    },

    *add(self: RuntimeObject, element: RuntimeObject) {
      self.assertIsCollection()

      self.innerValue.push(element)
      return undefined
    },

    *remove(self: RuntimeObject, element: RuntimeObject) {
      self.assertIsCollection()

      const index = self.innerValue.indexOf(element)
      if (index >= 0) self.innerValue.splice(index, 1)

      return undefined
    },

    *size(self: RuntimeObject) {
      self.assertIsCollection()

      return yield* this.reify(self.innerValue.length)
    },

    *clear(self: RuntimeObject) {
      self.assertIsCollection()

      self.innerValue.splice(0, self.innerValue.length)
      return undefined
    },

    *join(self: RuntimeObject, separator?: RuntimeObject) {
      const method = this.environment.getNodeByFQN<Class>('wollok.lang.Collection').lookupMethod('join', separator ? 1 : 0)
      return yield* this.invoke(method, self, ...separator ? [separator]: [])
    },

    *['=='](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsCollection()

      if (self.module !== other.module) return yield* this.reify(false)

      other.assertIsCollection()

      if (self.innerValue.length !== other.innerValue.length) return yield* this.reify(false)

      for(let index = 0; index < self.innerValue.length; index++)
        if(!(yield* this.invoke('==', self.innerValue[index], other.innerValue[index]))!.innerValue)
          return yield* this.reify(false)

      return yield* this.reify(true)
    },

    *withoutDuplicates(self: RuntimeObject) {
      self.assertIsCollection()

      const result: RuntimeObject[] = []
      for(const elem of [...self.innerValue]) {
        let alreadyIncluded = false
        for(const included of result)
          if((yield* this.invoke('==', elem, included))!.innerValue) {
            alreadyIncluded = true
            break
          }
        if(!alreadyIncluded) result.push(elem)
      }

      return yield* this.list(result)
    },
  },

  Dictionary: {

    *initialize(self: RuntimeObject) {
      return yield* this.invoke('clear', self)
    },

    *put(self: RuntimeObject, key: RuntimeObject, value: RuntimeObject) {
      if (key === (yield* this.reify(null))) throw new TypeError('key') // TODO: null as inner value to avoid these checks
      if (value === (yield* this.reify(null))) throw new TypeError('value')

      yield* this.invoke('remove', self, key)

      const keys: RuntimeObject = self.get('<keys>')!
      keys.assertIsCollection()

      const values: RuntimeObject = self.get('<values>')!
      values.assertIsCollection()

      keys.innerValue.push(key)
      values.innerValue.push(value)

      return undefined
    },

    *basicGet(self: RuntimeObject, key: RuntimeObject) {
      const keys: RuntimeObject = self.get('<keys>')!
      keys.assertIsCollection()

      const values: RuntimeObject = self.get('<values>')!
      values.assertIsCollection()

      for(let index = 0; index < keys.innerValue.length; index++)
        if((yield* this.invoke('==', keys.innerValue[index], key))?.innerValue) {
          return values.innerValue[index]
        }

      return yield* this.reify(null)
    },

    *remove(self: RuntimeObject, key: RuntimeObject) {
      const keys: RuntimeObject = self.get('<keys>')!
      keys.assertIsCollection()

      const values: RuntimeObject = self.get('<values>')!
      values.assertIsCollection()

      const updatedKeys: RuntimeObject[] = []
      const updatedValues: RuntimeObject[] = []
      for(let index = 0; index < keys.innerValue.length; index++)
        if(!(yield* this.invoke('==', keys.innerValue[index], key))?.innerValue) {
          updatedKeys.push(keys.innerValue[index])
          updatedValues.push(values.innerValue[index])
        }

      self.set('<keys>', yield* this.list(updatedKeys))
      self.set('<values>', yield* this.list(updatedValues))

      return undefined
    },

    *keys(self: RuntimeObject) {
      return self.get('<keys>')
    },

    *values(self: RuntimeObject) {
      return self.get('<values>')
    },

    *forEach(self: RuntimeObject, closure: RuntimeObject) {
      const keys: RuntimeObject = self.get('<keys>')!
      keys.assertIsCollection()

      const values: RuntimeObject = self.get('<values>')!
      values.assertIsCollection()

      for(let index = 0; index < keys.innerValue.length; index++)
        yield* this.invoke('apply', closure, keys.innerValue[index], values.innerValue[index])

      return undefined
    },

    *clear(self: RuntimeObject) {
      self.set('<keys>', yield* this.list([]))
      self.set('<values>', yield* this.list([]))

      return undefined
    },

  },

  Number: {

    *coerceToInteger(self: RuntimeObject) {
      self.assertIsNumber()

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')

      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + 1)))
        : self
    },

    *coerceToPositiveInteger(self: RuntimeObject) {
      self.assertIsNumber()

      if (self.innerValue < 0) throw new RangeError('self')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')
      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + 1)))
        : self
    },

    *['==='](self: RuntimeObject, other?: RuntimeObject) {
      self.assertIsNumber()

      return yield* this.reify(self.innerValue === other?.innerValue)
    },

    *['+'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue + other.innerValue)
    },

    *['-'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue - other.innerValue)
    },

    *['*'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue * other.innerValue)
    },

    *['/'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      if (other.innerValue === 0) throw new RangeError('other')

      return yield* this.reify(self.innerValue / other.innerValue)
    },

    *['**'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue ** other.innerValue)
    },

    *['%'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue % other.innerValue)
    },

    *toString(this: Runner, self: RuntimeObject) {
      self.assertIsNumber()

      return yield* this.reify(`${self.innerValue}`)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue > other.innerValue)
    },

    *['<'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(self.innerValue < other.innerValue)
    },

    *abs(self: RuntimeObject) {
      self.assertIsNumber()

      return yield* this.reify(abs(self.innerValue))
    },

    *invert(self: RuntimeObject) {
      self.assertIsNumber()

      return yield* this.reify(-self.innerValue)
    },

    *roundUp(self: RuntimeObject, decimals: RuntimeObject) {
      self.assertIsNumber()
      decimals.assertIsNumber()
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      return yield* this.reify(ceil(self.innerValue * 10 ** decimals.innerValue) / 10 ** decimals.innerValue)
    },

    *truncate(self: RuntimeObject, decimals: RuntimeObject) {
      self.assertIsNumber()
      decimals.assertIsNumber()
      if (decimals.innerValue < 0) throw new RangeError('decimals')

      const num = self.innerValue.toString()
      const decimalPosition = num.indexOf('.')
      return decimalPosition >= 0
        ? yield* this.reify(Number(num.slice(0, decimalPosition + decimals.innerValue + 1)))
        : self
    },

    *randomUpTo(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      return yield* this.reify(random() * (other.innerValue - self.innerValue) + self.innerValue)
    },

    *gcd(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsNumber()
      other.assertIsNumber()

      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)

      return yield* this.reify(gcd(self.innerValue, other.innerValue))
    },

    *isInteger(self: RuntimeObject) {
      self.assertIsNumber()

      return yield* this.reify(self.innerValue % 1 === 0)
    },

  },


  String: {

    *length(self: RuntimeObject) {
      self.assertIsString()

      return yield* this.reify(self.innerValue.length)
    },

    *concat(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()

      return yield* this.reify(self.innerValue + other.innerValue)
    },

    *startsWith(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      return yield* this.reify(self.innerValue.startsWith(other.innerValue))
    },

    *endsWith(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      return yield* this.reify(self.innerValue.endsWith(other.innerValue))
    },

    *indexOf(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      const index = self.innerValue.indexOf(other.innerValue)

      if (index < 0) throw new RangeError('other')
      return yield* this.reify(index)
    },

    *lastIndexOf(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      const index = self.innerValue.lastIndexOf(other.innerValue)

      if (index < 0) throw new RangeError('other')
      return yield* this.reify(index)
    },

    *toLowerCase(self: RuntimeObject) {
      self.assertIsString()

      return yield* this.reify(self.innerValue.toLowerCase())
    },

    *toUpperCase(self: RuntimeObject) {
      self.assertIsString()

      return yield* this.reify(self.innerValue.toUpperCase())
    },

    *trim(self: RuntimeObject) {
      self.assertIsString()

      return yield* this.reify(self.innerValue.trim())
    },

    *reverse(self: RuntimeObject) {
      self.assertIsString()

      return yield* this.reify(self.innerValue.split('').reverse().join(''))
    },

    *['<'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      return yield* this.reify(self.innerValue < other.innerValue)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      return yield* this.reify(self.innerValue > other.innerValue)
    },

    *contains(self: RuntimeObject, other: RuntimeObject) {
      self.assertIsString()
      other.assertIsString()

      return yield* this.reify(self.innerValue.indexOf(other.innerValue) >= 0)
    },

    *substring(self: RuntimeObject, startIndex: RuntimeObject, endIndex?: RuntimeObject) {
      self.assertIsString()
      startIndex.assertIsNumber()

      if (startIndex.innerValue < 0) throw new RangeError('startIndex')

      let endIndexValue: number | undefined
      if (endIndex) {
        const endIndexInstance: RuntimeObject = endIndex
        endIndexInstance.assertIsNumber()
        if (endIndexInstance.innerValue < 0) throw new RangeError('endIndex')
        endIndexValue = endIndexInstance.innerValue
      }

      return yield* this.reify(self.innerValue.substring(startIndex.innerValue, endIndexValue))
    },

    *replace(self: RuntimeObject, expression: RuntimeObject, replacement: RuntimeObject) {
      self.assertIsString()
      expression.assertIsString()
      replacement.assertIsString()

      return yield* this.reify(self.innerValue.replace(new RegExp(expression.innerValue, 'g'), replacement.innerValue))
    },

    *toString(self: RuntimeObject) {
      return self
    },

    *toSmartString(self: RuntimeObject) {
      return self
    },

    *['=='](self: RuntimeObject, other: RuntimeObject) {
      return yield* this.reify(self.innerValue === other.innerValue)
    },
  },

  Boolean: {
    *['&&'](self: RuntimeObject, closure: RuntimeObject) {
      if(!self.innerValue) return self
      return yield* this.invoke('apply', closure)
    },

    *and(self: RuntimeObject, closure: RuntimeObject) {
      return yield* this.invoke('&&', self, closure)
    },

    *['||'](self: RuntimeObject, closure: RuntimeObject) {
      if(self.innerValue) return self
      return yield* this.invoke('apply', closure)
    },

    *or(self: RuntimeObject, closure: RuntimeObject) {
      return yield* this.invoke('||', self, closure)
    },

    *toString(this: Runner, self: RuntimeObject) {
      return yield* this.reify(`${self.innerValue}`)
    },

    *toSmartString(self: RuntimeObject) {
      return yield* this.reify(`${self.innerValue}`)
    },

    *['=='](self: RuntimeObject, other: RuntimeObject) {
      return yield* this.reify(self === other)
    },

    *negate(self: RuntimeObject) {
      return yield* this.reify(!self.innerValue)
    },
  },

  Range: {

    *forEach(self: RuntimeObject, closure: RuntimeObject) {
      const start: RuntimeObject = self.get('start')!
      start.assertIsNumber()

      const end: RuntimeObject = self.get('end')!
      end.assertIsNumber()

      const step: RuntimeObject = self.get('step')!
      step.assertIsNumber()

      const values: RuntimeObject[] = []

      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue)
          values.push(yield* this.reify(i))

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue)
          values.push(yield* this.reify(i))

      for(const value of values)
        yield* this.invoke('apply', closure, value)

      return undefined
    },

    *anyOne(self: RuntimeObject) {
      const start: RuntimeObject = self.get('start')!
      start.assertIsNumber()

      const end: RuntimeObject = self.get('end')!
      end.assertIsNumber()

      const step: RuntimeObject = self.get('step')!
      step.assertIsNumber()

      const values: RuntimeObject[] = []

      if (start.innerValue <= end.innerValue && step.innerValue > 0)
        for (let i = start.innerValue; i <= end.innerValue; i += step.innerValue)
          values.push(yield* this.reify(i))

      if (start.innerValue >= end.innerValue && step.innerValue < 0)
        for (let i = start.innerValue; i >= end.innerValue; i += step.innerValue)
          values.push(yield* this.reify(i))

      return values[floor(random() * values.length)]
    },

  },

  Closure: {

    *apply(self: RuntimeObject, ...args: RuntimeObject[]) {
      try {
        self.set('self', self.parentContext?.get('self'))
        return yield* this.invoke('<apply>', self, ...args)
      } finally {
        self.set('self', self)
      }
    },

    *toString(this: Runner, self: RuntimeObject) {
      return self.get('<toString>') ?? (yield* this.reify(`${self.module.fullyQualifiedName()}#${self.id}`))
    },

  },

  Date: {

    *initialize(self: RuntimeObject) {
      const day = self.get('day')
      const month = self.get('month')
      const year = self.get('year')

      const today = new Date()

      if (!day || day === (yield* this.reify(null))) self.set('day', yield* this.reify(today.getDate()))
      if (!month || month === (yield* this.reify(null))) self.set('month', yield* this.reify(today.getMonth() + 1))
      if (!year || year === (yield* this.reify(null))) self.set('year', yield* this.reify(today.getFullYear()))

      return undefined
    },

    *shortDescription(self: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      return yield* this.reify(`${month.innerValue}/${day.innerValue}/${year.innerValue}`)
    },

    *isLeapYear(self: RuntimeObject) {
      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      const value = new Date(year.innerValue, 1, 29)

      return yield* this.reify(value.getDate() === 29)
    },

    *internalDayOfWeek(self: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue)

      return yield* this.reify(value.getDay() == 0 ? 7 : value.getDay())
    },

    *plusDays(self: RuntimeObject, days: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      days.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue + floor(days.innerValue))

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *minusDays(self: RuntimeObject, days: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      days.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1, day.innerValue - floor(days.innerValue))

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *plusMonths(self: RuntimeObject, months: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      months.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1 + floor(months.innerValue), day.innerValue)
      while (months.innerValue > 0 && value.getMonth() > (month.innerValue - 1 + months.innerValue) % 12)
        value.setDate(value.getDate() - 1)

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *minusMonths(self: RuntimeObject, months: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      months.assertIsNumber()

      const value = new Date(year.innerValue, month.innerValue - 1 - floor(months.innerValue), day.innerValue)

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *plusYears(self: RuntimeObject, years: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      years.assertIsNumber()

      const value = new Date(year.innerValue + floor(years.innerValue), month.innerValue - 1, day.innerValue)
      if (years.innerValue > 0 && value.getDate() !== day.innerValue) {
        value.setDate(value.getDate() - 1)
      }

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *minusYears(self: RuntimeObject, years: RuntimeObject) {
      const day: RuntimeObject = self.get('day')!
      day.assertIsNumber()

      const month: RuntimeObject = self.get('month')!
      month.assertIsNumber()

      const year: RuntimeObject = self.get('year')!
      year.assertIsNumber()

      years.assertIsNumber()

      const value = new Date(year.innerValue - floor(years.innerValue), month.innerValue - 1, day.innerValue)
      if (years.innerValue > 0 && value.getDate() !== day.innerValue) {
        value.setDate(value.getDate() - 1)
      }

      return yield* this.instantiate(self.module, {
        day: yield* this.reify(value.getDate()),
        month: yield* this.reify(value.getMonth() + 1),
        year: yield* this.reify(value.getFullYear()),
      })
    },

    *['=='](self: RuntimeObject, other: RuntimeObject) {
      return yield* this.reify(
        self.module === other.module &&
        self.get('day') === other.get('day') &&
        self.get('month') === other.get('month') &&
        self.get('year') === other.get('year')
      )
    },

    *['-'](self: RuntimeObject, other: RuntimeObject) {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay: RuntimeObject = self.get('day')!
      ownDay.assertIsNumber()

      const ownMonth: RuntimeObject = self.get('month')!
      ownMonth.assertIsNumber()

      const ownYear: RuntimeObject = self.get('year')!
      ownYear.assertIsNumber()

      const otherDay: RuntimeObject = other.get('day')!
      otherDay.assertIsNumber()

      const otherMonth: RuntimeObject = other.get('month')!
      otherMonth.assertIsNumber()

      const otherYear: RuntimeObject = other.get('year')!
      otherYear.assertIsNumber()

      const msPerDay = 1000 * 60 * 60 * 24
      const ownUTC = UTC(ownYear.innerValue, ownMonth.innerValue - 1, ownDay.innerValue)
      const otherUTC = UTC(otherYear.innerValue, otherMonth.innerValue - 1, otherDay.innerValue)
      return yield* this.reify(floor((ownUTC - otherUTC) / msPerDay))
    },

    *['<'](self: RuntimeObject, other: RuntimeObject) {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay: RuntimeObject = self.get('day')!
      ownDay.assertIsNumber()

      const ownMonth: RuntimeObject = self.get('month')!
      ownMonth.assertIsNumber()

      const ownYear: RuntimeObject = self.get('year')!
      ownYear.assertIsNumber()

      const otherDay: RuntimeObject = other.get('day')!
      otherDay.assertIsNumber()

      const otherMonth: RuntimeObject = other.get('month')!
      otherMonth.assertIsNumber()

      const otherYear: RuntimeObject = other.get('year')!
      otherYear.assertIsNumber()

      const value = new Date(ownYear.innerValue, ownMonth.innerValue - 1, ownDay.innerValue)
      const otherValue = new Date(otherYear.innerValue, otherMonth.innerValue - 1, otherDay.innerValue)

      return yield* this.reify(value < otherValue)
    },

    *['>'](self: RuntimeObject, other: RuntimeObject) {
      if (other.module !== self.module) throw new TypeError('other')

      const ownDay: RuntimeObject = self.get('day')!
      ownDay.assertIsNumber()

      const ownMonth: RuntimeObject = self.get('month')!
      ownMonth.assertIsNumber()

      const ownYear: RuntimeObject = self.get('year')!
      ownYear.assertIsNumber()

      const otherDay: RuntimeObject = other.get('day')!
      otherDay.assertIsNumber()

      const otherMonth: RuntimeObject = other.get('month')!
      otherMonth.assertIsNumber()

      const otherYear: RuntimeObject = other.get('year')!
      otherYear.assertIsNumber()

      const value = new Date(ownYear.innerValue, ownMonth.innerValue - 1, ownDay.innerValue)
      const otherValue = new Date(otherYear.innerValue, otherMonth.innerValue - 1, otherDay.innerValue)

      return yield* this.reify(value > otherValue)
    },

  },

}

export default lang