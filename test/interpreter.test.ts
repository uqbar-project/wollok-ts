import { expect, should, use } from 'chai'
import { restore } from 'sinon'
import sinonChai from 'sinon-chai'
import { EXCEPTION_MODULE, Evaluation, REPL, WRENatives, buildEnvironment } from '../src'
import { DirectedInterpreter, interprete, Interpreter, getStackTraceSanitized } from '../src/interpreter/interpreter'
import link from '../src/linker'
import { Body, Class, Field, Literal, Method, Package, ParameterizedType, Reference, Return, Send, Singleton, SourceIndex, SourceMap } from '../src/model'
import { WREEnvironment } from './utils'

use(sinonChai)
should()

const assertBasicError = (error?: Error) => {
  expect(error).not.to.be.undefined
  expect(error!.message).to.contain('Derived from TypeScript stack')
  expect(error!.stack).to.contain('at Evaluation.exec')
}

const WRE = link([
  new Package({
    name: 'wollok',
    members: [
      new Package({
        name: 'lang',
        members: [
          new Class({ name: 'Object', members: [new Method({ name: 'initialize', body: new Body() })] }),
          new Class({ name: 'Boolean' }),
          new Class({ name: 'Number' }),
          new Class({ name: 'String' }),
          new Class({ name: 'List' }),
          new Class({ name: 'Set' }),
          new Class({ name: 'EvaluationError', supertypes: [new ParameterizedType({ reference: new Reference({ name: EXCEPTION_MODULE }) })] }),
          new Class({ name: 'Exception' }),
        ],
      }),
    ],
  }),
])


describe('Wollok Interpreter', () => {

  afterEach(restore)

  describe('Interpreter', () => {

    it('should be able to execute unlinked sentences', () => {
      const environment = link([
        new Package({
          name:'p',
          members: [
            new Singleton({
              name: 'o',
              members: [
                new Method({
                  name: 'm',
                  body: new Body({
                    sentences: [
                      new Return({ value: new Literal({ value: 5 }) }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const sentence = new Send({ receiver: new Reference({ name: 'p.o' }), message: 'm' })
      const interpreter = new Interpreter(Evaluation.build(environment, {}))

      interpreter.exec(sentence)!.innerNumber!.should.equal(5)
    })

    it('should fail when executing a missing unlinked reference', () => {
      const sentence = new Reference({ name: 'x' })
      const interpreter = new Interpreter(Evaluation.build(WRE, {}))
      expect(() => interpreter.exec(sentence)).to.throw(`Could not resolve unlinked reference to ${sentence.name}`)
    })

    it('should fail if there is an uninitialized field in a singleton', () => {
      const environment = link([
        new Package({
          name:'p',
          members: [
            new Singleton({
              name: 'o',
              members: [
                new Field({
                  name: 'nullAttribute',
                  isConstant: false,
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      expect(() => Evaluation.build(environment, {})).to.throw('Error in o: \'nullAttribute\' attribute uninitialized')
    })

    it('should not fail if there is an explicit null initialization for a field in a singleton', () => {
      const environment = link([
        new Package({
          name:'p',
          members: [
            new Singleton({
              name: 'o',
              members: [
                new Field({
                  name: 'nullAttribute',
                  isConstant: true,
                  value: new Literal({
                    value: null,
                    sourceMap: new SourceMap({
                      start: new SourceIndex({
                        offset: 19,
                        line: 1,
                        column: 19,
                      }),
                      end: new SourceIndex({
                        offset: 23,
                        line: 1,
                        column: 23,
                      }),
                    }),
                  }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      Evaluation.build(environment, {})
    })

  })

  describe('interpret API function', () => {
    let interpreter: Interpreter

    const expectError = (command: string, errorMessage: string) => {
      const { error } = interprete(interpreter, command)
      assertBasicError(error)
      expect(getStackTraceSanitized(error)).to.deep.equal([
        errorMessage,
      ])
    }

    const checkSuccessfulResult = (expression: string, expectedResult: string) => {
      const { result, errored, error } = interprete(interpreter, expression)
      error?.message.should.be.equal('')
      result.should.be.equal(expectedResult)
      errored.should.be.false
    }

    const checkFailedResult = (expression: string, errorMessageContains: string, stackContains?: string) => {
      const { result, errored, error } = interprete(interpreter, expression)
      errored.should.be.true
      result.should.contains(errorMessageContains)
      stackContains && error?.message?.should.contains(stackContains)
    }

    beforeEach(() => {
      const replPackage = new Package({ name: REPL })
      const environment = link([replPackage], WREEnvironment)
      interpreter = new Interpreter(Evaluation.build(environment, WRENatives))
    })

    describe('expressions', () => {

      it('value expressions', () => {
        checkSuccessfulResult('1 + 2', '3')
      })

      it('void expressions', () => {
        checkSuccessfulResult('[].add(1)', '')
      })

      it('import sentences', () => {
        checkSuccessfulResult('import wollok.game.*', '')
      })

      it('const sentences', () => {
        checkSuccessfulResult('const a = 1', '')
        checkSuccessfulResult('a', '1')
      })

      it('var sentences', () => {
        checkSuccessfulResult('var numerete = 1', '')
        checkSuccessfulResult('numerete = 2', '')
        checkSuccessfulResult('numerete', '2')
      })

      it('block without parameters', () => {
        checkSuccessfulResult('{ 1 }.apply()', '1')
      })

      it('block with parameters', () => {
        checkSuccessfulResult('{ x => x + 1 }.apply(1)', '2')
      })

      it('not parsing strings', () => {
        checkFailedResult('3kd3id9', 'Syntax error')
      })

      it('failure expressions', () => {
        checkFailedResult('fakeReference', `Unknown reference ${'fakeReference'}`)
      })

      it('const assignment', () => {
        interprete(interpreter, 'const recontraconstante = 1')
        checkFailedResult('recontraconstante = 2', 'Evaluation Error!')
      })

      it('sending an invalid message should fail normally', () => {
        interprete(interpreter, 'const numeric = 1')
        checkFailedResult('numeric.coso()', 'Evaluation Error!', '1 does not understand coso')
      })

      it('sending an invalid message inside a closure should fail normally', () => {
        checkFailedResult('[1, 2, 3].map({ number => number.coso() })', 'Evaluation Error!', '1 does not understand coso')
      })

      // TODO: Change the Runtime model
      xit('const const', () => {
        interprete(interpreter, 'const a = 1')
        checkFailedResult('const a = 2', 'Evaluation Error!')
      })

    })

    describe('should print result', () => {

      it('for reference to wko', () => {
        checkSuccessfulResult('assert', 'assert')
      })

      it('for reference to an instance', () => {
        checkSuccessfulResult('new Object()', 'an Object')
      })

      it('for reference to a literal object', () => {
        const { result, errored } = interprete(interpreter, 'object { } ')
        result.should.include('an Object#')
        errored.should.be.false
      })

      it('for number', () => {
        checkSuccessfulResult('3', '3')
      })

      it('for string', () => {
        checkSuccessfulResult('"hola"', '"hola"')
      })

      it('for boolean', () => {
        checkSuccessfulResult('true', 'true')
      })

      it('for list', () => {
        checkSuccessfulResult('[1, 2, 3]', '[1, 2, 3]')
      })

      it('for set', () => {
        checkSuccessfulResult('#{1, 2, 3}', '#{1, 2, 3}')
      })

      it('for closure', () => {
        checkSuccessfulResult('{1 + 2}', '{1 + 2}')
      })
    })

    describe('sanitize stack trace', () => {

      it('should filter Typescript stack', () => {
        const { error } = interprete(interpreter, '2.coso()')
        expect(error).not.to.be.undefined
        expect(error!.message).to.contain('Derived from TypeScript stack')
        expect(error!.stack).to.contain('at Evaluation.execThrow')
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.MessageNotUnderstoodException: 2 does not understand coso()'])
      })

      it('should wrap RangeError errors', () => {
        const { error } = interprete(interpreter, '[1, 2, 3].get(3)')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: RangeError: get: index should be between 0 and 2'])
      })

      it('should wrap TypeError errors', () => {
        const { error } = interprete(interpreter, '1 < "hola"')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: TypeError: Message (<): parameter "hola" should be a number'])
      })

      it('should wrap custom TypeError errors', () => {
        expectError('new Date() - 2', 'wollok.lang.EvaluationError: TypeError: Message (-): parameter "2" should be a Date')
        expectError('new Date() < "hola"', 'wollok.lang.EvaluationError: TypeError: Message (<): parameter "hola" should be a Date')
        expectError('new Date() > []', 'wollok.lang.EvaluationError: TypeError: Message (>): parameter "wollok.lang.List" should be a Date')
      })

      it('should wrap Typescript Error errors', () => {
        const { error } = interprete(interpreter, 'new Date(day = 1, month = 2, year = 2001, nonsense = 2)')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: Error: Can\'t initialize wollok.lang.Date with value for unexistent field nonsense'])
      })

      it('should wrap RuntimeModel errors', () => {
        const { error } = interprete(interpreter, 'new Sound()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: Error: Sound cannot be instantiated, you must pass values to the following attributes: file'])
      })

      it('should wrap null validation errors', () => {
        const { error } = interprete(interpreter, '5 + null')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: RangeError: Message (+) does not support parameter \'other\' to be null'])
      })

      it('should wrap void validation errors for void object', () => {
        const { error } = interprete(interpreter, '5 + [1,2,3].add(4)')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: RangeError: Message Number.+/1: parameter #1 produces no value, cannot use it'])
      })

      it('should wrap void validation errors for void assignment', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
          object pepita {
            method volar() {
            }
          }`,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expectError('const a = pepita.volar()', 'wollok.lang.EvaluationError: RangeError: Cannot assign to variable \'a\': message volar/0 produces no value, cannot assign it to a variable')
        expectError('const a = if (4 > 5) true else pepita.volar()', 'wollok.lang.EvaluationError: RangeError: Cannot assign to variable \'a\': if expression produces no value, cannot assign it to a variable')
        expectError('const a = [1].add(2)', 'wollok.lang.EvaluationError: RangeError: Cannot assign to variable \'a\': message add/1 produces no value, cannot assign it to a variable')
      })

      it('should wrap void validation errors for void method', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
          object pepita {
            method volar() {
            }
          }`,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, '5 + pepita.volar()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.EvaluationError: RangeError: Message Number.+/1: parameter #1 produces no value, cannot use it',
        ])
      })

      it('should show Wollok stack', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
          object comun {
            method volar() {
              self.despegar()
            }

            method despegar() {
              return new Date().plusDays(new Date())
            }
          }
          
          class Ave {
            var energy = 100
            const formaVolar = comun

            method volar() {
              formaVolar.volar()
            }
          }`,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'new Ave().volar()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.EvaluationError: TypeError: Message plusDays: parameter "wollok.lang.Date" should be a number',
          '  at REPL.comun.despegar() [REPL:7]',
          '  at REPL.comun.volar() [REPL:3]',
          '  at REPL.Ave.volar() [REPL:16]',
        ])
      })

      it('should handle errors when using void return values for wko', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            object pepita {
                method unMetodo() {
                    return [1,2,3].add(4) + 5
                }
            }
        `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'pepita.unMetodo()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.EvaluationError: RangeError: Cannot send message +, receiver is an expression that produces no value.',
          '  at REPL.pepita.unMetodo() [REPL:3]',
        ])
      })

      it('should handle errors when using void return values for anonymous objects', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            const pepita = object { method energia(total) { } }
        `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, '[1, 2].map { n => pepita.energia(n) }')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.Exception: Message map: closure produces no value. Check the return type of the closure.',
        ])
      })

      it('should handle errors when using void parameters', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            const pepita = object { method energia() { } }
        `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expect('[].add(pepita.energia())', 'wollok.lang.EvaluationError: RangeError: Message List.add/1: parameter #1 produces no value, cannot use it')
      })

    })

    it('should handle void values for assert', () => {
      const replEnvironment = buildEnvironment([{
        name: REPL, content: `
        object pajarito {
          method volar() {
          }
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      expect('assert.that(pajarito.volar())', 'wollok.lang.EvaluationError: RangeError: Message assert.that/1: parameter #1 produces no value, cannot use it')
    })

    it('should let a void closure to work with forEach', () => {
      const { errored } = interprete(interpreter, '[1, 2, 3].forEach({ element => [].add(4) })')
      expect(errored).to.be.false
    })


  })

  describe('DirectedInterpreter', () => {

    it('should stop at breakpoints', () => {
      const breakpoint = new Literal({ value: 17 })
      const expression = new Send({
        message: '*',
        receiver: new Literal({ value: 2 }),
        args: [new Send({
          message: '+',
          receiver: breakpoint,
          args: [new Literal({ value: 4 })],
        })],
      })

      const interpreter = new DirectedInterpreter(Evaluation.build(WRE, {}))
      const director = interpreter.exec(expression)
      director.breakpoints.push(breakpoint)

      const state = director.resume()


      state.done.should.be.false
      state.should.have.property('next').equal(breakpoint)
    })

  })

})