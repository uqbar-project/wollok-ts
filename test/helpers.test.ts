import { should, use } from 'chai'
import sinonChai from 'sinon-chai'
import { BOOLEAN_MODULE, Body, Class, Environment, Evaluation, Field, Import, Interpreter, LIST_MODULE, Literal, Method, NUMBER_MODULE, New, OBJECT_MODULE, Package, Reference, STRING_MODULE, Self, Send, Singleton, WRENatives, allAvailableMethods, implicitImport, isNotImportedIn, link, linkSentenceInNode, literalValueToClass, mayExecute, parentModule, parse, projectPackages, sendDefinitions } from '../src'
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

const getLinkedEnvironment = (baseEnvironment?: Environment) => {
  const interpreter = new Interpreter(Evaluation.build(baseEnvironment ?? basicEnvironmentWithSingleClass(), WRENatives))
  return interpreter.evaluation.environment
}

describe('Wollok helpers', () => {

  describe('literalValueToClass', () => {

    const environment = getLinkedEnvironment()

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

    const environment = getLinkedEnvironment()

    it('should detect a module as a method parent module', () => {
      const aveClass = environment.getNodeByFQN('aves.Ave') as Class
      parentModule(aveClass.lookupMethod('volar', 0)!).should.equal(aveClass)
    })

  })

  describe('implicitImport', () => {

    const environment = getLinkedEnvironment()

    it('should be true for a lang class', () => {
      const listClass = environment.getNodeByFQN(LIST_MODULE)
      implicitImport(listClass).should.be.true
    })

    it('should be false for a custom class', () => {
      const customClass = environment.getNodeByFQN('aves.Ave')
      implicitImport(customClass).should.be.false
    })

  })

  describe('projectPackages', () => {

    it('should return the right package from an environment', () => {
      const environment = basicEnvironmentWithSingleClass()
      const mainPackage = environment.getNodeByFQN('aves')
      projectPackages(environment).should.deep.equal([mainPackage])
    })

  })

  describe('isNotImportedIn', () => {

    const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
    const environment = getLinkedEnvironment(link([
      new Package({
        name: 'A',
        imports: [
          new Import({ isGeneric: false, entity: new Reference({ name: 'B.pepita' }) }),
          new Import({ isGeneric: true, entity: new Reference({ name: 'D' }) }),
        ],
        members: [
          new Singleton({ name: 'entrenador' }),
        ],
      }),
      new Package({
        name: 'B',
        members: [
          new Singleton(
            { name: 'pepita' }),
        ],
      }),
      new Package({
        name: 'C',
        members: [
          new Singleton(
            { name: 'alpiste' }),
        ],
      }),
      new Package({
        name: 'D',
        members: [
          new Singleton(
            { name: 'quilmes' }),
        ],
      }),
    ], MINIMAL_LANG))

    const packageA = environment.getNodeByFQN('A') as Package
    const packageB = environment.getNodeByFQN('B') as Package
    const packageC = environment.getNodeByFQN('C') as Package
    const packageD = environment.getNodeByFQN('D') as Package

    it('should return false if a definition is imported, using a specific import', () => {
      isNotImportedIn(packageB, packageA).should.be.false
    })

    it('should return false if a definition is imported, use generic import', () => {
      isNotImportedIn(packageD, packageA).should.be.false
    })

    it('should return true if a definition is not imported', () => {
      isNotImportedIn(packageC, packageA).should.be.true
    })

  })

  describe('mayExecute', () => {

    let baseEnvironment: Environment
    let testMethod: Method

    beforeEach(() => {
      const pepitaPackage: Package = new Package({
        name: 'aves',
        members: [
          new Singleton({
            name: 'pepita',
            members: [
              new Method({ name: 'volar', body: new Body() }),
              new Method({ name: 'comer' }),
            ],
          }),
        ],
      })
      const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
      baseEnvironment = link([
        pepitaPackage,
        new Package({ name: 'repl' }  ),
      ], MINIMAL_LANG)

      const pepitaWKO = baseEnvironment.getNodeByFQN('aves.pepita') as Singleton
      testMethod = pepitaWKO.lookupMethod('volar', 0)!
    })

    it('should not execute if second parameter is not a Send object', () => {
      const assignmentForConst = parse.Variable.tryParse('const a = 1')
      linkSentenceInNode(assignmentForConst, baseEnvironment.getNodeByFQN('repl'))

      mayExecute(testMethod)(assignmentForConst).should.be.false
    })

    it('should not execute if method is different', () => {
      const sendDifferentMethod = parse.Send.tryParse('aves.pepita.comer()')
      linkSentenceInNode(sendDifferentMethod, baseEnvironment.getNodeByFQN('repl'))

      mayExecute(testMethod)(sendDifferentMethod).should.be.false
    })

    it('should execute if node receiver is a singleton and is the same method', () => {
      const sendOkSentence = parse.Send.tryParse('aves.pepita.volar()')
      linkSentenceInNode(sendOkSentence, baseEnvironment.getNodeByFQN('repl'))

      mayExecute(testMethod)(sendOkSentence).should.be.true
    })

  })

  describe('sendDefinitions', () => {

    const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
    const environment = getLinkedEnvironment(link([
      new Package({
        name: 'A',
        members: [
          new Class({
            name: 'Bird',
            members: [
              new Method({
                name: 'fly',
                body: new Body({ sentences: [] }),
              }),
            ],
          }),
          new Singleton({
            name: 'trainer',
            members: [
              new Method({
                name: 'play',
                body: new Body({
                  sentences: [
                    new Send({
                      receiver: new New({ instantiated: new Reference({ name: 'Bird' }) }),
                      message: 'fly',
                      args: [],
                    }),
                  ],
                }),
              }),
              new Method({
                name: 'pick',
                body: new Body({
                  sentences: [
                    new Send({
                      receiver: new Self(),
                      message: 'play',
                      args: [],
                    }),
                  ],
                }),
              }),
            ],
          }),
          new Singleton({
            name: 'anotherTrainer',
            members: [
              new Field({
                name: 'pepita',
                isConstant: true,
                value: new New({ instantiated: new Reference({ name: 'Bird' }) }),
              }),
              new Method({
                name: 'play',
                body: new Body({
                  sentences: [
                    new Send({
                      receiver: new Reference({ name: 'A.trainer' }),
                      message: 'pick',
                      args: [],
                    }),
                    new Send({
                      receiver: new Reference({ name: 'pepita' }),
                      message: 'fly',
                      args: [],
                    }),
                  ],
                }),
              }),
              new Method({
                name: 'fly',
                body: new Body({
                  sentences: [],
                }),
              }),
            ],
          }),
        ],
      }),
    ], MINIMAL_LANG))

    const trainerWKO = environment.getNodeByFQN('A.trainer') as Singleton
    const anotherTrainerWKO = environment.getNodeByFQN('A.anotherTrainer') as Singleton
    const pepitaClass = environment.getNodeByFQN('A.Bird') as Singleton
    const pickTrainerMethod = trainerWKO.allMethods[1] as Method
    const anotherTrainerFlyMethod = anotherTrainerWKO.allMethods[1] as Method
    const birdFlyMethod = pepitaClass.allMethods[0] as Method

    it('should return the methods of a class when using New', () => {
      const sendToNewBird = trainerWKO.allMethods[0].sentences[0] as Send
      const definitions = sendDefinitions(environment)(sendToNewBird)
      definitions.should.deep.equal([birdFlyMethod])
    })

    it('should return the methods of a singleton when calling to the WKO', () => {
      const sendToTrainer = anotherTrainerWKO.allMethods[0].sentences[0] as Send
      const definitions = sendDefinitions(environment)(sendToTrainer)
      definitions.should.deep.equal([pickTrainerMethod])
    })

    it('should return all methods definitions matching message & arity when calling to a class', () => {
      const sendToBird = anotherTrainerWKO.allMethods[0].sentences[1] as Send
      const definitions = sendDefinitions(environment)(sendToBird)
      definitions.should.deep.equal([birdFlyMethod, anotherTrainerFlyMethod])
    })

  })
})