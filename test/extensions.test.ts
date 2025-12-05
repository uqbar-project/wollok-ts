import { fail } from 'assert'
import { describe, it, expect } from 'vitest'
import { InstanceOf, is, match, Mixable, MixinDefinition, MIXINS, valueAsListOrEmpty, when } from '../src/extensions'

const mixinOf = <T extends object>(S: Mixable<T>) => (M: MixinDefinition<T>): Mixable<T> => {
  return class extends S {
    static [MIXINS] = [M, ...S[MIXINS] ?? []]
  }
}

describe('extensions', () => {

  class A { a(){ return 'a' } }
  class B { b(){ return 'b' } }
  class C { c(){ return 'c' } }

  type M = InstanceOf<typeof M>
  function M(S: Mixable<C>) {
    return class extends mixinOf(S)(M) {
      m(){ return 'm' }
    }
  }

  type N = InstanceOf<typeof N>
  function N(S: Mixable<C>) {
    return class extends mixinOf(S)(N) {
      n(){ return 'n' }
    }
  }

  type O = InstanceOf<typeof N>
  function O(S: Mixable<C>) {
    return class extends mixinOf(S)(O) {
      o(){ return 'o' }
    }
  }

  describe('is', () => {

    it('identifies instances of classes', () => {
      const anA = new A() as A | B

      if (is(A)(anA)) {
        expect(anA.a()).toBe('a')
      } else {
        expect(anA.b()).toBe('b')
        fail('value is not of type B')
      }
    })

    it('identifies instances of mixins', () => {
      const anM = new (M(C))() as M | N

      if(is(M)(anM)) {
        expect(anM.m()).toBe('m')
        if(is(C)(anM)) {
          expect(anM.c()).toBe('c')
        } else fail('value is instance of C')
      } else {
        expect(anM.n()).toBe('n')
        fail('value is not of type N')
      }
    })

  })

  describe('match', () => {

    it('chooses the matching path from a class-based configuration', () => {
      const anA = new A() as A | B

      const s: string = match(anA)(
        [A, a => a.a()],
        [B, b => b.b()],
      )

      expect(s).toBe('a')
    })

    it('chooses the matching path from a mixin-based configuration', () => {
      const anM = new (O(M(C)))() as unknown as  M | N | O

      const s: string = match(anM)(
        [M, m => m.m()],
        [N, n => n.n()],
      )

      expect(s).toBe('m')
    })

    it('chooses the first matching definition', () => {
      const anM = new (M(N(C)))() as M | N

      const s: string = match(anM)(
        [M, m => m.m()],
        [N, n => n.n()],
        [C, c => c.c()],
      )

      expect(s).toBe('m')
    })

    it('fails if no matching definition is found', () => {
      const anA = new A() as A | B

      expect(() => match(anA)(
        [B, b => b.b()],
      )).to.throw()
    })

    it('can interop with the when function', () => {
      const anA = new A() as A | B

      const s: string = match(anA)(
        when(A)(a => a.a()),
        when(B)(b => b.b()),
      )

      expect(s).toBe('a')
    })

  })

  describe('valuesAsList', () => {

    it('returns empty list if value is falsy', () => {
      expect(valueAsListOrEmpty<string | undefined>(undefined)).toEqual([])
      expect(valueAsListOrEmpty<string | null>(null)).toEqual([])
    })

    it('returns a list with a value if value is truthy', () => {
      expect(valueAsListOrEmpty<number | undefined>(1)).toEqual([1])
    })

  })
})