import { should, use } from 'chai'
import Parse from '../src/parser'
import { parserAssertions } from './assertions'

use(parserAssertions)
should()

describe('Wollok parser', () => {

  describe('Literals', () => {
    const parser = Parse.Literal

    describe('Booleans', () => {

      it('should parse "true"', () => {
        'true'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: true,
        }).and.be.tracedTo(0, 4)
      })

      it('should parse "false"', () => {
        'false'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: false,
        }).and.be.tracedTo(0, 5)
      })

    })

    describe('Null', () => {

      it('should parse "null"', () => {
        'null'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: null,
        }).and.be.tracedTo(0, 4)
      })

    })

    describe('Numbers', () => {

      it('should parse "10"', () => {
        '10'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 10,
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "-1"', () => {
        '-1'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: -1,
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "1.5"', () => {
        '1.5'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 1.5,
        }).and.be.tracedTo(0, 3)
      })

      it('should parse "-1.5"', () => {
        '-1.5'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: -1.5,
        }).and.be.tracedTo(0, 4)
      })

      it('should not parse "1."', () => {
        '1.'.should.not.be.parsedBy(parser)
      })

      it('should not parse ".5"', () => {
        '.5'.should.not.be.parsedBy(parser)
      })

    })

    describe('Strings', () => {

      it('should parse "foo"', () => {
        '"foo"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 'foo',
        }).and.be.tracedTo(0, 5)
      })

      it('should parse ""', () => {
        '""'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: '',
        }).and.be.tracedTo(0, 2)
      })
      it('should parse "foo\nbar"', () => {
        '"foo\nbar"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 'foo\nbar',
        }).and.be.tracedTo(0, 9)
      })

      it('should parse "foo\\nbar"', () => {
        '"foo\\nbar"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 'foo\\nbar',
        }).and.be.tracedTo(0, 10)
      })

      it('should not parse "foo\xbar"', () => {
        '"foo\xbar"'.should.not.be.parsedBy(parser)/*
        '"foo\xbar"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 'foo',
        }).and.be.tracedTo(0, 10)*/
      })

    })

    describe('Collections', () => {
      it('should parse "[]"', () => {
        '[]'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
              kind: 'Reference',
              name: '',
            }],
            className: {
              kind: 'Reference',
              name: 'wollok.List',
            },
          },
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "[1,2,3]"', () => {
        '[1,2,3]'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
              kind: 'Literal',
              value: 1,
            }, {
              kind: 'Literal',
              value: 2,
            }, {
              kind: 'Literal',
              value: 3,
            },
            ],
            className: {
              kind: 'Reference',
              name: 'wollok.List',
            },
          },
        }).and.be.tracedTo(0, 7)
      })

      it('should parse "#{}"', () => {
        '#{}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
              kind: 'Reference',
              name: '',
            }],
            className: {
              kind: 'Reference',
              name: 'wollok.Set',
            },
          },
        }).and.be.tracedTo(0, 3)
      })

      it('should parse "#{1,2,3}"', () => {
        '#{1,2,3}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
              kind: 'Literal',
              value: 1,
            }, {
              kind: 'Literal',
              value: 2,
            }, {
              kind: 'Literal',
              value: 3,
            },
            ],
            className: {
              kind: 'Reference',
              name: 'wollok.Set',
            },
          },
        }).and.be.tracedTo(0, 8)
      })

    })

    /*
    describe('Objects', () => {

      it('should parse "object {}"', () => {
        'object {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 8)
      })
      it('should parse "object { var v; method m(){} }"', () => {
        'object { var v; method m(){} }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 24)
      })
      it('should parse "object inherits D {}"', () => {
        'object inherits D {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 20)
      })
      it('should parse "object inherits D(5) {}"', () => {
        'object inherits D(5) {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 23)
      })
      it('should parse "object inherits D mixed with M {}"', () => {
        'object inherits D mixed with M {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 33)
      })
      it('should parse "object inherits D mixed with M and N {}"', () => {
        'object inherits D mixed with M and N {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 2)
      })
      it('should parse "object mixed with M and N {}"', () => {
        'object mixed with M and N {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 2)
      })
      it('should parse "object { constructor(){} }"', () => {
        'object { constructor(){} }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 2)
      })

      it('should not parse "object"', () => {
        'object {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse "object inherits D inherits E"', () => {
        'object inherits D inherits E'.should.not.be.parsedBy(parser)
      })

      it('should not parse "object inherits {}"', () => {
        'object inherits {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse "object inherits"', () => {
        'object inherits'.should.not.be.parsedBy(parser)
      })

      it('should parse "object mixed with {}"', () => {
        'object mixed with {}'.should.not.be.parsedBy(parser)
      })
      it('should not parse "object mixed with"', () => {
        'object {}'.should.not.be.parsedBy(parser)
      })
    })

    describe('Closure', () => {

      it('should parse "{}"', () => {
        '{}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "{ => }"', () => {
        '{ => }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 4)
      })

      it('should parse "{ a }"', () => {
        '{ a }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 3)
      })

      it('should parse "{ a => }"', () => {
        '{ a => }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 5)
      })

      it('should parse "{ a => a }"', () => {
        '{ a => a }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 6)
      })

      it('should parse "{ a => a; b }"', () => {
        '{ a => a; b }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 6)
      })

      it('should parse "{ a,b => a }"', () => {
        '{ a,b => a }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 6)
      })

      it('should parse "{ a,b => a }"', () => {
        '{ a,b => a }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 7)
      })

      it('should parse "{ a,b... => a }"', () => {
        '{ a,b... => a }'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 10)
      })

      it('should parse "{ a, b c }"', () => {
        '{ a, b c }'.should.not.be.parsedBy(parser)
      })
    })*/

  })
})