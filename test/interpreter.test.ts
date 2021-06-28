import { should, use } from 'chai'
import sinonChai from 'sinon-chai'
import { restore } from 'sinon'
import { Class, Package, Literal, Method, Body, Send } from '../src/model'
import { Evaluation, ExecutionDirector } from '../src/interpreter/runtimeModel'
import link from '../src/linker'


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
          new Class({ name: 'EvaluationError' }),
        ],
      }),
    ],
  }),
])


describe('Wollok Interpreter', () => {

  afterEach(restore)

  describe('Execution Director', () => {

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

      const evaluation = Evaluation.build(WRE, {})
      const director = new ExecutionDirector(evaluation, function*(){ yield* this.exec(expression) })
      director.breakpoints.push(breakpoint)

      const state = director.resume()


      state.done.should.be.false
      state.should.have.property('next').equal(breakpoint)
    })

  })

})