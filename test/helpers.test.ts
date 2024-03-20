import { should, use } from 'chai'
import sinonChai from 'sinon-chai'
import { BOOLEAN_MODULE, Class, Environment, Evaluation, Interpreter, LIST_MODULE, Literal, Method, NUMBER_MODULE, OBJECT_MODULE, Package, Reference, STRING_MODULE, Singleton, WRENatives, allAvailableMethods, fromJSON, link, literalValueToClass } from '../src'
import wre from '../src/wre/wre.json'
import { environmentWithEntities } from './utils'

use(sinonChai)
should()

const WRE: Environment = fromJSON(wre)
const pepitaPackage: Package = new Package({
  name: 'p',
  members: [
    new Singleton({
      name: 'pepita',
      members: [
        new Method({ name: 'volar' }),
        new Method({ name: 'comer' }),
      ],
    }),
  ],
})

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

  describe('allAvailableMethods', () => {

    const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
    const baseEnvironment = link([
      pepitaPackage,
    ], MINIMAL_LANG)

    it('should bring all methods', () => {
      allAvailableMethods(baseEnvironment).map((method: Method) => method.name).should.deep.equal([
        'volar',
        'comer',
        'initialize',
        'identity',
        'kindName',
        'className',
        '==',
        '!=',
        '===',
        '!==',
        'equals',
        '->',
        'toString',
        'shortDescription',
        'printString',
        'messageNotUnderstood',
        'generateDoesNotUnderstandMessage',
        'error',
        'checkNotNull',
      ])
    })

  })


})