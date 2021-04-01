import { expect, use } from 'chai'
import sinonChai from 'sinon-chai'
import { restore, stub } from 'sinon'
import { Class, Package, Reference, Self, Variable, Literal, Method, Body, Singleton, New, Field, NamedArgument } from '../src/model'
import { Context, Evaluation, RuntimeObject } from '../src/interpreter/runtimeModel'
import link from '../src/linker'
import { interpreter2Assertions } from './assertions'


use(sinonChai)
use(interpreter2Assertions)

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


function resultOf<T>(generator: Generator<unknown, T>): T {
  let result = generator.next()
  while(!result.done) result = generator.next()
  return result.value
}

//TODO: These tests are stupid. We should already be covering all this in the sanities, so why double our work?
//      We should replace these with short, to-the-point tests for the interpreter itself and the orchestrator
describe('Wollok Node Interpreter', () => {

  // afterEach(restore)

  // describe('Execution', () => {

  //   describe('Reference', () => {

  //     it('should return the object referenced on the given context, if any', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Reference<Variable>({ name: 'x' })
  //       const instance = resultOf(runner.instantiate(WRE.getNodeByFQN('wollok.lang.Object')))
  //       const context = new Context(runner.rootContext, { x: instance })

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.return(instance)
  //     })

  //     it('should return the object referenced on an inherited context, if any', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Reference<Variable>({ name: 'x' })
  //       const instance = resultOf(runner.instantiate(WRE.getNodeByFQN('wollok.lang.Object')))
  //       const parentContext = new Context(runner.rootContext, { x: instance })

  //       const execution = runner.exec(node, new Context(parentContext))

  //       expect(execution)
  //         .to.yield(node)
  //         .and.return(instance)
  //     })

  //     it('should return undefined if the is no referenced object on the given context', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Reference<Variable>({ name: 'x' })
  //       const context = new Context(runner.rootContext, { })

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.return(undefined)
  //     })

  //     it('should yield before executing', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Reference({ name: 'x' })
  //       const context = new Context(runner.rootContext)
  //       stub(context, 'get').throws('Should not have reached this point')

  //       const execution = runner.exec(node, context)

  //       expect(execution).to.yield(node)
  //     })

  //   })


  //   describe('Self', () => {

  //     it('should return the object referenced on the given context, if any', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Self()
  //       const instance = resultOf(runner.instantiate(WRE.getNodeByFQN('wollok.lang.Object')))
  //       const context = new Context(runner.rootContext, { self: instance })

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.return(instance)
  //     })

  //     it('should return the object referenced on an inherited context, if any', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Self()
  //       const instance = resultOf(runner.instantiate(WRE.getNodeByFQN('wollok.lang.Object')))
  //       const parentContext = new Context(runner.rootContext, { self: instance })

  //       const execution = runner.exec(node, new Context(parentContext))

  //       expect(execution)
  //         .to.yield(node)
  //         .and.return(instance)
  //     })

  //     it('should return undefined if the is no referenced object on the given context', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Self()
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.return(undefined)
  //     })

  //     it('should yield before executing', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Self()
  //       const context = new Context(runner.rootContext)
  //       stub(context, 'get').throws('Should not have reached this point')

  //       const execution = runner.exec(node, context)

  //       expect(execution).to.yield(node)
  //     })

  //   })


  //   describe('Literal', () => {

  //     it('numeric literals should return the reified Number', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({ value: 5 })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.exactly.return(resultOf(runner.reify(node.value)))
  //     })

  //     it('string literals should return the reified String', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({ value: 'foo' })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.exactly.return(resultOf(runner.reify(node.value)))
  //     })

  //     it('boolean literals should return the reified Boolean', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({ value: true })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.exactly.return(resultOf(runner.reify(node.value)))
  //     })

  //     it('null literals should return the reified null', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({ value: null })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.exactly.return(resultOf(runner.reify(node.value)))
  //     })

  //     it('List literals should return the reified List', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({
  //         value: [
  //           new Reference({ name: 'wollok.lang.List' }),
  //           [new Literal({ value: 1 }), new Literal({ value: 2 }), new Literal({ value: 3 })],
  //         ],
  //       })
  //       stub(node.value[0], 'target').returns(WRE.getNodeByFQN<Class>('wollok.lang.List'))
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node.value[1][0])
  //         .and.yield(node.value[1][1])
  //         .and.yield(node.value[1][2])
  //         .and.yield(node)
  //         .and.return(resultOf(runner.list([resultOf(runner.reify(1)), resultOf(runner.reify(2)), resultOf(runner.reify(3))])))
  //     })

  //     it('Set literals should return the reified Set', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({
  //         value: [
  //           new Reference({ name: 'wollok.lang.Set' }),
  //           [new Literal({ value: 1 }), new Literal({ value: 2 }), new Literal({ value: 3 })],
  //         ],
  //       })
  //       stub(node.value[0], 'target').returns(WRE.getNodeByFQN<Class>('wollok.lang.Set'))
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node.value[1][0])
  //         .and.yield(node.value[1][1])
  //         .and.yield(node.value[1][2])
  //         .and.yield(node)
  //         .and.return(resultOf(runner.set([resultOf(runner.reify(1)), resultOf(runner.reify(2)), resultOf(runner.reify(3))])))
  //     })

  //     it('singleton literals should return the given singleton instance', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({ value: new Singleton({ members: [new Method({ name: 'initialize', body: new Body() })] }) })
  //       stub(node.value, 'superclass').returns(WRE.getNodeByFQN<Class>('wollok.lang.Object'))
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.yield(node.value.methods()[0].body)
  //         .and.return(new RuntimeObject(node.value, context))
  //     })

  //     it('should yield before executing', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new Literal({
  //         value: [
  //           new Reference({ name: 'wollok.lang.List' }),
  //           [new Literal({ value: 1 }), new Literal({ value: 2 }), new Literal({ value: 3 })],
  //         ],
  //       })
  //       stub(node.value[0], 'target').returns(WRE.getNodeByFQN<Class>('wollok.lang.List'))
  //       stub(runner, 'list').throws('Should not have reached this point')
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node.value[1][0])
  //         .and.yield(node.value[1][1])
  //         .and.yield(node.value[1][2])
  //         .and.yield(node)
  //     })
  //   })


  //   describe('New', () => {

  //     it('should return a new initialized instance of the given module', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new New({ instantiated: new Reference({ name: 'wollok.lang.Object' }) })
  //       const context = new Context(runner.rootContext)

  //       stub(node.instantiated, 'target').returns(WRE.getNodeByFQN<Class>('wollok.lang.Object'))

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //         .and.yield(WRE.getNodeByFQN<Class>('wollok.lang.Object').lookupMethod('initialize', 0)?.body)
  //         .and.return(new RuntimeObject(WRE.getNodeByFQN<Class>('wollok.lang.Object'), context))
  //     })

  //     it('should return a new initialized instance of the given module, setting the instantiation parameters', () => {
  //       const runner = Runner.build(link([
  //         new Package({
  //           name: 'p',
  //           members: [
  //             new Class({
  //               name: 'C',
  //               members: [
  //                 new Field({ name: 'x', isReadOnly: true, value: new Literal({ value: 0 }) }),
  //                 new Method({ name: 'initialize', body: new Body() }),
  //               ],
  //             }),
  //           ],
  //         }),
  //       ], WRE), {})
  //       const node = new New({ instantiated: new Reference({ name: 'p.C' }), args: [new NamedArgument({ name: 'x', value: new Literal({ value: 5 }) })] })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)
  //       stub(node.instantiated, 'target').returns(runner.environment.getNodeByFQN<Class>('p.C'))

  //       const expected = new RuntimeObject(runner.environment.getNodeByFQN<Class>('p.C'), context)
  //       expected.set('x', resultOf(runner.reify(5)))

  //       expect(execution)
  //         .to.yield(node.args[0].value)
  //         .and.yield(node)
  //         .and.yield(runner.environment.getNodeByFQN<Class>('p.C').methods()[0].body)
  //         .and.return(expected)
  //     })

  //     it('should return a new initialized instance of the given module, setting the default values when there are no instantiation arguments', () => {
  //       const runner = Runner.build(link([
  //         new Package({
  //           name: 'p',
  //           members: [
  //             new Class({
  //               name: 'C',
  //               members: [
  //                 new Field({ name: 'x', isReadOnly: true, value: new Literal({ value: 0 }) }),
  //                 new Method({ name: 'initialize', body: new Body() }),
  //               ],
  //             }),
  //           ],
  //         }),
  //       ], WRE), {})
  //       const node = new New({ instantiated: new Reference({ name: 'p.C' }) })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)
  //       stub(node.instantiated, 'target').returns(runner.environment.getNodeByFQN<Class>('p.C'))

  //       const expected = new RuntimeObject(runner.environment.getNodeByFQN<Class>('p.C'), context)
  //       expected.set('x', resultOf(runner.reify(0)))

  //       expect(execution)
  //         .to.yield(node)
  //         .and.yield(runner.environment.getNodeByFQN<Class>('p.C').fields()[0].value)
  //         .and.yield(runner.environment.getNodeByFQN<Class>('p.C').methods()[0].body)
  //         .and.return(expected)
  //     })

  //     it('Should yield before executing', () => {
  //       const runner = Runner.build(WRE, {})
  //       const node = new New({ instantiated: new Reference({ name: 'p.C' }) })
  //       const context = new Context(runner.rootContext)

  //       const execution = runner.exec(node, context)

  //       expect(execution)
  //         .to.yield(node)
  //     })

  //   })


  //   describe('Send', () => {
  //     it('should lookup method and invoke it in new context if non-native or abstract')
  //     it('should lookup method and invoke it in new context if native')
  //     it('should lookup method and invoke "messageNotUnderstood" if not found')
  //     it('should yield before executing')
  //   })


  //   describe('Super', () => {
  //     it('should lookup method and invoke it in new context if non-native or abstract')
  //     it('should lookup method and invoke it in new context if native')
  //     it('should lookup method and invoke "messageNotUnderstood" if not found')
  //     it('should yield before executing')
  //   })


  //   describe('If', () => {
  //     it('should execute thenBody in a new context when the condition is true')
  //     it('should execute elseBody in a new context when the condition is false')
  //     it('should throw an error if the condition is not boolean')
  //     it('should yield before executing')
  //   })


  //   describe('Try', () => {
  //     it('should execute body and return the result if no exception is thrown')
  //     it('should execute body and handle thrown exceptions with matching catch')
  //     it('should prioritize catches in descending order')
  //     it('should let the error bubble up if no catch matches the thrown exception')
  //     it('should execute always when no exception is thrown')
  //     it('should execute always when a catch handles the thrown exception')
  //     it('should execute always when a no catch handles the thrown exception')
  //     it('should yield before executing')
  //   })


  //   describe('Throw', () => {
  //     it('should interrupt excution raising the given exception')
  //     it('should yield before executing')
  //   })


  //   describe('Variable', () => {
  //     it('should save the variable and its default value to the current context')
  //     it('should yield before executing')
  //   })


  //   describe('Assignment', () => {
  //     it('should override the referenced name with the given value on the current context')
  //     it('should override the referenced name with the given value on an inherited context')
  //     it('should throw an error if assigning a constant')
  //     it('should yield before executing')
  //   })


  //   describe('Return', () => {
  //     it('should interrupt current execution returning the given value')
  //     it('should interrupt nested non-method executions returning the given value')
  //     it('should yield before executing')
  //   })

  // })

})