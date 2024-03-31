import { expect, should, use } from 'chai'
import { restore } from 'sinon'
import sinonChai from 'sinon-chai'
import { EXCEPTION_MODULE, Evaluation } from '../src'
import { DirectedInterpreter, Interpreter } from '../src/interpreter/interpreter'
import link from '../src/linker'
import { Body, Class, Field, Literal, Method, Package, ParameterizedType, Reference, Return, Send, Singleton, SourceIndex, SourceMap } from '../src/model'


use(sinonChai)
should()

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