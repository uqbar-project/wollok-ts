import { should, use } from 'chai'
import * as Parse from '../src/parser'
import { parserAssertions } from './assertions'
import { Assignment, Catch, Class, Closure, Constructor, Describe, Field, If, Import, Literal, Method, Mixin, New, Package, Parameter, Program, Reference, Return, Send, Singleton, Super, Test, Throw, Try, Variable } from './builders'

const { raw } = String

use(parserAssertions)
should()

describe('Wollok parser', () => {


  describe('Comments', () => {
    const parser = Parse.Import

    it('multiline comments should be ignored in between tokens', () => {
      `/*some comment*/import /* some
      comment */ p`.should.be.parsedBy(parser).into(
        Import(Reference('p'))
      ).and.be.tracedTo(16, 49)
        .and.have.nested.property('reference').tracedTo(48, 49)
    })

    it('line comments should be ignored at the end of line', () => {
      `import //some comment
      p`.should.be.parsedBy(parser).into(
        Import(Reference('p'))
      ).and.be.tracedTo(0, 29)
        .and.have.nested.property('reference').tracedTo(28, 29)
    })

    it('should not parse elements inside line comment', () => {
      '// import p'.should.not.be.parsedBy(parser)
    })

    it('should not parse elements inside multiline comment', () => {
      `/*
        import p
      */`.should.not.be.parsedBy(parser)
    })

    it('should not parse elements with an unclosed multiline comment', () => {
      'import p /* non closed comment'.should.not.be.parsedBy(parser)
    })

  })


  describe('Names', () => {

    const parser = Parse.Name

    it('should parse names that begin with _', () => {
      '_foo123'.should.be.be.parsedBy(parser).into(
        '_foo123'
      )
    })

    it('should not parse names with spaces', () => {
      'foo bar'.should.not.be.parsedBy(parser)
    })

    it('should not parse names that begin with numbers', () => {
      '4foo'.should.not.be.parsedBy(parser)
    })

    it('should not parse operators as names', () => {
      '=='.should.not.be.parsedBy(parser)
    })

  })


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

      it('should parse valid strings with double quote', () => {
        '"foo"'.should.be.parsedBy(parser).into(Literal('foo')).and.be.tracedTo(0, 5)
      })

      it('should parse valid strings with single quote', () => {
        '\'foo\''.should.be.parsedBy(parser).into(Literal('foo')).and.be.tracedTo(0, 5)
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
          Literal(New(Reference('wollok.lang.List'), []))
        ).and.be.tracedTo(0, 2)
      })

      it('should parse non-empty lists', () => {
        '[1,2,3]'.should.be.parsedBy(parser).into(
          Literal(New(Reference('wollok.lang.List'), [Literal(1), Literal(2), Literal(3)]))
        ).and.be.tracedTo(0, 7)
          .and.have.nested.property('value.args.0').tracedTo(1, 2)
          .and.also.have.nested.property('value.args.1').tracedTo(3, 4)
          .and.also.have.nested.property('value.args.2').tracedTo(5, 6)
      })

      it('should parse empty sets', () => {
        '#{}'.should.be.parsedBy(parser).into(
          Literal(New(Reference('wollok.lang.Set'), []))
        ).and.be.tracedTo(0, 3)
      })

      it('should parse non-empty sets', () => {
        '#{1,2,3}'.should.be.parsedBy(parser).into(
          Literal(
            New(Reference('wollok.lang.Set'), [Literal(1), Literal(2), Literal(3)])
          )
        ).and.be.tracedTo(0, 8)
          .and.have.nested.property('value.args.0').tracedTo(2, 3)
          .and.also.have.nested.property('value.args.1').tracedTo(4, 5)
          .and.also.have.nested.property('value.args.2').tracedTo(6, 7)
      })

    })

    describe('Objects', () => {

      it('should parse empty literal objects', () => {

        'object {}'.should.be.parsedBy(parser).into(
          Literal(Singleton()())
        ).and.be.tracedTo(0, 9)
      })

      it('should parse non empty literal objects', () => {
        'object { var v method m(){} }'.should.be.parsedBy(parser).into(
          Literal(
            Singleton()(
              Field('v'), Method('m')()
            )
          )
        ).and.be.tracedTo(0, 29)
          .and.have.nested.property('value.members.0').tracedTo(9, 14)
          .and.also.have.nested.property('value.members.1').tracedTo(15, 27)
      })

      it('should parse literal objects that inherit from a class', () => {
        'object inherits D {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [] },
            })()
          )
        ).and.be.tracedTo(0, 20)
          .and.have.nested.property('value.superCall.superclass').tracedTo(16, 17)
      })

      it('should parse literal objects that inherit from a class with explicit builders', () => {
        'object inherits D(5) {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              superCall: { superclass: Reference('D'), args: [Literal(5)] },
            })()
          )
        ).and.be.tracedTo(0, 23)
          .and.have.nested.property('value.superCall.superclass').tracedTo(16, 17)
          .and.also.have.nested.property('value.superCall.args.0').tracedTo(18, 19)
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
          .and.have.nested.property('value.superCall.superclass').tracedTo(16, 17)
          .and.also.have.nested.property('value.mixins.0').tracedTo(29, 30)
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
          .and.have.nested.property('value.superCall.superclass').tracedTo(16, 17)
          .and.also.have.nested.property('value.mixins.0').tracedTo(29, 30)
          .and.also.have.nested.property('value.mixins.1').tracedTo(35, 36)
      })

      it('should parse literal objects that have multiple mixins', () => {
        'object mixed with M and N {}'.should.be.parsedBy(parser).into(
          Literal(
            Singleton(undefined, {
              mixins: [Reference('M'), Reference('N')],
            })()
          )
        ).and.be.tracedTo(0, 28)
          .and.have.nested.property('value.mixins.0').tracedTo(18, 19)
          .and.also.have.nested.property('value.mixins.1').tracedTo(24, 25)
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
          Closure()()
        ).and.be.tracedTo(0, 2)
      })

      it('should parse closures that do not receive parameters and returns nothing', () => {
        '{ => }'.should.be.parsedBy(parser).into(
          Closure()()
        ).and.be.tracedTo(0, 6)
      })

      it('should parse closures without parameters', () => {
        '{ a }'.should.be.parsedBy(parser).into(
          Closure()(Reference('a'))
        ).and.be.tracedTo(0, 5)
          .and.have.nested.property('value.members.0.body.sentences.0').tracedTo(2, 3)
      })

      it('should parse closure with parameters and no body', () => {
        '{ a => }'.should.be.parsedBy(parser).into(
          Closure(Parameter('a'))()
        ).and.be.tracedTo(0, 8)
          .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
      })

      it('should parse closures with parameters and body', () => {
        '{ a => a }'.should.be.parsedBy(parser).into(
          Closure(Parameter('a'))(Reference('a'))
        ).and.be.tracedTo(0, 10)
          .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
          .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(7, 8)

      })

      it('should parse closures with multiple sentence separated by ";"', () => {
        '{ a => a; b }'.should.be.parsedBy(parser).into(
          Closure(Parameter('a'))(Reference('a'), Reference('b'))
        ).and.be.tracedTo(0, 13)
          .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
          .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(7, 8)
          .and.also.have.nested.property('value.members.0.body.sentences.1').tracedTo(10, 11)
      })

      it('should parse closures that receive two parameters and return the first one', () => {
        '{ a,b => a }'.should.be.parsedBy(parser).into(
          Closure(Parameter('a'), Parameter('b'))(Reference('a'))
        ).and.be.tracedTo(0, 12)
          .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
          .and.also.have.nested.property('value.members.0.parameters.1').tracedTo(4, 5)
          .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(9, 10)
      })

      it('should parse closures with vararg parameters', () => {
        '{ a,b... => a }'.should.be.parsedBy(parser).into(
          Closure(Parameter('a'), Parameter('b', { isVarArg: true }))(Reference('a'))
        ).and.be.tracedTo(0, 15)
          .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
          .and.also.have.nested.property('value.members.0.parameters.1').tracedTo(4, 8)
          .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(12, 13)
      })

      it('should not parse malformed closures', () => {
        '{ a, b c }'.should.not.be.parsedBy(parser)
      })

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
      'foo bar'.should.not.be.parsedBy(parser)
    })

    it('should not parse references that begin with numbers', () => {
      '4foo'.should.not.be.parsedBy(parser)
    })

    it('should not parse operators as references', () => {
      '=='.should.not.be.parsedBy(parser)
    })

  })

  describe('Fully qualified reference', () => {

    const parser = Parse.Reference

    it('should parse uppercase references', () => {
      'C'.should.be.parsedBy(parser).into(
        Reference('C')
      ).and.be.tracedTo(0, 1)
    })

    it('should not parse references that end with wrong characters', () => {
      'p.q.'.should.not.be.parsedBy(parser)
    })

    it('should not parse references that begin with wrong characters', () => {
      '.q.C'.should.not.be.parsedBy(parser)
    })

    it('should not parse references with wrong characters', () => {
      '.'.should.not.be.parsedBy(parser)
    })

    it('should not parse fully qualified references with wrong characters', () => {
      'p.*'.should.not.be.parsedBy(parser)
    })

  })

  describe('Files', () => {
    const parser = Parse.File('foo')

    it('should parse empty packages', () => {
      ''.should.be.parsedBy(parser).into(
        Package('foo')()
      ).and.be.tracedTo(0, 0)
    })

    it('should parse non empty packages', () => {
      'import p import q class C {}'.should.be.parsedBy(parser).into(
        Package('foo', {
          imports: [Import(Reference('p')), Import(Reference('q'))],
        })(Class('C')())
      ).and.be.tracedTo(0, 28)
        .and.have.nested.property('imports.0').tracedTo(0, 8)
        .and.also.have.nested.property('imports.1').tracedTo(9, 17)
        .and.also.have.nested.property('members.0').tracedTo(18, 28)
    })

  })

  describe('Imports', () => {

    const parser = Parse.Import

    it('should parse imported packages', () => {
      'import p'.should.be.parsedBy(parser).into(
        Import(Reference('p'))
      ).and.be.tracedTo(0, 8)
        .and.have.nested.property('reference').tracedTo(7, 8)
    })

    it('should parse generic imports', () => {
      'import p.q.*'.should.be.parsedBy(parser).into(
        Import(Reference('p.q'), {
          reference: Reference('p.q'),
          isGeneric: true,
        })
      ).and.be.tracedTo(0, 12)
        .and.have.nested.property('reference').tracedTo(7, 10)
    })

    it('should not parse malformed imports', () => {
      'import p.*.q'.should.not.be.parsedBy(parser)
    })

    it('should not parse "import" keyword without a package', () => {
      'import *'.should.not.be.parsedBy(parser)
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
        .and.have.nested.property('body.sentences.0').tracedTo(15, 20)
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
        .and.have.nested.property('body').tracedTo(12, 21)
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


  describe('Describe', () => {
    const parser = Parse.Describe

    it('should parse empty describe', () => {
      'describe "name" { }'.should.be.parsedBy(parser).into(
        Describe('name')()
      ).and.be.tracedTo(0, 19)
    })

    it('should parse non-empty describe', () => {
      'describe "name" { test "foo" {} test "bar" {} }'.should.be.parsedBy(parser).into(
        Describe('name')(Test('foo')(), Test('bar')())
      ).and.be.tracedTo(0, 47)
        .and.have.nested.property('members.0').tracedTo(18, 31)
        .and.also.have.nested.property('members.1').tracedTo(32, 45)
    })

    it('should not parse describes with names that aren\'t a string', () => {
      'describe name { }'.should.not.be.parsedBy(parser)
    })

    it('should not parse describe without name', () => {
      'describe { }'.should.not.be.parsedBy(parser)
    })

    it('should not parse describe without name and body', () => {
      'describe'.should.not.be.parsedBy(parser)
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
        .and.have.nested.property('members.0').tracedTo(12, 23)
    })

    it('should parse non-empty packages with more than one class', () => {
      'package p { class C {} class D {} }'.should.be.parsedBy(parser).into(
        Package('p')(Class('C')(), Class('D')())
      ).and.be.tracedTo(0, 35)
        .and.have.nested.property('members.0').tracedTo(12, 23)
        .and.also.have.nested.property('members.1').tracedTo(23, 34)

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
        .and.have.nested.property('members.0').tracedTo(10, 26)
    })

    it('should parse classes with sentences', () => {
      'class C { var v method m(){} }'.should.be.parsedBy(parser).into(
        Class('C')(Field('v'), Method('m')())
      ).and.be.tracedTo(0, 30)
        .and.have.nested.property('members.0').tracedTo(10, 15)
        .and.also.have.nested.property('members.1').tracedTo(16, 28)
    })

    it('should parse classes that inherit from other class', () => {
      'class C inherits D {}'.should.be.parsedBy(parser).into(
        Class('C',
          { superclass: Reference('D') }
        )()
      ).and.be.tracedTo(0, 21)
        .and.have.nested.property('superclass').tracedTo(17, 18)
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
        .and.have.nested.property('superclass').tracedTo(17, 18)
        .and.also.have.nested.property('mixins.0').tracedTo(30, 31)
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
      'mixin M { var v method m(){} }'.should.be.parsedBy(parser).into(
        Mixin('M')(Field('v'), Method('m')())
      ).and.be.tracedTo(0, 30)
        .and.have.nested.property('members.0').tracedTo(10, 15)
        .and.also.have.nested.property('members.1').tracedTo(16, 28)
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
      'object O  { var v method m(){} }'.should.be.parsedBy(parser).into(
        Singleton('O')(Field('v'), Method('m')())
      ).and.be.tracedTo(0, 32)
        .and.have.nested.property('members.0').tracedTo(12, 17)
        .and.also.have.nested.property('members.1').tracedTo(18, 30)
    })

    it('should parse objects that inherits from a class', () => {
      'object O inherits D {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [] },
        })()
      ).and.be.tracedTo(0, 22)
        .and.have.nested.property('superCall.superclass').tracedTo(18, 19)
    })

    it('should parse objects that inherit from a class with explicit builders', () => {
      'object O inherits D(5) {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [Literal(5)] },
        })()
      ).and.be.tracedTo(0, 25)
        .and.have.nested.property('superCall.superclass').tracedTo(18, 19)
        .and.also.have.nested.property('superCall.args.0').tracedTo(20, 21)
    })

    it('should parse objects that inherit from a class and have a mixin', () => {
      'object O inherits D mixed with M {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [] },
          mixins: [Reference('M')],
        })()
      ).and.be.tracedTo(0, 35)
        .and.have.nested.property('superCall.superclass').tracedTo(18, 19)
        .and.also.have.nested.property('mixins.0').tracedTo(31, 32)
    })

    it('should parse objects that inherit from a class and have multiple mixins', () => {
      'object O inherits D mixed with M and N {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          superCall: { superclass: Reference('D'), args: [] },
          mixins: [Reference('M'), Reference('N')],
        })()
      ).and.be.tracedTo(0, 41)
        .and.have.nested.property('superCall.superclass').tracedTo(18, 19)
        .and.also.have.nested.property('mixins.0').tracedTo(31, 32)
        .and.also.have.nested.property('mixins.1').tracedTo(37, 38)
    })

    it('should parse objects thats have multiple mixins ', () => {
      'object O mixed with M and N {}'.should.be.parsedBy(parser).into(
        Singleton('O', {
          mixins: [Reference('M'), Reference('N')],
        })()
      ).and.be.tracedTo(0, 30)
        .and.have.nested.property('mixins.0').tracedTo(20, 21)
        .and.also.have.nested.property('mixins.1').tracedTo(26, 27)
    })

    it('should not parse objects with a constructor', () => {
      'object O { constructor(){} }'.should.not.be.parsedBy(parser)
    })

    it('should not parse the "object" keyword without a body', () => {
      'object'.should.not.be.parsedBy(parser)
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


    it('should parse var declaration and asignation', () => {
      'var v = 5'.should.be.parsedBy(parser).into(
        Field('v', {
          value: Literal(5),
        })
      ).and.be.tracedTo(0, 9)
        .and.have.nested.property('value').tracedTo(8, 9)

    })

    it('should parse const declaration', () => {
      'const v'.should.be.parsedBy(parser).into(
        Field('v', {
          isReadOnly: true,
        })
      ).and.be.tracedTo(0, 7)
    })

    it('should parse const declaration and asignation', () => {
      'const v = 5'.should.be.parsedBy(parser).into(
        Field('v', {
          isReadOnly: true,
          value: Literal(5),
        })
      ).and.be.tracedTo(0, 11)
        .and.have.nested.property('value').tracedTo(10, 11)
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
        Method('m', { body: undefined })()
      ).and.be.tracedTo(0, 10)
    })

    it('should parse methods with operator characters as names ', () => {
      'method ==()'.should.be.parsedBy(parser).into(
        Method('==', { body: undefined })()
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
        .and.have.nested.property('parameters.0').tracedTo(9, 10)
        .and.also.have.nested.property('parameters.1').tracedTo(12, 13)
    })

    it('should parse methods that have vararg parameters', () => {
      'method m(p, q...) {}'.should.be.parsedBy(parser).into(
        Method('m', {
          parameters: [Parameter('p'), Parameter('q', {
            isVarArg: true,
          })],
        })()
      ).and.be.tracedTo(0, 20)
        .and.have.nested.property('parameters.0').tracedTo(9, 10)
        .and.also.have.nested.property('parameters.1').tracedTo(12, 16)
    })

    it('should parse non-empty methods ', () => {
      'method m() {var x}'.should.be.parsedBy(parser).into(
        Method('m')(Variable('x'))
      ).and.be.tracedTo(0, 18)
        .and.have.nested.property('body').tracedTo(11, 18)
        .and.also.have.nested.property('body.sentences.0').tracedTo(12, 17)
    })

    it('should parse methods defined as expressions', () => {
      'method m() = 5'.should.be.parsedBy(parser).into(
        Method('m')(Return(Literal(5)))
      ).and.be.tracedTo(0, 14)
        .and.have.nested.property('body').tracedTo(13, 14)
        .and.also.have.nested.property('body.sentences.0.value').tracedTo(13, 14)
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
          body: undefined,
        })()
      ).and.be.tracedTo(0, 17)
    })

    it('should parse methods that have a closure as body', () => {
      'method m() = { 5 }'.should.be.parsedBy(parser).into(
        Method('m')(Return(Closure()(Literal(5))))
      ).and.be.tracedTo(0, 18)
        .and.have.nested.property('body').tracedTo(13, 18)
        .and.also.have.nested.property('body.sentences.0.value').tracedTo(13, 18)
    })

    it('should not parse incomplete methods', () => {
      'method m(p,q) ='.should.not.be.parsedBy(parser)
    })

    it('should not parse development of native methods', () => {
      'method m(p,q) native = q'.should.not.be.parsedBy(parser)
    })

    it('should not parse development with closures of native methods', () => {
      'method m(p,q) native { }'.should.not.be.parsedBy(parser)
    })

  })

  describe('Constructors', () => {

    const parser = Parse.Constructor

    it('should parse empty constructors', () => {
      'constructor () { }'.should.be.parsedBy(parser).into(
        Constructor()()
      ).and.be.tracedTo(0, 18)
    })

    it('should parse constructors with explicit builder ', () => {
      'constructor(p, q) {}'.should.be.parsedBy(parser).into(
        Constructor({
          parameters: [Parameter('p'), Parameter('q')],
        })()
      ).and.be.tracedTo(0, 20)
        .and.have.nested.property('parameters.0').tracedTo(12, 13)
        .and.also.have.nested.property('parameters.1').tracedTo(15, 16)
    })

    it('should parse constructors with explicit builder with vararg parameters', () => {
      'constructor(p, q...) {}'.should.be.parsedBy(parser).into(
        Constructor({
          parameters: [Parameter('p'), Parameter('q', {
            isVarArg: true,
          })],
        })()
      ).and.be.tracedTo(0, 23)
        .and.have.nested.property('parameters.0').tracedTo(12, 13)
        .and.also.have.nested.property('parameters.1').tracedTo(15, 19)
    })

    it('should parse non-empty constructors', () => {
      'constructor() {var x}'.should.be.parsedBy(parser).into(
        Constructor()(Variable('x'))
      ).and.be.tracedTo(0, 21)
        .and.have.nested.property('body').tracedTo(14, 21)
        .and.also.have.nested.property('body.sentences.0').tracedTo(15, 20)
    })

    it('should parse should parse constructor delegations to another constructor in the same class, with a body', () => {
      'constructor() = self(5) {}'.should.be.parsedBy(parser).into(
        Constructor({
          baseCall: {
            callsSuper: false,
            args: [Literal(5)],
          },
        })()
      ).and.be.tracedTo(0, 26)
        .and.have.nested.property('baseCall.args.0').tracedTo(21, 22)
    })

    it('should parse constructor delegations to a superclass and a body', () => {
      'constructor() = super(5) {}'.should.be.parsedBy(parser).into(
        Constructor({
          baseCall: {
            callsSuper: true,
            args: [Literal(5)],
          },
        })()
      ).and.be.tracedTo(0, 27)
        .and.have.nested.property('baseCall.args.0').tracedTo(22, 23)
    })

    it('should not parse "constructor" keyword without a body', () => {
      'constructor'.should.not.be.parsedBy(parser)
    })

    it('should not parse constructor delegations without a reference to a superclass or a constructor in the same class', () => {
      'constructor() = { }'.should.not.be.parsedBy(parser)
    })

    it('should not parse constructor delegations to another constructor in the same class, thats use "self" keyword without ()', () => {
      'constructor() = self'.should.not.be.parsedBy(parser)
    })

    it('should not parse  constructor delegations to a superclass, that use "super" keyword without parentheses', () => {
      'constructor() = super'.should.not.be.parsedBy(parser)
    })

  })

  describe('Variables', () => {
    const parser = Parse.Variable
    it('should parse var declaration', () => {
      'var v'.should.be.parsedBy(parser).into(
        Variable('v')
      ).and.be.tracedTo(0, 5)
    })


    it('should parse var asignation', () => {
      'var v = 5'.should.be.parsedBy(parser).into(
        Variable('v', {
          value: Literal(5),
        })
      ).and.be.tracedTo(0, 9)
        .and.have.nested.property('value').tracedTo(8, 9)
    })

    it('should parse const declaration', () => {
      'const v'.should.be.parsedBy(parser).into(
        Variable('v', {
          isReadOnly: true,
        })
      ).and.be.tracedTo(0, 7)
    })

    it('should parse const asignation', () => {
      'const v = 5'.should.be.parsedBy(parser).into(
        Variable('v', {
          isReadOnly: true,
          value: Literal(5),
        })
      ).and.be.tracedTo(0, 11)
        .and.have.nested.property('value').tracedTo(10, 11)
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

  describe('Returns', () => {
    const parser = Parse.Return

    it('should parse returns', () => {
      'return 5'.should.be.parsedBy(parser).into(
        Return(Literal(5))
      ).and.be.tracedTo(0, 8)
        .and.have.nested.property('value').tracedTo(7, 8)
    })

    it('parse empty return', () => {
      'return'.should.be.parsedBy(parser).into(
        Return()
      ).and.be.tracedTo(0, 6)
    })

  })

  describe('Assignments', () => {
    const parser = Parse.Assignment

    it('should parse simple assignments', () => {
      'a = b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Reference('b'))
      ).and.be.tracedTo(0, 5)
        .and.have.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value').tracedTo(4, 5)
    })

    it('should parse += operation ', () => {
      'a += b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '+', [Reference('b')]))
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(5, 6)
    })

    it('should parse -= operation', () => {
      'a -= b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '-', [Reference('b')]))
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

    })

    it('should parse *= operation', () => {
      'a *= b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '*', [Reference('b')]))
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

    })

    it('should parse /= operation', () => {
      'a /= b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '/', [Reference('b')]))
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

    })

    it('should parse %= operation', () => {
      'a %= b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '%', [Reference('b')]))
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

    })

    it('should parse ||= operation ', () => {
      'a ||= b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '||', [Reference('b')]))
      ).and.be.tracedTo(0, 7)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(6, 7)

    })

    it('should parse &&= operation', () => {
      'a &&= b'.should.be.parsedBy(parser).into(
        Assignment(Reference('a'), Send(Reference('a'), '&&', [Reference('b')]))
      ).and.be.tracedTo(0, 7)
        .and.have.nested.property('reference').tracedTo(0, 1)
        .and.also.have.nested.property('value.args.0').tracedTo(6, 7)
    })

    it('should not parse assignments that have other assignment at the right', () => {
      'a = b = c'.should.not.be.parsedBy(parser)
    })

    it('should not parse assignments that have += operation at the right ', () => {
      'a = b += c'.should.not.be.parsedBy(parser)
    })

    it('should not parse += operation that have other assigment at the right', () => {
      'a += b = c'.should.not.be.parsedBy(parser)
    })
  })

  describe('Infix operations', () => {

    const parser = Parse.Operation

    it('should parse operations with arithmetic operators that are used infixed', () => {
      'a + b + c'.should.be.parsedBy(parser).into(
        Send(Send(Reference('a'), '+',
          [Reference('b')]), '+', [Reference('c')])
      ).and.be.tracedTo(0, 9)
        .and.have.nested.property('receiver').tracedTo(0, 5)
        .and.also.have.nested.property('receiver.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('receiver.args.0').tracedTo(4, 5)
        .and.also.have.nested.property('args.0').tracedTo(8, 9)
    })

    it('should parse operations with parentheses to separate members', () => {
      'a + (b + c)'.should.be.parsedBy(parser).into(
        Send(Reference('a'), '+',
          [Send(Reference('b'), '+', [Reference('c')])])
      ).and.be.tracedTo(0, 11)
        .and.have.nested.property('receiver').tracedTo(0, 1)
        .and.also.have.nested.property('args.0').tracedTo(5, 10)
        .and.also.have.nested.property('args.0.receiver').tracedTo(5, 6)
        .and.also.have.nested.property('args.0.args.0').tracedTo(9, 10)
    })

    it('should parse infix operations with logical operators', () => {
      'a > b || c && d + e == f'.should.be.parsedBy(parser).into(
        Send(
          Send(Reference('a'), '>', [Reference('b')]),
          '||',
          [
            Send(
              Reference('c'),
              '&&',
              [
                Send(
                  Send(Reference('d'), '+', [Reference('e')]),
                  '==',
                  [Reference('f')]
                ),
              ]
            ),
          ]
        )
      ).and.be.tracedTo(0, 24)
        .and.have.nested.property('receiver').tracedTo(0, 5)
        .and.also.have.nested.property('receiver.receiver').tracedTo(0, 1)
        .and.also.have.nested.property('receiver.args.0').tracedTo(4, 5)
        .and.also.have.nested.property('args.0').tracedTo(9, 24)
        .and.also.have.nested.property('args.0.receiver').tracedTo(9, 10)
        .and.also.have.nested.property('args.0.args.0').tracedTo(14, 24)
        .and.also.have.nested.property('args.0.args.0.receiver').tracedTo(14, 19)
        .and.also.have.nested.property('args.0.args.0.receiver.receiver').tracedTo(14, 15)
        .and.also.have.nested.property('args.0.args.0.receiver.args.0').tracedTo(18, 19)
        .and.also.have.nested.property('args.0.args.0.args.0').tracedTo(23, 24)
    })


  })

  describe('Prefix Operations', () => {
    const parser = Parse.Operation

    it('should parse the negation of a reference with the "!" operator', () => {
      '!a'.should.be.parsedBy(parser).into(
        Send(Reference('a'), '!_', [])
      ).and.be.tracedTo(0, 2)
        .and.have.nested.property('receiver').tracedTo(1, 2)
    })

    it('should parse negation with chained "!" operators', () => {
      '!!!a'.should.be.parsedBy(parser).into(
        Send(Send(Send(Reference('a'), '!_', []), '!_', []), '!_', [])
      ).and.be.tracedTo(0, 4)
        .and.have.nested.property('receiver').tracedTo(1, 4)
        .and.also.have.nested.property('receiver.receiver').tracedTo(2, 4)
        .and.also.have.nested.property('receiver.receiver.receiver').tracedTo(3, 4)
    })

    it('should parse arithmetic operators in prefix operations', () => {
      '-1'.should.be.parsedBy(parser).into(
        Send((Literal(1)), '-_', [])
      ).and.be.tracedTo(0, 2)
        .and.have.nested.property('receiver').tracedTo(1, 2)
    })


  })

  describe('Send', () => {
    const parser = Parse.Send

    it('should parse sending messages without parameters', () => {
      'a.m()'.should.be.parsedBy(parser).into(
        Send(Reference('a'), 'm', [])
      ).and.be.tracedTo(0, 5)
        .and.have.nested.property('receiver').tracedTo(0, 1)
    })

    it('should parse sending messages with a single parameter', () => {
      'a.m(5)'.should.be.parsedBy(parser).into(
        Send(Reference('a'), 'm', [Literal(5)])
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('receiver').tracedTo(0, 1)
        .and.also.have.nested.property('args.0').tracedTo(4, 5)
    })

    it('should parse sending messages with multiple arguments', () => {
      'a.m(5,7)'.should.be.parsedBy(parser).into(
        Send(Reference('a'), 'm', [Literal(5), Literal(7)])
      ).and.be.tracedTo(0, 8)
        .and.have.nested.property('receiver').tracedTo(0, 1)
        .and.also.have.nested.property('args.0').tracedTo(4, 5)
        .and.also.have.nested.property('args.1').tracedTo(6, 7)
    })

    it('should parse sending messages with a closure as an argument', () => {
      'a.m{p => p}'.should.be.parsedBy(parser).into(
        Send(Reference('a'), 'm', [Closure(Parameter('p'))(Reference('p'))])
      ).and.be.tracedTo(0, 11)
        .and.have.nested.property('receiver').tracedTo(0, 1)
        .and.also.have.nested.property('args.0').tracedTo(3, 11)
        .and.also.have.nested.property('args.0.value.members.0.parameters.0').tracedTo(4, 5)
        .and.also.have.nested.property('args.0.value.members.0.body.sentences.0').tracedTo(9, 10)
    })

    it('should parse compound sending messages', () => {
      'a.m().n().o()'.should.be.parsedBy(parser).into(
        Send(
          Send(Send(Reference('a'), 'm', []), 'n', []),
          'o',
          [])
      ).and.be.tracedTo(0, 13)
        .and.have.nested.property('receiver').tracedTo(0, 9)
        .and.also.have.nested.property('receiver.receiver').tracedTo(0, 5)
        .and.also.have.nested.property('receiver.receiver.receiver').tracedTo(0, 1)
    })

    it('should parse compound sending messages using methods with parameters', () => {
      '(a + 1).m(5)'.should.be.parsedBy(parser).into(
        Send(
          Send(Reference('a'), '+', [Literal(1)]),
          'm',
          [Literal(5)])
      ).and.be.tracedTo(0, 12)
        .and.have.nested.property('receiver').tracedTo(1, 6)
        .and.also.have.nested.property('receiver.receiver').tracedTo(1, 2)
        .and.also.have.nested.property('receiver.args.0').tracedTo(5, 6)
        .and.also.have.nested.property('args.0').tracedTo(10, 11)
    })

    it('should parse sending messages to numeric objects', () => {
      '1.5.m()'.should.be.parsedBy(parser).into(
        Send(Literal(1.5), 'm', [])
      ).and.be.tracedTo(0, 7)
        .and.have.nested.property('receiver').tracedTo(0, 3)
    })

    it('should not parse sending messages calling the method with a "," at the end of the parameters', () => {
      'a.m(p,)'.should.not.be.parsedBy(parser)
    })

    it('should not parse sending messages calling the method with a "," at the start of the parameters', () => {
      'a.m(,q)'.should.not.be.parsedBy(parser)
    })

    it('should not parse sending messages without parentheses', () => {
      'a.m'.should.not.be.parsedBy(parser)
    })

    it('should not parse an expression with a "." at the end', () => {
      'a.'.should.not.be.parsedBy(parser)
    })

    it('should not parse a call to a method without the reference that is calling', () => {
      'm(p,q)'.should.not.be.parsedBy(parser)
    })

    it('should not parse an expression with a "." at the start', () => {
      '.m'.should.not.be.parsedBy(parser)
    })

  })

  describe('Constructors', () => {

    const parser = Parse.New

    it('should parse constructors without parameters', () => {
      'new C()'.should.be.parsedBy(parser).into(
        New(Reference('C'), [])
      ).and.be.tracedTo(0, 7)
        .and.have.nested.property('className').tracedTo(4, 5)
    })

    it('should parse constructors with parameters', () => {
      'new C(1,2)'.should.be.parsedBy(parser).into(
        New(Reference('C'), [Literal(1), Literal(2)])
      ).and.be.tracedTo(0, 10)
        .and.have.nested.property('className').tracedTo(4, 5)
        .and.also.have.nested.property('args.0').tracedTo(6, 7)
        .and.also.have.nested.property('args.1').tracedTo(8, 9)
    })

    it('should not parse "new" keyword without a builder', () => {
      'new C'.should.not.be.parsedBy(parser)
    })

    it('should not parse "new" keyword without a class', () => {
      'new'.should.not.be.parsedBy(parser)
    })

  })

  describe('Super calls', () => {
    const parser = Parse.Super

    it('should parse super call without parameters', () => {
      'super()'.should.be.parsedBy(parser).into(
        Super()
      ).and.be.tracedTo(0, 7)
    })

    it('should parse super call with parameters', () => {
      'super(1,2)'.should.be.parsedBy(parser).into(
        Super([Literal(1), Literal(2)])
      ).and.be.tracedTo(0, 10)
        .and.have.nested.property('args.0').tracedTo(6, 7)
        .and.also.have.nested.property('args.1').tracedTo(8, 9)
    })

    it('should not parse "super" keyword without parentheses', () => {
      'super'.should.not.be.parsedBy(parser)
    })

    it('should not parse sending messages to a super call ', () => {
      'super.m()'.should.not.be.parsedBy(parser)
    })

  })

  describe('If expressions', () => {
    const parser = Parse.If

    it('should parse "if" with "then" body', () => {
      'if(a) x'.should.be.parsedBy(parser).into(
        If(Reference('a'), [Reference('x')])
      ).and.be.tracedTo(0, 7)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(6, 7)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
    })

    it('should parse "if" with "then" curly-braced body', () => {
      'if(a){x}'.should.be.parsedBy(parser).into(
        If(Reference('a'), [Reference('x')])
      ).and.be.tracedTo(0, 8)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(5, 8)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
    })

    it('should parse "if" with "then" with a multi-sentence curly-braced body', () => {
      'if(a){x;y}'.should.be.parsedBy(parser).into(
        If(Reference('a'), [Reference('x'), Reference('y')])
      ).and.be.tracedTo(0, 10)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(5, 10)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
        .and.also.have.nested.property('thenBody.sentences.1').tracedTo(8, 9)
    })

    it('should parse "if" with "then" and "else" body', () => {
      'if(a) x else y'.should.be.parsedBy(parser).into(
        If(Reference('a'), [Reference('x')], [Reference('y')])
      ).and.be.tracedTo(0, 14)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(6, 7)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
        .and.also.have.nested.property('elseBody').tracedTo(13, 14)
        .and.also.have.nested.property('elseBody.sentences.0').tracedTo(13, 14)
    })

    it('should parse "if" with "then" and "else" curly-braced body', () => {
      'if(a){x} else {y}'.should.be.parsedBy(parser).into(
        If(Reference('a'), [Reference('x')], [Reference('y')])
      ).and.be.tracedTo(0, 17)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(5, 8)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
        .and.also.have.nested.property('elseBody').tracedTo(14, 17)
        .and.also.have.nested.property('elseBody.sentences.0').tracedTo(15, 16)
    })

    it('should parse if inside other if', () => {
      'if(a) if(b) x else y'.should.be.parsedBy(parser).into(
        If(Reference('a'),
          [If(Reference('b'),
            [Reference('x')],
            [Reference('y')])])

      ).and.be.tracedTo(0, 20)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(6, 20)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 20)
        .and.also.have.nested.property('thenBody.sentences.0.condition').tracedTo(9, 10)
        .and.also.have.nested.property('thenBody.sentences.0.thenBody').tracedTo(12, 13)
        .and.also.have.nested.property('thenBody.sentences.0.thenBody.sentences.0').tracedTo(12, 13)
        .and.also.have.nested.property('thenBody.sentences.0.elseBody').tracedTo(19, 20)
        .and.also.have.nested.property('thenBody.sentences.0.elseBody.sentences.0').tracedTo(19, 20)
    })

    it('should parse "if" inside other "if" that have an else', () => {
      'if(a) if(b) x else y else z'.should.be.parsedBy(parser).into(
        If(Reference('a'),
          [If(Reference('b'), [Reference('x')], [Reference('y')])],
          [Reference('z')])

      ).and.be.tracedTo(0, 27)
        .and.have.nested.property('condition').tracedTo(3, 4)
        .and.also.have.nested.property('thenBody').tracedTo(6, 20)
        .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 20)
        .and.also.have.nested.property('thenBody.sentences.0.condition').tracedTo(9, 10)
        .and.also.have.nested.property('thenBody.sentences.0.thenBody').tracedTo(12, 13)
        .and.also.have.nested.property('thenBody.sentences.0.thenBody.sentences.0').tracedTo(12, 13)
        .and.also.have.nested.property('thenBody.sentences.0.elseBody').tracedTo(19, 20)
        .and.also.have.nested.property('thenBody.sentences.0.elseBody.sentences.0').tracedTo(19, 20)
        .and.also.have.nested.property('elseBody').tracedTo(26, 27)
        .and.also.have.nested.property('elseBody.sentences.0').tracedTo(26, 27)
    })

    it('should not parse "if" that doesn\'t have the condition inside parentheses', () => {
      'if a x else y'.should.not.be.parsedBy(parser)
    })

    it('should not parse "if" with an explicit empty "else"', () => {
      'if(a) x else'.should.not.be.parsedBy(parser)
    })

    it('should not parse "if" without a body', () => {
      'if(a)'.should.not.be.parsedBy(parser)
    })

  })

  describe('Try expressions', () => {
    const parser = Parse.Try

    it('should parse try expressions', () => {
      'try x'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {})
      ).and.be.tracedTo(0, 5)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
    })

    it('should parse try expressions with a curly-braced body', () => {
      'try{x}'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {})
      ).and.be.tracedTo(0, 6)
        .and.have.nested.property('body').tracedTo(3, 6)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
    })

    it('should parse try expressions with a catch', () => {
      'try x catch e h'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          catches: [
            Catch(Parameter('e'))(Reference('h')),
          ],
        })
      ).and.be.tracedTo(0, 15)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('catches.0').tracedTo(6, 15)
        .and.also.have.nested.property('catches.0.parameter').tracedTo(12, 13)
        .and.also.have.nested.property('catches.0.body').tracedTo(14, 15)
        .and.also.have.nested.property('catches.0.body.sentences.0').tracedTo(14, 15)
    })

    it('should parse try expressions with a curly-braced body', () => {
      'try x catch e{h}'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          catches: [
            Catch(Parameter('e'))(Reference('h')),
          ],
        })
      ).and.be.tracedTo(0, 16)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('catches.0').tracedTo(6, 16)
        .and.also.have.nested.property('catches.0.parameter').tracedTo(12, 13)
        .and.also.have.nested.property('catches.0.body').tracedTo(13, 16)
        .and.also.have.nested.property('catches.0.body.sentences.0').tracedTo(14, 15)
    })

    it('should parse try expressions with a catch with the parameter type', () => {
      'try x catch e:E h'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          catches: [
            Catch(Parameter('e'), { parameterType: Reference('E') })(Reference('h')),
          ],

        })
      ).and.be.tracedTo(0, 17)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('catches.0').tracedTo(6, 17)
        .and.also.have.nested.property('catches.0.parameter').tracedTo(12, 13)
        .and.also.have.nested.property('catches.0.parameterType').tracedTo(14, 15)
        .and.also.have.nested.property('catches.0.body').tracedTo(16, 17)
        .and.also.have.nested.property('catches.0.body.sentences.0').tracedTo(16, 17)
    })

    it('should parse try expressions with a "then always" body', () => {
      'try x then always a'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          always: [Reference('a')],
        })
      ).and.be.tracedTo(0, 19)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('always').tracedTo(18, 19)
        .and.also.have.nested.property('always').tracedTo(18, 19)
        .and.also.have.nested.property('always.sentences.0').tracedTo(18, 19)
    })

    it('should parse try expressions with a "then always" curly-braced body', () => {
      'try x then always{a}'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          always: [Reference('a')],
        })
      ).and.be.tracedTo(0, 20)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('always').tracedTo(17, 20)
        .and.also.have.nested.property('always.sentences.0').tracedTo(18, 19)
    })

    it('should parse try expressions with a catch and a "then always" body', () => {
      'try x catch e h then always a'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          catches: [
            Catch(Parameter('e'))(Reference('h')),
          ],
          always: [Reference('a')],
        })
      ).and.be.tracedTo(0, 29)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('catches.0').tracedTo(6, 15)
        .and.also.have.nested.property('catches.0.parameter').tracedTo(12, 13)
        .and.also.have.nested.property('catches.0.body').tracedTo(14, 15)
        .and.also.have.nested.property('catches.0.body.sentences.0').tracedTo(14, 15)
        .and.also.have.nested.property('always').tracedTo(28, 29)
        .and.also.have.nested.property('always.sentences.0').tracedTo(28, 29)
    })

    it('should parse try expressions with more than one catch', () => {
      'try x catch e h catch e i then always a'.should.be.parsedBy(parser).into(
        Try([Reference('x')], {
          catches: [
            Catch(Parameter('e'))(Reference('h')),
            Catch(Parameter('e'))(Reference('i')),
          ],
          always: [Reference('a')],
        })
      ).and.be.tracedTo(0, 39)
        .and.have.nested.property('body').tracedTo(4, 5)
        .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        .and.also.have.nested.property('catches.0').tracedTo(6, 15)
        .and.also.have.nested.property('catches.0.parameter').tracedTo(12, 13)
        .and.also.have.nested.property('catches.0.body').tracedTo(14, 15)
        .and.also.have.nested.property('catches.1').tracedTo(16, 25)
        .and.also.have.nested.property('catches.1.parameter').tracedTo(22, 23)
        .and.also.have.nested.property('catches.1.body').tracedTo(24, 25)
        .and.also.have.nested.property('always').tracedTo(38, 39)
    })

    it('should not parse try expressions with an incomplete "then always" body', () => {
      'try x catch e h then always'.should.not.be.parsedBy(parser)
    })

    it('should not parse try expressions with an incomplete catch body', () => {
      'try x catch e'.should.not.be.parsedBy(parser)
    })

    it('should not parse try expressions with a malformed catch body', () => {
      'try x catch{h}'.should.not.be.parsedBy(parser)
    })

    it('should not parse "try" keyword without a body', () => {
      'try'.should.not.be.parsedBy(parser)
    })

    it('should not parse a catch body without a try body', () => {
      'catch e {}'.should.not.be.parsedBy(parser)
    })

  })

  describe('Throw Expressions', () => {
    const parser = Parse.Throw

    it('should parse throw expressions', () => {
      'throw e'.should.be.parsedBy(parser).into(
        Throw(Reference('e'))
      ).and.be.tracedTo(0, 7)
        .and.have.nested.property('arg').tracedTo(6, 7)
    })

    it('should not parse "throw" keyword without a exception', () => {
      'throw'.should.not.be.parsedBy(parser)
    })

  })

})