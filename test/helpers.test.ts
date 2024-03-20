import { should, use } from 'chai'
import sinonChai from 'sinon-chai'
import { BOOLEAN_MODULE, Class, Environment, Evaluation, Interpreter, LIST_MODULE, Literal, NUMBER_MODULE, Package, Reference, STRING_MODULE, WRENatives, fromJSON, link, literalValueToClass } from '../src'
import wre from '../src/wre/wre.json'

use(sinonChai)
should()

const WRE: Environment = fromJSON(wre)

describe('Wollok helpers', () => {

  describe('literalValueToClass', () => {

    const baseEnvironment = link([new Package({
      name: 'p',
      members: [
        new Class({ name: 'c' }),
      ],
    })], WRE)
    const interpreter = new Interpreter(Evaluation.build(baseEnvironment, WRENatives))
    const environment = interpreter.evaluation.environment

    it('should work for numbers', () => {
      const numberClass = environment.getNodeByFQN(NUMBER_MODULE)
      literalValueToClass(environment, 2).should.equal(numberClass)
    })

    it('should work for strings', () => {
      const stringClass = environment.getNodeByFQN(STRING_MODULE)
      literalValueToClass(environment, 'hello').should.equal(stringClass)
    })

    it('should work for booleans', () => {
      const booleanClass = environment.getNodeByFQN(BOOLEAN_MODULE)
      literalValueToClass(environment, false).should.equal(booleanClass)
    })

    it('should work for instances of a class', () => {
      const listClass = environment.getNodeByFQN(LIST_MODULE)
      literalValueToClass(environment, [new Reference({ name: LIST_MODULE }), [
        new Literal({ value: 1 }),
      ]],
      ).should.equal(listClass)
    })

  })
})