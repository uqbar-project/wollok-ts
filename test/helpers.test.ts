import { should, use } from 'chai'
import sinonChai from 'sinon-chai'
import { BOOLEAN_MODULE, Body, Class, Evaluation, Interpreter, LIST_MODULE, Literal, Method, NUMBER_MODULE, OBJECT_MODULE, Package, Reference, STRING_MODULE, Singleton, WRENatives, allAvailableMethods, implicitImport, link, literalValueToClass, parentModule } from '../src'
import { WREEnvironment, environmentWithEntities } from './utils'

use(sinonChai)
should()

const basicEnvironmentWithSingleClass = () => link([new Package({
  name: 'aves',
  members: [
    new Class({
      name: 'Ave',
      members: [
        new Method({ name: 'volar', body: new Body() }),
      ],
    }),
  ],
})], WREEnvironment)

describe('Wollok helpers', () => {

  describe('literalValueToClass', () => {

    const interpreter = new Interpreter(Evaluation.build(basicEnvironmentWithSingleClass(), WRENatives))
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

    const pepitaPackage: Package = new Package({
      name: 'aves',
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

  describe('parentModule', () => {

    const interpreter = new Interpreter(Evaluation.build(basicEnvironmentWithSingleClass(), WRENatives))
    const environment = interpreter.evaluation.environment

    it('should detect a module as a method parent module', () => {
      const aveClass = environment.getNodeByFQN('aves.Ave') as Class
      parentModule(aveClass.lookupMethod('volar', 0)!).should.equal(aveClass)
    })

  })

  describe('implicitImport', () => {

    const interpreter = new Interpreter(Evaluation.build(basicEnvironmentWithSingleClass(), WRENatives))
    const environment = interpreter.evaluation.environment

    it('should be true for a lang class', () => {
      const listClass = environment.getNodeByFQN(LIST_MODULE)
      implicitImport(listClass).should.be.true
    })

    it('should be false for a custom class', () => {
      const customClass = environment.getNodeByFQN('aves.Ave')
      implicitImport(customClass).should.be.false
    })

  })

})