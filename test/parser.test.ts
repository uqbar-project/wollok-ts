
import { Result } from 'parsimmon'
import { LIST_MODULE, SET_MODULE } from '../src'
import { Annotation, Assignment, Body, Catch, Class, Closure, ClosurePayload, Describe, Field, If, Import, Literal, Method, Mixin, Name, NamedArgument, New, Package, Parameter, ParameterizedType, Program, Reference, Return, Self, Send, Singleton, SourceIndex, Super, Test, Throw, Try, Variable } from '../src/model'
import * as parse from '../src/parser'
import { describe, expect, it } from 'vitest'

const { raw } = String

type AssertionFunction = <T>(result: Result<T>) => asserts result is { status: true; value: T }

const verifyParse: AssertionFunction = <T>(result: Result<T>): asserts result is { status: true; value: T } => {
  if (!result.status) throw new Error(`Parse failed: ${JSON.stringify(result)}`)
}

const shouldNotParse = <T>(result: Result<T>) => {
  expect(result.status).toBe(false)
}

describe('Wollok parser', () => {

  describe('Comments', () => {
    it('multiline comments should be ignored in between tokens', () => {
      const source = `/*some comment*/import /* some
      comment */ p`

      const parsed = parse.Import.parse(source)
      verifyParse<Import>(parsed)

      const importNode = parsed.value
      const entityNode = importNode.entity

      expect(parsed.value).parsedInto(
        new Import({
          entity: new Reference({
            name: 'p',
            metadata: [
              new Annotation('comment', {
                text: '/* some\n      comment */',
                position: 'start',
              }),
            ],
          }),
          metadata: [
            new Annotation('comment', {
              text: '/*some comment*/',
              position: 'start',
            }),
          ],
        })
      )

      expect(importNode).tracedTo([16, 49])

      expect(entityNode).tracedTo([48, 49])
    })

    it('line comments should be ignored at the end of line', () => {
      const code = `import //some comment
      p`

      const expected = new Import({
        entity: new Reference({
          name: 'p',
          metadata: [new Annotation('comment', {
            text: '//some comment',
            position: 'start',
          })],
        }),
      })

      const result = parse.Import.parse(code)
      expect(result.status).toBe(true)
      if (!result.status) throw new Error('Parse failed')

      expect(result.value).parsedInto(expected)
      expect(result.value).tracedTo([0, 29])
      expect(result.value.entity).tracedTo([28, 29])
    })

    it('comments after sends should be parsed', () => {
      const result = parse.Send.parse('pepita.vola() //some comment')
      verifyParse(result)
      expect(result.value).parsedInto(new Send({
        receiver: new Reference({ name: 'pepita' }),
        message: 'vola',
        metadata: [new Annotation('comment', { text: '//some comment', position: 'end' })],
      }))
    })

    it('comments after malformed sends should be parsed', () => {
      const result = parse.Send.parse('vola() //some comment')
      verifyParse(result)
      expect(result.value).parsedInto(new Send({
        receiver: new Literal({ value: null }),
        message: 'vola',
        metadata: [new Annotation('comment', { text: '//some comment', position: 'end' })],
      }))
      expect(result.value).recoveringFrom({ code: parse.MALFORMED_MESSAGE_SEND, start: 0, end: 4 })
    })

    it('comments after variable should be parsed', () => {
      const result = parse.Variable.parse('const a = 1 //some comment')
      verifyParse(result)
      expect(result.value).parsedInto(new Variable({
        name: 'a',
        isConstant: true,
        value: new Literal({
          value: 1,
          metadata: [new Annotation('comment', { text: '//some comment', position: 'end' })],
        }),
      }))
    })

    it('comments after variable in body should be parsed', () => {
      const result = parse.Body.parse(`{
        const a = 1 //some comment
      }`)
      verifyParse(result)
      expect(result.value).parsedInto(new Body({
        sentences: [
          new Variable({
            name: 'a',
            isConstant: true,
            value: new Literal({
              value: 1,
              metadata: [new Annotation('comment', { text: '//some comment', position: 'end' })],
            }),
          }),
        ],
      }))
    })

    it('comments after send in body should be parsed', () => {
      const result = parse.Body.parse(`{
        1.even() //some comment
      }`)
      verifyParse(result)
      expect(result.value).parsedInto(new Body({
        sentences: [
          new Send({
            message: 'even',
            receiver: new Literal({ value: 1 }),
            metadata: [new Annotation('comment', { text: '//some comment', position: 'end' })],
          }),
        ],
      }))
    })

    it('should not parse elements inside line comment', () => {
      shouldNotParse<Class>(parse.Class.parse('// import p'))
    })

    it('should not parse elements inside multiline comment', () => {
      shouldNotParse<Import>(parse.Import.parse(`/*
        import p
      */`))
    })

    it('should not parse elements with an unclosed multiline comment', () => {
      shouldNotParse<Import>(parse.Import.parse('import p /* non-closed comment'))
    })

    describe('as entities metadata', () => {
      const parser = parse.Class

      it('comment on previous line', () => {
        const result = parser.parse(`//some comment
        class c { }`)
        verifyParse(result)
        expect(result.value).parsedInto(new Class({
          name: 'c',
          metadata: [new Annotation('comment', { text: '//some comment', position: 'start' })],
        }))
        expect(result.value).tracedTo([23, 34])
      })

      it('many comments on previous lines', () => {
        const result = parser.parse(`//some comment
        //other comment
        class c { }`)
        verifyParse(result)
        expect(result.value).parsedInto(new Class({
          name: 'c',
          metadata: [
            new Annotation('comment', { text: '//some comment', position: 'start' }),
            new Annotation('comment', { text: '//other comment', position: 'start' }),
          ],
        }))
        expect(result.value).tracedTo([47, 58])
      })

      it('inner comment only', () => {
        const result = parser.parse(`class c {
          //some comment 
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(new Class({
          name: 'c',
          metadata: [
            new Annotation('comment', { text: '//some comment ', position: 'inner' }),
          ],
        }))
        expect(result.value).tracedTo([0, 45])
      })

      it('comment before member', () => {
        const result = parser.parse(`class c {
          //some comment
          method m() 
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(new Class({
          name: 'c',
          metadata: [],
          members: [
            new Method({
              name: 'm',
              metadata: [
                new Annotation('comment', { text: '//some comment', position: 'start' }),
              ],
            }),
          ],
        }))
        expect(result.value).tracedTo([0, 66])
      })

      it('comment before and after member', () => {
        const source = `class c { 
          //some comment
          method m()
          //other comment
        }`

        const result = parser.parse(source)
        verifyParse(result)

        const expected = new Class({
          name: 'c',
          metadata: [
            new Annotation('comment', { text: '//other comment', position: 'inner' }),
          ],
          members: [
            new Method({
              name: 'm',
              metadata: [
                new Annotation('comment', { text: '//some comment', position: 'start' }),
              ],
            }),
          ],
        })

        expect(result.value).parsedInto(expected)
        expect(result.value).tracedTo([0, 92])
      })

      it('comments before many members', () => {
        const source = `class c { 
          //some comment
          method m1()
          //other comment
          method m2() 
        }`

        const result = parser.parse(source)
        verifyParse(result)

        const expected = new Class({
          name: 'c',
          metadata: [],
          members: [
            new Method({
              name: 'm1',
              metadata: [
                new Annotation('comment', { text: '//some comment', position: 'start' }),
              ],
            }),
            new Method({
              name: 'm2',
              metadata: [
                new Annotation('comment', { text: '//other comment', position: 'start' }),
              ],
            }),
          ],
        })

        expect(result.value).parsedInto(expected)
        expect(result.value).tracedTo([0, 116])
      })

      it('comments before many members with body expressions', () => {
        const source = `class c { 
          //some comment
          method m1() = 1

          //other comment
          method m2() = 2
        }`

        const result = parser.parse(source)
        verifyParse(result)

        const expected = new Class({
          name: 'c',
          metadata: [],
          members: [
            new Method({
              name: 'm1',
              body: new Body({ sentences: [new Return({ value: new Literal({ value: 1 }) })] }),
              metadata: [
                new Annotation('comment', { text: '//some comment', position: 'start' }),
              ],
            }),
            new Method({
              name: 'm2',
              body: new Body({ sentences: [new Return({ value: new Literal({ value: 2 }) })] }),
              metadata: [
                new Annotation('comment', { text: '//other comment', position: 'start' }),
              ],
            }),
          ],
        })

        expect(result.value).parsedInto(expected)
        expect(result.value).tracedTo([0, 124])
      })

      it('comments before many members with body expressions with send', () => {
        const source = `class c { 
          //some comment
          method m1() = self.m2()

          //other comment
          method m2() = 2
        }`

        const result = parser.parse(source)
        verifyParse(result)

        const expected = new Class({
          name: 'c',
          metadata: [],
          members: [
            new Method({
              name: 'm1',
              body: new Body({
                sentences: [
                  new Return({
                    value: new Send({
                      receiver: new Self(),
                      message: 'm2',
                    }),
                  }),
                ],
              }),
              metadata: [
                new Annotation('comment', { text: '//some comment', position: 'start' }),
              ],
            }),
            new Method({
              name: 'm2',
              body: new Body({ sentences: [new Return({ value: new Literal({ value: 2 }) })] }),
              metadata: [
                new Annotation('comment', { text: '//other comment', position: 'start' }),
              ],
            }),
          ],
        })

        expect(result.value).parsedInto(expected)
        expect(result.value).tracedTo([0, 132])
      })

      it('comments with block closures', () => {
        const source = `class c { 
          //some comment
          const f = { }

          //other comment
        }`

        const result = parser.parse(source)
        verifyParse(result)

        const expected = new Class({
          name: 'c',
          members: [
            new Field({
              name: 'f',
              value: Closure({ code: '{ }' }),
              isConstant: true,
              metadata: [
                new Annotation('comment', { text: '//some comment', position: 'start' }),
              ],
            }),
          ],
          metadata: [
            new Annotation('comment', { text: '//other comment', position: 'inner' }),
          ],
        })

        expect(result.value).parsedInto(expected)
        expect(result.value).tracedTo([0, 96])
      })

    })

  })

  describe('Annotations', () => {

    const parser = parse.annotation

    it('should parse annotations without parameters', () => {
      const result = parser.parse('@Annotation')
      verifyParse(result)
      expect(result.value).parsedInto(new Annotation('Annotation'))
    })

    it('should parse annotations with empty parameters', () => {
      const result = parser.parse('@Annotation()')
      verifyParse(result)
      expect(result.value).parsedInto(new Annotation('Annotation'))
    })

    it('should parse annotations with numeric parameter', () => {
      const result = parser.parse('@Annotation(x = 1)')
      verifyParse(result)
      expect(result.value).parsedInto(new Annotation('Annotation', { x: 1 }))
    })

    it('should parse annotations with string parameter', () => {
      const result = parser.parse('@Annotation(x="a")')
      verifyParse(result)
      expect(result.value).parsedInto(new Annotation('Annotation', { x: 'a' }))
    })

    it('should parse annotations with boolean parameter', () => {
      const result = parser.parse('@Annotation(x = true)')
      verifyParse(result)
      expect(result.value).parsedInto(new Annotation('Annotation', { x: true }))
    })

    it('should parse annotations with multiple parameters', () => {
      const result = parser.parse('@Annotation (x = 1, y = "a", z=true)')
      verifyParse(result)
      expect(result.value).parsedInto(new Annotation('Annotation', { x: 1, y: 'a', z: true }))
    })

    it('should not parse malformed annotations', () => {
      shouldNotParse<Annotation>(parser.parse('Annotation'))
      shouldNotParse<Annotation>(parser.parse('Annotation(x = true)'))
      shouldNotParse<Annotation>(parser.parse('@ Annotation'))
      shouldNotParse<Annotation>(parser.parse('@ Annotation(x = true)'))
      shouldNotParse<Annotation>(parser.parse('@Annotation(x = y)'))
      shouldNotParse<Annotation>(parser.parse('@Annotation(true)'))
      shouldNotParse<Annotation>(parser.parse('@Annotation('))
      shouldNotParse<Annotation>(parser.parse('@Annotation)'))
    })
  })

  describe('Names', () => {

    const parser = parse.name

    it('should parse names that begin with _', () => {
      const result = parser.parse('_foo123')
      verifyParse(result)
      expect(result.value).parsedInto('_foo123')
    })

    it('should parse names that contains unicode chars', () => {
      const result = parser.parse('_foö123_and_bár')
      verifyParse(result)
      expect(result.value).parsedInto('_foö123_and_bár')
    })

    it('should not parse names with spaces', () => {
      shouldNotParse<Name>(parser.parse('foo bar'))
    })

    it('should not parse names that begin with numbers', () => {
      shouldNotParse<Name>(parser.parse('4foo'))
    })

    it('should not parse operators as names', () => {
      shouldNotParse<Name>(parser.parse('=='))
    })

    it('should not parse strings as names', () => {
      shouldNotParse<Name>(parser.parse('"foo"'))
    })

    it('should not parse strings containing unicode as names', () => {
      shouldNotParse<Name>(parser.parse('"foö"'))
    })
  })

  describe('Files', () => {
    const parser = parse.File('foo.wlk')

    it('should parse empty packages', () => {
      const result = parser.parse('')
      verifyParse(result)
      expect(result.value).parsedInto(new Package({ fileName: 'foo.wlk', name: 'foo' }))
    })

    it('should parse non-empty packages', () => {
      const result = parser.parse('import p import q class C {}')
      verifyParse(result)
      expect(result.value).parsedInto(
        new Package({
          fileName: 'foo.wlk',
          name: 'foo',
          imports: [
            new Import({ entity: new Reference({ name: 'p' }) }),
            new Import({ entity: new Reference({ name: 'q' }) }),
          ],
          members: [
            new Class({ name: 'C' }),
          ],
        })
      )
      expect(result.value.imports[0]).tracedTo([0, 8])
      expect(result.value.imports[1]).tracedTo([9, 17])
      expect(result.value.members[0]).tracedTo([18, 28])
    })

    it('should nest parsed file inside the dir packages', () => {
      const parser = parse.File('a/b/foo.wlk')
      const result = parser.parse('')
      verifyParse(result)
      expect(result.value).parsedInto(
        new Package({
          name: 'a',
          members: [
            new Package({
              name: 'b',
              members: [
                new Package({ fileName: 'a/b/foo.wlk', name: 'foo' }),
              ],
            }),
          ],
        })
      )
    })

    it('should parse annotated members', () => {
      const result = parser.parse('@A(x = 1) class C {}')
      verifyParse(result)
      expect(result.value).parsedInto(
        new Package({
          fileName: 'foo.wlk',
          name: 'foo',
          members: [
            new Class({ name: 'C', metadata: [new Annotation('A', { x: 1 })] }),
          ],
        })
      )
    })

    it('should recover from entity parse error', () => {
      const result = parser.parse('class A {} clazz B {method m () {}} class C{}')
      verifyParse(result)
      expect(result.value).parsedInto(new Package({
        fileName: 'foo.wlk',
        name: 'foo',
        members: [
          new Class({ name: 'A' }),
          new Class({ name: 'C' }),
        ],
      }))
    })

  })

  describe('Imports', () => {

    const parser = parse.Import

    it('should parse imported packages', () => {
      const result = parser.parse('import p')
      verifyParse(result)
      expect(result.value).parsedInto(new Import({ entity: new Reference({ name: 'p' }) }))
      expect(result.value).tracedTo([0, 8])
      expect(result.value.entity).tracedTo([7, 8])
    })

    it('should parse generic imports', () => {
      const result = parser.parse('import p.q.*')
      verifyParse(result)
      expect(result.value).parsedInto(
        new Import({
          entity: new Reference({ name: 'p.q' }),
          isGeneric: true,
        })
      )
      expect(result.value).tracedTo([0, 12])
      expect(result.value.entity).tracedTo([7, 10])
    })

    it('should parse annotated nodes', () => {
      const result = parser.parse('@A(x = 1) import p')
      verifyParse(result)
      expect(result.value).parsedInto(
        new Import({ entity: new Reference({ name: 'p' }), metadata: [new Annotation('A', { x: 1 })] })
      )
    })

    it('should parse multiply annotated nodes', () => {
      const result = parser.parse('@A(x = 1)\n       @B\n       import p')
      verifyParse(result)
      expect(result.value).parsedInto(
        new Import({ entity: new Reference({ name: 'p' }), metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
      )
    })

    it('should not parse malformed import statements', () => {
      shouldNotParse<Import>(parser.parse('importp'))
    })

    it('should not parse malformed import references', () => {
      shouldNotParse<Import>(parser.parse('import p.*.q'))
    })

    it('should not parse "import" keyword without a package', () => {
      shouldNotParse<Import>(parser.parse('import *'))
    })

  })

  describe('Entities', () => {

    describe('Packages', () => {
      const parser = parse.Package

      it('should parse empty packages', () => {
        const result = parser.parse('package p {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Package({ name: 'p' }))
        expect(result.value).tracedTo([0, 12])
      })

      it('should parse non-empty packages', () => {
        const result = parser.parse('package p { class C {} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Package({
            name: 'p',
            members: [new Class({ name: 'C' })],
          })
        )
        expect(result.value).tracedTo([0, 24])
        expect(result.value.members[0]).tracedTo([12, 22])
      })

      it('should parse non-empty packages with more than one class', () => {
        const result = parser.parse('package p { class C {} class D {} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Package({
            name: 'p',
            members: [
              new Class({ name: 'C' }),
              new Class({ name: 'D' }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 35])
        expect(result.value.members[0]).tracedTo([12, 22])
        expect(result.value.members[1]).tracedTo([23, 33])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) package p {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Package({ name: 'p', metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse('@A(x = 1)\n         @B\n         package p {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Package({ name: 'p', metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`package p {
          class A {}
          @B(x = 1)
          class B {}
          class C {}
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Package({
            name: 'p',
            members: [
              new Class({ name: 'A' }),
              new Class({ name: 'B', metadata: [new Annotation('B', { x: 1 })] }),
              new Class({ name: 'C' }),
            ],
          })
        )
      })

      it('should recover from entity parse error', () => {
        const result = parser.parse('package p { class A {} clazz B {method m () {}} class C{} }')
        verifyParse(result)
        expect(result.value).parsedInto(new Package({
          name: 'p',
          members: [
            new Class({ name: 'A' }),
            new Class({ name: 'C' }),
          ],
        }))
      })

      it('should recover from intial member parse error', () => {
        const result = parser.parse('package p { clazz A {method m () {}} class B {} class C{} }')
        verifyParse(result)
        expect(result.value).parsedInto(
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
        const result = parser.parse('package p { class A {} class B {} clazz C{method m () {}} }')
        verifyParse(result)
        expect(result.value).parsedInto(
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
        const result = parser.parse('package p { clazz A {method m () {}} clazz B {} class C{} clazz D{method m () {}} clazz E{method m () {}} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Package({
            name: 'p',
            members: [new Class({ name: 'C' })],
          })
        )
      })

      it('should not parse packages without a body', () => {
        shouldNotParse(parser.parse('package p'))
      })

    })

    describe('Classes', () => {
      const parser = parse.Class

      it('should parse empty classes', () => {
        const result = parser.parse('class C {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'C' }))
        expect(result.value).tracedTo([0, 10])
      })

      it('should parse classes with members', () => {
        const result = parser.parse('class C { var v method m(){} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'v', isConstant: false }),
              new Method({ name: 'm', body: new Body() }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 30])
        expect(result.value.members[0]).tracedTo([10, 15])
        expect(result.value.members[1]).tracedTo([16, 28])
      })

      it('should parse classes that inherit from other class', () => {
        const result = parser.parse('class C inherits D {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'D' }) })] }))
        expect(result.value).tracedTo([0, 21])
        expect(result.value.supertypes[0]).tracedTo([17, 18])
        expect(result.value.supertypes[0].reference).tracedTo([17, 18])
      })

      it('should parse classes that inherit from other class with parameters', () => {
        const result = parser.parse('class C inherits D(x = 1) {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            supertypes: [
              new ParameterizedType({
                reference: new Reference({ name: 'D' }),
                args: [new NamedArgument({ name: 'x', value: new Literal({ value: 1 }) })],
              }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 28])
        expect(result.value.supertypes[0]).tracedTo([17, 25])
        expect(result.value.supertypes[0].reference).tracedTo([17, 18])
      })

      it('should parse classes that inherit from other class referenced with their qualified name', () => {
        const result = parser.parse('class C inherits p.D {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'p.D' }) })] }))
        expect(result.value).tracedTo([0, 23])
        expect(result.value.supertypes[0]).tracedTo([17, 20])
        expect(result.value.supertypes[0].reference).tracedTo([17, 20])
      })

      it('should parse classes that inherit from other class and have a mixin', () => {
        const result = parser.parse('class C inherits M and D {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 27])
        expect(result.value.supertypes[0]).tracedTo([17, 18])
        expect(result.value.supertypes[0].reference).tracedTo([17, 18])
        expect(result.value.supertypes[1]).tracedTo([23, 24])
        expect(result.value.supertypes[1].reference).tracedTo([23, 24])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) class C {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'C', metadata: [new Annotation('A', { x: 1 })] }))
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse('@A(x = 1) @B class C {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({ name: 'C', metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`class C {
          var f
          @A(x = 1)
          var g
          @B(x = 1)
          method m(){}
          method n(){}
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'f', isConstant: false }),
              new Field({ name: 'g', isConstant: false, metadata: [new Annotation('A', { x: 1 })] }),
              new Method({ name: 'm', body: new Body(), metadata: [new Annotation('B', { x: 1 })] }),
              new Method({ name: 'n', body: new Body() }),
            ],
          })
        )
      })

      it('should recover from member parse error', () => {
        const result = parser.parse('class C {var var1 methd m() {} var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from intial member parse error', () => {
        const result = parser.parse('class C {vr var1 var var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'var2', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from final member parse error', () => {
        const result = parser.parse('class C {var var1 var var2 vr var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var2', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from multiple member parse errors', () => {
        const result = parser.parse('class C {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [new Field({ name: 'var4', isConstant: false })],
          })
        )
      })

      it('should recover from annotated member parse error', () => {
        const result = parser.parse('class C {var var1 @A vr var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Class({
            name: 'C',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should not parse "class" keyword without a body', () => {
        shouldNotParse(parser.parse('class'))
      })

      it('should not parse classes without name ', () => {
        shouldNotParse(parser.parse('class {}'))
      })

      it('should not parse classes without a body ', () => {
        shouldNotParse(parser.parse('class C'))
      })

      it('should not parse classes thats inherits from more than one class', () => {
        shouldNotParse(parser.parse('class C inherits D inherits E'))
      })

      it('should not parse classes that use the "inherits" keyword without a superclass ', () => {
        shouldNotParse(parser.parse('class C inherits'))
      })

      it('should not parse "class C inherits" keyword without a body and superclass ', () => {
        shouldNotParse(parser.parse('class C inherits'))
      })

      it('should not parse the "and" keyword without "inherits"', () => {
        shouldNotParse(parser.parse('class C and D {}'))
      })

      it('should not parse the "and" keyword without inherits or supertype', () => {
        shouldNotParse(parser.parse('class C and {}'))
      })

      it('should not parse the "and" keyword without a trailing supertype', () => {
        shouldNotParse(parser.parse('class C inherits M and {}'))
      })

      it('should not parse the "and" keyword without a trailing supertype or body', () => {
        shouldNotParse(parser.parse('class C inherits M and'))
      })

    })

    describe('Mixins', () => {

      const parser = parse.Mixin

      it('should parse empty mixins', () => {
        const result = parser.parse('mixin M {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Mixin({ name: 'M' }))
        expect(result.value).tracedTo([0, 10])
      })

      it('should parse mixins that inherit from other mixins', () => {
        const result = parser.parse('mixin M inherits D {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 21])
        expect(result.value.supertypes[0]).tracedTo([17, 18])
        expect(result.value.supertypes[0].reference).tracedTo([17, 18])
      })

      it('should parse mixins that inherit from other mixins with parameters', () => {
        const result = parser.parse('mixin M inherits D(x = 1) {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            supertypes: [
              new ParameterizedType({
                reference: new Reference({ name: 'D' }),
                args: [new NamedArgument({ name: 'x', value: new Literal({ value: 1 }) })],
              }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 28])
        expect(result.value.supertypes[0]).tracedTo([17, 25])
        expect(result.value.supertypes[0].reference).tracedTo([17, 18])
      })

      it('should parse non-empty mixins', () => {
        const result = parser.parse('mixin M { var v method m(){} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            members: [
              new Field({ name: 'v', isConstant: false }),
              new Method({ name: 'm', body: new Body() }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 30])
        expect(result.value.members[0]).tracedTo([10, 15])
        expect(result.value.members[1]).tracedTo([16, 28])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) mixin M {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({ name: 'M', metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse('@A(x = 1)\n         @B\n         mixin M {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({ name: 'M', metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`mixin M {
          var f
          @A(x = 1)
          var g
          @B(x = 1)
          method m(){}
          method n(){}
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            members: [
              new Field({ name: 'f', isConstant: false }),
              new Field({ name: 'g', isConstant: false, metadata: [new Annotation('A', { x: 1 })] }),
              new Method({ name: 'm', body: new Body(), metadata: [new Annotation('B', { x: 1 })] }),
              new Method({ name: 'n', body: new Body() }),
            ],
          })
        )
      })

      it('should recover from member parse error', () => {
        const result = parser.parse('mixin M {var var1 vr var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from intial member parse error', () => {
        const result = parser.parse('mixin M {vr var1 var var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            members: [
              new Field({ name: 'var2', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from final member parse error', () => {
        const result = parser.parse('mixin M {var var1 var var2 vr var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var2', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from multiple member parse errors', () => {
        const result = parser.parse('mixin M {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Mixin({
            name: 'M',
            members: [new Field({ name: 'var4', isConstant: false })],
          })
        )
      })

      it('should not parse "mixin" keyword without name and body', () => {
        shouldNotParse(parser.parse('mixin'))
      })

      it('should not parse mixins without name', () => {
        shouldNotParse(parser.parse('mixin {}'))
      })

      it('should not parse mixins without body', () => {
        shouldNotParse(parser.parse('mixin M'))
      })

    })

    describe('Singletons', () => {

      const parser = parse.Singleton

      it('should parse empty objects', () => {
        const result = parser.parse('object o {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Singleton({ name: 'o' }))
        expect(result.value).tracedTo([0, 11])
      })

      it('should parse non-empty objects', () => {
        const result = parser.parse('object o  { var v method m(){} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            members: [
              new Field({ name: 'v', isConstant: false }),
              new Method({ name: 'm', body: new Body() }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 32])
        expect(result.value.members[0]).tracedTo([12, 17])
        expect(result.value.members[1]).tracedTo([18, 30])
      })

      it('should parse objects that inherits from a class', () => {
        const result = parser.parse('object o inherits D {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            supertypes: [new ParameterizedType({ reference: new Reference({ name: 'D' }) })],
          })
        )
        expect(result.value).tracedTo([0, 22])
        expect(result.value.supertypes[0]).tracedTo([18, 19])
        expect(result.value.supertypes[0].reference).tracedTo([18, 19])
      })

      it('should parse objects that inherit from a class with multiple parameters', () => {
        const result = parser.parse('object o inherits D(a = 5, b = 7) {}')
        verifyParse(result)
        expect(result.value).parsedInto(
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
        )
        expect(result.value).tracedTo([0, 36])
        expect(result.value.supertypes[0]).tracedTo([18, 33])
        expect(result.value.supertypes[0].reference).tracedTo([18, 19])
        expect(result.value.supertypes[0].args[0]).tracedTo([20, 25])
        expect(result.value.supertypes[0].args[0].value).tracedTo([24, 25])
        expect(result.value.supertypes[0].args[1]).tracedTo([27, 32])
        expect(result.value.supertypes[0].args[1].value).tracedTo([31, 32])
      })

      it('should parse objects that inherit from a class and have a mixin', () => {
        const result = parser.parse('object o inherits M and D {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 28])
        expect(result.value.supertypes[0]).tracedTo([18, 19])
        expect(result.value.supertypes[0].reference).tracedTo([18, 19])
        expect(result.value.supertypes[1]).tracedTo([24, 25])
        expect(result.value.supertypes[1].reference).tracedTo([24, 25])
      })

      it('should parse objects that inherit from a class and have a mixin referenced by a FQN', () => {
        const result = parser.parse('object o inherits p.M and D {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'p.M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 30])
        expect(result.value.supertypes[0]).tracedTo([18, 21])
        expect(result.value.supertypes[0].reference).tracedTo([18, 21])
        expect(result.value.supertypes[1]).tracedTo([26, 27])
        expect(result.value.supertypes[1].reference).tracedTo([26, 27])
      })

      it('should parse objects that inherit from a class and have multiple mixins', () => {
        const result = parser.parse('object o inherits N and M and D {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 34])
        expect(result.value.supertypes[0]).tracedTo([18, 19])
        expect(result.value.supertypes[0].reference).tracedTo([18, 19])
        expect(result.value.supertypes[1]).tracedTo([24, 25])
        expect(result.value.supertypes[1].reference).tracedTo([24, 25])
        expect(result.value.supertypes[2]).tracedTo([30, 31])
        expect(result.value.supertypes[2].reference).tracedTo([30, 31])
      })

      it('should parse objects thats have multiple mixins ', () => {
        const result = parser.parse('object o inherits N and M {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            supertypes: [
              new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
              new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 28])
        expect(result.value.supertypes[0]).tracedTo([18, 19])
        expect(result.value.supertypes[0].reference).tracedTo([18, 19])
        expect(result.value.supertypes[1]).tracedTo([24, 25])
        expect(result.value.supertypes[1].reference).tracedTo([24, 25])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) object o {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({ name: 'o', metadata: [new Annotation('A', { x: 1 })] })
        )
        expect(result.value).tracedTo([10, 21])
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse('@A(x = 1)\n         @B\n         object o {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({ name: 'o', metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`object o {
          var f
          @A(x = 1)
          var g
          @B(x = 1)
          method m(){}
          method n(){}
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            members: [
              new Field({ name: 'f', isConstant: false }),
              new Field({ name: 'g', isConstant: false, metadata: [new Annotation('A', { x: 1 })] }),
              new Method({ name: 'm', body: new Body(), metadata: [new Annotation('B', { x: 1 })] }),
              new Method({ name: 'n', body: new Body() }),
            ],
          })
        )
      })

      it('should not parse dashed objects', () => {
        shouldNotParse<Singleton>(parser.parse('object my-object {}'))
      })

      it('should recover from member parse error', () => {
        const result = parser.parse('object o {var var1 vr var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from intial member parse error', () => {
        const result = parser.parse('object o {vr var1 var var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            members: [
              new Field({ name: 'var2', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from final member parse error', () => {
        const result = parser.parse('object o {var var1 var var2 vr var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var2', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from multiple member parse errors', () => {
        const result = parser.parse('object o {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Singleton({
            name: 'o',
            members: [new Field({ name: 'var4', isConstant: false })],
          })
        )
      })

      it('should not parse the "object" keyword without a body', () => {
        shouldNotParse<Singleton>(parser.parse('object'))
      })

      it('should not parse objects without body', () => {
        shouldNotParse<Singleton>(parser.parse('object o'))
      })

      it('should not parse objects that inherit from more than one class', () => {
        shouldNotParse<Singleton>(parser.parse('object o inherits D inherits E'))
      })

      it('should not parse objects that use the "inherits" keyword without a superclass', () => {
        shouldNotParse<Singleton>(parser.parse('object o inherits {}'))
      })

      it('should not parse objects that use the "inherits" keyword without a body and superclass', () => {
        shouldNotParse<Singleton>(parser.parse('object o inherits'))
      })

      it('should not parse the "and" keyword without "inherits"', () => {
        shouldNotParse<Singleton>(parser.parse('object o and D {}'))
      })

      it('should not parse the "and" keyword without inherits or supertype', () => {
        shouldNotParse<Singleton>(parser.parse('object o and {}'))
      })

      it('should not parse the "and" keyword without a trailing supertype', () => {
        shouldNotParse<Singleton>(parser.parse('object o inherits M and {}'))
      })

      it('should not parse the "and" keyword without a trailing supertype or body', () => {
        shouldNotParse<Singleton>(parser.parse('object o inherits M and'))
      })

    })

    describe('Programs', () => {
      const parser = parse.Program

      it('should parse empty programs', () => {
        const result = parser.parse('program name { }')
        verifyParse(result)
        expect(result.value).parsedInto(new Program({ name: 'name', body: new Body({}) }))
        expect(result.value).tracedTo([0, 16])
      })

      it('should parse non-empty programs', () => {
        const result = parser.parse('program name { var x }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Program({
            name: 'name', body: new Body({
              sentences: [
                new Variable({ name: 'x', isConstant: false }),
              ],
            }),
          })
        )
        expect(result.value).tracedTo([0, 22])
        expect(result.value.body.sentences[0]).tracedTo([15, 20])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) program p {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Program({ name: 'p', body: new Body(), metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse(`@A(x = 1)
         @B
         program p {}`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Program({ name: 'p', body: new Body(), metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`program p {
          var f
          @A(x = 1)
          var g
          var h
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Program({
            name: 'p',
            body: new Body({
              sentences: [
                new Variable({ name: 'f', isConstant: false }),
                new Variable({ name: 'g', isConstant: false, metadata: [new Annotation('A', { x: 1 })] }),
                new Variable({ name: 'h', isConstant: false }),
              ],
            }),
          })
        )
      })

      it('should not parse programs without name', () => {
        shouldNotParse<Program>(parser.parse('program { }'))
      })

      it('should not parse "program" keyword without name and body', () => {
        shouldNotParse<Program>(parser.parse('program'))
      })

    })

    describe('Tests', () => {
      const parser = parse.Test

      it('should parse empty test', () => {
        const result = parser.parse('test "name" { }')
        verifyParse(result)
        expect(result.value).parsedInto(new Test({ name: '"name"', body: new Body() }))
        expect(result.value).tracedTo([0, 15])
      })

      it('should parse non-empty test', () => {
        const result = parser.parse('test "name" { var x }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Test({
            name: '"name"', body: new Body({
              sentences: [
                new Variable({ name: 'x', isConstant: false }),
              ],
            }),
          })
        )
        expect(result.value).tracedTo([0, 21])
        expect(result.value.body).tracedTo([12, 21])
      })

      it('should parse only test', () => {
        const result = parser.parse('only test "name" { }')
        verifyParse(result)
        expect(result.value).parsedInto(new Test({ name: '"name"', isOnly: true, body: new Body() }))
        expect(result.value).tracedTo([0, 20])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) test "t" {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Test({ name: '"t"', body: new Body(), metadata: [new Annotation('A', { x: 1 })] })
        )
        expect(result.value).tracedTo([10, 21])
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse(`@A(x = 1)
         @B
         test "t" {}`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Test({ name: '"t"', body: new Body(), metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`test "t" {
          var f
          @A(x = 1)
          var g
          var h
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Test({
            name: '"t"',
            body: new Body({
              sentences: [
                new Variable({ name: 'f', isConstant: false }),
                new Variable({ name: 'g', isConstant: false, metadata: [new Annotation('A', { x: 1 })] }),
                new Variable({ name: 'h', isConstant: false }),
              ],
            }),
          })
        )
      })

      it('should not parse tests with names that aren\'t a string', () => {
        shouldNotParse<Test>(parser.parse('test name { }'))
      })

      it('should not parse tests without name', () => {
        shouldNotParse<Test>(parser.parse('test { }'))
      })

      it('should not parse tests without name and body', () => {
        shouldNotParse<Test>(parser.parse('test'))
      })

    })

    describe('Describe', () => {
      const parser = parse.Describe

      it('should parse empty describe', () => {
        const result = parser.parse('describe "name" { }')
        verifyParse(result)
        expect(result.value).parsedInto(new Describe({ name: '"name"' }))
        expect(result.value).tracedTo([0, 19])
      })

      it('should parse describes with tests', () => {
        const result = parser.parse('describe "name" { test "foo" {} test "bar" {} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({
            name: '"name"', members: [
              new Test({ name: '"foo"', body: new Body() }),
              new Test({ name: '"bar"', body: new Body() }),
            ],
          })
        )
        expect(result.value).tracedTo([0, 47])
        expect(result.value.members[0]).tracedTo([18, 31])
        expect(result.value.members[1]).tracedTo([32, 45])
      })

      it('should parse describes with fields', () => {
        const result = parser.parse('describe "name" { var v }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({ name: '"name"', members: [new Field({ name: 'v', isConstant: false })] })
        )
        expect(result.value).tracedTo([0, 25])
        expect(result.value.members[0]).tracedTo([18, 23])
      })

      it('should parse describes with methods', () => {
        const result = parser.parse('describe "name" { method m(){} }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({ name: '"name"', members: [new Method({ name: 'm', body: new Body() })] })
        )
        expect(result.value).tracedTo([0, 32])
        expect(result.value.members[0]).tracedTo([18, 30])
      })

      it('should parse annotated nodes', () => {
        const result = parser.parse('@A(x = 1) describe "d" {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({ name: '"d"', metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parser.parse(`@A(x = 1)
         @B
         describe "d" {}`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({ name: '"d"', metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parser.parse(`describe "d" {
          test "t" { }
          @A(x = 1)
          test "u" { }
          var f
          @B(x = 1)
          var g
          method m() {}
          @C(x = 1)
          method n() {}
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({
            name: '"d"',
            members: [
              new Test({ name: '"t"', body: new Body() }),
              new Test({ name: '"u"', body: new Body(), metadata: [new Annotation('A', { x: 1 })] }),
              new Field({ name: 'f', isConstant: false }),
              new Field({ name: 'g', isConstant: false, metadata: [new Annotation('B', { x: 1 })] }),
              new Method({ name: 'm', body: new Body() }),
              new Method({ name: 'n', body: new Body(), metadata: [new Annotation('C', { x: 1 })] }),
            ],
          })
        )
      })

      it('should recover from member parse error', () => {
        const result = parser.parse('describe "name" {var var1 vr var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({
            name: '"name"',
            members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from intial member parse error', () => {
        const result = parser.parse('describe "name" {vr var1 var var2 var var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({
            name: '"name"',
            members: [
              new Field({ name: 'var2', isConstant: false }),
              new Field({ name: 'var3', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from final member parse error', () => {
        const result = parser.parse('describe "name" {var var1 var var2 vr var3}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({
            name: '"name"', members: [
              new Field({ name: 'var1', isConstant: false }),
              new Field({ name: 'var2', isConstant: false }),
            ],
          })
        )
      })

      it('should recover from multiple member parse errors', () => {
        const result = parser.parse('describe "name" {vr var1 vr var2 vr var3 var var4 vr var5 vr var6}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Describe({ name: '"name"', members: [new Field({ name: 'var4', isConstant: false })] })
        )
      })

      it('should not parse describes with names that aren\'t a string', () => {
        shouldNotParse(parser.parse('describe name { }'))
      })

      it('should not parse describe without name', () => {
        shouldNotParse(parser.parse('describe { }'))
      })

      it('should not parse describe without name and body', () => {
        shouldNotParse(parser.parse('describe'))
      })
    })

    describe('Source Map', () => {
      const parser = parse.Class

      it('should sanitize whitespaces at the end of line', () => {
        const result = parser.parse('class c {}    ')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'c' }))
        expect(result.value).sourceMap(
          [
            { line: 1, column: 1, offset: 0 },
            { line: 1, column: 11, offset: 10 },
          ])
      })

      it('should sanitize whitespaces at the beginning of line', () => {
        const result = parser.parse('    class c {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'c' }))
        expect(result.value).sourceMap(
          [
            { line: 1, column: 5, offset: 4 },
            { line: 1, column: 15, offset: 14 },
          ])
      })

      it('should sanitize whitespaces at next lines', () => {
        const result = parser.parse(`class c {}

        `)
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'c' }))
        expect(result.value).sourceMap(
          [
            { line: 1, column: 1, offset: 0 },
            { line: 1, column: 11, offset: 10 },
          ])
      })

      it('should sanitize whitespaces on CRLF files', () => {
        const result = parser.parse('\r\nclass c {}\r\n      \r\n     ')
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'c' }))
        expect(result.value).sourceMap(
          [
            { line: 2, column: 1, offset: 2 },
            { line: 2, column: 11, offset: 12 },
          ])
      })

      it('should sanitize whitespaces at before lines', () => {
        const result = parser.parse(`

class c {}`)
        verifyParse(result)
        expect(result.value).parsedInto(new Class({ name: 'c' }))
        expect(result.value).sourceMap(
          [
            { line: 3, column: 1, offset: 2 },
            { line: 3, column: 11, offset: 12 },
          ])
      })

      it('should sanitize whitespaces with many sentences', () => {
        const result = parse.Program.parse(`program p {
          const a = 0.a()
          const b = 0

          const c = b
          const d = object {

          }
        }`)
        verifyParse(result)
        expect(result.value).parsedInto(new Program({
          name: 'p',
          body: new Body({
            sentences: [
              new Variable({ name: 'a', isConstant: true, value: new Send({ message: 'a', receiver: new Literal({ value: 0 }) }) }),
              new Variable({ name: 'b', isConstant: true, value: new Literal({ value: 0 }) }),
              new Variable({ name: 'c', isConstant: true, value: new Reference({ name: 'b' }) }),
              new Variable({ name: 'd', isConstant: true, value: new Singleton({}) }),
            ],
          }),
        }))
        expect(result.value).sourceMap(
          [
            { line: 1, column: 1, offset: 0 },
            { line: 9, column: 10, offset: 134 },
          ])
        expect(result.value.body.sentences[0]).sourceMap([
          { line: 2, column: 11, offset: 22 },
          { line: 2, column: 26, offset: 37 },
        ])
        expect(result.value.body.sentences[1]).sourceMap([
          { line: 3, column: 11, offset: 48 },
          { line: 3, column: 22, offset: 59 },
        ])
        expect(result.value.body.sentences[2]).sourceMap([
          { line: 5, column: 11, offset: 71 },
          { line: 5, column: 22, offset: 82 },
        ])
        expect(result.value.body.sentences[3]).sourceMap([
          { line: 6, column: 11, offset: 93 },
          { line: 8, column: 12, offset: 124 },
        ])
      })
    })

  })

  describe('Members', () => {

    describe('Fields', () => {

      it('should parse var declaration', () => {
        const result = parse.Field.parse('var v')
        verifyParse(result)
        expect(result.value).parsedInto(new Field({ name: 'v', isConstant: false }))
        expect(result.value).tracedTo([0, 5])
      })

      it('should parse var declaration and asignation', () => {
        const result = parse.Field.parse('var v = 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Field(
            {
              name: 'v',
              isConstant: false,
              value: new Literal({ value: 5 }),
            })
        )
        expect(result.value).tracedTo([0, 9])
        expect(result.value.value).tracedTo([8, 9])
      })

      it('should parse const declaration', () => {
        const result = parse.Field.parse('const v')
        verifyParse(result)
        expect(result.value).parsedInto(new Field({ name: 'v', isConstant: true }))
        expect(result.value).tracedTo([0, 7])
      })

      it('should parse const declaration and asignation', () => {
        const result = parse.Field.parse('const v = 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Field(
            {
              name: 'v',
              isConstant: true,
              value: new Literal({ value: 5 }),
            })
        )
        expect(result.value).tracedTo([0, 11])
        expect(result.value.value).tracedTo([10, 11])
      })

      it('should parse properties', () => {
        const result = parse.Field.parse('var property v')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Field(
            {
              name: 'v',
              isConstant: false,
              isProperty: true,
            })
        )
        expect(result.value).tracedTo([0, 14])
      })

      it('should parse annotated nodes', () => {
        const result = parse.Field.parse('@A(x = 1) var f')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Field({ name: 'f', isConstant: false, metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parse.Field.parse(`@A(x = 1)
         @B
         var f`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Field({ name: 'f', isConstant: false, metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parse.Field.parse('var f = @A(x = 1) 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Field({
            name: 'f',
            isConstant: false,
            value: new Literal({ value: 5, metadata: [new Annotation('A', { x: 1 })] }),
          })
        )
      })

      it('should not parse vars without name', () => {
        shouldNotParse(parse.Field.parse('var'))
      })

      it('should not parse consts without name', () => {
        shouldNotParse(parse.Field.parse('const'))
      })

      it('should not parse declaration of numbers as vars ', () => {
        shouldNotParse(parse.Field.parse('var 5'))
      })

      it('should not parse declaration of numbers as consts ', () => {
        shouldNotParse(parse.Field.parse('const 5'))
      })

    })

    describe('Methods', () => {

      it('should parse method declarations', () => {
        const result = parse.Method.parse('method m()')
        verifyParse(result)
        expect(result.value).parsedInto(new Method({ name: 'm', body: undefined }))
        expect(result.value).tracedTo([0, 10])
      })

      it('should parse methods with operator characters as names ', () => {
        const result = parse.Method.parse('method ==()')
        verifyParse(result)
        expect(result.value).parsedInto(new Method({ name: '==', body: undefined }))
        expect(result.value).tracedTo([0, 11])
      })

      it('should parse empty methods', () => {
        const result = parse.Method.parse('method m() {}')
        verifyParse(result)
        expect(result.value).parsedInto(new Method({ name: 'm', body: new Body() }))
        expect(result.value).tracedTo([0, 13])
      })

      it('should parse methods that have parameters', () => {
        const result = parse.Method.parse('method m(p, q) {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            body: new Body(),
            parameters: [new Parameter({ name: 'p' }), new Parameter({ name: 'q' })],
          })
        )
        expect(result.value).tracedTo([0, 17])
        expect(result.value.parameters[0]).tracedTo([9, 10])
        expect(result.value.parameters[1]).tracedTo([12, 13])
      })

      it('should parse methods that have vararg parameters', () => {
        const result = parse.Method.parse('method m(p, q...) {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            body: new Body(),
            parameters: [new Parameter({ name: 'p' }), new Parameter({ name: 'q', isVarArg: true })],
          })
        )
        expect(result.value).tracedTo([0, 20])
        expect(result.value.parameters[0]).tracedTo([9, 10])
        expect(result.value.parameters[1]).tracedTo([12, 16])
      })

      it('should parse non-empty methods', () => {
        const result = parse.Method.parse('method m() {var x}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            body: new Body({ sentences: [new Variable({ name: 'x', isConstant: false })] }),
          })
        )
        expect(result.value).tracedTo([0, 18])
        expect(result.value.body).tracedTo([11, 18])
        expect((result.value.body! as Body).sentences[0]).tracedTo([12, 17])
      })

      it('should parse methods defined as expressions', () => {
        const result = parse.Method.parse('method m() = 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            body: new Body({ sentences: [new Return({ value: new Literal({ value: 5 }) })] }),
          })
        )
        expect(result.value).tracedTo([0, 14])
        expect(result.value.body).tracedTo([13, 14])
        expect(((result.value.body! as Body).sentences[0] as Return).value).tracedTo([13, 14])
      })

      it('should parse override methods', () => {
        const result = parse.Method.parse('override method m() {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({ name: 'm', isOverride: true, body: new Body() })
        )
        expect(result.value).tracedTo([0, 22])
      })

      it('should parse native methods', () => {
        const result = parse.Method.parse('method m() native')
        verifyParse(result)
        expect(result.value).parsedInto(new Method({ name: 'm', body: 'native' }))
        expect(result.value).tracedTo([0, 17])
      })

      it('should parse methods that have a closure as body', () => {
        const result = parse.Method.parse('method m() = { 5 }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            body: new Body({
              sentences: [
                new Return({
                  value: Closure({
                    sentences: [new Return({ value: new Literal({ value: 5 }) })],
                    code: '{ 5 }',
                  }),
                }),
              ],
            }),
          })
        )
        expect(result.value).tracedTo([0, 18])
        expect(result.value.body).tracedTo([13, 18])
        expect(((result.value.body! as Body).sentences[0] as Return).value).tracedTo([13, 18])
      })

      it('should parse annotated nodes', () => {
        const result = parse.Method.parse('@A(x = 1) method m() {}')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({ name: 'm', body: new Body(), metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parse.Method.parse(`@A(x = 1)
         @B
         method m() {}`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({ name: 'm', body: new Body(), metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
      })

      it('should parse annotated subnodes within expression bodies', () => {
        const result = parse.Method.parse('method m() = (@A(x = 1) 5)')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm', body: new Body({
              sentences: [
                new Return({
                  value: new Literal({
                    value: 5,
                    metadata: [new Annotation('A', { x: 1 })],
                  }),
                }),
              ],
            }),
          })
        )
      })

      it('should parse annotated subnodes within multiline bodies', () => {
        const result = parse.Method.parse(`method m() {
          @A(x = 1)
          var x = 5
          5
         }`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm', body: new Body({
              sentences: [
                new Variable({ name: 'x', isConstant: false, value: new Literal({ value: 5 }), metadata: [new Annotation('A', { x: 1 })] }),
                new Literal({ value: 5 }),
              ],
            }),
          })
        )
      })

      it('should parse annotated bodies 1', () => {
        const result = parse.Method.parse('method m() @A(x = 1) { 5 }')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm', body: new Body({
              sentences: [
                new Literal({ value: 5 }),
              ],
              metadata: [new Annotation('A', { x: 1 })],
            }),
          })
        )
      })

      it('should parse annotated bodies 2', () => {
        const result = parse.Method.parse(`method m(
          @A(x = 1)
          p
        ) {}`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            parameters: [
              new Parameter({
                name: 'p',
                metadata: [new Annotation('A', { x: 1 })],
              }),
            ],
            body: new Body(),
          })
        )
      })

      it('should not parse incomplete methods', () => {
        shouldNotParse(parse.Method.parse('method m(p,q) ='))
      })

      it('should not parse development of native methods', () => {
        shouldNotParse(parse.Method.parse('method m(p,q) native = q'))
      })

      it('should not parse development with closures of native methods', () => {
        shouldNotParse(parse.Method.parse('method m(p,q) native { }'))
      })

      it('should recover from methods without parenthesis', () => {
        const result = parse.Method.parse('method m = 2')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Method({
            name: 'm',
            body: undefined,
          })
        )
      })
    })

  })

  describe('Body', () => {

    it('should recover from malformed sentence', () => {
      const result = parse.Body.parse('{ felicidad. }')
      verifyParse(result)
      expect(result.value).parsedInto(new Body({
        sentences: [
          new Reference({ name: 'felicidad' }),
        ],
      }))
    })
  })

  describe('Sentences', () => {

    describe('Variables', () => {

      it('should parse var declaration', () => {
        const result = parse.Variable.parse('var v')
        verifyParse(result)
        expect(result.value).parsedInto(new Variable({ name: 'v', isConstant: false }))
        expect(result.value).tracedTo([0, 5])
      })

      it('should parse var declaration with non-ascii caracter in identifier', () => {
        const result = parse.Variable.parse('var ñ')
        verifyParse(result)
        expect(result.value).parsedInto(new Variable({ name: 'ñ', isConstant: false }))
        expect(result.value).tracedTo([0, 5])
      })

      it('should parse var asignation', () => {
        const result = parse.Variable.parse('var v = 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Variable({
            name: 'v',
            isConstant: false,
            value: new Literal({ value: 5 }),
          })
        )
        expect(result.value).tracedTo([0, 9])
        expect(result.value.value).tracedTo([8, 9])
      })

      it('should parse const declaration', () => {
        const result = parse.Variable.parse('const v')
        verifyParse(result)
        expect(result.value).parsedInto(new Variable({ name: 'v', isConstant: true }))
        expect(result.value).tracedTo([0, 7])
      })

      it('should parse const asignation', () => {
        const result = parse.Variable.parse('const v = 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Variable({
            name: 'v',
            isConstant: true,
            value: new Literal({ value: 5 }),
          })
        )
        expect(result.value).tracedTo([0, 11])
        expect(result.value.value).tracedTo([10, 11])
      })

      it('should parse annotated nodes', () => {
        const result = parse.Variable.parse('@A(x = 1) var f')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Variable({ name: 'f', isConstant: false, metadata: [new Annotation('A', { x: 1 })] })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parse.Variable.parse(`@A(x = 1)
         @B
         var f`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Variable({ name: 'f', isConstant: false, metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
        )
        expect(result.value).tracedTo([31, 36])
      })

      it('should parse annotated subnodes', () => {
        const result = parse.Variable.parse('var f = @A(x = 1) 5')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Variable({
            name: 'f',
            isConstant: false,
            value: new Literal({ value: 5, metadata: [new Annotation('A', { x: 1 })] }),
          })
        )
        expect(result.value).tracedTo([0, 19])
        expect(result.value.value).tracedTo([18, 19])
      })

      it('should not parse vars without name', () => {
        shouldNotParse(parse.Variable.parse('var'))
      })

      it('should not parse consts without name', () => {
        shouldNotParse(parse.Variable.parse('const'))
      })

      it('should not parse declaration of numbers as vars ', () => {
        shouldNotParse(parse.Variable.parse('var 5'))
      })

      it('should not parse declaration of numbers as consts ', () => {
        shouldNotParse(parse.Variable.parse('const 5'))
      })
    })

    describe('Returns', () => {
      it('should parse returns', () => {
        const result = parse.Return.parse('return 5')
        verifyParse(result)
        expect(result.value).parsedInto(new Return({ value: new Literal({ value: 5 }) }))
        expect(result.value).tracedTo([0, 8])
        expect(result.value.value).tracedTo([7, 8])
      })

      it('parse empty return', () => {
        const result = parse.Return.parse('return')
        verifyParse(result)
        expect(result.value).parsedInto(new Return())
        expect(result.value).tracedTo([0, 6])
      })

      it('should parse annotated nodes', () => {
        const result = parse.Return.parse('@A(x = 1) return 5')
        verifyParse(result)
        expect(result.value).parsedInto(new Return({ value: new Literal({ value: 5 }), metadata: [new Annotation('A', { x: 1 })] }))
      })

      it('should parse multiply annotated nodes', () => {
        const result = parse.Return.parse(`@A(x = 1)
         @B
         return 5`)
        verifyParse(result)
        expect(result.value).parsedInto(new Return({ value: new Literal({ value: 5 }), metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] }))
      })

      it('should parse annotated subnodes', () => {
        const result = parse.Return.parse('return @A(x = 1) 5')
        verifyParse(result)
        expect(result.value).parsedInto(new Return({ value: new Literal({ value: 5, metadata: [new Annotation('A', { x: 1 })] }) }))
      })
    })

    describe('Assignments', () => {
      it('should parse simple assignments', () => {
        const result = parse.Assignment.parse('a = b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Reference({ name: 'b' }),
          })
        )
        expect(result.value).tracedTo([0, 5])
        expect(result.value.variable).tracedTo([0, 1])
        expect(result.value.value).tracedTo([4, 5])
      })

      it('should parse += operation ', () => {
        const result = parse.Assignment.parse('a += b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '+',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 6])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([5, 6])
      })

      it('should parse -= operation', () => {
        const result = parse.Assignment.parse('a -= b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '-',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 6])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([5, 6])
      })

      it('should parse *= operation', () => {
        const result = parse.Assignment.parse('a *= b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '*',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 6])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([5, 6])
      })

      it('should parse /= operation', () => {
        const result = parse.Assignment.parse('a /= b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '/',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 6])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([5, 6])
      })

      it('should parse %= operation', () => {
        const result = parse.Assignment.parse('a %= b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '%',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 6])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([5, 6])
      })

      it('should parse ||= operation', () => {
        const result = parse.Assignment.parse('a ||= b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '||',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 7])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([6, 7])
      })

      it('should parse &&= operation', () => {
        const result = parse.Assignment.parse('a &&= b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '&&',
              args: [new Reference({ name: 'b' })],
            }),
          })
        )
        expect(result.value).tracedTo([0, 7])
        expect(result.value.variable).tracedTo([0, 1])
        expect((result.value.value as Send).args[0]).tracedTo([6, 7])
      })

      it('should parse annotated nodes', () => {
        const result = parse.Assignment.parse('@A(x = 1) a = b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Reference({ name: 'b' }),
            metadata: [new Annotation('A', { x: 1 })],
          })
        )
      })

      it('should parse multiply annotated nodes', () => {
        const result = parse.Assignment.parse(`@A(x = 1)
         @B
         a = b`)
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Reference({ name: 'b' }),
            metadata: [new Annotation('A', { x: 1 }), new Annotation('B')],
          })
        )
      })

      it('should parse annotated subnodes', () => {
        const result = parse.Assignment.parse('a = @A(x = 1) b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Reference({ name: 'b', metadata: [new Annotation('A', { x: 1 })] }),
          })
        )
      })

      it('should parse annotated subnodes in special assignations', () => {
        const result = parse.Assignment.parse('a += @A(x = 1) b')
        verifyParse(result)
        expect(result.value).parsedInto(
          new Assignment({
            variable: new Reference({ name: 'a' }),
            value: new Send({
              receiver: new Reference({ name: 'a' }),
              message: '+',
              args: [new Reference({ name: 'b', metadata: [new Annotation('A', { x: 1 })] })],
            }),
          })
        )
      })

      it('should not parse assignments that have other assignment at the right', () => {
        shouldNotParse(parse.Assignment.parse('a = b = c'))
      })

      it('should not parse assignments that have += operation at the right ', () => {
        shouldNotParse(parse.Assignment.parse('a = b += c'))
      })

      it('should not parse += operation that have other assigment at the right', () => {
        shouldNotParse(parse.Assignment.parse('a += b = c'))
      })
    })

    describe('Expressions', () => {

      describe('References', () => {

        it('should parse references that begin with _', () => {
          const result = parse.Expression.parse('_foo123')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: '_foo123' }))
          expect(result.value).tracedTo([0, 7])
        })

        it('should parse uppercase references', () => {
          const result = parse.Expression.parse('C')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: 'C' }))
          expect(result.value).tracedTo([0, 1])
        })

        it('should parse references to fully qualified singletons', () => {
          const result = parse.Expression.parse('p.o')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: 'p.o' }))
          expect(result.value).tracedTo([0, 3])
        })

        it('should parse fully quelified references with -', () => {
          const result = parse.Expression.parse('p-p.C')
          verifyParse(result)
        })

        it('should parse annotated nodes', () => {
          const result = parse.Expression.parse('@A(x = 1) x')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: 'x', metadata: [new Annotation('A', { x: 1 })] }))
        })

        it('should parse multiply annotated nodes', () => {
          const result = parse.Expression.parse('@A(x = 1) @B x')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: 'x', metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] }))
        })

        it('should parse references starting with unicode letter', () => {
          const result = parse.Expression.parse('ñ')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: 'ñ' }))
          expect(result.value).tracedTo([0, 1])
        })

        it('should parse references containing unicode letter', () => {
          const result = parse.Expression.parse('some_ñandu')
          verifyParse(result)
          expect(result.value).parsedInto(new Reference({ name: 'some_ñandu' }))
          expect(result.value).tracedTo([0, 10])
        })

        it('should not parse references starting with numbers that contain unicode letters', () => {
          shouldNotParse(parse.Expression.parse('4ñandu'))
        })

        it('should not parse references with spaces', () => {
          shouldNotParse(parse.Expression.parse('foo bar'))
        })

        it('should not parse references that begin with numbers', () => {
          shouldNotParse(parse.Expression.parse('4foo'))
        })

        it('should not parse operators as references', () => {
          shouldNotParse(parse.Expression.parse('=='))
        })

        it('should not parse references that end with wrong characters', () => {
          shouldNotParse(parse.Expression.parse('p.q.'))
        })

        it('should not parse references that begin with wrong characters', () => {
          shouldNotParse(parse.Expression.parse('.q.C'))
        })

        it('should not parse references with wrong characters', () => {
          shouldNotParse(parse.Expression.parse('.'))
        })

        it('should not parse fully qualified references with wrong characters', () => {
          shouldNotParse(parse.Expression.parse('p.*'))
        })
      })

      describe('Infix operations', () => {

        it('should parse operations with arithmetic operators that are used infixed', () => {
          const result = parse.Expression.parse('a + b + c')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Reference({ name: 'b' })],
              }),
              message: '+',
              args: [new Reference({ name: 'c' })],
            })
          )
          expect(result.value).tracedTo([0, 9])
          expect((result.value as Send).receiver).tracedTo([0, 5])
          expect(((result.value as Send).receiver as Send).receiver).tracedTo([0, 1])
          expect(((result.value as Send).receiver as Send).args[0]).tracedTo([4, 5])
          expect((result.value as Send).args[0]).tracedTo([8, 9])
        })

        it('should parse operations surrounded by parenthesis', () => {
          const result = parse.Expression.parse('(a + b + c)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Reference({ name: 'b' })],
              }),
              message: '+',
              args: [new Reference({ name: 'c' })],
            })
          )
          expect(result.value).tracedTo([1, 10])
          expect((result.value as Send).receiver).tracedTo([1, 6])
          expect(((result.value as Send).receiver as Send).receiver).tracedTo([1, 2])
          expect(((result.value as Send).receiver as Send).args[0]).tracedTo([5, 6])
          expect((result.value as Send).args[0]).tracedTo([9, 10])
        })

        it('should parse operations with parenthesis to separate members', () => {
          const result = parse.Expression.parse('a + (b + c)')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 11])
          expect((result.value as Send).receiver).tracedTo([0, 1])
          expect(((result.value as Send).args[0] as Send).receiver).tracedTo([5, 6])
          expect(((result.value as Send).args[0] as Send).args[0]).tracedTo([9, 10])
        })

        it('should parse infix operations with proper precedence', () => {
          const result = parse.Expression.parse('a > b || c && d + e == f')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '>',
                args: [new Reference({ name: 'b' })],
              }),
              message: '||',
              args: [
                new Send({
                  receiver: new Reference({ name: 'c' }),
                  message: '&&',
                  args: [
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
            })
          )
          expect(result.value).tracedTo([0, 24])
          expect((result.value as Send).receiver).tracedTo([0, 5])
          expect(((result.value as Send).receiver as Send).receiver).tracedTo([0, 1])
          expect(((result.value as Send).receiver as Send).args[0]).tracedTo([4, 5])
          expect((result.value as Send).args[0]).tracedTo([9, 24])
          expect(((result.value as Send).args[0] as Send).receiver).tracedTo([9, 10])
          expect(((result.value as Send).args[0] as Send).args[0]).tracedTo([14, 24])
          expect((((result.value as Send).args[0] as Send).args[0] as Send).receiver).tracedTo([14, 19])
          expect(((((result.value as Send).args[0] as Send).args[0] as Send).receiver as Send).receiver).tracedTo([14, 15])
          expect(((((result.value as Send).args[0] as Send).args[0] as Send).receiver as Send).args[0]).tracedTo([18, 19])
          expect((((result.value as Send).args[0] as Send).args[0] as Send).args[0]).tracedTo([23, 24])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Expression.parse('@A(x = 1)(a + b + c)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Reference({ name: 'b' })],
              }),
              message: '+',
              args: [new Reference({ name: 'c' })],
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse inner annotated nodes', () => {
          let result = parse.Expression.parse('@A(x = 1) a + b + c')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] }),
                message: '+',
                args: [new Reference({ name: 'b' })],
              }),
              message: '+',
              args: [new Reference({ name: 'c' })],
            })
          )

          result = parse.Expression.parse('a + @A(x = 1) b + c')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Reference({ name: 'b', metadata: [new Annotation('A', { x: 1 })] })],
              }),
              message: '+',
              args: [new Reference({ name: 'c' })],
            })
          )
        })

        describe('**', () => {
          it('has more precedence than *', () => {
            const result = parse.Expression.parse('a * b ** c')
            verifyParse(result)
            expect(result.value).parsedInto(
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

        it('should parse the negation of a reference with the "!" operator', () => {
          const result = parse.Expression.parse('!a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({ receiver: new Reference({ name: 'a' }), message: 'negate', originalOperator: '!' })
          )
          expect(result.value).tracedTo([0, 2])
          expect((result.value as Send).receiver).tracedTo([1, 2])
        })

        it('should parse negation with chained "!" operators', () => {
          const result = parse.Expression.parse('!!!a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Send({
                  receiver: new Reference({ name: 'a' }),
                  message: 'negate',
                  originalOperator: '!',
                }),
                message: 'negate',
                originalOperator: '!',
              }),
              message: 'negate',
              originalOperator: '!',
            })
          )
          expect(result.value).tracedTo([0, 4])
          expect((result.value as Send).receiver).tracedTo([1, 4])
          expect(((result.value as Send).receiver as Send).receiver).tracedTo([2, 4])
          expect((((result.value as Send).receiver as Send).receiver as Send).receiver).tracedTo([3, 4])
        })

        it('should parse arithmetic operators in prefix operations', () => {
          const result = parse.Expression.parse('-1')
          verifyParse(result)
          expect(result.value).parsedInto(new Send({ receiver: new Literal({ value: 1 }), message: 'invert', originalOperator: '-' }))
          expect(result.value).tracedTo([0, 2])
          expect((result.value as Send).receiver).tracedTo([1, 2])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Expression.parse('@A(x = 1)!!a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: 'negate',
                originalOperator: '!',
              }),
              message: 'negate',
              originalOperator: '!',
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse inner annotated nodes', () => {
          let result = parse.Expression.parse('!@A(x = 1)!a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: 'negate',
                originalOperator: '!',
                metadata: [new Annotation('A', { x: 1 })],
              }),
              message: 'negate',
              originalOperator: '!',
            })
          )

          result = parse.Expression.parse('!!@A(x = 1)a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] }),
                message: 'negate',
                originalOperator: '!',
              }),
              message: 'negate',
              originalOperator: '!',
            })
          )
        })

      })

      describe('Send', () => {

        it('should parse sending messages without parameters', () => {
          const result = parse.Send.parse('a.m()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
            })
          )
          expect(result.value).tracedTo([0, 5])
          expect((result.value as Send).receiver).tracedTo([0, 1])
        })

        it('should parse sending messages with a single parameter', () => {
          const result = parse.Send.parse('a.m(5)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
              args: [new Literal({ value: 5 })],
            })
          )
          expect(result.value).tracedTo([0, 6])
          expect((result.value as Send).receiver).tracedTo([0, 1])
          expect(((result.value as Send).args[0] as Literal)).tracedTo([4, 5])
        })

        it('should parse sending messages with multiple arguments', () => {
          const result = parse.Send.parse('a.m(5,7)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
              args: [
                new Literal({ value: 5 }),
                new Literal({ value: 7 }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 8])
          expect((result.value as Send).receiver).tracedTo([0, 1])
          expect(((result.value as Send).args[0] as Literal)).tracedTo([4, 5])
          expect(((result.value as Send).args[1] as Literal)).tracedTo([6, 7])
        })

        it('should parse sending messages with a closure as an argument', () => {
          const result = parse.Send.parse('a.m{p => p}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Reference({ name: 'a' }),
              message: 'm',
              args: [
                Closure({
                  parameters: [new Parameter({ name: 'p' })],
                  sentences: [new Return({ value: new Reference({ name: 'p' }) })],
                  code: '{p => p}',
                }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 11])
          expect((result.value as Send).receiver).tracedTo([0, 1])
          expect((result.value as Send).args[0]).tracedTo([3, 11])
          expect((((result.value as Send).args[0] as ClosurePayload).members![0] as ClosurePayload).parameters![0]).tracedTo([4, 5])
          expect((((((result.value as Send).args[0] as ClosurePayload).members![0] as Method).body! as Body).sentences[0] as Return).value).tracedTo([9, 10])
        })

        /* Hasta acá */
        it('should parse sending messages to fully qualified singleton references', () => {
          const result = parse.Send.parse('p.o.m()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Reference({ name: 'p.o' }),
              message: 'm',
            })
          )
          expect(result.value).tracedTo([0, 7])
          expect((result.value as Send).receiver).tracedTo([0, 3])
        })

        it('should parse chained sending messages', () => {
          const result = parse.Send.parse('a.m().n().o()')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 13])
          expect((result.value as Send).receiver).tracedTo([0, 9])
          expect(((result.value as Send).receiver as Send).receiver).tracedTo([0, 5])
          expect((((result.value as Send).receiver as Send).receiver as Send).receiver).tracedTo([0, 1])
        })

        it('should parse compound sending messages using methods with parameters', () => {
          const result = parse.Send.parse('(a + 1).m(5)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: '+',
                args: [new Literal({ value: 1 })],
              }),
              message: 'm',
              args: [new Literal({ value: 5 })],
            })
          )
          expect(result.value).tracedTo([0, 12])
          expect(result.value.receiver).tracedTo([1, 6])
          expect(((result.value as Send).receiver as Send).receiver).tracedTo([1, 2])
          expect(((result.value as Send).receiver as Send).args[0]).tracedTo([5, 6])
          expect((result.value as Send).args[0]).tracedTo([10, 11])
        })

        it('should parse sending messages to numeric objects', () => {
          const result = parse.Send.parse('1.5.m()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Literal({ value: 1.5 }),
              message: 'm',
            })
          )
          expect(result.value).tracedTo([0, 7])
          expect(result.value.receiver).tracedTo([0, 3])
        })

        it('should parse annotated nodes', () => {
          let result = parse.Send.parse('@A(x = 1)a.m(5).n()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] }),
                message: 'm',
                args: [new Literal({ value: 5 })],
              }),
              message: 'n',
              args: [],
            })
          )

          result = parse.Send.parse('@A(x = 1)(a.m(5).n())')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: 'm',
                args: [new Literal({ value: 5 })],
              }),
              message: 'n',
              args: [],
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse inner annotated nodes', () => {
          let result = parse.Send.parse('@A(x = 1)(a.m(5)).n()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: 'm',
                args: [new Literal({ value: 5 })],
                metadata: [new Annotation('A', { x: 1 })],
              }),
              message: 'n',
              args: [],
            })
          )

          result = parse.Send.parse('a.m(@A(x = 1) 5).n()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Reference({ name: 'a' }),
                message: 'm',
                args: [new Literal({ value: 5, metadata: [new Annotation('A', { x: 1 })] })],
              }),
              message: 'n',
              args: [],
            })
          )
        })

        it('should not parse sending messages calling the method with a "," at the end of the parameters', () => {
          shouldNotParse(parse.Send.parse('a.m(p,)'))
        })

        it('should not parse sending messages calling the method with a "," at the start of the parameters', () => {
          shouldNotParse(parse.Send.parse('a.m(,q)'))
        })

        it('should not parse sending messages without parentheses', () => {
          shouldNotParse(parse.Send.parse('a.m'))
        })

        it('should not parse an expression with a "." at the end', () => {
          shouldNotParse(parse.Send.parse('a.'))
        })

        it('should not parse an expression with a "." at the start', () => {
          shouldNotParse(parse.Send.parse('.m'))
        })

        it('should recover from malformed message send without arguments', () => {
          const result = parse.Send.parse('m()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Literal({ value: null }),
              message: 'm',
              args: [],
            })
          )
        })

        it('should recover from malformed message send with one argument', () => {
          const result = parse.Send.parse('m(p)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Literal({ value: null }),
              message: 'm',
              args: [new Reference({ name: 'p' })],
            }))
        })

        it('should recover from malformed message send with multiple arguments', () => {
          const result = parse.Send.parse('m(p,q)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Literal({ value: null }),
              message: 'm',
              args: [
                new Reference({ name: 'p' }),
                new Reference({ name: 'q' }),
              ],
            }))
        })

        it('should parse malformed message sends with a closure as an argument', () => {
          const result = parse.Send.parse('m1 {p => p}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Literal({ value: null }),
              message: 'm1',
              args: [
                Closure({
                  parameters: [new Parameter({ name: 'p' })],
                  sentences: [new Return({ value: new Reference({ name: 'p' }) })],
                  code: '{p => p}',
                }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 11])
          expect((result.value as Send).args[0]).tracedTo([3, 11])
          expect((((result.value as Send).args[0] as ClosurePayload).members![0] as ClosurePayload).parameters![0]).tracedTo([4, 5])
          expect(((((result.value as Send).args[0] as ClosurePayload).members![0] as ClosurePayload).sentences![0] as Return).value).tracedTo([9, 10])
        })

        it('should parse chained send with malformed receiver', () => {
          const result = parse.Send.parse('m1().m2()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Send({
              receiver: new Send({
                receiver: new Literal({ value: null }),
                message: 'm1',
                args: [],
              }),
              message: 'm2',
              args: [],
            }))
        })

      })

      describe('New', () => {

        it('should parse instantiations without parameters', () => {
          const result = parse.New.parse('new C()')
          verifyParse(result)
          expect(result.value).parsedInto(
            new New({ instantiated: new Reference({ name: 'C' }) })
          )
          expect(result.value).tracedTo([0, 7])
          expect((result.value as New).instantiated).tracedTo([4, 5])
        })

        it('should parse instantiation with named arguments', () => {
          const result = parse.New.parse('new C(a = 1, b = 2)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new New({
              instantiated: new Reference({ name: 'C' }),
              args: [
                new NamedArgument({ name: 'a', value: new Literal({ value: 1 }) }),
                new NamedArgument({ name: 'b', value: new Literal({ value: 2 }) }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 19])
          expect((result.value as New).instantiated).tracedTo([4, 5])
          expect((result.value as New).args[0]).tracedTo([6, 11])
          expect(((result.value as New).args[0] as NamedArgument).value).tracedTo([10, 11])
          expect((result.value as New).args[1]).tracedTo([13, 18])
          expect(((result.value as New).args[1] as NamedArgument).value).tracedTo([17, 18])
        })

        it('should parse annotated nodes', () => {
          const result = parse.New.parse('@A(x = 1) new C(a = 1, b = 2)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new New({
              instantiated: new Reference({ name: 'C' }),
              args: [
                new NamedArgument({ name: 'a', value: new Literal({ value: 1 }) }),
                new NamedArgument({ name: 'b', value: new Literal({ value: 2 }) }),
              ],
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse inner annotated nodes', () => {
          const result = parse.New.parse('new C(a = 1,@A(x = 1) b = 2)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new New({
              instantiated: new Reference({ name: 'C' }),
              args: [
                new NamedArgument({ name: 'a', value: new Literal({ value: 1 }) }),
                new NamedArgument({ name: 'b', value: new Literal({ value: 2 }), metadata: [new Annotation('A', { x: 1 })] }),
              ],
            })
          )
        })

        it('should not parse instantiations without parameter names', () => {
          shouldNotParse(parse.New.parse('new C(1,2)'))
        })

        it('should not parse "new" keyword without arguments', () => {
          shouldNotParse(parse.New.parse('new C'))
        })

        it('should not parse "new" keyword without a class name', () => {
          shouldNotParse(parse.New.parse('new'))
        })

      })

      describe('Super', () => {

        it('should parse super call without parameters', () => {
          const result = parse.Super.parse('super()')
          verifyParse(result)
          expect(result.value).parsedInto(new Super())
          expect(result.value).tracedTo([0, 7])
        })

        it('should parse super call with parameters', () => {
          const result = parse.Super.parse('super(1,2)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Super({ args: [new Literal({ value: 1 }), new Literal({ value: 2 })] })
          )
          expect(result.value).tracedTo([0, 10])
          expect((result.value as Super).args[0]).tracedTo([6, 7])
          expect((result.value as Super).args[1]).tracedTo([8, 9])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Super.parse('@A(x = 1) super(1,2)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Super({ args: [new Literal({ value: 1 }), new Literal({ value: 2 })], metadata: [new Annotation('A', { x: 1 })] })
          )
        })

        it('should parse inner annotated nodes', () => {
          const result = parse.Super.parse('super(1,@A(x = 1) 2)')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Super({ args: [new Literal({ value: 1 }), new Literal({ value: 2, metadata: [new Annotation('A', { x: 1 })] })] })
          )
        })

        it('should not parse "super" keyword without parentheses', () => {
          shouldNotParse(parse.Super.parse('super'))
        })

        it('should not parse sending messages to a super call ', () => {
          shouldNotParse(parse.Super.parse('super.m()'))
        })

      })

      describe('If', () => {

        it('should parse "if" with "then" body', () => {
          const result = parse.If.parse('if(a) x')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
            })
          )
          expect(result.value).tracedTo([0, 7])
          expect((result.value as If).condition).tracedTo([3, 4])
          expect((result.value as If).thenBody).tracedTo([6, 7])
          expect(((result.value as If).thenBody as Body).sentences[0]).tracedTo([6, 7])
        })

        it('should parse "if" with "then" curly-braced body', () => {
          const result = parse.If.parse('if(a){x}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
            })
          )
          expect(result.value).tracedTo([0, 8])
          expect((result.value as If).condition).tracedTo([3, 4])
          expect((result.value as If).thenBody).tracedTo([5, 8])
          expect(((result.value as If).thenBody as Body).sentences[0]).tracedTo([6, 7])
        })

        it('should parse "if" with "then" with a multi-sentence curly-braced body', () => {
          const result = parse.If.parse('if(a){x;y}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' }), new Reference({ name: 'y' })] }),
            })
          )
          expect(result.value).tracedTo([0, 10])
          expect((result.value as If).condition).tracedTo([3, 4])
          expect((result.value as If).thenBody).tracedTo([5, 10])
          expect(((result.value as If).thenBody as Body).sentences[0]).tracedTo([6, 7])
          expect(((result.value as If).thenBody as Body).sentences[1]).tracedTo([8, 9])
        })

        it('should parse "if" with "then" and "else" body', () => {
          const result = parse.If.parse('if(a) x else y')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          )
          expect(result.value).tracedTo([0, 14])
          expect(result.value.condition).tracedTo([3, 4])
          expect(result.value.thenBody).tracedTo([6, 7])
          expect(result.value.thenBody.sentences[0]).tracedTo([6, 7])
          expect(result.value.elseBody).tracedTo([13, 14])
          expect(result.value.elseBody.sentences[0]).tracedTo([13, 14])
        })

        it('should parse "if" with "then" and "else" curly-braced body', () => {
          const result = parse.If.parse('if(a){x} else {y}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          )
          expect(result.value).tracedTo([0, 17])
          expect(result.value.condition).tracedTo([3, 4])
          expect(result.value.thenBody).tracedTo([5, 8])
          expect(result.value.thenBody.sentences[0]).tracedTo([6, 7])
          expect(result.value.elseBody).tracedTo([14, 17])
          expect(result.value.elseBody.sentences[0]).tracedTo([15, 16])
        })

        it('should parse if inside other if', () => {
          const result = parse.If.parse('if(a) if(b) x else y')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 20])
          expect(result.value.condition).tracedTo([3, 4])
          expect(result.value.thenBody).tracedTo([6, 20])
          expect(result.value.thenBody.sentences[0]).tracedTo([6, 20])
          expect((result.value.thenBody.sentences[0] as If).condition).tracedTo([9, 10])
          expect((result.value.thenBody.sentences[0] as If).thenBody).tracedTo([12, 13])
          expect((result.value.thenBody.sentences[0] as If).elseBody).tracedTo([19, 20])
          expect((result.value.thenBody.sentences[0] as If).elseBody.sentences[0]).tracedTo([19, 20])
        })

        it('should parse "if" inside other "if" that have an else', () => {
          const result = parse.If.parse('if(a) if(b) x else y else z')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 27])
          expect(result.value.condition).tracedTo([3, 4])
          expect(result.value.thenBody).tracedTo([6, 20])
          expect(result.value.thenBody.sentences[0]).tracedTo([6, 20])
          expect((result.value.thenBody.sentences[0] as If).condition).tracedTo([9, 10])
          expect((result.value.thenBody.sentences[0] as If).thenBody).tracedTo([12, 13])
          expect((result.value.thenBody.sentences[0] as If).elseBody).tracedTo([19, 20])
          expect((result.value.thenBody.sentences[0] as If).elseBody.sentences[0]).tracedTo([19, 20])
          expect(result.value.elseBody).tracedTo([26, 27])
          expect(result.value.elseBody.sentences[0]).tracedTo([26, 27])
        })

        it('should parse annotated nodes', () => {
          const result = parse.If.parse('@A(x=1) if(a) x else y')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse inner annotated nodes', () => {
          let result = parse.If.parse('if(@A(x=1) a) x else y')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          )

          result = parse.If.parse('if(a) { @A(x=1) x } else y')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x', metadata: [new Annotation('A', { x: 1 })] })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          )

          result = parse.If.parse('if(a) @A(x=1) x else y')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x', metadata: [new Annotation('A', { x: 1 })] })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })] }),
            })
          )

          result = parse.If.parse('if(a) x else @A(x=1){ y }')
          verifyParse(result)
          expect(result.value).parsedInto(
            new If({
              condition: new Reference({ name: 'a' }),
              thenBody: new Body({ sentences: [new Reference({ name: 'x' })] }),
              elseBody: new Body({ sentences: [new Reference({ name: 'y' })], metadata: [new Annotation('A', { x: 1 })] }),
            })
          )
        })

        it('should not parse "if" that doesn\'t have the condition inside parentheses', () => {
          shouldNotParse(parse.If.parse('if a x else y'))
        })

        it('should not parse "if" with an explicit empty "else"', () => {
          shouldNotParse(parse.If.parse('if(a) x else'))
        })

        it('should not parse "if" without a body', () => {
          shouldNotParse(parse.If.parse('if(a)'))
        })

      })

      describe('Try', () => {
        it('should parse try expressions', () => {
          const result = parse.Try.parse('try x')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({ body: new Body({ sentences: [new Reference({ name: 'x' })] }) })
          )
          expect(result.value).tracedTo([0, 5])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
        })

        it('should parse try expressions with a curly-braced body', () => {
          const result = parse.Try.parse('try{x}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({ body: new Body({ sentences: [new Reference({ name: 'x' })] }) })
          )
          expect(result.value).tracedTo([0, 6])
          expect(result.value.body).tracedTo([3, 6])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
        })

        it('should parse try expressions with a catch', () => {
          const result = parse.Try.parse('try x catch e h')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 15])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.catches[0]).tracedTo([6, 15])
          expect(result.value.catches[0].parameter).tracedTo([12, 13])
          expect(result.value.catches[0].body).tracedTo([14, 15])
          expect(result.value.catches[0].body.sentences[0]).tracedTo([14, 15])
        })

        it('should parse try expressions with a curly-braced body', () => {
          const result = parse.Try.parse('try x catch e{h}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 16])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.catches[0]).tracedTo([6, 16])
          expect(result.value.catches[0].parameter).tracedTo([12, 13])
          expect(result.value.catches[0].body).tracedTo([13, 16])
          expect(result.value.catches[0].body.sentences[0]).tracedTo([14, 15])
        })

        it('should parse try expressions with a catch with the parameter type', () => {
          const result = parse.Try.parse('try x catch e:E h')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 17])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.catches[0]).tracedTo([6, 17])
          expect(result.value.catches[0].parameter).tracedTo([12, 13])
          expect(result.value.catches[0].parameterType).tracedTo([14, 15])
          expect(result.value.catches[0].body).tracedTo([16, 17])
          expect(result.value.catches[0].body.sentences[0]).tracedTo([16, 17])
        })

        it('should parse try expressions with a catch with fully qualified parameter type', () => {
          const result = parse.Try.parse('try x catch e:wollok.lang.E h')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  parameterType: new Reference({ name: 'wollok.lang.E' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 29])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.catches[0]).tracedTo([6, 29])
          expect(result.value.catches[0].parameter).tracedTo([12, 13])
          expect(result.value.catches[0].parameterType).tracedTo([14, 27])
          expect(result.value.catches[0].body).tracedTo([28, 29])
          expect(result.value.catches[0].body.sentences[0]).tracedTo([28, 29])
        })

        it('should parse try expressions with a "then always" body', () => {
          const result = parse.Try.parse('try x then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )
          expect(result.value).tracedTo([0, 19])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.always).tracedTo([18, 19])
          expect(result.value.always.sentences[0]).tracedTo([18, 19])
        })

        it('should parse try expressions with a "then always" curly-braced body', () => {
          const result = parse.Try.parse('try x then always{a}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )
          expect(result.value).tracedTo([0, 20])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.always).tracedTo([17, 20])
          expect(result.value.always.sentences[0]).tracedTo([18, 19])
        })

        it('should parse try expressions with a catch and a "then always" body', () => {
          const result = parse.Try.parse('try x catch e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 29])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.catches[0]).tracedTo([6, 15])
          expect(result.value.catches[0].parameter).tracedTo([12, 13])
          expect(result.value.catches[0].body).tracedTo([14, 15])
          expect(result.value.catches[0].body.sentences[0]).tracedTo([14, 15])
          expect(result.value.always).tracedTo([28, 29])
          expect(result.value.always.sentences[0]).tracedTo([28, 29])
        })

        it('should parse try expressions with more than one catch', () => {
          const result = parse.Try.parse('try x catch e h catch e i then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
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
          )
          expect(result.value).tracedTo([0, 39])
          expect(result.value.body).tracedTo([4, 5])
          expect(result.value.body.sentences[0]).tracedTo([4, 5])
          expect(result.value.catches[0]).tracedTo([6, 15])
          expect(result.value.catches[0].parameter).tracedTo([12, 13])
          expect(result.value.catches[0].body).tracedTo([14, 15])
          expect(result.value.catches[1]).tracedTo([16, 25])
          expect(result.value.catches[1].parameter).tracedTo([22, 23])
          expect(result.value.catches[1].body).tracedTo([24, 25])
          expect(result.value.always).tracedTo([38, 39])
          expect(result.value.always.sentences[0]).tracedTo([38, 39])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Try.parse('@A(x=1) try x catch e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse inner annotated nodes', () => {
          let result = parse.Try.parse('try @A(x=1) x catch e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x', metadata: [new Annotation('A', { x: 1 })] })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try @A(x=1) { x } catch e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })], metadata: [new Annotation('A', { x: 1 })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try { @A(x=1) x } catch e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x', metadata: [new Annotation('A', { x: 1 })] })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x @A(x=1) catch e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                  metadata: [new Annotation('A', { x: 1 })],
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x catch @A(x=1)e h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e', metadata: [new Annotation('A', { x: 1 })] }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x catch e: @A(x=1)E h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  parameterType: new Reference({ name: 'E', metadata: [new Annotation('A', { x: 1 })] }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x catch e @A(x=1)h then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h', metadata: [new Annotation('A', { x: 1 })] })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x catch e @A(x=1){h} then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })], metadata: [new Annotation('A', { x: 1 })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x catch e {@A(x=1) h} then always a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h', metadata: [new Annotation('A', { x: 1 })] })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })] }),
            })
          )

          result = parse.Try.parse('try x catch e h then always @A(x=1) a')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] })] }),
            })
          )

          result = parse.Try.parse('try x catch e h then always @A(x=1){a}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a' })], metadata: [new Annotation('A', { x: 1 })] }),
            })
          )

          result = parse.Try.parse('try x catch e h then always { @A(x=1) a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Try({
              body: new Body({ sentences: [new Reference({ name: 'x' })] }),
              catches: [
                new Catch({
                  parameter: new Parameter({ name: 'e' }),
                  body: new Body({ sentences: [new Reference({ name: 'h' })] }),
                }),
              ],
              always: new Body({ sentences: [new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] })] }),
            })
          )
        })

        it('should not parse try expressions with an incomplete "then always" body', () => {
          shouldNotParse(parse.Try.parse('try x catch e h then always'))
        })

        it('should not parse try expressions with an incomplete catch body', () => {
          shouldNotParse(parse.Try.parse('try x catch e'))
        })

        it('should not parse try expressions with a malformed catch body', () => {
          shouldNotParse(parse.Try.parse('try x catch{h}'))
        })

        it('should not parse "try" keyword without a body', () => {
          shouldNotParse(parse.Try.parse('try'))
        })

        it('should not parse a catch body without a try body', () => {
          shouldNotParse(parse.Try.parse('catch e {}'))
        })

      })

      describe('Throw', () => {

        it('should parse throw expressions', () => {
          const result = parse.Throw.parse('throw e')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Throw({ exception: new Reference({ name: 'e' }) })
          )
          expect(result.value).tracedTo([0, 7])
          expect(result.value.exception).tracedTo([6, 7])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Throw.parse('@A(x=1) throw e')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Throw({ exception: new Reference({ name: 'e' }), metadata: [new Annotation('A', { x: 1 })] })
          )
        })

        it('should parse inner annotated nodes', () => {
          const result = parse.Throw.parse('throw @A(x=1) e')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Throw({ exception: new Reference({ name: 'e', metadata: [new Annotation('A', { x: 1 })] }) })
          )
        })

        it('should not parse "throw" keyword without a exception', () => {
          shouldNotParse(parse.Throw.parse('throw'))
        })

      })

      describe('Objects', () => {

        it('should parse empty literal objects', () => {
          const result = parse.Singleton.parse('object {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({})
          )
          expect(result.value).tracedTo([0, 9])
        })

        it('should parse non-empty literal objects', () => {
          const result = parse.Singleton.parse('object { var v method m(){} }')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              members: [
                new Field({ name: 'v', isConstant: false }),
                new Method({ name: 'm', body: new Body() }),
              ],
            }),
          )
          expect(result.value).tracedTo([0, 29])
          expect(result.value.members[0]).tracedTo([9, 14])
          expect(result.value.members[1]).tracedTo([15, 27])
        })

        it('should parse literal objects that inherit from a class', () => {
          const result = parse.Singleton.parse('object inherits D {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
              ],
            }),
          )
          expect(result.value).tracedTo([0, 20])
          expect(result.value.supertypes[0]).tracedTo([16, 17])
          expect(result.value.supertypes[0].reference).tracedTo([16, 17])
        })

        it('should parse literal objects that inherit from a class referenced with a FQN', () => {
          const result = parse.Singleton.parse('object inherits p.D {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'p.D' }) }),
              ],
            }),
          )
          expect(result.value).tracedTo([0, 22])
          expect(result.value.supertypes[0]).tracedTo([16, 19])
          expect(result.value.supertypes[0].reference).tracedTo([16, 19])
        })

        it('should parse literal objects that inherit from a class with explicit builders', () => {
          const result = parse.Singleton.parse('object inherits D(v = 5) {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              supertypes: [
                new ParameterizedType({
                  reference: new Reference({ name: 'D' }), args: [
                    new NamedArgument({ name: 'v', value: new Literal({ value: 5 }) }),
                  ],
                }),
              ],
            })
          )
          expect(result.value).tracedTo([0, 27])
          expect(result.value.supertypes?.[0]).tracedTo([16, 24])
          expect(result.value.supertypes?.[0].reference).tracedTo([16, 17])
          expect(result.value.supertypes?.[0].args?.[0]).tracedTo([18, 23])
        })

        it('should parse literal objects that inherit from a class and have a mixin', () => {
          const result = parse.Singleton.parse('object inherits M and D {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
              ],
            }),
          )
          expect(result.value).tracedTo([0, 26])
          expect(result.value.supertypes?.[0]).tracedTo([16, 17])
          expect(result.value.supertypes?.[0].reference).tracedTo([16, 17])
          expect(result.value.supertypes?.[1]).tracedTo([22, 23])
          expect(result.value.supertypes?.[1].reference).tracedTo([22, 23])
        })

        it('should parse literal objects that inherit from a class and have multiple mixins', () => {
          const result = parse.Singleton.parse('object inherits N and M and D {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
                new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                new ParameterizedType({ reference: new Reference({ name: 'D' }) }),
              ],
            }),
          )
          expect(result.value).tracedTo([0, 32])
          expect(result.value.supertypes?.[0]).tracedTo([16, 17])
          expect(result.value.supertypes?.[0].reference).tracedTo([16, 17])
          expect(result.value.supertypes?.[1]).tracedTo([22, 23])
          expect(result.value.supertypes?.[1].reference).tracedTo([22, 23])
          expect(result.value.supertypes?.[2]).tracedTo([28, 29])
          expect(result.value.supertypes?.[2].reference).tracedTo([28, 29])
        })

        it('should parse literal objects that have multiple mixins', () => {
          const result = parse.Singleton.parse('object inherits N and M {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'N' }) }),
                new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
              ],
            }),
          )
          expect(result.value).tracedTo([0, 26])
          expect(result.value.supertypes?.[0]).tracedTo([16, 17])
          expect(result.value.supertypes?.[0].reference).tracedTo([16, 17])
          expect(result.value.supertypes?.[1]).tracedTo([22, 23])
          expect(result.value.supertypes?.[1].reference).tracedTo([22, 23])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Singleton.parse('@A(x = 1) object {}')
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({ metadata: [new Annotation('A', { x: 1 })] })
          )
        })

        it('should parse multiply annotated nodes', () => {
          const result = parse.Singleton.parse(`@A(x = 1)
           @B
           object {}`)
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({ metadata: [new Annotation('A', { x: 1 }), new Annotation('B')] })
          )
        })

        it('should parse annotated subnodes', () => {
          const result = parse.Singleton.parse(`object {
            var f
            @A(x = 1)
            var g
            @B(x = 1)
            method m(){}
            method n(){}
          }`)
          verifyParse(result)
          expect(result.value).parsedInto(
            new Singleton({
              members: [
                new Field({ name: 'f', isConstant: false }),
                new Field({ name: 'g', isConstant: false, metadata: [new Annotation('A', { x: 1 })] }),
                new Method({ name: 'm', body: new Body(), metadata: [new Annotation('B', { x: 1 })] }),
                new Method({ name: 'n', body: new Body() }),
              ],
            }),
          )
        })

        it('should not parse the "object" keyword without a body', () => {
          shouldNotParse(parse.Singleton.parse('object'))
        })

        it('should not parse objects that inherit from more than one class', () => {
          shouldNotParse(parse.Singleton.parse('object inherits D inherits E'))
        })

        it('should not parse objects that use the "inherits" keyword without a superclass', () => {
          shouldNotParse(parse.Singleton.parse('object inherits {}'))
        })

        it('should not parse the "object inherits" keyword sequence without a body and superclass', () => {
          shouldNotParse(parse.Singleton.parse('object inherits'))
        })

        it('should not parse the "and" keyword without "inherits"', () => {
          shouldNotParse(parse.Singleton.parse('object and D {}'))
        })

        it('should not parse the "and" keyword without a trailing supertype', () => {
          shouldNotParse(parse.Singleton.parse('object inherits M and {}'))
        })

        it('should not parse the "and" keyword without a trailing supertype or body', () => {
          shouldNotParse(parse.Singleton.parse('object inherits M and'))
        })
      })

      describe('Closure', () => {

        it('should parse empty closures', () => {
          const result = parse.Expression.parse('{}')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({ sentences: [], code: '{}' })
          )
          expect(result.value).tracedTo([0, 2])
        })

        it('should parse closures that do not receive parameters and returns nothing', () => {
          const result = parse.Expression.parse('{ => }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({ sentences: [], code: '{ => }' })
          )
          expect(result.value).tracedTo([0, 6])
        })

        it('should parse closures without parameters', () => {
          const result = parse.Expression.parse('{ a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              sentences: [new Return({ value: new Reference({ name: 'a' }) })],
              code: '{ a }',
            })
          )
          expect(result.value).tracedTo([0, 5])
          expect(((((result.value as ClosurePayload).members![0] as Method).body as Body).sentences[0] as Return).value).tracedTo([2, 3])
        })

        it('should parse closures with return in their body', () => {
          const result = parse.Expression.parse('{ return a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({ sentences: [new Return({ value: new Reference({ name: 'a' }) })], code: '{ return a }' })
          )
          expect(result.value).tracedTo([0, 12])
          expect(((((result.value as ClosurePayload).members![0] as Method).body as Body).sentences[0] as Return).value).tracedTo([9, 10])
        })

        it('should parse closure with parameters and no body', () => {
          const result = parse.Expression.parse('{ a => }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({ parameters: [new Parameter({ name: 'a' })], sentences: [], code: '{ a => }' })
          )
          expect(result.value).tracedTo([0, 8])
          expect(((result.value as ClosurePayload).members?.[0] as Method).parameters?.[0]).tracedTo([2, 3])
        })

        it('should parse closures with parameters and body', () => {
          const result = parse.Expression.parse('{ a => a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' })],
              sentences: [new Return({ value: new Reference({ name: 'a' }) })],
              code: '{ a => a }',
            })
          )
          expect(result.value).tracedTo([0, 10])
          expect(((result.value as ClosurePayload).members?.[0] as Method).parameters?.[0]).tracedTo([2, 3])
          expect(((((result.value as ClosurePayload).members![0] as Method).body! as Body).sentences![0] as Return).value).tracedTo([7, 8])
        })

        it('should parse closures with multiple sentence separated by ";"', () => {
          const result = parse.Expression.parse('{ a => a; b }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' })],
              sentences: [
                new Reference({ name: 'a' }),
                new Return({ value: new Reference({ name: 'b' }) }),
              ],
              code: '{ a => a; b }',
            })
          )
          expect(result.value).tracedTo([0, 13])
          expect(((result.value as ClosurePayload).members![0] as Method).parameters![0]).tracedTo([2, 3])
          expect((((result.value as ClosurePayload).members![0] as Method).body! as Body).sentences![0]).tracedTo([7, 8])
          expect(((((result.value as ClosurePayload).members![0] as Method).body! as Body).sentences![1] as Return).value).tracedTo([10, 11])
        })

        it('should parse closures that receive two parameters and return the first one', () => {
          const result = parse.Expression.parse('{ a,b => a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })],
              sentences: [new Return({ value: new Reference({ name: 'a' }) })],
              code: '{ a,b => a }',
            })
          )
          expect(result.value).tracedTo([0, 12])
          expect(((result.value as ClosurePayload).members![0] as Method).parameters![0]).tracedTo([2, 3])
          expect(((result.value as ClosurePayload).members![0] as Method).parameters![1]).tracedTo([4, 5])
          expect(((((result.value as ClosurePayload).members![0] as Method).body! as Body).sentences![0] as Return).value).tracedTo([9, 10])
        })

        it('should parse closures with vararg parameters', () => {
          const result = parse.Expression.parse('{ a,b... => a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b', isVarArg: true })],
              sentences: [new Return({ value: new Reference({ name: 'a' }) })],
              code: '{ a,b... => a }',
            })
          )
          expect(result.value).tracedTo([0, 15])
          expect(((result.value as ClosurePayload).members![0] as Method).parameters![0]).tracedTo([2, 3])
          expect(((result.value as ClosurePayload).members![0] as Method).parameters![1]).tracedTo([4, 8])
          expect(((((result.value as ClosurePayload).members![0] as Method).body! as Body).sentences![0] as Return).value).tracedTo([12, 13])
        })

        it('should parse annotated nodes', () => {
          const result = parse.Expression.parse('@A(x = 1) { a => a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' })],
              sentences: [new Reference({ name: 'a' })],
              code: '{ a => a }',
              metadata: [new Annotation('A', { x: 1 })],
            })
          )
        })

        it('should parse multiply annotated nodes', () => {
          const result = parse.Expression.parse(`@A(x = 1)
           @B
           { a => a }`)
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' })],
              sentences: [new Reference({ name: 'a' })],
              code: '{ a => a }',
              metadata: [new Annotation('A', { x: 1 }), new Annotation('B')],
            })
          )
        })

        it('should parse annotated subnodes', () => {
          let result = parse.Expression.parse('{ @A(x = 1) a => a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a', metadata: [new Annotation('A', { x: 1 })] })],
              sentences: [new Reference({ name: 'a' })],
              code: '{ @A(x = 1) a => a }',
            })
          )

          result = parse.Expression.parse('{ a => @A(x = 1) a }')
          verifyParse(result)
          expect(result.value).parsedInto(
            Closure({
              parameters: [new Parameter({ name: 'a' })],
              sentences: [new Reference({ name: 'a', metadata: [new Annotation('A', { x: 1 })] })],
              code: '{ a => @A(x = 1) a }',
            })
          )
        })

        it('should not parse malformed closures', () => {
          shouldNotParse(parse.Expression.parse('{ a, b c }'))
        })

      })

      describe('Literals', () => {

        describe('Booleans', () => {

          it('should parse "true"', () => {
            const result = parse.Literal.parse('true')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: true }))
            expect(result.value).tracedTo([0, 4])
          })

          it('should parse "false"', () => {
            const result = parse.Literal.parse('false')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: false }))
            expect(result.value).tracedTo([0, 5])
          })

          it('should parse annotated nodes', () => {
            const result = parse.Literal.parse('@A(x=1) true')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: true, metadata: [new Annotation('A', { x: 1 })] }))
          })

        })

        describe('Null', () => {

          it('should parse "null"', () => {
            const result = parse.Literal.parse('null')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: null }))
            expect(result.value).tracedTo([0, 4])
          })

          it('should parse annotated nodes', () => {
            const result = parse.Literal.parse('@A(x=1) null')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: null, metadata: [new Annotation('A', { x: 1 })] }))
            expect(result.value).tracedTo([8, 12])
          })
        })

        describe('Numbers', () => {

          it('should parse positive whole numbers', () => {
            const result = parse.Literal.parse('10')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 10 }))
            expect(result.value).tracedTo([0, 2])
          })

          it('should parse negative whole numbers', () => {
            const result = parse.Literal.parse('-1')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: -1 }))
            expect(result.value).tracedTo([0, 2])
          })

          it('should parse fractional numbers', () => {
            const result = parse.Literal.parse('1.5')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 1.5 }))
            expect(result.value).tracedTo([0, 3])
          })

          it('should parse negative fractional numbers', () => {
            const result = parse.Literal.parse('-1.5')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: -1.5 }))
            expect(result.value).tracedTo([0, 4])
          })

          it('should parse annotated nodes', () => {
            const result = parse.Literal.parse('@A(x=1) 10')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 10, metadata: [new Annotation('A', { x: 1 })] }))
            expect(result.value).tracedTo([8, 10])
          })

          it('should not parse fractional numbers without decimal part', () => {
            shouldNotParse(parse.Literal.parse('1.'))
          })

          it('should not parse fractional numbers without whole part', () => {
            shouldNotParse(parse.Literal.parse('.5'))
          })

        })

        describe('Strings', () => {

          it('should parse valid strings with double quote', () => {
            const result = parse.Literal.parse('"foo"')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 'foo' }))
            expect(result.value).tracedTo([0, 5])
          })

          it('should parse valid strings with single quote', () => {
            const result = parse.Literal.parse('\'foo\'')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 'foo' }))
            expect(result.value).tracedTo([0, 5])
          })

          it('should parse empty strings', () => {
            const result = parse.Literal.parse('""')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: '' }))
            expect(result.value).tracedTo([0, 2])
          })

          it('should parse strings with escape sequences', () => {
            const result = parse.Literal.parse('"foo\\nbar"')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 'foo\nbar' }))
            expect(result.value).tracedTo([0, 10])
          })

          it('should parse strings with the escaped escape character without escaping the whole sequence', () => {
            const result = parse.Literal.parse('"foo\\\\nbar"')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 'foo\\nbar' }))
            expect(result.value).tracedTo([0, 11])
          })

          it('should parse annotated nodes', () => {
            const result = parse.Literal.parse('@A(x=1) "foo"')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: 'foo', metadata: [new Annotation('A', { x: 1 })] }))
          })

          it('should not parse strings with invalid escape sequences', () => {
            shouldNotParse(parse.Literal.parse(raw`"foo\xbar"`))
          })

        })

        describe('Collections', () => {

          it('should parse empty lists', () => {
            const result = parse.Literal.parse('[]')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: [new Reference({ name: LIST_MODULE }), []] }))
            expect(result.value).tracedTo([0, 2])
          })

          it('should parse non-empty lists', () => {
            const result = parse.Literal.parse('[1,2,3]')
            verifyParse(result)
            expect(result.value).parsedInto(
              new Literal({
                value: [new Reference({ name: LIST_MODULE }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2 }),
                  new Literal({ value: 3 }),
                ]],
              })
            )
            expect(result.value).tracedTo([0, 7])
            const literalValue = result.value.value as [any, any[]]

            expect(literalValue[1][0]).tracedTo([1, 2])
            expect(literalValue[1][1]).tracedTo([3, 4])
            expect(literalValue[1][2]).tracedTo([5, 6])
          })

          it('should parse empty sets', () => {
            const result = parse.Literal.parse('#{}')
            verifyParse(result)
            expect(result.value).parsedInto(new Literal({ value: [new Reference({ name: SET_MODULE }), []] }))
            expect(result.value).tracedTo([0, 3])
          })

          it('should parse non-empty sets', () => {
            const result = parse.Literal.parse('#{1,2,3}')
            verifyParse(result)
            expect(result.value).parsedInto(
              new Literal({
                value: [new Reference({ name: SET_MODULE }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2 }),
                  new Literal({ value: 3 }),
                ]],
              })
            )
            expect(result.value).tracedTo([0, 8])
            const literalValue = result.value.value as [any, any[]]

            expect(literalValue[1][0]).tracedTo([2, 3])
            expect(literalValue[1][1]).tracedTo([4, 5])
            expect(literalValue[1][2]).tracedTo([6, 7])
          })

          it('should parse annotated nodes', () => {
            let result = parse.Literal.parse('@A(x=1)[1,2,3]')
            verifyParse(result)
            expect(result.value).parsedInto(
              new Literal({
                value: [new Reference({ name: LIST_MODULE }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2 }),
                  new Literal({ value: 3 }),
                ]],
                metadata: [new Annotation('A', { x: 1 })],
              })
            )
            expect(result.value).tracedTo([7, 14])
            let literalValue = result.value.value as [any, any[]]

            expect(literalValue[1][0]).tracedTo([8, 9])
            expect(literalValue[1][1]).tracedTo([10, 11])
            expect(literalValue[1][2]).tracedTo([12, 13])

            result = parse.Literal.parse('@A(x=1)#{1,2,3}')
            verifyParse(result)
            expect(result.value).parsedInto(
              new Literal({
                value: [new Reference({ name: SET_MODULE }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2 }),
                  new Literal({ value: 3 }),
                ]],
                metadata: [new Annotation('A', { x: 1 })],
              })
            )
            expect(result.value).tracedTo([7, 15])
            literalValue = result.value.value as [any, any[]]

            expect(literalValue[1][0]).tracedTo([9, 10])
            expect(literalValue[1][1]).tracedTo([11, 12])
            expect(literalValue[1][2]).tracedTo([13, 14])
          })

          it('should parse inner annotated nodes', () => {
            let result = parse.Literal.parse('[1,@A(x=1) 2,3]')
            verifyParse(result)
            expect(result.value).parsedInto(
              new Literal({
                value: [
                  new Reference({ name: LIST_MODULE }), [
                    new Literal({ value: 1 }),
                    new Literal({ value: 2, metadata: [new Annotation('A', { x: 1 })] }),
                    new Literal({ value: 3 }),
                  ],
                ],
              })
            )
            expect(result.value).tracedTo([0, 15])
            let literalValue = result.value.value as [any, any[]]

            expect(literalValue[1][0]).tracedTo([1, 2])
            expect(literalValue[1][1]).tracedTo([11, 12])
            expect(literalValue[1][2]).tracedTo([13, 14])

            result = parse.Literal.parse('#{1,@A(x=1) 2,3}')
            verifyParse(result)
            expect(result.value).parsedInto(
              new Literal({
                value: [new Reference({ name: SET_MODULE }), [
                  new Literal({ value: 1 }),
                  new Literal({ value: 2, metadata: [new Annotation('A', { x: 1 })] }),
                  new Literal({ value: 3 }),
                ]],
              })
            )
            expect(result.value).tracedTo([0, 16])
            literalValue = result.value.value as [any, any[]]

            expect(literalValue[1][0]).tracedTo([2, 3])
            expect(literalValue[1][1]).tracedTo([12, 13])
            expect(literalValue[1][2]).tracedTo([14, 15])
          })

        })

      })

    })

  })

  describe('sanitizeWhitespaces', () => {

    const input = `
class Bird {
  var property energy = 100
  var times = 0

  method fly() {
    energy = energy - 50
    times = times + 1
  }

  method eat(grams) {
    energy = energy + 10 * grams
  }

  method energy() = energy

}

class OtherClass {

}
  `
    const textFor = ([from, to]: SourceIndex[], input: string): string => input.substring(from.offset, to.offset)

    it('should return same input if there are no whitespaces', () => {
      const result = parse.sanitizeWhitespaces(new SourceIndex({ line: 2, column: 1, offset: 1 }), new SourceIndex({ line: 2, column: 6, offset: 6 }), input)

      expect(textFor(result, input)).toBe('class')
    })

    it('should trim trailing whitespaces', () => {
      const result = parse.sanitizeWhitespaces(new SourceIndex({ line: 2, column: 1, offset: 1 }), new SourceIndex({ line: 2, column: 7, offset: 7 }), input)
      expect(textFor(result, input)).toBe('class')
    })

    it('should trim beginning whitespaces for the input', () => {
      const result = parse.sanitizeWhitespaces(new SourceIndex({ line: 4, column: 16, offset: 57 }), new SourceIndex({ line: 6, column: 15, offset: 73 }), input)
      expect(textFor(result, input)).toBe('method fly()')
    })

    it('should trim beginning & trailing whitespaces for the input', () => {
      const result = parse.sanitizeWhitespaces(new SourceIndex({ line: 4, column: 16, offset: 57 }), new SourceIndex({ line: 6, column: 16, offset: 74 }), input)
      expect(textFor(result, input)).toBe('method fly()')
    })
  })
})