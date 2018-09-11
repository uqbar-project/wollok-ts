import { should, use } from 'chai'
import Parse from '../src/parser'
import { parserAssertions } from './assertions'
import { Class, Closure, Constructor, Field, Import, Literal, Method, Mixin, New, Package, Parameter, Program, Reference, Singleton, Test, Variable } from './builders'

const { raw } = String

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
        '"foo\\nbar"'.should.be.parsedBy(parser).into(Literal('foo\nbar')).and.be.tracedTo(0, 10)
      })

      it('should parse strings with the escaped escape character without escaping the whole sequence', () => {
        '"foo\\\\nbar"'.should.be.parsedBy(parser).into(Literal('foo\\nbar')).and.be.tracedTo(0, 11)
      })

      it('should not parse strings with invalid escape sequences', () => {
        raw`"foo\xbar"`.should.not.be.parsedBy(parser)
      })

    })

    describe('Collections', () => {

      it('should parse empty lists', () => {
        '[]'.should.be.parsedBy(parser).into(
          Literal(New(Reference('wollok.List'), []))
        ).and.be.tracedTo(0, 2)
      })

      it('should parse non-empty lists', () => {
        '[1,2,3]'.should.be.parsedBy(parser).into(
          Literal(New(Reference('wollok.List'), [Literal(1), Literal(2), Literal(3)]))
        ).and.be.tracedTo(0, 7)
      })

      it('should parse empty sets', () => {
        '#{}'.should.be.parsedBy(parser).into(
          Literal(New(Reference('wollok.Set'), []))
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
        ).and.be.tracedTo(0, 9)
      })

      it('should parse non empty literal objects', () => {
        'object { var v; method m(){} }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton()(
              Field('v'), Method('m')()
            )
          )
        ).and.be.tracedTo(0, 30)
      })

      it('should parse literal objects that inherit from a class', () => {
        'object inherits D {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [] },
            })()
          )
        ).and.be.tracedTo(0, 20)
      })

      it('should parse literal objects that inherit from a class with explicit builders', () => {
        'object inherits D(5) {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [Literal(5)] },
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

      it('should not parse literal objects with a constructor', () => {
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
          Literal(Closure()())
        ).and.be.tracedTo(0, 2)
      })

      it('should parse closures that do not receive parameters and returns nothing', () => {
        '{ => }'.should.be.parsedBy(parser).into(
          Literal(Closure()())
        ).and.be.tracedTo(0, 6)
      })

      it('should parse closures without parameters', () => {
        '{ a }'.should.be.parsedBy(parser).into(
          Literal(Closure()(Reference('a')))
        ).and.be.tracedTo(0, 5)
      })

      it('should parse closure with parameters and no body', () => {
        '{ a => }'.should.be.parsedBy(parser).into(
          Literal(Closure(Parameter('a'))())
        ).and.be.tracedTo(0, 8)
      })

      it('should parse closures with parameters and body', () => {
        '{ a => a }'.should.be.parsedBy(parser).into(
          Literal(Closure(Parameter('a'))(Reference('a')))
        ).and.be.tracedTo(0, 10)
      })

      it('should parse closures with multiple sentence separated by ";"', () => {
        '{ a => a; b }'.should.be.parsedBy(parser).into(
          Literal(Closure(Parameter('a'))(Reference('a'), Reference('b')))
        ).and.be.tracedTo(0, 13)
      })

      it('should parse closures that receive two parameters and return the first one', () => {
        '{ a,b => a }'.should.be.parsedBy(parser).into(
          Literal(Closure(Parameter('a'), Parameter('b'))(Reference('a')))
        ).and.be.tracedTo(0, 12)
      })

      it('should parse closures with vararg parameters', () => {
        '{ a,b... => a }'.should.be.parsedBy(parser).into(
          Literal(Closure(Parameter('a'), Parameter('b', { isVarArg: true }))(Reference('a')))
        ).and.be.tracedTo(0, 15)
      })

      it('should not parse malformed closures', () => {
        '{ a, b c }'.should.not.be.parsedBy(parser)
      })

    })

  })

  describe('Comments', () => {
    const parser = Parse.Import

    it('should parse imports with some large comment at the right', () => {
      'import /* some comment */ p'.should.be.parsedBy(parser).into(
        Import(Reference('p'))
      ).and.be.tracedTo(0, 26)
    })

    it('should parse import  with some one line comment at the right', () => {
      'import //some comment \n p'.should.be.parsedBy(parser).into(
        Import(Reference('p'))
      ).and.be.tracedTo(0, 27)
    })

    it('should not parse one line commented imports', () => {
      '// import p \n //import p'.should.not.parsedBy(parser)
    })

    it('should not parse large commented imports', () => {
      '/* import p */'.should.not.parsedBy(parser)
    })

    it('should not parse imports with a non closed commet at the right', () => {
      'import p/* non closed comment'.should.not.parsedBy(parser)
    })

  })

  describe('Names', () => {

    const parser = Parse.Name

    it('should parse names that begin with _', () => {
      '_foo123'.should.be.be.parsedBy(parser).into(
        Reference('_foo123')
      ).and.be.tracedTo(0, 7)
    })

    it('should not parse names with spaces', () => {
      'foo bar'.should.not.parsedBy(parser)
    })

    it('should not parse names that begin with numbers', () => {
      '4foo'.should.not.parsedBy(parser)
    })

    it('should not parse operators as names', () => {
      '=='.should.not.parsedBy(parser)
    })

  })

  describe('Local references', () => {

    const parser = Parse.Reference

    it('should parse references that begin with _', () => {
      '_foo123'.should.be.be.parsedBy(parser).into(
        Reference('_foo123')
      ).and.be.tracedTo(0, 7)
    })

    it('should not parse references with spaces', () => {
      'foo bar'.should.not.parsedBy(parser)
    })

    it('should not parse references that begin with numbers', () => {
      '4foo'.should.not.parsedBy(parser)
    })

    it('should not parse operators as references', () => {
      '=='.should.not.parsedBy(parser)
    })

  })

  describe('Fully qualified reference', () => {

    const parser = Parse.Reference

    it('should parse uppercase references', () => {
      'C'.should.be.be.parsedBy(parser).into(
        Reference('C')
      ).and.be.tracedTo(0, 1)
    })

    it('should parse fully qualified references', () => {
      'p.q.C'.should.be.be.parsedBy(parser).into(
        Reference('p.q.C')
      ).and.be.tracedTo(0, 5)
    })

    it('should not parse references that end with wrong characters', () => {
      'p.q.'.should.not.parsedBy(parser)
    })

    it('should not parse references that begin with wrong characters', () => {
      '.q.C'.should.not.parsedBy(parser)
    })

    it('should not parse references with wrong characters', () => {
      '.'.should.not.parsedBy(parser)
    })

    it('should not parse fully qualified references with wrong characters', () => {
      'p.*'.should.not.parsedBy(parser)
    })

  })

  describe('Files', () => {
    const parser = Parse.File

    it('should parse empty packages', () => {
      ''.should.be.parsedBy(parser).into(
        Package('')()
      ).and.be.tracedTo(0, 0)
    })

    it('should parse non empty packages', () => {
      'import p import q class C {}'.should.be.parsedBy(parser).into(
        Package('', {
          name: '',
          imports: [Import(Reference('p')), Import(Reference('q'))],
        })(Class('C')())
      ).and.be.tracedTo(0, 28)
    })

  })

  describe('Imports', () => {

    const parser = Parse.Import

    it('should parse imported packages..', () => {
      'import p'.should.be.parsedBy(parser).into(
        Import(Reference('p'))
      ).and.be.tracedTo(0, 8)
    })

    it('should parse imported packages..', () => {
      'import p.q.*'.should.be.parsedBy(parser).into(
        Import(Reference('p.q'), {
          reference: Reference('p.q'),
          isGeneric: true,
        })
      ).and.be.tracedTo(0, 12)
    })

    it('should not parse ...', () => {
      'import p.*.q'.should.not.parsedBy(parser)
    })

    it('should not parse ...', () => {
      'import *'.should.not.parsedBy(parser)
    })

  })

  describe('Programs', () => {
    const parser = Parse.Program
    it('should parse empty programs', () => {
      'program name { }'.should.be.parsedBy(parser).into(
        Program('name')()
      ).and.be.tracedTo(0, 16)
    })

    it('should parse non-empty programs', () => {
      'program name { var x }'.should.be.parsedBy(parser).into(
        Program('name')(Variable('x'))
      ).and.be.tracedTo(0, 22)
    })


    it('should not parse programs without name', () => {
      'program { }'.should.not.be.parsedBy(parser)
    })

    it('should not parse "program" keyword without name and body', () => {
      'program'.should.not.be.parsedBy(parser)
    })

  })

  describe('Tests', () => {
    const parser = Parse.Test

    it('should parse empty test', () => {
      'test "name" { }'.should.be.parsedBy(parser).into(
        Test('name')()
      ).and.be.tracedTo(0, 15)
    })

    it('should parse non-empty test', () => {
      'test "name" { var x }'.should.be.parsedBy(parser).into(
        Test('name')(Variable('x'))
      ).and.be.tracedTo(0, 21)
    })

    it('should not parse tests with names that aren\'t a string', () => {
      'test name { }'.should.not.be.parsedBy(parser)
    })

    it('should not parse tests without name', () => {
      'test { }'.should.not.be.parsedBy(parser)
    })

    it('should not parse tests without name and body', () => {
      'test'.should.not.be.parsedBy(parser)
    })

  })

  describe('Packages', () => {
    const parser = Parse.Package

    it('should parse empty packages', () => {
      'package p {}'.should.be.parsedBy(parser).into(
        Package('p')()
      ).and.be.tracedTo(0, 12)
    })

    it('should parse non-empty packages', () => {
      'package p { class C {} }'.should.be.parsedBy(parser).into(
        Package('p')(Class('C')())
      ).and.be.tracedTo(0, 24)
    })

    it('should parse non-empty packages', () => {
      'package p { class C {} class D {} }'.should.be.parsedBy(parser).into(
        Package('p')(Class('C')(), Class('D')())
      ).and.be.tracedTo(0, 35)
    })

    it('should not parse packages without a body', () => {
      'package p'.should.not.be.parsedBy(parser)
    })
  })

  describe('Classes', () => {
    const parser = Parse.Class

    it('should parse empty classes', () => {
      'class C {}'.should.be.parsedBy(parser).into(
        Class('C')()
      ).and.be.tracedTo(0, 10)
    })

    it('should parse classes with a constructor', () => {
      'class C { constructor() {} }'.should.be.parsedBy(parser).into(
        Class('C')(Constructor()())
      ).and.be.tracedTo(0, 28)
    })

    it('should parse classes with sentences', () => {
      'class C { var v; method m(){} }'.should.be.parsedBy(parser).into(
        Class('C')(Field('v'), Method('m')())
      ).and.be.tracedTo(0, 31)
    })

    it('should parse classes that inherit from other class', () => {
      'class C inherits D {}'.should.be.parsedBy(parser).into(
        Class('C',
          { superclass: Reference('D') }
        )()
      ).and.be.tracedTo(0, 21)
    })

    it('should parse classes that inherit from other class and have a mixin', () => {
      'class C inherits D mixed with M {}'.should.be.parsedBy(parser).into(
        Class('C',
          {
            superclass: Reference('D'),
            mixins: [Reference('M')],
          }
        )()
      ).and.be.tracedTo(0, 34)
    })

    it('should not parse "class" keyword without a body', () => {
      'class'.should.not.be.parsedBy(parser)
    })

    it('should not parse classes without name ', () => {
      'class {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse classes without a body ', () => {
      'class C'.should.not.be.parsedBy(parser)
    })

    it('should not parse classes thats inherits from more than one class', () => {
      'class C inherits D inherits E'.should.not.be.parsedBy(parser)
    })

    it('should not parse classes that use the "inherits" keyword without a superclass ', () => {
      'class C inherits {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse "class C inherits" keyword without a body and superclass ', () => {
      'class C inherits'.should.not.be.parsedBy(parser)
    })

    it('should not parse the "mixed with" keyword without a mixin', () => {
      'class C mixed with {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse the "class C mixed with" keyword without a body and mixin ', () => {
      'class C mixed with'.should.not.be.parsedBy(parser)
    })
  })

  describe('Mixins', () => {

    const parser = Parse.Mixin

    it('should parse empty mixins', () => {
      'mixin M {}'.should.be.parsedBy(parser).into(
        Mixin('M')()
      ).and.be.tracedTo(0, 10)
    })

    it('should parse non-empty programs', () => {
      'mixin M { var v; method m(){} }'.should.be.parsedBy(parser).into(
        Mixin('M')(Field('v'), Method('m')())
      ).and.be.tracedTo(0, 31)
    })

    it('should not parse mixins with constructor', () => {
      'mixin M { constructor(){} }'.should.not.be.parsedBy(parser)
    })

    it('should not parse "mixin" keyword without name and body', () => {
      'mixin'.should.not.be.parsedBy(parser)
    })

    it('should not parse mixins without name', () => {
      'mixin {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse mixins without body', () => {
      'mixin M'.should.not.be.parsedBy(parser)
    })

  })

  describe('Singletons', () => {

    const parser = Parse.Singleton

    it('should parse empty objects', () => {
      'object O {}'.should.be.parsedBy(parser).into(
        Singleton('O')()
      ).and.be.tracedTo(0, 11)
    })

    it('should parse non-empty objects', () => {
      'object O  { var v; method m(){} }'.should.be.parsedBy(parser).into(
        Singleton('O')(Field('v'), Method('m')())
      ).and.be.tracedTo(0, 33)
    })

    it('should parse objects that inherits from a class', () => {
      'object O inherits D {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [] },
        })()
      ).and.be.tracedTo(0, 22)
    })

    it('should parse objects that inherit from a class with explicit builders', () => {
      'object O inherits D(5) {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [Literal(5)] },
        })()
      ).and.be.tracedTo(0, 25)
    })

    it('should parse objects that inherit from a class and have a mixin', () => {
      'object O inherits D mixed with M {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [] },
          mixins: [Reference('M')],
        })()
      ).and.be.tracedTo(0, 35)
    })

    it('should parse objects that inherit from a class and have multiple mixins', () => {
      'object O inherits D mixed with M and N {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [] },
          mixins: [Reference('M'), Reference('N')],
        })()
      ).and.be.tracedTo(0, 41)
    })

    it('should parse objects thats have multiple mixins ', () => {
      'object O mixed with M and N {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          mixins: [Reference('M'), Reference('N')],
        })()
      ).and.be.tracedTo(0, 30)
    })

    it('should not parse objects with a constructor', () => {
      'object O { constructor(){} }'.should.not.be.parsedBy(parser)
    })

    it('should not parse the "object" keyword without a body', () => {
      'object'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects without name', () => {
      'object {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects without body', () => {
      'object O'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects that inherit from more than one class', () => {
      'object O inherits D inherits E'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects that use the "inherits" keyword without a superclass', () => {
      'object O inherits {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects that use the "inherits" keyword without a body and superclass', () => {
      'object O inherits'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects thats use "mixed with" keyword without a mixin', () => {
      'object O mixed with {}'.should.not.be.parsedBy(parser)
    })

    it('should not parse objects thats use "mixed with" keyword without a mixin and a body', () => {
      'object O mixed with'.should.not.be.parsedBy(parser)
    })

  })

  describe('Fields', () => {

    const parser = Parse.Field

    it('should parse var declaration', () => {
      'var v'.should.be.parsedBy(parser).into(
        Field('v')
      ).and.be.tracedTo(0, 5)
    })


    it('should parse var asignation', () => {
      'var v = 5'.should.be.parsedBy(parser).into(
        Field('v', {
          value: Literal(5),
        })
      ).and.be.tracedTo(0, 9)
    })

    it('should parse const declaration', () => {
      'const v'.should.be.parsedBy(parser).into(
        Field('v', {
          isReadOnly: true,
        })
      ).and.be.tracedTo(0, 7)
    })

    it('should parse const asignation', () => {
      'const v = 5'.should.be.parsedBy(parser).into(
        Field('v', {
          isReadOnly: true,
          value: Literal(5),
        })
      ).and.be.tracedTo(0, 11)
    })

    it('should not parse vars without name', () => {
      'var'.should.not.be.parsedBy(parser)
    })

    it('should not parse consts without name', () => {
      'const'.should.not.be.parsedBy(parser)
    })

    it('should not parse declaration of numbers as vars ', () => {
      'var 5'.should.not.be.parsedBy(parser)
    })

    it('should not parse declaration of numbers as consts ', () => {
      'const 5'.should.not.be.parsedBy(parser)
    })

  })

  describe('Methods', () => {

    const parser = Parse.Method

    it('should parse method declarations', () => {
      'method m()'.should.be.parsedBy(parser).into(
        Method('m')()
      ).and.be.tracedTo(0, 10)
    })

    it('should parse methods with operator characters as names ', () => {
      'method ==()'.should.be.parsedBy(parser).into(
        Method('==')()
      ).and.be.tracedTo(0, 11)
    })

    it('should parse empty methods', () => {
      'method m() {}'.should.be.parsedBy(parser).into(
        Method('m')()
      ).and.be.tracedTo(0, 13)
    })

    it('should parse methods that have two parameters  ', () => {
      'method m(p, q) {}'.should.be.parsedBy(parser).into(
        Method('m', {
          parameters: [Parameter('p'), Parameter('q')],
        })()
      ).and.be.tracedTo(0, 17)
    })

    it('should parse methods that have vararg parameters', () => {
      'method m(p, q...) {}'.should.be.parsedBy(parser).into(
        Method('m', {
          parameters: [Parameter('p'), Parameter('q', {
            isVarArg: true,
          })],
        })()
      ).and.be.tracedTo(0, 20)
    })

    it('should parse non-empty methods ', () => {
      'method m() {var x}'.should.be.parsedBy(parser).into(
        Method('m')(Variable('x'))
      ).and.be.tracedTo(0, 18)
    })

    it('should parse simple return method', () => {
      'method m() = 5'.should.be.parsedBy(parser).into(
        Method('m')(Literal(5))
      ).and.be.tracedTo(0, 14)
    })

    it('should parse override methods', () => {
      'override method m() {}'.should.be.parsedBy(parser).into(
        Method('m', {
          isOverride: true,
        })()
      ).and.be.tracedTo(0, 22)
    })
    it('should parse native methods', () => {
      'method m() native'.should.be.parsedBy(parser).into(
        Method('m', {
          isNative: true,
        })
      ).and.be.tracedTo(0, 17)
    })
    it('should parse methods that have closures', () => {
      'method m() = { 5 }'.should.be.parsedBy(parser).into(
        Method('m')(Literal(Closure()(Literal(5))))
      ).and.be.tracedTo(0, 18)
    })

    it('should not parse incomplete methods', () => {
      'method m(p,q) ='.should.not.be.parsedBy(parser)
    })

    it('should not parse ', () => {
      'method m(p,q) native = q'.should.not.be.parsedBy(parser)
    })

    it('should not parse ', () => {
      'method m(p,q) native { }'.should.not.be.parsedBy(parser)
    })

  })

})