import { should, use } from 'chai'
import { describe, it } from 'mocha'
import sinonChai from 'sinon-chai'
import { Assignment, Body, buildEnvironment, compileConstantLiteralMethod, compilePropertyMethod, constantLiteralReturnedBy, Evaluation, Execution, executionFor, Literal, Method, NativeFunction, Parameter, Reference, REPL, Return, RuntimeObject, WRENatives } from '../src'


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

      const testCompilation = (flag: boolean, shouldCompile: boolean) => {
      const environment = buildEnvironment([{ name: REPL, content: 'object o { method doSomething() = 1 }' }])
      const evaluation = Evaluation.build(environment, WRENatives, flag)
      const compiledMethods = Array.from(evaluation.natives.keys())
      
    
      compiledMethods.some(m => m.name === 'doSomething').should.equal(shouldCompile)
    }

    it('should compile natives when feature flag is true', () => {
      testCompilation(true, true) 
    })

    it('should not compile natives when feature flag is false', () => {
      testCompilation(false, false) 
    })

    it('should not compile methods when using DirectedInterpreter', () => {
      const environment = buildEnvironment([{ name: REPL, content: 'object o { method doSomething() = 1 }' }])
      const interpreter = executionFor(environment)
      const compiledMethods = Array.from(interpreter.evaluation.natives.keys())
      
      compiledMethods.some(m => m.name === 'doSomething').should.be.false
    })

})