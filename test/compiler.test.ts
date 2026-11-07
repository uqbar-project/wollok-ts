import { should, use } from 'chai'
import { describe, it } from 'mocha'
import sinonChai from 'sinon-chai'
import { Assignment, Body, buildEnvironment, compileConstantLiteralMethod, compilePropertyMethod, constantLiteralReturnedBy, Environment, Evaluation, Execution, Expression, Literal, Method, NativeFunction, Parameter, Reference, REPL, Return, RuntimeObject, RuntimeValue, Singleton, Variable, WollokException, WRENatives } from '../src'
import { DirectedInterpreter, getStackTraceSanitized, interprete, Interpreter } from '../src/interpreter/interpreter'

use(sinonChai)
should()

function generatorValue<T>(gen: Execution<T>): T {
  let result = gen.next()
  while (!result.done) result = gen.next()
  return result.value
}

function execNative(native: NativeFunction, evaluation: Evaluation, self: RuntimeObject, ...params: RuntimeObject[]): RuntimeObject | void {
  const gen = native.call(evaluation, self, ...params)
  return generatorValue(gen)
}

describe('Compiler', () => {

  describe('properties', () => {

    const name = 'x'

    it('compiles getter', () => {
      const getter = new Method({
        name,
        isOverride: false,
        parameters: [],
        body: new Body({ sentences: [new Return({ value: new Reference({ name }) })] }),
      })

      const native = compilePropertyMethod(getter)

      const replEnvironment = buildEnvironment([{ name: REPL, content: 'object o { var x = 10 }' }])
      const evaluation = Evaluation.build(replEnvironment, WRENatives)
      const obj = evaluation.rootFrame.get(REPL + '.o')!
      const value = execNative(native, evaluation, obj)
      value!.innerNumber!.should.equal(10)
    })

    it('compiles setter', () => {
      const setter = new Method({
        name,
        isOverride: false,
        parameters: [new Parameter({ name: '<value>', isVarArg: false })],
        body: new Body({
          sentences: [
            new Assignment({
              variable: new Reference({ name }),
              value: new Reference({ name: '<value>' }),
            }),
          ],
        }),
      })

      const native = compilePropertyMethod(setter)

      const replEnvironment = buildEnvironment([{ name: REPL, content: 'object o { var x = 10 }' }])
      const evaluation = Evaluation.build(replEnvironment, WRENatives)
      const obj = evaluation.rootFrame.get(REPL + '.o')!
      execNative(native, evaluation, obj, generatorValue(evaluation.reify(20)))

      obj.get(name)!.innerNumber!.should.equal(20)
    })

    it('compiles constant method', () => {
      const constantMethod = new Method({
        name,
        body: new Body({
          sentences: [
            new Return({
              value: new Literal({ value: 8 }),
            }),
          ],
        }),
      })
      const native = compileConstantLiteralMethod(constantLiteralReturnedBy(constantMethod)!)

      const replEnvironment = buildEnvironment([{ name: REPL, content: 'object o { }' }])
      const evaluation = Evaluation.build(replEnvironment, WRENatives)
      const obj = evaluation.rootFrame.get(REPL + '.o')!
      const value = execNative(native, evaluation, obj)
      value!.innerNumber!.should.equal(8)
    })
  })

  describe('returned expressions', () => {

    const content = `
      class Point {
        const property x
        const property y
      }

      class Shape {
        method area()
      }

      const globalConstant = 7

      const globalObject = object {
        method instance(param) = new Point(x = param, y = 2)
      }

      object helper {
        method nothing(param) { }
        method first(a, b) = a
        method fail(param) { throw new DomainException(message = param) }
      }

      object o {
        var property x = 1

        method parameter(param) = param
        method attribute(param) = x
        method global(param) = console
        method globalVariable(param) = globalConstant
        method returnStatement(param) { return param }
        method varArgs(params...) = params

        method message(param) = param.max(x)
        method messageWithConstants(param) = 1.max(2)
        method messageToGlobal(param) = helper.first(param, "constant")
        method messageOnArgument(param) = 1.max(param)
        method messageThatFails(param) = helper.fail(param)
        method multilineMessageThatFails(param) {
          return helper.fail(param)
        }
        method conjunction(param, other) = param && other
        method closure(param) = { other => param.max(other) }

        method instance(param) = new Point(x = x, y = param)
        method instanceWithConstant(param) = new Point(x = 1, y = 2)
        method instanceWithMessage(param) = new Point(x = param.max(x), y = 2)
        method instanceWithVoidMessage(param) = new Point(x = helper.nothing(param), y = 2)

        method selfReference(param) = self
        method messageToSelf(param) = self.parameter(param)
        method nestedMessage(param) = param.max(x).max(x)
        method messageWithCollection(param) = helper.first(param, [1])
        method collection(param) = [param]
        method twoSentences(param) {
          const value = param
          return value
        }
        method withoutReturn(param) { param }
        method emptyList(param) = new List()
        method abstractInstance(param) = new Shape()
        method uninitializedInstance(param) = new Point(x = 1)
        method instanceWithNestedMessage(param) = new Point(x = param.max(x).max(x), y = 2)
        method nestedInstance(param) = new Point(x = new Point(x = 1, y = 2), y = 2)
      }
    `

    let environment: Environment
    let interpreter: Interpreter
    let o: RuntimeObject

    const methodNamed = (name: string): Method => environment.getNodeByFQN<Singleton>('main.o').methods.find(method => method.name === name)!
    const interpretAllMethods = () => environment.forEach(node => { if (node.is(Method) && !node.isSynthetic) node.compiled = false })
    const send = (message: string, ...args: RuntimeObject[]): RuntimeValue => interpreter.send(message, o, ...args)
    const reifyVoid = (): RuntimeObject => interpreter.do(function* () { return yield* this.reifyVoid() })

    const stackTraceOf = (action: () => unknown): string[] => {
      try {
        action()
      } catch (error) {
        return getStackTraceSanitized(error as WollokException)
      }
      throw new Error('Expected the action to fail')
    }

    beforeEach(() => {
      environment = buildEnvironment([{ name: 'main.wlk', content }])
      interpreter = new Interpreter(Evaluation.build(environment, WRENatives))
      o = interpreter.object('main.o')
    })

    const compiledMethods = ['parameter', 'attribute', 'global', 'globalVariable', 'returnStatement', 'varArgs', 'message', 'messageWithConstants', 'messageToGlobal', 'messageOnArgument', 'messageThatFails', 'conjunction', 'instance', 'instanceWithConstant', 'instanceWithMessage', 'instanceWithVoidMessage']
    compiledMethods.forEach(name => it(`compiles ${name}`, () => {
      methodNamed(name).compiled.should.be.true
    }))

    const interpretedMethods = ['selfReference', 'messageToSelf', 'nestedMessage', 'messageWithCollection', 'collection', 'twoSentences', 'withoutReturn', 'emptyList', 'abstractInstance', 'uninitializedInstance', 'instanceWithNestedMessage', 'nestedInstance', 'closure']
    interpretedMethods.forEach(name => it(`does not compile ${name}`, () => {
      methodNamed(name).compiled.should.be.false
    }))

    it('does not compile instances inside global variables, whose arguments are lazy', () => {
      const singleton = environment.getNodeByFQN<Variable>('main.globalObject').value as Singleton
      singleton.methods[0].compiled.should.be.false
    })

    it('returns the parameter', () => {
      const param = interpreter.reify(5)
      send('parameter', param)!.should.equal(param)
    })

    it('returns the current value of the attribute', () => {
      send('attribute', interpreter.reify(5))!.innerNumber!.should.equal(1)
      send('x', interpreter.reify(2))
      send('attribute', interpreter.reify(5))!.innerNumber!.should.equal(2)
    })

    it('returns the global objects and variables', () => {
      send('global', interpreter.reify(5))!.should.equal(interpreter.object('wollok.lib.console'))
      send('globalVariable', interpreter.reify(5))!.innerNumber!.should.equal(7)
    })

    it('returns var args as a list', () => {
      send('varArgs', interpreter.reify(1), interpreter.reify(2))!.innerCollection!.map(_ => _.innerNumber).should.deep.equal([1, 2])
    })

    it('sends the message', () => {
      send('message', interpreter.reify(5))!.innerNumber!.should.equal(5)
      send('messageWithConstants', interpreter.reify(5))!.innerNumber!.should.equal(2)
      send('messageToGlobal', interpreter.reify(5))!.innerNumber!.should.equal(5)
    })

    it('does not evaluate the argument if the message short-circuits', () => {
      send('conjunction', interpreter.reify(false), reifyVoid())!.innerBoolean!.should.be.false
    })

    it('resolves the variables captured by closures', () => {
      const closure = send('closure', interpreter.reify(3))!
      closure.module.methods.find(method => method.name === '<apply>')!.compiled.should.be.true
      interpreter.send('apply', closure, interpreter.reify(8))!.innerNumber!.should.equal(8)
    })

    it('creates a new instance on each send', () => {
      const instance = send('instance', interpreter.reify(5))!
      instance.module.name!.should.equal('Point')
      instance.get('x')!.innerNumber!.should.equal(1)
      instance.get('y')!.innerNumber!.should.equal(5)
      send('instance', interpreter.reify(5))!.should.not.equal(instance)
    })

    it('uses messages as arguments of the new instance', () => {
      send('instanceWithMessage', interpreter.reify(5))!.get('x')!.innerNumber!.should.equal(5)
    })

    it('resolves references to definitions added later from the REPL', () => {
      const replEnvironment = buildEnvironment([{ name: REPL, content: 'object o { method later() = definedLater }' }])
      const replInterpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))

      interprete(replInterpreter, 'object definedLater { }', undefined, true).errored.should.be.false
      interprete(replInterpreter, 'o.later()').errored.should.be.false
    })

    it('fails the same way as the interpreter', () => {
      const failures: [string, () => RuntimeObject][] = [
        ['message', reifyVoid],
        ['messageOnArgument', reifyVoid],
        ['messageToGlobal', reifyVoid],
        ['message', () => interpreter.reify('not a number')],
        ['messageThatFails', () => interpreter.reify('failed')],
        ['multilineMessageThatFails', () => interpreter.reify('failed')],
        ['instance', reifyVoid],
        ['instanceWithMessage', reifyVoid],
        ['instanceWithVoidMessage', () => interpreter.reify(5)],
      ]

      const stackTraces = (): string[][] => failures.map(([message, param]) => stackTraceOf(() => send(message, param())))

      const compiledStackTraces = stackTraces()
      interpretAllMethods()

      compiledStackTraces.should.deep.equal(stackTraces())
    })

    it('can be paused on the nodes of a compiled method', () => {
      const directedInterpreter = new DirectedInterpreter(Evaluation.build(environment, WRENatives))
      const method = methodNamed('messageWithConstants')
      const message = (method.sentences[0] as Return).value as Expression

      const director = directedInterpreter.send('messageWithConstants', directedInterpreter.object('main.o'), o)
      director.addBreakpoint(message)

      director.resume().should.deep.include({ done: false, next: message })

      const finalState = director.finish()
      if (finalState.error) throw finalState.error
      finalState.result!.innerNumber!.should.equal(2)
    })
  })
})