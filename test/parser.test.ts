import { should, use } from 'chai'
import Parse from '../src/parser'
import { parserAssertions } from './assertions'
import { Field, Literal, Method, New, Parameter, Reference, Singleton } from './builders'

use(parserAssertions)
should()

describe('Wollok parser', () => {

  
  describe('Literals', () => {
    const parser = Parse.Literal

    describe('Booleans', () => {

      it('should parse "true"', () => {
        'true'.should.be.parsedBy(parser).into(Literal(true)).and.be.tracedTo(0, 4)
      })

      it('should parse "false"', () => {
        'false'.should.be.parsedBy(parser).into(Literal(false)).and.be.tracedTo(0, 5)
      })

    })

    describe('Null', () => {

      it('should parse "null"', () => {
        'null'.should.be.parsedBy(parser).into(Literal(null)
        ).and.be.tracedTo(0, 4)
      })

    })

    describe('Numbers', () => {

      it('should parse positive whole numbers', () => {
        '10'.should.be.parsedBy(parser).into(Literal(10)).and.be.tracedTo(0, 2)
      })

      it('should parse negative whole numbers', () => {
        '-1'.should.be.parsedBy(parser).into(Literal(-1)).and.be.tracedTo(0, 2)
      })

      it('should parse fractional numbers', () => {
        '1.5'.should.be.parsedBy(parser).into(Literal(1.5)).and.be.tracedTo(0, 3)
      })

      it('should parse negative fractional numbers', () => {
        '-1.5'.should.be.parsedBy(parser).into(Literal(-1.5)).and.be.tracedTo(0, 4)
      })

      it('should not parse fractional numbers without decimal part', () => {
        '1.'.should.not.be.parsedBy(parser)
      })

      it('should not parse fractional numbers without whole part', () => {
        '.5'.should.not.be.parsedBy(parser)
      })

    })

    describe('Strings', () => {

      it('should parse valid strings', () => {
        '"foo"'.should.be.parsedBy(parser).into(Literal('foo')).and.be.tracedTo(0, 5)
      })

      it('should parse empty strings', () => {
        '""'.should.be.parsedBy(parser).into(Literal('')).and.be.tracedTo(0, 2)
      })
      it('should parse strings with escape sequences', () => {
        '"foo\nbar"'.should.be.parsedBy(parser).into(Literal('foo\nbar')).and.be.tracedTo(0, 9)
      })

      it('should parse strings with the escaped escape character without escaping the whole sequence', () => {
        '"foo\\nbar"'.should.be.parsedBy(parser).into(Literal('foo\\nbar')).and.be.tracedTo(0, 10)
      })

      it('should not parse strings with invalid escape sequences', () => {
        '"foo\xbar"'.should.not.be.parsedBy(parser)/*
        '"foo\xbar"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 'foo',
        }).and.be.tracedTo(0, 10)*/
      })

    })

    describe('Collections', () => {

      it('should parse empty lists', () => {
        '[]'.should.be.parsedBy(parser).into(
          Literal(
            New(
              Reference('wollok.List'),
              [Reference('')]
            )
          )
        ).and.be.tracedTo(0, 2)
      })

      it('should parse non-empty lists', () => {
        '[1,2,3]'.should.be.parsedBy(parser).into(
          Literal(
            New(
              Reference('wollok.List'), [Literal(1), Literal(2), Literal(3)]
            )
          )
        ).and.be.tracedTo(0, 7)
      })

      it('should parse empty sets', () => {
        '#{}'.should.be.parsedBy(parser).into(
          Literal(
            New(
              Reference('wollok.Set'), [Reference('')]
            )
          )
        ).and.be.tracedTo(0, 3)
      })

      it('should parse non-empty sets', () => {
        '#{1,2,3}'.should.be.parsedBy(parser).into(
          Literal(
            New(Reference('wollok.Set'), [Literal(1), Literal(2), Literal(3)])
          )
        ).and.be.tracedTo(0, 8)
      })

    })

    describe('Objects', () => {

      it('should parse empty literal objects', () => {
        'object {}'.should.be.parsedBy(parser).into(
          Literal(Singleton()())
        ).and.be.tracedTo(0, 8)
      })

      it('should parse non empty literal objects', () => {
        'object { var v; method m(){} }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton()(
              Field('v'), Method('m')()
            )
          )
        ).and.be.tracedTo(0, 26)
      })

      it('should parse literal objects that inherit from a class', () => {
        'object inherits D {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton()()
          )
        ).and.be.tracedTo(0, 20)
      })
      it('should parse literal objects that inherit from a class with explicit builders', () => {
        'object inherits D(5) {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [] },

            })()
          )
        ).and.be.tracedTo(0, 23)
      })

      it('should parse literal objects that inherit from a class and have a mixin', () => {
        'object inherits D mixed with M {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [] },
              mixins: [Reference('M')],
            })()
          )
        ).and.be.tracedTo(0, 33)
      })
      it('should parse literal objects that inherit from a class and have multiple mixins', () => {
        'object inherits D mixed with M and N {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [] },
              mixins: [Reference('M'), Reference('N')],
            })()
          )
        ).and.be.tracedTo(0, 39)
      })
      it('should parse literal objects that have multiple mixins', () => {
        'object mixed with M and N {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              mixins: [Reference('M'), Reference('N')],
            })()
          )
        ).and.be.tracedTo(0, 28)
      })

      it('should not parse literal objects with a constructor"', () => {
        'object { constructor(){} }'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "object" keyword without a body', () => {
        'object'.should.not.be.parsedBy(parser)
      })

      it('should not parse objects that inherit from more than one class', () => {
        'object inherits D inherits E'.should.not.be.parsedBy(parser)
      })

      it('should not parse objects that use the "inherits" keyword without a superclass', () => {
        'object inherits {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "object inherits" keyword sequence without a body and superclass', () => {
        'object inherits'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "mixed with" keyword without a mixin', () => {
        'object mixed with {}'.should.not.be.parsedBy(parser)
      })
      it('should not parse the "object mixed with" keyword without a body and mixin', () => {
        'object mixed with'.should.not.be.parsedBy(parser)
      })
    })

    describe('Closure', () => {

      it('should parse empty closures', () => {
        '{}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton()()
          )
        ).and.be.tracedTo(0, 2)
      })

      it('should parse closures that do not receive parameters and returns nothing', () => {
        '{ => }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', { isOverride: false, isNative: false })()
            )
          )
        ).and.be.tracedTo(0, 4)
      })

      it('should parse closures without parameters', () => {
        '{ a }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', { isOverride: false, isNative: false })(Reference('a'))
            )
          )
        ).and.be.tracedTo(0, 3)
      })

      it('should parse closure with parameters and no body', () => {
        '{ a => }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', { isOverride: false, isNative: false, parameters: [Parameter('a')] })()
            )
          )
        ).and.be.tracedTo(0, 5)
      })

      it('should parse closures with parameters and body', () => {
        '{ a => a }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', { isOverride: false, isNative: false, parameters: [Parameter('a')] })()
            )
          )
        ).and.be.tracedTo(0, 6)
      })

      it('should parse closures with multiple sentence separated by ";"', () => {
        '{ a => a; b }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', { isOverride: false, isNative: false, parameters: [Parameter('a')] })(Reference('a'), Reference('b'))
            )
          )
        ).and.be.tracedTo(0, 6)
      })

      it('should parse closures that receive two parameters and return the first one', () => {
        '{ a,b => a }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', { isOverride: false, isNative: false, parameters: [Parameter('a'), Parameter('b')] })(Reference('a'))
            )
          )
        ).and.be.tracedTo(0, 6)
      })

      it('should parse closures with vararg parameters', () => {
        '{ a,b... => a }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('wollok.Closure'), args: [] },
            })(
              Method('apply', {
                isOverride: false, isNative: false, parameters: [Parameter('a'), Parameter('b', { name: 'b', isVarArg: true })],
              })
                (Reference('a'))
            )
          )
        ).and.be.tracedTo(0, 10)
      })

      it('should not parse malformed closures', () => {
        '{ a, b c }'.should.not.be.parsedBy(parser)
      })
    })

  })
})
