import { expect, should, use } from 'chai'
import { restore } from 'sinon'
import sinonChai from 'sinon-chai'
import { buildEnvironment, Evaluation, EXCEPTION_MODULE, REPL, WRENatives } from '../src'
import { DirectedInterpreter, getStackTraceSanitized, interprete, Interpreter } from '../src/interpreter/interpreter'
import link from '../src/linker'
import { Body, Class, Field, Literal, Method, Package, ParameterizedType, Reference, Return, Send, Singleton, SourceIndex, SourceMap } from '../src/model'
import { environmentWithREPLInitializedFile, INIT_FILE, INIT_PACKAGE_NAME, WREEnvironment } from './utils'

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
          name: 'p',
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
          name: 'p',
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
          name: 'p',
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

    const expectError = (command: string, ...errorMessage: string[]) => {
      const { error } = interprete(interpreter, command)
      assertBasicError(error)
      expect(getStackTraceSanitized(error)).to.deep.equal(errorMessage)
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
      const environment = link([], WREEnvironment)
      interpreter = new Interpreter(Evaluation.build(environment, WRENatives))
    })

    describe('expressions', () => {

      it('empty expression', () => {
        checkSuccessfulResult('', '')
      })

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
        checkFailedResult('3kd3id9', 'Unknown reference kd3id9')
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

      it('const const', () => {
        interprete(interpreter, 'const a = 1')
        checkFailedResult('const a = 2', 'Evaluation Error!')
      })

      it('unlinked class should show error', () => {
        checkFailedResult('const pepita = new Bird()', 'Unknown reference Bird')
      })

      it('missing generic import should show error', () => {
        checkFailedResult('import some.*', 'Unknown reference some')
      })

      it('missing specific import should show error', () => {
        checkFailedResult('import some.Bird', 'Unknown reference some.Bird')
      })

      it('parse error', () => {
        checkFailedResult('class {}', 'Syntax Error at offset 0: class')
      })

    })

    describe('multiple sentences', () => {
      it('should execute all sentences (no enter)', () => {
        checkSuccessfulResult('var a = 1 ; a = a + 2; a', '3')
        checkSuccessfulResult('var b = 1;b = b + 2;b', '3')
      })

      it('should execute all sentences (using several enters and semicolon)', () => {
        checkSuccessfulResult(`var word = "hey" ;
          word = word + " jude";
          word
        `, '"hey jude"')
      })

      it('should execute all sentences (using several enters, no semicolon)', () => {
        checkSuccessfulResult(`var word = "hey"
          word = word + " jude"
          word
        `, '"hey jude"')
      })

      it('should work with imports', () => {
        checkSuccessfulResult('import wollok.game.* ; var a = 1 ; a', '1')
      })

    })

    describe('static definitions', () => {

      it('class', () => {
        checkSuccessfulResult(`class Bird {
          var energy = 100
          method fly() {
            energy = energy - 10
          }
        }`, '')
      })

      it('mixin', () => {
        checkSuccessfulResult(`mixin Flyier {
          var energy = 100
          method fly() {
            energy = energy - 10
          }
        }`, '')
      })

      it('singleton', () => {
        checkSuccessfulResult(`object pepita {
          var energy = 100
          method fly() {
            energy = energy - 10
          }
        }`, '')
      })

      it('unnamed singleton', () => {
        checkSuccessfulResult('object { } ', '')
      })

    })

    describe('using static definitions', () => {
      it('using a singleton', () => {
        checkSuccessfulResult(`object pepita {
          var energy = 100
          method energy() = energy
          method fly() {
            energy = energy - 10
          }
        } ;
        pepita.fly() ;
        pepita.energy()`, '90')
      })

      it('using a class', () => {
        checkSuccessfulResult(`class Bird {
          var property energy = 100
          method fly() {
            energy = energy - 10
          }
        } ;
        const pepita = new Bird() ;
        pepita.fly() ;
        pepita.energy()`, '90')
      })

      it('using a mixin', () => {
        checkSuccessfulResult(`mixin Tracker {
          var property timesTracked = 0
          method track() {
            timesTracked = timesTracked + 1
          }
        } ;
        class Bird {
          var property energy = 100
          method fly() {
            energy = energy - 10
          }
        };
        const pepita = object inherits Tracker and Bird {
          method fly() {
            super()
            self.track()
          }
        };
        pepita.fly();
        pepita.timesTracked()`, '1')
      })

    })

    describe('should print result', () => {

      it('for reference to wko', () => {
        checkSuccessfulResult('assert', 'assert')
      })

      it('for reference to an instance', () => {
        checkSuccessfulResult('new Object()', 'an Object')
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

      it('should be able to execute sentences related to a hierarchy defined in different packages', () => {
        const replEnvironment = buildEnvironment([{
          name: 'jefeDeDepartamento.wlk', content: `
          import medico.*

          class Jefe inherits Medico {
            const subordinados = #{}

            override method atenderA(unaPersona) {
              subordinados.anyOne().atenderA(unaPersona)
            }
          }
          `,
        }, {
          name: 'medico.wlk', content: `
          import persona.*

          class Medico inherits Persona {
            const dosis

            override method contraerEnfermedad(unaEnfermedad) {
              super(unaEnfermedad)
              self.atenderA(self)
            }
            method atenderA(unaPersona) {
              unaPersona.recibirMedicamento(dosis)
            }

          }
          `,
        }, {
          name: 'persona.wlk', content: `
          class Persona {
            const enfermedades = []

            method contraerEnfermedad(unaEnfermedad) {

              enfermedades.add(unaEnfermedad)
            }

            method saludar() = "hola"
          }
          `,
        }, {
          name: INIT_FILE, content: `
          import medico.*

          object testit {
            method test() = new Medico(dosis = 200).saludar()
          }
          `,
        }])
        replEnvironment.scope.register([REPL, replEnvironment.getNodeByFQN(INIT_PACKAGE_NAME)!])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error, result } = interprete(interpreter, 'testit.test()')
        expect(error).to.be.undefined
        expect(result).to.equal('"hola"')
      })

      it('should be able to execute sentences related to a hierarchy defined in different packages - 2', () => {
        const replEnvironment = buildEnvironment([{
          name: 'medico.wlk', content: `
          import persona.*

          class Medico inherits Persona {
            const dosis

            override method contraerEnfermedad(unaEnfermedad) {
              super(unaEnfermedad)
              self.atenderA(self)
            }

            method atenderA(unaPersona) {
              unaPersona.recibirMedicamento(dosis)
            }

          }
          `,
        }, {
          name: 'pediatra.wlk', content: `
          import jefeDeDepartamento.*

          class Pediatra inherits Jefe {
            const property fechaIngreso = new Date()

            method esNuevo() = fechaIngreso.year() < 2022
          }
          `,
        }, {
          name: 'jefeDeDepartamento.wlk', content: `
          import medico.*

          class Jefe inherits Medico {
            const subordinados = #{}

            override method atenderA(unaPersona) {
              subordinados.anyOne().atenderA(unaPersona)
            }
          }
          `,
        }, {
          name: 'persona.wlk', content: `
          class Persona {
            const enfermedades = []

            method contraerEnfermedad(unaEnfermedad) {

              enfermedades.add(unaEnfermedad)
            }

            method saludar() = "hola"
          }
          `,
        }, {
          name: INIT_PACKAGE_NAME, content: `
          import pediatra.*

          object testit {
            method test() = new Pediatra(dosis = 200).saludar()
          }
          `,
        }])

        replEnvironment.scope.register([REPL, replEnvironment.getNodeByFQN(INIT_PACKAGE_NAME)!])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error, result } = interprete(interpreter, 'testit.test()')
        expect(error).to.be.undefined
        expect(result).to.equal('"hola"')
      })

      it('should be able to interprete sentences within a certain context', () => {
        const environment = buildEnvironment([{
          name: 'pepita-file.wlk',
          content: `
          object pepita {
            var energia = 100
            method volar() {
              energia = energia - 10
            }
          }`,
        },
        {
          name: 'pepita-tests.wtest',
          content: `
          import pepita-file.*

          test "testPepita" {
              pepita.volar()
          }`,
        }])
        const directedInterpreter: DirectedInterpreter = new DirectedInterpreter(Evaluation.build(environment, WRENatives))
        const executionDirector = directedInterpreter.exec(directedInterpreter.evaluation.environment.getNodeByFQN('pepita-tests."testPepita"'))
        executionDirector.addBreakpoint(directedInterpreter.evaluation.environment.getNodeByFQN<Singleton>('pepita-file.pepita').methods[0])
        executionDirector.resume()
        const { error, result } = interprete(new Interpreter(directedInterpreter.evaluation), 'energia', directedInterpreter.evaluation.currentFrame)
        expect(error).to.be.undefined
        expect(result).to.equal('100')
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

      it('should wrap void validation errors for void parameter', () => {
        const { error } = interprete(interpreter, '5 + [1,2,3].add(4)')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(['wollok.lang.EvaluationError: RangeError: Message Number.+/1: parameter #1 produces no value, cannot use it'])
      })

      it('should wrap void validation errors when sending a message to a void object', () => {
        expectError('([1].add(2)).add(3)', 'wollok.lang.EvaluationError: RangeError: Cannot send message add, receiver is an expression that produces no value.')
      })

      it('should wrap void validation errors for void parameter in super call', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
          class Bird {
            var energy = 100
            method fly(minutes) {
              energy = 4 * minutes + energy
            }
          }

          class MockingBird inherits Bird {
            override method fly(minutes) {
              super([1, 2].add(4))
            }
          }
          `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'new MockingBird().fly(2)')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(
          [
            'wollok.lang.EvaluationError: RangeError: super call for message fly/1: parameter #1 produces no value, cannot use it',
            `  at ${INIT_PACKAGE_NAME}.MockingBird.fly(minutes) [${INIT_PACKAGE_NAME}.wlk:11]`,
          ]
        )
      })

      it('should wrap void validation errors for void condition in if', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
          class Bird {
            var energy = 100
            method fly(minutes) {
              if ([1, 2].add(3)) {
                energy = 50
              }
            }
          }
          `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'new Bird().fly(2)')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(
          [
            'wollok.lang.EvaluationError: RangeError: Message fly - if condition produces no value, cannot use it',
            `  at ${INIT_PACKAGE_NAME}.Bird.fly(minutes) [${INIT_PACKAGE_NAME}.wlk:5]`,
          ]
        )
      })

      it('Can\'t redefine a const with a var', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            const variableName = 1
          `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'var variableName = 2')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(
          [
            'wollok.lang.EvaluationError: Error: Can\'t redefine a variable',

          ]
        )
        const { result } = interprete(interpreter, 'variableName')
        expect(+result).to.equal(1)
      })

      it('Can\'t redefine a const with a const', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            const variableName = 1
          `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'const variableName = 2')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(
          [
            'wollok.lang.EvaluationError: Error: Can\'t redefine a variable',

          ]
        )
        const { result } = interprete(interpreter, 'variableName')
        expect(+result).to.equal(1)
      })

      it('Can\'t redefine a var with a const', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            var variableName = 1
          `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'const variableName = 2')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(
          [
            'wollok.lang.EvaluationError: Error: Can\'t redefine a variable',

          ]
        )
        const { result } = interprete(interpreter, 'variableName')
        expect(+result).to.equal(1)
      })

      it('Can\'t redefine a var with a var', () => {
        const replEnvironment = buildEnvironment([{
          name: REPL, content: `
            var variableName = 1
          `,
        }])
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'var variableName = 2')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal(
          [
            'wollok.lang.EvaluationError: Error: Can\'t redefine a variable',

          ]
        )
        const { result } = interprete(interpreter, 'variableName')
        expect(+result).to.equal(1)
      })

      it('should wrap void validation errors for assignment to void value', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
          object pepita {
            method volar() {
            }
          }`)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expectError('const a = pepita.volar()', 'wollok.lang.EvaluationError: RangeError: Cannot assign to variable \'a\': message volar/0 produces no value, cannot assign it to a variable')
        expectError('const a = if (4 > 5) true else pepita.volar()', 'wollok.lang.EvaluationError: RangeError: Cannot assign to variable \'a\': if expression produces no value, cannot assign it to a variable')
        expectError('const a = [1].add(2)', 'wollok.lang.EvaluationError: RangeError: Cannot assign to variable \'a\': message add/1 produces no value, cannot assign it to a variable')
      })

      it('should wrap void validation errors for void method used in expression', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
          object pepita {
            method volar() {
            }
          }`)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))

        const { error } = interprete(interpreter, '5 + pepita.volar()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.EvaluationError: RangeError: Message Number.+/1: parameter #1 produces no value, cannot use it',
        ])
      })

      it('should handle errors when using void values in new named parameters', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
            class Bird {
              var energy = 100
              var name = "Pepita"
            }
        `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expectError('new Bird(energy = void)', `wollok.lang.EvaluationError: RangeError: new ${INIT_PACKAGE_NAME}.Bird: value of parameter 'energy' produces no value, cannot use it`)
        expectError('new Bird(energy = 150, name = [1].add(2))', `wollok.lang.EvaluationError: RangeError: new ${INIT_PACKAGE_NAME}.Bird: value of parameter 'name' produces no value, cannot use it`)
      })

      it('should show Wollok stack', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
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
          }`)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'new Ave().volar()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.EvaluationError: TypeError: Message plusDays: parameter "wollok.lang.Date" should be a number',
          `  at ${INIT_PACKAGE_NAME}.comun.despegar() [${INIT_PACKAGE_NAME}.wlk:8]`,
          `  at ${INIT_PACKAGE_NAME}.comun.volar() [${INIT_PACKAGE_NAME}.wlk:4]`,
          `  at ${INIT_PACKAGE_NAME}.Ave.volar() [${INIT_PACKAGE_NAME}.wlk:17]`,
        ])
      })

      it('should handle errors when using void return values for wko', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
            object pepita {
                method unMetodo() {
                    return [1,2,3].add(4) + 5
                }
            }
        `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        const { error } = interprete(interpreter, 'pepita.unMetodo()')
        assertBasicError(error)
        expect(getStackTraceSanitized(error)).to.deep.equal([
          'wollok.lang.EvaluationError: RangeError: Cannot send message +, receiver is an expression that produces no value.',
          `  at ${INIT_PACKAGE_NAME}.pepita.unMetodo() [${INIT_PACKAGE_NAME}.wlk:4]`,
        ])
      })

      it('should handle errors when using void closures inside native list methods', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
            const pepita = object { method energia(total) { } }
        `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expectError('[1, 2].filter { n => pepita.energia(n) }', 'wollok.lang.EvaluationError: RangeError: Message filter: closure produces no value. Check the return type of the closure (missing return?)')
        expectError('[1, 2].findOrElse({ n => pepita.energia(n) }, {})', 'wollok.lang.EvaluationError: RangeError: Message findOrElse: predicate produces no value. Check the return type of the closure (missing return?)')
        expectError('[1, 2].fold(0, { acum, total => pepita.energia(1) })', 'wollok.lang.EvaluationError: RangeError: Message fold: closure produces no value. Check the return type of the closure (missing return?)')
        expectError('[1, 2].sortBy({ a, b => pepita.energia(1) })', 'wollok.lang.EvaluationError: RangeError: Message sortBy: closure produces no value. Check the return type of the closure (missing return?)')
      })

      it('should handle errors when using void closures inside native set methods', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
            const pepita = object { method energia(total) { } }
        `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expectError('#{1, 2}.filter { n => pepita.energia(n) }', 'wollok.lang.EvaluationError: RangeError: Message filter: closure produces no value. Check the return type of the closure (missing return?)')
        expectError('#{1, 2}.findOrElse({ n => pepita.energia(n) }, {})', 'wollok.lang.EvaluationError: RangeError: Message findOrElse: predicate produces no value. Check the return type of the closure (missing return?)')
        expectError('#{1, 2}.fold(0, { acum, total => pepita.energia(1) })', 'wollok.lang.EvaluationError: RangeError: Message fold: closure produces no value. Check the return type of the closure (missing return?)')
      })

      it('should handle errors when using void closures inside Wollok list methods', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
            const pepita = object { method energia(total) { } }
        `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expectError('[1, 2].map { n => pepita.energia(n) }', 'wollok.lang.EvaluationError: RangeError: map - while sending message List.add/1: parameter #1 produces no value, cannot use it')
      })

      it('should handle errors when using void parameters', () => {
        const replEnvironment = environmentWithREPLInitializedFile(`
            const pepita = object { method energia() { } }
        `)
        interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
        expect('[].add(pepita.energia())', 'wollok.lang.EvaluationError: RangeError: Message List.add/1: parameter #1 produces no value, cannot use it')
      })

    })

    it('should handle void values for assert', () => {
      const replEnvironment = environmentWithREPLInitializedFile(`
        object pajarito {
          method volar() {
          }
        }`)
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      expectError('assert.that(pajarito.volar())', 'wollok.lang.EvaluationError: RangeError: Message assert.that/1: parameter #1 produces no value, cannot use it')
    })

    it('should allow a forEach to receive a void closure', () => {
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