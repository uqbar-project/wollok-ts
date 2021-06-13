import { should, use } from 'chai'
import { Assignment, Body, Catch, Class, Closure, Describe, Field, If, Import, Literal, Method, Mixin, NamedArgument, New, Package, Parameter, ParameterizedType, Program, Reference, Return, Send, Singleton, Super, Test, Throw, Try, Variable } from '../src/model'
import * as parse from '../src/parser'
import { parserAssertions } from './assertions'

const { raw } = String

use(parserAssertions)
should()


describe('Wollok parser', () => {

  describe('Comments', () => {
    const parser = parse.Import

    it('multiline comments should be ignored in between tokens', () => {
      `/*some comment*/import /* some
      comment */ p`.should.be.parsedBy(parser).into(new Import({ entity: new Reference({ name: 'p' }) }))
        .and.be.tracedTo(16, 49)
        .and.have.nested.property('entity').tracedTo(48, 49)
    })

    it('line comments should be ignored at the end of line', () => {
      `import //some comment
      p`.should.be.parsedBy(parser).into(new Import({ entity: new Reference({ name: 'p' }) }))
        .and.be.tracedTo(0, 29)
        .and.have.nested.property('entity').tracedTo(28, 29)
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
      'import p /* non-closed comment'.should.not.be.parsedBy(parser)
    })

  })


  describe('Names', () => {

    const parser = parse.name

    it('should parse names that begin with _', () => {
      '_foo123'.should.be.be.parsedBy(parser).into('_foo123')
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


  describe('Files', () => {

    it('should parse empty packages', () => {
      const parser = parse.File('foo.wlk')

      ''.should.be.parsedBy(parser).into(new Package({ fileName: 'foo.wlk', name:'foo' })).and.be.tracedTo(0, 0)
    })

    it('should parse non-empty packages', () => {
      const parser = parse.File('foo.wlk')

      'import p import q class C {}'.should.be.parsedBy(parser).into(
        new Package({
          fileName: 'foo.wlk',
          name:'foo',
          imports: [
            new Import({ entity: new Reference({ name: 'p' }) }),
            new Import({ entity: new Reference({ name: 'q' }) }),
          ],
          members: [
            new Class({ name: 'C' }),
          ],
        })
      ).and.be.tracedTo(0, 28)
        .and.have.nested.property('imports.0').tracedTo(0, 8)
        .and.also.have.nested.property('imports.1').tracedTo(9, 17)
        .and.also.have.nested.property('members.0').tracedTo(18, 28)
    })

    it('should nest parsed file inside the dir packages', () => {
      const parser = parse.File('a/b/foo.wlk')

      ''.should.be.parsedBy(parser).into(
        new Package({
          name: 'a',
          members: [
            new Package({
              name: 'b',
              members: [
                new Package({ fileName: 'a/b/foo.wlk', name:'foo' }),
              ],
            }),
          ],
        })
      ).and.have.nested.property('members.0.members.0').tracedTo(0, 0)
    })

  })


  describe('Imports', () => {

    const parser = parse.Import

    it('should parse imported packages', () => {
      'import p'.should.be.parsedBy(parser).into(new Import({ entity: new Reference({ name: 'p' }) }))
        .and.be.tracedTo(0, 8)
        .and.have.nested.property('entity').tracedTo(7, 8)
    })

    it('should parse generic imports', () => {
      'import p.q.*'.should.be.parsedBy(parser).into(
        new Import({
          entity: new Reference({ name: 'p.q' }),
          isGeneric: true,
        })
      ).and.be.tracedTo(0, 12)
        .and.have.nested.property('entity').tracedTo(7, 10)
    })

    it('should not parse malformed import statements', () => {
      'importp'.should.not.be.parsedBy(parser)
    })

    it('should not parse malformed import references', () => {
      'import p.*.q'.should.not.be.parsedBy(parser)
    })

    it('should not parse "import" keyword without a package', () => {
      'import *'.should.not.be.parsedBy(parser)
    })

  })


  describe('Entities', () => {

    describe('Packages', () => {
      const parser = parse.Package

      it('should parse empty packages', () => {
        'package p {}'.should.be.parsedBy(parser).into(new Package({ name: 'p' })).and.be.tracedTo(0, 12)
      })

      it('should parse non-empty packages', () => {
        'package p { class C {} }'.should.be.parsedBy(parser).into(
          new Package({
            name: 'p',
            members: [new Class({ name: 'C' })],
          })
        ).and.be.tracedTo(0, 24)
          .and.have.nested.property('members.0').tracedTo(12, 23)
      })

      it('should parse non-empty packages with more than one class', () => {
        'package p { class C {} class D {} }'.should.be.parsedBy(parser).into(
          new Package({
            name: 'p',
            members: [
              new Class({ name: 'C' }),
              new Class({ name: 'D' }),
            ],
          })
        ).and.be.tracedTo(0, 35)
          .and.have.nested.property('members.0').tracedTo(12, 23)
          .and.also.have.nested.property('members.1').tracedTo(23, 34)

      })


      it('should recover from entity parse error', () => {
        'package p { class A {} clazz B {} class C{} }'.should.be.parsedBy(parser)
          .recoveringFrom('malformedEntity', 23, 33)
          .into(new Package({
            name: 'p',
            members: [
              new Class({ name: 'A' }),
              new Class({ name: 'C' }),
            ],
          }))
      })

      it('should recover from intial member parse error', () => {
        'package p { clazz A {} class B {} class C{} }'.should.be.parsedBy(parser)
          .recoveringFrom('malformedEntity', 12, 22)
          .into(
            new Package({
              name: 'p',
              members: [
                new Class({ name: 'B' }),
                new Class({ name: 'C' }),
              ],
            })
          )
      })

      it('should recover from final member parse error', () => {
        'package p { class A {} class B {} clazz C{} }'.should.be.parsedBy(parser)
          .recoveringFrom('malformedEntity', 34, 43)
          .into(
            new Package({
              name: 'p',
              members: [
                new Class({ name: 'A' }),
                new Class({ name: 'B' }),
              ],
            })
          )
      })

      it('should recover from multiple member parse errors', () => {
        'package p { clazz A {} clazz B {} class C{} clazz D{} clazz E{} }'.should.be.parsedBy(parser)
          .recoveringFrom('malformedEntity', 12, 33)
          .recoveringFrom('malformedEntity', 44, 63)
          .into(
            new Package({
              name: 'p',
              members: [new Class({ name: 'C' })],
            })
          )
      })


      it('should not parse packages without a body', () => {
        'package p'.should.not.be.parsedBy(parser)
      })

    })


    describe('Classes', () => {
      const parser = parse.Class

      it('should parse empty classes', () => {
        'class C {}'.should.be.parsedBy(parser).into(new Class({ name: 'C' })).and.be.tracedTo(0, 10)
      })

      it('should parse classes with members', () => {
        'class C { var v method m(){} }'.should.be.parsedBy(parser).into(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'v', isReadOnly: false }),
              new Method({ name: 'm', body: new Body() }),
            ],
          })
        ).and.be.tracedTo(0, 30)
          .and.have.nested.property('members.0').tracedTo(10, 15)
          .and.also.have.nested.property('members.1').tracedTo(16, 29)
      })

      it('should parse classes that inherit from other class', () => {
        'class C inherits D {}'.should.be.parsedBy(parser).into(new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'D' }) })] }))
          .and.be.tracedTo(0, 21)
          .and.have.nested.property('supertypes.0').tracedTo(17, 18)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(17, 18)
      })

      it('should parse classes that inherit from other class with parameters', () => {
        'class C inherits D(x = 1) {}'.should.be.parsedBy(parser).into(
          new Class({
            name: 'C',
            supertypes: [
              new ParameterizedType({
                reference: new Reference({ name: 'D' }),
                args: [new NamedArgument({ name: 'x', value: new Literal({ value: 1 }) })],
              }),
            ],
          })
        ).and.be.tracedTo(0, 28)
          .and.have.nested.property('supertypes.0').tracedTo(17, 26)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(17, 18)
      })

      it('should parse classes that inherit from other class referenced with their qualified name', () => {
        'class C inherits p.D {}'.should.be.parsedBy(parser).into(new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'p.D' }) })] }))
          .and.be.tracedTo(0, 23)
          .and.have.nested.property('supertypes.0').tracedTo(17, 20)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(17, 20)
      })

      it('should parse classes that inherit from other class and have a mixin', () => {
        'class C inherits M and D {}'.should.be.parsedBy(parser).into(
          new Class({
            name: 'C',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        ).and.be.tracedTo(0, 27)
          .and.have.nested.property('supertypes.0').tracedTo(17, 18)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(17, 18)
          .and.also.have.nested.property('supertypes.1').tracedTo(23, 24)
          .and.also.have.nested.property('supertypes.1.reference').tracedTo(23, 24)
      })

      it('should recover from member parse error', () => {
        'class C {var var1 vr var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 18, 25)
          .into(
            new Class({
              name: 'C',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from intial member parse error', () => {
        'class C {vr var1 var var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 9, 16)
          .into(
            new Class({
              name: 'C',
              members: [
                new Field({ name: 'var2', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from final member parse error', () => {
        'class C {var var1 var var2 vr var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 27, 34)
          .into(
            new Class({
              name: 'C',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var2', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from multiple member parse errors', () => {
        'class C {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 9, 32)
          .recoveringFrom('malformedMember', 42, 57)
          .into(
            new Class({
              name: 'C',
              members: [new Field({ name: 'var4', isReadOnly: false })],
            })
          )
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

      it('should not parse the "and" keyword without "inherits"', () => {
        'class C and D {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without inherits or supertype', () => {
        'class C and {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without a trailing supertype', () => {
        'class C inherits M and {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without a trailing supertype or body', () => {
        'class C inherits M and'.should.not.be.parsedBy(parser)
      })

    })


    describe('Mixins', () => {

      const parser = parse.Mixin

      it('should parse empty mixins', () => {
        'mixin M {}'.should.be.parsedBy(parser).into(new Mixin({ name: 'M' })).and.be.tracedTo(0, 10)
      })

      it('should parse mixins that inherit from other mixins', () => {
        'mixin M inherits D {}'.should.be.parsedBy(parser).into(
          new Mixin({
            name: 'M',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        ).and.be.tracedTo(0, 21)
          .and.have.nested.property('supertypes.0').tracedTo(17, 18)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(17, 18)
      })

      it('should parse mixins that inherit from other mixins with parameters', () => {
        'mixin M inherits D(x = 1) {}'.should.be.parsedBy(parser).into(
          new Mixin({
            name: 'M',
            supertypes: [
              new ParameterizedType({
                reference: new Reference({ name: 'D' }),
                args: [new NamedArgument({ name: 'x', value: new Literal({ value: 1 }) })],
              }),
            ],
          })
        ).and.be.tracedTo(0, 28)
          .and.have.nested.property('supertypes.0').tracedTo(17, 26)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(17, 18)
      })

      it('should parse non-empty mixins', () => {
        'mixin M { var v method m(){} }'.should.be.parsedBy(parser).into(
          new Mixin({
            name: 'M',
            members: [
              new Field({ name: 'v', isReadOnly: false }),
              new Method({ name: 'm', body: new Body() }),
            ],
          })
        ).and.be.tracedTo(0, 30)
          .and.have.nested.property('members.0').tracedTo(10, 15)
          .and.also.have.nested.property('members.1').tracedTo(16, 29)
      })


      it('should recover from member parse error', () => {
        'mixin M {var var1 vr var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 18, 25)
          .into(
            new Mixin({
              name: 'M',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from intial member parse error', () => {
        'mixin M {vr var1 var var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 9, 16)
          .into(
            new Mixin({
              name: 'M',
              members: [
                new Field({ name: 'var2', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from final member parse error', () => {
        'mixin M {var var1 var var2 vr var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 27, 34)
          .into(
            new Mixin({
              name: 'M',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var2', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from multiple member parse errors', () => {
        'mixin M {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 9, 32)
          .recoveringFrom('malformedMember', 42, 57)
          .into(
            new Mixin({
              name: 'M',
              members: [new Field({ name: 'var4', isReadOnly: false })],
            })
          )
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

      const parser = parse.Singleton

      it('should parse empty objects', () => {
        'object o {}'.should.be.parsedBy(parser).into(new Singleton({ name: 'o' })).and.be.tracedTo(0, 11)
      })

      it('should parse non-empty objects', () => {
        'object o  { var v method m(){} }'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            members: [
              new Field({ name: 'v', isReadOnly: false }),
              new Method({ name: 'm', body: new Body() }),
            ],
          })
        ).and.be.tracedTo(0, 32)
          .and.have.nested.property('members.0').tracedTo(12, 17)
          .and.also.have.nested.property('members.1').tracedTo(18, 31)
      })

      it('should parse objects that inherits from a class', () => {
        'object o inherits D {}'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            supertypes: [new ParameterizedType({ reference: new Reference({ name: 'D' }) })],
          })
        ).and.be.tracedTo(0, 22)
          .and.have.nested.property('supertypes.0').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(18, 19)
      })

      it('should parse objects that inherit from a class with multiple parameters', () => {
        'object o inherits D(a = 5, b = 7) {}'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            supertypes: [new ParameterizedType({
              reference: new Reference({ name: 'D' }),
              args: [
                new NamedArgument({ name: 'a', value: new Literal({ value: 5 }) }),
                new NamedArgument({ name: 'b', value: new Literal({ value: 7 }) }),
              ],
            })],
          })
        ).and.be.tracedTo(0, 36)
          .and.have.nested.property('supertypes.0').tracedTo(18, 34)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.0.args.0').tracedTo(20, 25)
          .and.also.have.nested.property('supertypes.0.args.0.value').tracedTo(24, 25)
          .and.also.have.nested.property('supertypes.0.args.1').tracedTo(27, 32)
          .and.also.have.nested.property('supertypes.0.args.1.value').tracedTo(31, 32)
      })

      it('should parse objects that inherit from a class and have a mixin', () => {
        'object o inherits M and D {}'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        ).and.be.tracedTo(0, 28)
          .and.have.nested.property('supertypes.0').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.1').tracedTo(24, 25)
          .and.also.have.nested.property('supertypes.1.reference').tracedTo(24, 25)
      })

      it('should parse objects that inherit from a class and have a mixin referenced by a FQN', () => {
        'object o inherits p.M and D {}'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'p.M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        ).and.be.tracedTo(0, 30)
          .and.have.nested.property('supertypes.0').tracedTo(18, 21)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(18, 21)
          .and.also.have.nested.property('supertypes.1').tracedTo(26, 27)
          .and.also.have.nested.property('supertypes.1.reference').tracedTo(26, 27)
      })

      it('should parse objects that inherit from a class and have multiple mixins', () => {
        'object o inherits N and M and D {}'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        ).and.be.tracedTo(0, 34)
          .and.have.nested.property('supertypes.0').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.1').tracedTo(24, 25)
          .and.also.have.nested.property('supertypes.1.reference').tracedTo(24, 25)
          .and.also.have.nested.property('supertypes.2').tracedTo(30, 31)
          .and.also.have.nested.property('supertypes.2.reference').tracedTo(30, 31)
      })

      it('should parse objects thats have multiple mixins ', () => {
        'object o inherits N and M {}'.should.be.parsedBy(parser).into(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
            ],
          })
        ).and.be.tracedTo(0, 28)
          .and.have.nested.property('supertypes.0').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.0.reference').tracedTo(18, 19)
          .and.also.have.nested.property('supertypes.1').tracedTo(24, 25)
          .and.also.have.nested.property('supertypes.1.reference').tracedTo(24, 25)
      })


      it('should recover from member parse error', () => {
        'object o {var var1 vr var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 19, 26)
          .into(
            new Singleton({
              name: 'o',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from intial member parse error', () => {
        'object o {vr var1 var var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 10, 17)
          .into(
            new Singleton({
              name: 'o',
              members: [
                new Field({ name: 'var2', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from final member parse error', () => {
        'object o {var var1 var var2 vr var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 28, 35)
          .into(
            new Singleton({
              name: 'o',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var2', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from multiple member parse errors', () => {
        'object o {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 10, 33)
          .recoveringFrom('malformedMember', 43, 58)
          .into(
            new Singleton({
              name: 'o',
              members: [new Field({ name: 'var4', isReadOnly: false })],
            })
          )
      })

      it('should not parse the "object" keyword without a body', () => {
        'object'.should.not.be.parsedBy(parser)
      })

      it('should not parse objects without body', () => {
        'object o'.should.not.be.parsedBy(parser)
      })

      it('should not parse objects that inherit from more than one class', () => {
        'object o inherits D inherits E'.should.not.be.parsedBy(parser)
      })

      it('should not parse objects that use the "inherits" keyword without a superclass', () => {
        'object o inherits {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse objects that use the "inherits" keyword without a body and superclass', () => {
        'object o inherits'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without "inherits"', () => {
        'object o and D {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without inherits or supertype', () => {
        'object o and {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without a trailing supertype', () => {
        'object o inherits M and {}'.should.not.be.parsedBy(parser)
      })

      it('should not parse the "and" keyword without a trailing supertype or body', () => {
        'object o inherits M and'.should.not.be.parsedBy(parser)
      })

    })


    describe('Programs', () => {
      const parser = parse.Program
      it('should parse empty programs', () => {
        'program name { }'.should.be.parsedBy(parser).into(new Program({ name: 'name', body: new Body({}) })).and.be.tracedTo(0, 16)
      })

      it('should parse non-empty programs', () => {
        'program name { var x }'.should.be.parsedBy(parser).into(
          new Program({
            name: 'name', body: new Body({
              sentences: [
                new Variable({ name: 'x', isReadOnly: false }),
              ],
            }),
          })
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
      const parser = parse.Test

      it('should parse empty test', () => {
        'test "name" { }'.should.be.parsedBy(parser).into(new Test({ name: '"name"', body: new Body() })).and.be.tracedTo(0, 15)
      })

      it('should parse non-empty test', () => {
        'test "name" { var x }'.should.be.parsedBy(parser).into(
          new Test({
            name: '"name"', body: new Body({
              sentences: [
                new Variable({ name: 'x', isReadOnly: false }),
              ],
            }),
          })
        ).and.be.tracedTo(0, 21)
          .and.have.nested.property('body').tracedTo(12, 21)
      })

      it('should parse only test', () => {
        'only test "name" { }'.should.be.parsedBy(parser).into(new Test({ name: '"name"', isOnly: true, body: new Body() })).and.be.tracedTo(0, 20)
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
      const parser = parse.Describe

      it('should parse empty describe', () => {
        'describe "name" { }'.should.be.parsedBy(parser).into(new Describe({ name: '"name"' })).and.be.tracedTo(0, 19)
      })

      it('should parse describes with tests', () => {
        'describe "name" { test "foo" {} test "bar" {} }'.should.be.parsedBy(parser).into(
          new Describe({
            name: '"name"', members: [
              new Test({ name: '"foo"', body: new Body() }),
              new Test({ name: '"bar"', body: new Body() }),
            ],
          })
        ).and.be.tracedTo(0, 47)
          .and.have.nested.property('members.0').tracedTo(18, 32)
          .and.also.have.nested.property('members.1').tracedTo(32, 46)
      })

      it('should parse describes with fields', () => {
        'describe "name" { var v }'.should.be.parsedBy(parser).into(
          new Describe({ name: '"name"', members: [new Field({ name: 'v', isReadOnly: false })] })
        ).and.be.tracedTo(0, 25)
          .and.have.nested.property('members.0').tracedTo(18, 23)
      })

      it('should parse describes with methods', () => {
        'describe "name" { method m(){} }'.should.be.parsedBy(parser).into(
          new Describe({ name: '"name"', members: [new Method({ name: 'm', body: new Body() })] })
        ).and.be.tracedTo(0, 32)
          .and.have.nested.property('members.0').tracedTo(18, 31)
      })


      it('should recover from member parse error', () => {
        'describe "name" {var var1 vr var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 26, 33)
          .into(
            new Describe({
              name: '"name"',
              members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from intial member parse error', () => {
        'describe "name" {vr var1 var var2 var var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 17, 24)
          .into(
            new Describe({
              name: '"name"',
              members: [
                new Field({ name: 'var2', isReadOnly: false }),
                new Field({ name: 'var3', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from final member parse error', () => {
        'describe "name" {var var1 var var2 vr var3}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 35, 42)
          .into(
            new Describe({
              name: '"name"', members: [
                new Field({ name: 'var1', isReadOnly: false }),
                new Field({ name: 'var2', isReadOnly: false }),
              ],
            })
          )
      })

      it('should recover from multiple member parse errors', () => {
        'describe "name" {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}'.should.be.parsedBy(parser)
          .recoveringFrom('malformedMember', 17, 40)
          .recoveringFrom('malformedMember', 50, 65)
          .into(new Describe({ name: '"name"', members: [new Field({ name: 'var4', isReadOnly: false })] }))
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

  })

  describe('Members', () => {

    describe('Fields', () => {

      const parser = parse.Field

      it('should parse var declaration', () => {
        'var v'.should.be.parsedBy(parser).into(new Field({ name: 'v', isReadOnly: false })).and.be.tracedTo(0, 5)
      })


      it('should parse var declaration and asignation', () => {
        'var v = 5'.should.be.parsedBy(parser).into(
          new Field(
            {
              name: 'v',
              isReadOnly: false,
              value: new Literal({ value: 5 }),
            })
        ).and.be.tracedTo(0, 9)
          .and.have.nested.property('value').tracedTo(8, 9)

      })

      it('should parse const declaration', () => {
        'const v'.should.be.parsedBy(parser).into(new Field({ name: 'v', isReadOnly: true })).and.be.tracedTo(0, 7)
      })

      it('should parse const declaration and asignation', () => {
        'const v = 5'.should.be.parsedBy(parser).into(
          new Field(
            {
              name: 'v',
              isReadOnly: true,
              value: new Literal({ value: 5 }),
            })
        ).and.be.tracedTo(0, 11)
          .and.have.nested.property('value').tracedTo(10, 11)
      })

      it('should parse properties', () => {
        'var property v'.should.be.parsedBy(parser).into(
          new Field(
            {
              name: 'v',
              isReadOnly: false,
              isProperty: true,
            })
        ).and.be.tracedTo(0, 14)
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

      const parser = parse.Method

      it('should parse method declarations', () => {
        'method m()'.should.be.parsedBy(parser).into(new Method({ name: 'm', body: undefined })).and.be.tracedTo(0, 10)
      })

      it('should parse methods with operator characters as names ', () => {
        'method ==()'.should.be.parsedBy(parser).into(new Method({ name: '==', body: undefined })).and.be.tracedTo(0, 11)
      })

      it('should parse empty methods', () => {
        'method m() {}'.should.be.parsedBy(parser).into(new Method({ name: 'm', body: new Body() })).and.be.tracedTo(0, 13)
      })

      it('should parse methods that have parameters', () => {
        'method m(p, q) {}'.should.be.parsedBy(parser).into(
          new Method({
            name: 'm',
            body: new Body(),
            parameters: [new Parameter({ name: 'p' }), new Parameter({ name: 'q' })],
          })
        ).and.be.tracedTo(0, 17)
          .and.have.nested.property('parameters.0').tracedTo(9, 10)
          .and.also.have.nested.property('parameters.1').tracedTo(12, 13)
      })

      it('should parse methods that have vararg parameters', () => {
        'method m(p, q...) {}'.should.be.parsedBy(parser).into(
          new Method({
            name: 'm',
            body: new Body(),
            parameters: [new Parameter({ name: 'p' }), new Parameter({ name: 'q', isVarArg: true })],
          })
        ).and.be.tracedTo(0, 20)
          .and.have.nested.property('parameters.0').tracedTo(9, 10)
          .and.also.have.nested.property('parameters.1').tracedTo(12, 16)
      })

      it('should parse non-empty methods', () => {
        'method m() {var x}'.should.be.parsedBy(parser).into(
          new Method({
            name: 'm',
            body: new Body({ sentences: [new Variable({ name: 'x', isReadOnly: false })] }),
          })
        ).and.be.tracedTo(0, 18)
          .and.have.nested.property('body').tracedTo(11, 18)
          .and.also.have.nested.property('body.sentences.0').tracedTo(12, 17)
      })

      it('should parse methods defined as expressions', () => {
        'method m() = 5'.should.be.parsedBy(parser).into(
          new Method({
            name: 'm',
            body: new Body({ sentences: [new Literal({ value: 5 })] }),
          })
        ).and.be.tracedTo(0, 14)
          .and.have.nested.property('body').tracedTo(13, 14)
          .and.also.have.nested.property('body.sentences.0').tracedTo(13, 14)
      })

      it('should parse override methods', () => {
        'override method m() {}'.should.be.parsedBy(parser).into(
          new Method({ name: 'm', isOverride: true, body: new Body() })
        ).and.be.tracedTo(0, 22)
      })

      it('should parse native methods', () => {
        'method m() native'.should.be.parsedBy(parser).into(new Method({ name: 'm', body: 'native' })).and.be.tracedTo(0, 17)
      })

      it('should parse methods that have a closure as body', () => {
        'method m() = { 5 }'.should.be.parsedBy(parser).into(
          new Method({
            name: 'm',
            body: new Body({
              sentences: [
                Closure({
                  sentences: [new Literal({ value: 5 })],
                  code: '{ 5 }',
                }),
              ],
            }),
          })
        ).and.be.tracedTo(0, 18)
          .and.have.nested.property('body').tracedTo(13, 18)
          .and.also.have.nested.property('body.sentences.0').tracedTo(13, 18)
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

  })

  describe('Sentences', () => {

    describe('Variables', () => {
      const parser = parse.Variable
      it('should parse var declaration', () => {
        'var v'.should.be.parsedBy(parser).into(new Variable({ name: 'v', isReadOnly: false })).and.be.tracedTo(0, 5)
      })


      it('should parse var asignation', () => {
        'var v = 5'.should.be.parsedBy(parser).into(
          new Variable({
            name: 'v',
            isReadOnly: false,
            value: new Literal({ value: 5 }),
          })
        ).and.be.tracedTo(0, 9)
          .and.have.nested.property('value').tracedTo(8, 9)
      })

      it('should parse const declaration', () => {
        'const v'.should.be.parsedBy(parser).into(new Variable({ name: 'v', isReadOnly: true })).and.be.tracedTo(0, 7)
      })

      it('should parse const asignation', () => {
        'const v = 5'.should.be.parsedBy(parser).into(
          new Variable({
            name: 'v',
            isReadOnly: true,
            value: new Literal({ value: 5 }),
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
      const parser = parse.Return

      it('should parse returns', () => {
        'return 5'.should.be.parsedBy(parser).into(new Return({ value: new Literal({ value: 5 }) })).and.be.tracedTo(0, 8)
          .and.have.nested.property('value').tracedTo(7, 8)
      })

      it('parse empty return', () => {
        'return'.should.be.parsedBy(parser).into(new Return()).and.be.tracedTo(0, 6)
      })

    })


    describe('Assignments', () => {
      const parser = parse.Assignment

      it('should parse simple assignments', () => {
        'a = b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Reference({ name: 'b' }),
          })
        ).and.be.tracedTo(0, 5)
          .and.have.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value').tracedTo(4, 5)
      })

      it('should parse += operation ', () => {
        'a += b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '+',
              args: [new Reference({ name: 'b' })],
            }),
          })
        ).and.be.tracedTo(0, 6)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0').tracedTo(5, 6)
      })

      it('should parse -= operation', () => {
        'a -= b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '-',
              args: [new Reference({ name: 'b' })],
            }),
          })
        ).and.be.tracedTo(0, 6)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

      })

      it('should parse *= operation', () => {
        'a *= b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '*',
              args: [new Reference({ name: 'b' })],
            }),
          })
        ).and.be.tracedTo(0, 6)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

      })

      it('should parse /= operation', () => {
        'a /= b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '/',
              args: [new Reference({ name: 'b' })],
            }),
          })
        ).and.be.tracedTo(0, 6)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

      })

      it('should parse %= operation', () => {
        'a %= b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '%',
              args: [new Reference({ name: 'b' })],
            }),
          })
        ).and.be.tracedTo(0, 6)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0').tracedTo(5, 6)

      })

      it('should parse ||= operation and wrap the argument in a closure', () => {
        'a ||= b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '||',
              args: [Closure({ sentences: [new Reference({ name: 'b' })] })],
            }),
          })
        ).and.be.tracedTo(0, 7)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.receiver').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0.value.members.0.body.sentences.0').tracedTo(6, 7)

      })

      it('should parse &&= operation', () => {
        'a &&= b'.should.be.parsedBy(parser).into(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '&&',
              args: [Closure({ sentences: [new Reference({ name: 'b' })] })],
            }),
          })
        ).and.be.tracedTo(0, 7)
          .and.have.nested.property('variable').tracedTo(0, 1)
          .and.also.have.nested.property('value.args.0.value.members.0.body.sentences.0').tracedTo(6, 7)
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


    describe('Expressions', () => {

      describe('References', () => {

        const parser = parse.Reference

        it('should parse references that begin with _', () => {
          '_foo123'.should.be.be.parsedBy(parser).into(new Reference({ name: '_foo123' })).and.be.tracedTo(0, 7)
        })

        it('should parse uppercase references', () => {
          'C'.should.be.parsedBy(parser).into(new Reference({ name: 'C' })).and.be.tracedTo(0, 1)
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


      describe('Infix operations', () => {

        const parser = parse.Expression

        it('should parse operations with arithmetic operators that are used infixed', () => {
          'a + b + c'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Reference({ name: 'b' })],
              }),
              message: '+',
              args: [new Reference({ name: 'c' })],
            })
          ).and.be.tracedTo(0, 9)
            .and.have.nested.property('receiver').tracedTo(0, 5)
            .and.also.have.nested.property('receiver.receiver').tracedTo(0, 1)
            .and.also.have.nested.property('receiver.args.0').tracedTo(4, 5)
            .and.also.have.nested.property('args.0').tracedTo(8, 9)
        })

        it('should parse operations with parentheses to separate members', () => {
          'a + (b + c)'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: '+',
              args: [
                new Send({
                  receiver: new Reference({ name: 'b' }),
                  message: '+',
                  args: [new Reference({ name: 'c' })],
                }),
              ],
            })
          ).and.be.tracedTo(0, 11)
            .and.have.nested.property('receiver').tracedTo(0, 1)
            .and.also.have.nested.property('args.0').tracedTo(5, 10)
            .and.also.have.nested.property('args.0.receiver').tracedTo(5, 6)
            .and.also.have.nested.property('args.0.args.0').tracedTo(9, 10)
        })

        it('should parse infix operations with logical operators, wrapping the arguments in closures', () => {
          'a > b || c && d + e == f'.should.be.parsedBy(parser).into(

            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '>',
                args: [new Reference({ name: 'b' })],
              }),
              message: '||',
              args: [
                Closure({
                  sentences: [
                    new Send({
                      receiver: new Reference({ name: 'c' }),
                      message: '&&',
                      args: [
                        Closure({
                          sentences: [
                            new Send({
                              receiver: new Send({
                                receiver: new Reference({ name: 'd' }),
                                message: '+',
                                args: [new Reference({ name: 'e' })],
                              }),
                              message: '==',
                              args: [new Reference({ name: 'f' })],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          ).and.be.tracedTo(0, 24)
            .and.have.nested.property('receiver').tracedTo(0, 5)
            .and.also.have.nested.property('receiver.receiver').tracedTo(0, 1)
            .and.also.have.nested.property('receiver.args.0').tracedTo(4, 5)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0').tracedTo(9, 24)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0.receiver').tracedTo(9, 10)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0.args.0.value.members.0.body.sentences.0').tracedTo(14, 24)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0.args.0.value.members.0.body.sentences.0.receiver').tracedTo(14, 19)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0.args.0.value.members.0.body.sentences.0.receiver.receiver').tracedTo(14, 15)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0.args.0.value.members.0.body.sentences.0.receiver.args.0').tracedTo(18, 19)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0.args.0.value.members.0.body.sentences.0.args.0').tracedTo(23, 24)
        })

        describe('**', () => {
          it('has more precedence than *', () => {
            'a * b ** c'.should.be.parsedBy(parser).into(
              new Send({
                receiver: new Reference({ name: 'a' }),
                message: '*',
                args: [
                  new Send({
                    receiver: new Reference({ name: 'b' }),
                    message: '**',
                    args: [new Reference({ name: 'c' })],
                  })],
              })
            )
          })
        })

      })


      describe('Prefix Operations', () => {
        const parser = parse.Expression

        it('should parse the negation of a reference with the "!" operator', () => {
          '!a'.should.be.parsedBy(parser).into(
            new Send({ receiver: new Reference({ name: 'a' }), message: 'negate' })
          ).and.be.tracedTo(0, 2)
            .and.have.nested.property('receiver').tracedTo(1, 2)
        })

        it('should parse negation with chained "!" operators', () => {
          '!!!a'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Send({
                receiver: new Send({
                  receiver: new Reference({ name: 'a' }),
                  message: 'negate',
                }),
                message: 'negate',
              }),
              message: 'negate',
            })
          ).and.be.tracedTo(0, 4)
            .and.have.nested.property('receiver').tracedTo(1, 4)
            .and.also.have.nested.property('receiver.receiver').tracedTo(2, 4)
            .and.also.have.nested.property('receiver.receiver.receiver').tracedTo(3, 4)
        })

        it('should parse arithmetic operators in prefix operations', () => {
          '-1'.should.be.parsedBy(parser).into(new Send({ receiver: new Literal({ value: 1 }), message: 'invert' }))
            .and.be.tracedTo(0, 2)
            .and.have.nested.property('receiver').tracedTo(1, 2)
        })


      })


      describe('Send', () => {
        const parser = parse.Send

        it('should parse sending messages without parameters', () => {
          'a.m()'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
            })
          ).and.be.tracedTo(0, 5)
            .and.have.nested.property('receiver').tracedTo(0, 1)
        })

        it('should parse sending messages with a single parameter', () => {
          'a.m(5)'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
              args:[new Literal({ value: 5 })],
            })
          ).and.be.tracedTo(0, 6)
            .and.have.nested.property('receiver').tracedTo(0, 1)
            .and.also.have.nested.property('args.0').tracedTo(4, 5)
        })

        it('should parse sending messages with multiple arguments', () => {
          'a.m(5,7)'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
              args: [
                new Literal({ value: 5 }),
                new Literal({ value: 7 }),
              ],
            })
          ).and.be.tracedTo(0, 8)
            .and.have.nested.property('receiver').tracedTo(0, 1)
            .and.also.have.nested.property('args.0').tracedTo(4, 5)
            .and.also.have.nested.property('args.1').tracedTo(6, 7)
        })

        it('should parse sending messages with a closure as an argument', () => {
          'a.m{p => p}'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
              args: [
                Closure({
                  parameters: [new Parameter({ name: 'p' })],
                  sentences: [new Reference({ name: 'p' })],
                  code: '{p => p}',
                }),
              ],
            })
          ).and.be.tracedTo(0, 11)
            .and.have.nested.property('receiver').tracedTo(0, 1)
            .and.also.have.nested.property('args.0').tracedTo(3, 11)
            .and.also.have.nested.property('args.0.value.members.0.parameters.0').tracedTo(4, 5)
            .and.also.have.nested.property('args.0.value.members.0.body.sentences.0').tracedTo(9, 10)
        })

        it('should parse compound sending messages', () => {
          'a.m().n().o()'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Send({
                receiver: new Send({
                  receiver: new Reference({ name: 'a' }),
                  message: 'm',
                }),
                message: 'n',
              }),
              message: 'o',
            })
          ).and.be.tracedTo(0, 13)
            .and.have.nested.property('receiver').tracedTo(0, 9)
            .and.also.have.nested.property('receiver.receiver').tracedTo(0, 5)
            .and.also.have.nested.property('receiver.receiver.receiver').tracedTo(0, 1)
        })

        it('should parse compound sending messages using methods with parameters', () => {
          '(a + 1).m(5)'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Literal({ value: 1 })],
              }),
              message: 'm',
              args: [new Literal({ value: 5 })],
            })
          ).and.be.tracedTo(0, 12)
            .and.have.nested.property('receiver').tracedTo(1, 6)
            .and.also.have.nested.property('receiver.receiver').tracedTo(1, 2)
            .and.also.have.nested.property('receiver.args.0').tracedTo(5, 6)
            .and.also.have.nested.property('args.0').tracedTo(10, 11)
        })

        it('should parse sending messages to numeric objects', () => {
          '1.5.m()'.should.be.parsedBy(parser).into(
            new Send({
              receiver: new Literal({ value: 1.5 }),
              message: 'm',
            })
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


      describe('New', () => {

        const parser = parse.New

        it('should parse instantiations without parameters', () => {
          'new C()'.should.be.parsedBy(parser).into(new New({ instantiated: new Reference({ name: 'C' }) })).and.be.tracedTo(0, 7)
            .and.have.nested.property('instantiated').tracedTo(4, 5)
        })

        it('should parse instantiation with named arguments', () => {
          'new C(a = 1, b = 2)'.should.be.parsedBy(parser).into(
            new New({
              instantiated: new Reference({ name: 'C' }),
              args: [
                new NamedArgument({ name: 'a', value: new Literal({ value: 1 }) }),
                new NamedArgument({ name: 'b', value: new Literal({ value: 2 }) }),
              ],
            })
          ).and.be.tracedTo(0, 19)
            .and.have.nested.property('instantiated').tracedTo(4, 5)
            .and.also.have.nested.property('args.0').tracedTo(6, 11)
            .and.also.have.nested.property('args.0.value').tracedTo(10, 11)
            .and.also.have.nested.property('args.1').tracedTo(13, 18)
            .and.also.have.nested.property('args.1.value').tracedTo(17, 18)
        })

        it('should not parse instantiations without parameter names', () => {
          'new C(1,2)'.should.not.be.parsedBy(parser)
        })

        it('should not parse "new" keyword without arguments', () => {
          'new C'.should.not.be.parsedBy(parser)
        })

        it('should not parse "new" keyword without a class name', () => {
          'new'.should.not.be.parsedBy(parser)
        })

      })


      describe('Super calls', () => {
        const parser = parse.Super

        it('should parse super call without parameters', () => {
          'super()'.should.be.parsedBy(parser).into(new Super()).and.be.tracedTo(0, 7)
        })

        it('should parse super call with parameters', () => {
          'super(1,2)'.should.be.parsedBy(parser).into(
            new Super({ args: [new Literal({ value: 1 }), new Literal({ value: 2 })] })
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


      describe('If', () => {
        const parser = parse.If

        it('should parse "if" with "then" body', () => {
          'if(a) x'.should.be.parsedBy(parser).into(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
            })
          ).and.be.tracedTo(0, 7)
            .and.have.nested.property('condition').tracedTo(3, 4)
            .and.also.have.nested.property('thenBody').tracedTo(6, 7)
            .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
        })

        it('should parse "if" with "then" curly-braced body', () => {
          'if(a){x}'.should.be.parsedBy(parser).into(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
            })
          ).and.be.tracedTo(0, 8)
            .and.have.nested.property('condition').tracedTo(3, 4)
            .and.also.have.nested.property('thenBody').tracedTo(5, 8)
            .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
        })

        it('should parse "if" with "then" with a multi-sentence curly-braced body', () => {
          'if(a){x;y}'.should.be.parsedBy(parser).into(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' }), new Reference({ name: 'y' })] }),
            })
          ).and.be.tracedTo(0, 10)
            .and.have.nested.property('condition').tracedTo(3, 4)
            .and.also.have.nested.property('thenBody').tracedTo(5, 10)
            .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
            .and.also.have.nested.property('thenBody.sentences.1').tracedTo(8, 9)
        })

        it('should parse "if" with "then" and "else" body', () => {
          'if(a) x else y'.should.be.parsedBy(parser).into(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          ).and.be.tracedTo(0, 14)
            .and.have.nested.property('condition').tracedTo(3, 4)
            .and.also.have.nested.property('thenBody').tracedTo(6, 7)
            .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
            .and.also.have.nested.property('elseBody').tracedTo(13, 14)
            .and.also.have.nested.property('elseBody.sentences.0').tracedTo(13, 14)
        })

        it('should parse "if" with "then" and "else" curly-braced body', () => {
          'if(a){x} else {y}'.should.be.parsedBy(parser).into(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          ).and.be.tracedTo(0, 17)
            .and.have.nested.property('condition').tracedTo(3, 4)
            .and.also.have.nested.property('thenBody').tracedTo(5, 9)
            .and.also.have.nested.property('thenBody.sentences.0').tracedTo(6, 7)
            .and.also.have.nested.property('elseBody').tracedTo(14, 17)
            .and.also.have.nested.property('elseBody.sentences.0').tracedTo(15, 16)
        })

        it('should parse if inside other if', () => {
          'if(a) if(b) x else y'.should.be.parsedBy(parser).into(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({
                sentences: [
                  new If({
                    condition: new Reference({ name: 'b' }),
                    thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
                    elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
                  }),
                ],
              }),
            })
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
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({
                sentences: [
                  new If({
                    condition: new Reference({ name: 'b' }),
                    thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
                    elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
                  }),
                ],
              }),
              elseBody: new Body({ sentences: [new Reference({ name: 'z' })] }),
            })
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


      describe('Try', () => {
        const parser = parse.Try

        it('should parse try expressions', () => {
          'try x'.should.be.parsedBy(parser).into(
            new Try({ body: new Body({ sentences: [new Reference({ name: 'x' })] }) })
          ).and.be.tracedTo(0, 5)
            .and.have.nested.property('body').tracedTo(4, 5)
            .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        })

        it('should parse try expressions with a curly-braced body', () => {
          'try{x}'.should.be.parsedBy(parser).into(
            new Try({ body: new Body({ sentences: [new Reference({ name: 'x' })] }) })
          ).and.be.tracedTo(0, 6)
            .and.have.nested.property('body').tracedTo(3, 6)
            .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
        })

        it('should parse try expressions with a catch', () => {
          'try x catch e h'.should.be.parsedBy(parser).into(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
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
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
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
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  parameterType: new Reference({ name: 'E' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
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
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
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
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          ).and.be.tracedTo(0, 20)
            .and.have.nested.property('body').tracedTo(4, 5)
            .and.also.have.nested.property('body.sentences.0').tracedTo(4, 5)
            .and.also.have.nested.property('always').tracedTo(17, 20)
            .and.also.have.nested.property('always.sentences.0').tracedTo(18, 19)
        })

        it('should parse try expressions with a catch and a "then always" body', () => {
          'try x catch e h then always a'.should.be.parsedBy(parser).into(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
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
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'i' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
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


      describe('Throw', () => {
        const parser = parse.Throw

        it('should parse throw expressions', () => {
          'throw e'.should.be.parsedBy(parser).into(new Throw({ exception: new Reference({ name: 'e' }) })).and.be.tracedTo(0, 7)
            .and.have.nested.property('exception').tracedTo(6, 7)
        })

        it('should not parse "throw" keyword without a exception', () => {
          'throw'.should.not.be.parsedBy(parser)
        })

      })


      describe('Literals', () => {
        const parser = parse.Literal

        describe('Booleans', () => {

          it('should parse "true"', () => {
            'true'.should.be.parsedBy(parser).into(new Literal({ value: true })).and.be.tracedTo(0, 4)
          })

          it('should parse "false"', () => {
            'false'.should.be.parsedBy(parser).into(new Literal({ value: false })).and.be.tracedTo(0, 5)
          })

        })

        describe('Null', () => {

          it('should parse "null"', () => {
            'null'.should.be.parsedBy(parser).into(new Literal({ value: null })).and.be.tracedTo(0, 4)
          })

        })

        describe('Numbers', () => {

          it('should parse positive whole numbers', () => {
            '10'.should.be.parsedBy(parser).into(new Literal({ value: 10 })).and.be.tracedTo(0, 2)
          })

          it('should parse negative whole numbers', () => {
            '-1'.should.be.parsedBy(parser).into(new Literal({ value: -1 })).and.be.tracedTo(0, 2)
          })

          it('should parse fractional numbers', () => {
            '1.5'.should.be.parsedBy(parser).into(new Literal({ value: 1.5 })).and.be.tracedTo(0, 3)
          })

          it('should parse negative fractional numbers', () => {
            '-1.5'.should.be.parsedBy(parser).into(new Literal({ value: -1.5 })).and.be.tracedTo(0, 4)
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
            '"foo"'.should.be.parsedBy(parser).into(new Literal({ value: 'foo' })).and.be.tracedTo(0, 5)
          })

          it('should parse valid strings with single quote', () => {
            '\'foo\''.should.be.parsedBy(parser).into(new Literal({ value: 'foo' })).and.be.tracedTo(0, 5)
          })

          it('should parse empty strings', () => {
            '""'.should.be.parsedBy(parser).into(new Literal({ value: '' })).and.be.tracedTo(0, 2)
          })
          it('should parse strings with escape sequences', () => {
            '"foo\\nbar"'.should.be.parsedBy(parser).into(new Literal({ value: 'foo\nbar' })).and.be.tracedTo(0, 10)
          })

          it('should parse strings with the escaped escape character without escaping the whole sequence', () => {
            '"foo\\\\nbar"'.should.be.parsedBy(parser).into(new Literal({ value: 'foo\\nbar' })).and.be.tracedTo(0, 11)
          })

          it('should not parse strings with invalid escape sequences', () => {
            raw`"foo\xbar"`.should.not.be.parsedBy(parser)
          })

        })

        describe('Collections', () => {

          it('should parse empty lists', () => {
            '[]'.should.be.parsedBy(parser).into(
              new Literal({ value: [new Reference({ name: 'wollok.lang.List' }), []] })
            ).and.be.tracedTo(0, 2)
          })

          it('should parse non-empty lists', () => {
            '[1,2,3]'.should.be.parsedBy(parser).into(
              new Literal({
                value: [new Reference({ name: 'wollok.lang.List' }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2 }),
                  new Literal({ value: 3 }),
                ]],
              })
            ).and.be.tracedTo(0, 7)
              .and.have.nested.property('value.1.0').tracedTo(1, 2)
              .and.also.have.nested.property('value.1.1').tracedTo(3, 4)
              .and.also.have.nested.property('value.1.2').tracedTo(5, 6)
          })

          it('should parse empty sets', () => {
            '#{}'.should.be.parsedBy(parser).into(
              new Literal({ value: [new Reference({ name: 'wollok.lang.Set' }), []] })
            ).and.be.tracedTo(0, 3)
          })

          it('should parse non-empty sets', () => {
            '#{1,2,3}'.should.be.parsedBy(parser).into(
              new Literal({
                value: [new Reference({ name: 'wollok.lang.Set' }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2 }),
                  new Literal({ value: 3 }),
                ]],
              })
            ).and.be.tracedTo(0, 8)
              .and.have.nested.property('value.1.0').tracedTo(2, 3)
              .and.also.have.nested.property('value.1.1').tracedTo(4, 5)
              .and.also.have.nested.property('value.1.2').tracedTo(6, 7)
          })

        })

        describe('Objects', () => {

          it('should parse empty literal objects', () => {

            'object {}'.should.be.parsedBy(parser).into(new Literal({ value: new Singleton({}) })).and.be.tracedTo(0, 9)
          })

          it('should parse non-empty literal objects', () => {
            'object { var v method m(){} }'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  members: [
                    new Field({ name: 'v', isReadOnly: false }),
                    new Method({ name: 'm', body: new Body() }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 29)
              .and.have.nested.property('value.members.0').tracedTo(9, 14)
              .and.also.have.nested.property('value.members.1').tracedTo(15, 28)
          })

          it('should parse literal objects that inherit from a class', () => {
            'object inherits D {}'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  supertypes: [
                    new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 20)
              .and.have.nested.property('value.supertypes.0').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.0.reference').tracedTo(16, 17)
          })

          it('should parse literal objects that inherit from a class referenced with a FQN', () => {
            'object inherits p.D {}'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  supertypes: [
                    new ParameterizedType({ reference: new Reference({ name: 'p.D' }) }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 22)
              .and.have.nested.property('value.supertypes.0').tracedTo(16, 19)
              .and.also.have.nested.property('value.supertypes.0.reference').tracedTo(16, 19)
          })

          it('should parse literal objects that inherit from a class with explicit builders', () => {
            'object inherits D(v = 5) {}'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  supertypes: [
                    new ParameterizedType({
                      reference: new Reference({ name: 'D' }), args: [
                        new NamedArgument({ name: 'v', value: new Literal({ value: 5 }) }),
                      ],
                    }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 27)
              .and.have.nested.property('value.supertypes.0').tracedTo(16, 25)
              .and.also.have.nested.property('value.supertypes.0.reference').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.0.args.0').tracedTo(18, 23)
          })

          it('should parse literal objects that inherit from a class and have a mixin', () => {
            'object inherits M and D {}'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  supertypes: [
                    new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                    new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 26)
              .and.have.nested.property('value.supertypes.0').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.0.reference').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.1').tracedTo(22, 23)
              .and.also.have.nested.property('value.supertypes.1.reference').tracedTo(22, 23)
          })

          it('should parse literal objects that inherit from a class and have multiple mixins', () => {
            'object inherits N and M and D {}'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  supertypes: [
                    new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
                    new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                    new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 32)
              .and.have.nested.property('value.supertypes.0').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.0.reference').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.1').tracedTo(22, 23)
              .and.also.have.nested.property('value.supertypes.1.reference').tracedTo(22, 23)
              .and.also.have.nested.property('value.supertypes.2').tracedTo(28, 29)
              .and.also.have.nested.property('value.supertypes.2.reference').tracedTo(28, 29)
          })

          it('should parse literal objects that have multiple mixins', () => {
            'object inherits N and M {}'.should.be.parsedBy(parser).into(
              new Literal({
                value: new Singleton({
                  supertypes: [
                    new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
                    new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                  ],
                }),
              })
            ).and.be.tracedTo(0, 26)
              .and.have.nested.property('value.supertypes.0').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.0.reference').tracedTo(16, 17)
              .and.also.have.nested.property('value.supertypes.1').tracedTo(22, 23)
              .and.also.have.nested.property('value.supertypes.1.reference').tracedTo(22, 23)
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

          it('should not parse the "and" keyword without "inherits"', () => {
            'object and D {}'.should.not.be.parsedBy(parser)
          })

          it('should not parse the "and" keyword without a trailing supertype', () => {
            'object inherits M and {}'.should.not.be.parsedBy(parser)
          })

          it('should not parse the "and" keyword without a trailing supertype or body', () => {
            'object inherits M and'.should.not.be.parsedBy(parser)
          })
        })

        describe('Closure', () => {

          it('should parse empty closures', () => {
            '{}'.should.be.parsedBy(parser).into(
              Closure({ sentences: [], code: '{}' })
            ).and.be.tracedTo(0, 2)
          })

          it('should parse closures that do not receive parameters and returns nothing', () => {
            '{ => }'.should.be.parsedBy(parser).into(
              Closure({ sentences: [], code: '{ => }' })
            ).and.be.tracedTo(0, 6)
          })

          it('should parse closures without parameters', () => {
            '{ a }'.should.be.parsedBy(parser).into(
              Closure({ sentences: [new Reference({ name: 'a' })], code: '{ a }' })
            ).and.be.tracedTo(0, 5)
              .and.have.nested.property('value.members.0.body.sentences.0').tracedTo(2, 3)
          })

          it('should parse closures with return in their body', () => {
            '{ return a }'.should.be.parsedBy(parser).into(
              Closure({ sentences: [new Return({ value: new Reference({ name: 'a' }) })], code: '{ return a }' })
            ).and.be.tracedTo(0, 12)
              .and.have.nested.property('value.members.0.body.sentences.0').tracedTo(2, 10)
              .and.also.have.nested.property('value.members.0.body.sentences.0.value').tracedTo(9, 10)
          })

          it('should parse closure with parameters and no body', () => {
            '{ a => }'.should.be.parsedBy(parser).into(
              Closure({ parameters: [new Parameter({ name: 'a' })], sentences: [], code: '{ a => }' })
            ).and.be.tracedTo(0, 8)
              .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
          })

          it('should parse closures with parameters and body', () => {
            '{ a => a }'.should.be.parsedBy(parser).into(
              Closure({
                parameters: [new Parameter({ name: 'a' })],
                sentences: [new Reference({ name: 'a' })],
                code: '{ a => a }',
              })
            ).and.be.tracedTo(0, 10)
              .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
              .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(7, 8)

          })

          it('should parse closures with multiple sentence separated by ";"', () => {
            '{ a => a; b }'.should.be.parsedBy(parser).into(
              Closure({
                parameters: [new Parameter({ name: 'a' })],
                sentences: [
                  new Reference({ name: 'a' }),
                  new Reference({ name: 'b' }),
                ],
                code: '{ a => a; b }',
              })
            ).and.be.tracedTo(0, 13)
              .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
              .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(7, 8)
              .and.also.have.nested.property('value.members.0.body.sentences.1').tracedTo(10, 11)
          })

          it('should parse closures that receive two parameters and return the first one', () => {
            '{ a,b => a }'.should.be.parsedBy(parser).into(
              Closure({
                parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })],
                sentences: [new Reference({ name: 'a' })],
                code: '{ a,b => a }',
              })
            ).and.be.tracedTo(0, 12)
              .and.have.nested.property('value.members.0.parameters.0').tracedTo(2, 3)
              .and.also.have.nested.property('value.members.0.parameters.1').tracedTo(4, 5)
              .and.also.have.nested.property('value.members.0.body.sentences.0').tracedTo(9, 10)
          })

          it('should parse closures with vararg parameters', () => {
            '{ a,b... => a }'.should.be.parsedBy(parser).into(
              Closure({
                parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b', isVarArg: true })],
                sentences: [new Reference({ name: 'a' })],
                code: '{ a,b... => a }',
              })
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

    })

  })

})