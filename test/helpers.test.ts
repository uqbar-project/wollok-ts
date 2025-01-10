import { expect, should, use } from 'chai'
import sinonChai from 'sinon-chai'
import { BOOLEAN_MODULE, Body, Class, Describe, Environment, Evaluation, Field, Import, Interpreter, isError, LIST_MODULE, Literal, Method, methodByFQN, NUMBER_MODULE, New, OBJECT_MODULE, Package, Parameter, Reference, STRING_MODULE, Self, Send, Singleton, Test, Variable, WRENatives, allAvailableMethods, allScopedVariables, allVariables, implicitImport, isNamedSingleton, isNotImportedIn, link, linkSentenceInNode, literalValueToClass, mayExecute, parentModule, parse, projectPackages, hasNullValue, hasBooleanValue, projectToJSON, getNodeDefinition, ParameterizedType, sendDefinitions, Super, SourceMap, isVoid, VOID_WKO, REPL, buildEnvironment, assertNotVoid, showParameter, getMethodContainer, Program, getExpressionFor, Expression, If, Return } from '../src'
import { WREEnvironment, environmentWithEntities, environmentWithREPLInitializedFile } from './utils'
import { RuntimeObject } from '../src/interpreter/runtimeModel'

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
      const mainPackage = environment.getNodeByFQN<Package>('aves')
      projectPackages(environment).includes(mainPackage)
      projectPackages(environment).includes(environment.replNode())
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

  describe('getNodeDefinition', () => {

    // Necessary for the methods not to be synthetic
    const sourceMap = new SourceMap({ start: { offset: 1, line: 1, column: 1 }, end: { offset: 9, line: 2, column: 3 } })

    const environment = getLinkedEnvironment(link([
      new Package({
        name: 'A',
        members: [
          new Class({
            name: 'Bird',
            members: [
              new Field({
                name: 'energy',
                isConstant: false,
                isProperty: true,
                value: new Literal({ value: 100 }),
              }),
              new Method({
                name: 'fly',
                sourceMap,
                body: new Body({ sentences: [] }),
              }),
              new Method({
                name: 'sing',
                sourceMap,
                body: new Body({
                  sentences: [
                    new Send({
                      receiver: new Self(),
                      message: 'fly',
                      args: [],
                    }),
                  ],
                }),
              }),
            ],
          }),
          new Class({
            name: 'Cage',
            members: [
              new Method({
                name: 'size',
                sourceMap,
                body: new Body({
                  sentences: [
                    new Literal({ value: 10 }),
                  ],
                }),
                isOverride: false,
              }),
            ],
          }),
          new Class({
            name: 'SpecialCage',
            members: [
              new Method({
                name: 'size',
                sourceMap,
                body: new Body({
                  sentences: [
                    new Send({
                      receiver: new Super(),
                      message: '+',
                      args: [new Literal({ value: 5 })],
                    }),
                  ],
                }),
                isOverride: true,
              }),
            ],
            supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A.Cage' }) })],
          }),
          new Singleton({
            name: 'trainer',
            members: [
              new Field({
                name: 'displayName',
                isConstant: false,
                isProperty: true,
                value: new Literal({ value: 'John ' }),
              }),
              new Method({
                name: 'play',
                sourceMap,
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
                sourceMap,
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
                sourceMap,
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
                sourceMap,
                body: new Body({ sentences: [] }),
              }),
            ],
          }),
        ],
      }),
    ], WREEnvironment))

    const trainerWKO = environment.getNodeByFQN('A.trainer') as Singleton
    const anotherTrainerWKO = environment.getNodeByFQN('A.anotherTrainer') as Singleton
    const birdClass = environment.getNodeByFQN('A.Bird') as Class
    const trainerPlayMethod = trainerWKO.allMethods[0] as Method
    const trainerPickMethod = trainerWKO.allMethods[1] as Method
    const anotherTrainerPlayMethod = anotherTrainerWKO.allMethods[0] as Method
    const anotherTrainerFlyMethod = anotherTrainerWKO.allMethods[1] as Method
    const birdFlyMethod = birdClass.allMethods[0] as Method
    const cageClass = environment.getNodeByFQN('A.Cage') as Class
    const cageSizeMethod = cageClass.allMethods[0] as Method
    const specialCageClass = environment.getNodeByFQN('A.SpecialCage') as Class
    const specialCageSizeMethod = specialCageClass.allMethods[0] as Method

    it('should return the methods of a class when using new', () => {
      const sendToNewBird = trainerWKO.allMethods[0].sentences[0] as Send
      const definitions = getNodeDefinition(environment)(sendToNewBird)
      definitions.should.deep.equal([birdFlyMethod])
    })

    it('should return all methods with same interface if using new to an unreferenced class', () => {
      const sendToNew = {
        ...trainerWKO.allMethods[0].sentences[0],
        receiver: new New({ instantiated: new Reference({ name: 'UnexistentBird' }) }) as unknown,
      } as Send
      const definitions = sendDefinitions(environment)(sendToNew)
      definitions.should.deep.equal([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should return the methods of a singleton when calling to the WKO', () => {
      const sendToTrainer = anotherTrainerWKO.allMethods[0].sentences[0] as Send
      const definitions = sendDefinitions(environment)(sendToTrainer)
      definitions.should.deep.equal([trainerPickMethod])
    })

    it('should return all methods definitions matching message & arity when calling to a class', () => {
      const sendToBird = anotherTrainerWKO.allMethods[0].sentences[1] as Send
      const definitions = sendDefinitions(environment)(sendToBird)
      definitions.should.deep.equal([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should return the methods of a class when calling to self', () => {
      const sendToSelf = birdClass.allMethods[1].sentences[0] as Send
      const definitions = sendDefinitions(environment)(sendToSelf)
      definitions.should.deep.equal([birdFlyMethod])
    })

    it('should return the properties of an entity when calling to wko', () => {
      const sendToName = new Send({
        receiver: trainerWKO,
        message: 'displayName',
      })
      const definitions = sendDefinitions(environment)(sendToName)
      definitions.should.deep.equal([trainerWKO.allFields[0]])
    })

    it('should return the properties of an entity when calling to class methods', () => {
      const sendToName = new Send({
        receiver: new Reference({ name: 'A.bird' }),
        message: 'energy',
      })
      const definitions = sendDefinitions(environment)(sendToName)
      definitions.should.deep.equal([birdClass.allFields[0]])
    })

    it('should return all methods with the same interface when calling to self is not linked to a module', () => {
      const sendToSelf = new Send({
        receiver: new Self(),
        message: 'fly',
      })
      const definitions = sendDefinitions(environment)(sendToSelf)
      definitions.should.deep.equal([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should return all methods with the same name when an error is thrown', () => {
      const sendToSelf = {
        ...birdClass.allMethods[1].sentences[0],
        receiver: undefined as unknown,
      } as Send
      const definitions = sendDefinitions(environment)(sendToSelf)
      definitions.should.deep.equal([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should match a reference to the corresponding field', () => {
      const pepitaReference = (anotherTrainerPlayMethod.sentences[1] as Send).receiver
      const pepitaField = anotherTrainerWKO.allFields[0]
      const definitions = getNodeDefinition(environment)(pepitaReference)
      definitions.should.deep.equal([pepitaField])
    })

    it('should match a reference to the corresponding class for a new instance', () => {
      const newBirdReference = ((trainerPlayMethod.sentences[0] as Send).receiver as New).instantiated
      const definitions = getNodeDefinition(environment)(newBirdReference)
      definitions.should.deep.equal([birdClass])
    })

    it('should return the parent method when asking for a super definition', () => {
      const callToSuperCageSize = (specialCageSizeMethod.sentences[0] as Send).receiver as Super
      const definitions = getNodeDefinition(environment)(callToSuperCageSize)
      definitions.should.deep.equal([cageSizeMethod])
    })

    it('should return self when asking for a self definition', () => {
      const callToSelfTrainer = (trainerPickMethod.sentences[0] as Send).receiver as Self
      const definitions = getNodeDefinition(environment)(callToSelfTrainer)
      definitions.should.deep.equal([trainerWKO])
    })

  })

  describe('allVariables', () => {

    it('should return all variables for a method', () => {
      const aNumberVariable = new Variable({ name:'aNumber', isConstant: false, value: new Literal({ value: 0 }) })
      const aStringVariable = new Variable({ name:'aString', isConstant: false, value: new Literal({ value: 'hello' }) })
      const anotherNumberVariable = new Variable({ name:'anotherNumber', isConstant: true, value: new Literal({ value: 1 }) })

      const method = new Method({
        name: 'm', parameters: [], isOverride: false, id: 'm1',  body: new Body({
          id: 'b1',  sentences: [
            aNumberVariable,
            aStringVariable,
            new Send({ receiver: new Reference({ name: 'aNumber' }), message: 'even', args: [] }),
            anotherNumberVariable,
          ],
        }),
      })
      allVariables(method).should.deep.equal([aNumberVariable, aStringVariable, anotherNumberVariable])
    })

    it('should return all variables for a test', () => {
      const aNumberVariable = new Variable({ name:'aNumber', isConstant: false, value: new Literal({ value: 0 }) })
      const anotherVariable = new Variable({ name:'anotherNumber', isConstant: false, value: new Literal({ value: 0 }) })

      const test = new Test({
        name: 'test something', id: 'test1', body: new Body({
          id: 'b1',  sentences: [
            aNumberVariable,
            anotherVariable,
            new Send({ receiver: new Reference({ name: 'assert' }), message: 'equals', args: [new Reference({ name: 'aNumber' }), new Reference({ name: 'anotherNumber' })] }),
          ],
        }),
      })
      allVariables(test).should.deep.equal([aNumberVariable, anotherVariable])
    })

  })

  describe('allScopedVariables', () => {

    it('should return all scoped variables for a method', () => {
      const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
      const environment = getLinkedEnvironment(link([
        new Package({
          name: 'A',
          members: [
            new Class({
              name: 'Bird',
              members: [
                new Method({
                  name: 'm',
                  parameters: [
                    new Parameter({ name: 'energy' }),
                  ], isOverride: false, id: 'm1',  body: new Body({
                    id: 'b1',  sentences: [
                      new Variable({ name: 'aNumber', isConstant: false, value: new Literal({ value: 0 }) }),
                      new Variable({ name: 'aString', isConstant: false, value: new Literal({ value: 'hello' }) }),
                      new Send({ receiver: new Reference({ name: 'aNumber' }), message: 'even', args: [] }),
                      new Variable({ name: 'anotherNumber', isConstant: true, value: new Literal({ value: 1 }) }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      ], MINIMAL_LANG))

      const birdClass = environment.getNodeByFQN('A.Bird') as Class
      const method = birdClass.allMethods[0] as Method

      allScopedVariables(method).map(variable => variable.name).should.deep.equal(['energy', 'aNumber', 'aString', 'anotherNumber'])
    })

    it('should return all variables for a lonely test (not surrounded by a describe)', () => {
      const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
      const environment = getLinkedEnvironment(link([
        new Package({
          name: 'A',
          members: [
            new Test({
              name: 'test something', id: 'test1', body: new Body({
                id: 'b1',  sentences: [
                  new Variable({ name:'aNumber', isConstant: false, value: new Literal({ value: 0 }) }),
                  new Variable({ name:'anotherNumber', isConstant: false, value: new Literal({ value: 0 }) }),
                  new Send({ receiver: new Reference({ name: 'assert' }), message: 'equals', args: [new Reference({ name: 'aNumber' }), new Reference({ name: 'anotherNumber' })] }),
                ],
              }),
            }),
          ],
        }),
      ], MINIMAL_LANG))

      const aPackage = environment.getNodeByFQN('A') as Package
      const method = aPackage.members[0] as Test

      allScopedVariables(method).map(variable => variable.name).should.deep.equal(['aNumber', 'anotherNumber'])
    })

    it('should return all variables for a test inside a describe', () => {
      const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
      const environment = getLinkedEnvironment(link([
        new Package({
          name: 'A',
          members: [
            new Describe({
              name: 'a describe',
              members: [
                new Field({ name:'describeVariable', isConstant: false, value: new Literal({ value: 0 }) }),
                new Test({
                  name: 'test something', id: 'test1', body: new Body({
                    id: 'b1',  sentences: [
                      new Variable({ name:'aNumber', isConstant: false, value: new Literal({ value: 0 }) }),
                      new Variable({ name:'anotherNumber', isConstant: false, value: new Literal({ value: 0 }) }),
                      new Send({ receiver: new Reference({ name: 'assert' }), message: 'equals', args: [new Reference({ name: 'aNumber' }), new Reference({ name: 'anotherNumber' })] }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      ], MINIMAL_LANG))

      const aPackage = environment.getNodeByFQN('A') as Package
      const aDescribe = aPackage.members[0] as Describe
      const aTest = aDescribe.members[1] as Test

      allScopedVariables(aTest).map(variable => variable.name).should.deep.equal(['describeVariable', 'aNumber', 'anotherNumber'])
    })

  })

  describe('isNamedSingleton', () => {

    it('should return true for a named singleton', () => {
      isNamedSingleton(new Singleton({ name: 'entrenador' })).should.be.true
    })

    it('should return false for an unnamed singleton', () => {
      isNamedSingleton(new Singleton({})).should.be.false
    })

    it('should return false for an named module which is not a singleton', () => {
      isNamedSingleton(new Class({ name: 'Bird' })).should.be.false
    })

  })

  describe('methodByFQN', () => {

    const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
    const environment = getLinkedEnvironment(link([
      new Package({
        name: 'A',
        members: [
          new Class({
            name: 'Bird',
            members: [
              new Method({
                name: 'm',
                parameters: [
                  new Parameter({ name: 'energy' }),
                ], isOverride: false, id: 'm',  body: new Body({}),
              }),
              new Method({
                name: 'm2',
                parameters: [
                ], isOverride: false, id: 'm2',  body: new Body({}),
              }),
            ],
          }),
        ],
      }),
    ], MINIMAL_LANG))
    const classA = environment.getNodeByFQN('A.Bird') as Class
    const aMethod = classA.members[0]
    const noParameterMethod = classA.members[1]

    it('should return a method if a correct fqn is sent', () => {
      methodByFQN(environment, 'A.Bird.m/1')!.should.equal(aMethod)
    })

    it('should return a method if a fqn with no arity is sent', () => {
      methodByFQN(environment, 'A.Bird.m2')!.should.equal(noParameterMethod)
    })

    it('should return undefined if an incorrect fqn is sent', () => {
      methodByFQN(environment, 'A.Bird.m1/1')?.should.be.undefined
    })

    it('should return undefined if an incorrect fqn is sent', () => {
      methodByFQN(environment, 'A.Bird.m/2')?.should.be.undefined
    })

    it('should return undefined if a Class fqn is sent', () => {
      methodByFQN(environment, 'A.Bird')?.should.be.undefined
    })

  })

  describe('isError', () => {

    it('should return true if problem has an error level', () => {
      isError({ level: 'error', node: new Body(), code: '', values: [] }).should.be.true
    })

    it('should return false if problem has an warning level', () => {
      isError({ level: 'warning', node: new Body(), code: '', values: [] }).should.be.false
    })

  })

  describe('hasNullValue', () => {

    it('should return true for a null expression', () => {
      hasNullValue(new Literal({ value: null })).should.be.true
    })

    it('should return false for a non null expression', () => {
      hasNullValue(new Literal({ value: 2 })).should.be.false
    })

  })

  describe('hasBooleanValue', () => {

    it('should return true if boolean value matches', () => {
      hasBooleanValue(new Literal({ value: true }), true).should.be.true
    })

    it('should return false if boolean value does not match', () => {
      hasBooleanValue(new Literal({ value: true }), false).should.be.false
    })

  })

  describe('projectToJSON', () => {

    it('should return a stringified JSON of an environment', () => {
      const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE)
      const environment = getLinkedEnvironment(link([
        new Package({
          name: 'AwesomePackage',
          members: [
            new Class({
              name: 'AwesomeClass',
              members: [
                new Method({
                  name: 'awesomeMethod',
                  parameters: [
                    new Parameter({ name: 'awesomeParameter' }),
                  ], isOverride: false, body: new Body({}),
                }),
              ],
            }),
          ],
        }),
      ], MINIMAL_LANG))
      const projectAsJSON = projectToJSON(environment)
      projectAsJSON.should.be.not.empty
      projectAsJSON.should.contain('AwesomePackage')
      projectAsJSON.should.contain('AwesomeClass')
      projectAsJSON.should.contain('awesomeMethod')
      projectAsJSON.should.contain('awesomeParameter')
    })

  })

  describe('isVoid', () => {
    const replEnvironment = buildEnvironment([{
      name: REPL, content: `
      object pajarito {
        method volar() {
        }
      }
      `,
    }])
    const evaluation = Evaluation.build(replEnvironment, WRENatives)

    it('should return true for void singleton', () => {
      isVoid(new RuntimeObject(replEnvironment.getNodeByFQN(VOID_WKO), evaluation.currentFrame, undefined)).should.be.true
    })

    it('should return false for Wollok elements', () => {
      isVoid(new RuntimeObject(replEnvironment.getNodeByFQN(NUMBER_MODULE), evaluation.currentFrame, 42)).should.be.false
    })

    it('should return false for custom definitions', () => {
      isVoid(new RuntimeObject(replEnvironment.getNodeByFQN(REPL + '.pajarito'), evaluation.currentFrame, undefined)).should.be.false
    })

  })

  describe('assertNotVoid', () => {
    const replEnvironment = buildEnvironment([{
      name: REPL, content: `
      object pajarito {
        method volar() {
        }
      }
      `,
    }])
    const evaluation = Evaluation.build(replEnvironment, WRENatives)

    it('should throw error if value is void', () => {
      expect(() => assertNotVoid(new RuntimeObject(replEnvironment.getNodeByFQN(VOID_WKO), evaluation.currentFrame, undefined), 'Something failed')).to.throw('Something failed')
    })

    it('should not throw error if value is not void', () => {
      assertNotVoid(new RuntimeObject(replEnvironment.getNodeByFQN(NUMBER_MODULE), evaluation.currentFrame, 2), 'Something failed')
    })

  })

  describe('showParameter', () => {
    const replEnvironment = buildEnvironment([{
      name: REPL, content: `
      object pajarito {
        method volar() {
        }
      }
      `,
    }])
    const evaluation = Evaluation.build(replEnvironment, WRENatives)

    it('should show a number', () => {
      showParameter(new RuntimeObject(replEnvironment.getNodeByFQN(NUMBER_MODULE), evaluation.currentFrame, 2)).should.equal('"2"')
    })

    it('should show a string', () => {
      showParameter(new RuntimeObject(replEnvironment.getNodeByFQN(STRING_MODULE), evaluation.currentFrame, 'pepita')).should.equal('"pepita"')
    })

    it('should show fqn for custom modules', () => {
      showParameter(new RuntimeObject(replEnvironment.getNodeByFQN(REPL + '.pajarito'), evaluation.currentFrame, undefined)).should.equal(`"${REPL}.pajarito"`)
    })

  })

  describe('getMethodContainer', () => {
    const replEnvironment = buildEnvironment([{
      name: REPL, content: `
      object pajarito {
        energia = 100
        method volar() {
          energia = energia + 10
        }
      }`,
    }, {
      name: 'test',
      content: `
      describe "some describe" {
        test "some test" {
          assert.equals(1, 1)
        }
      }
      `,
    }, {
      name: 'program',
      content: `
      program Prueba {
        const a = 1
        const b = a + 1
        console.println(a)
        console.println(b)
      }
      `,
    },
    ])

    it('should find method container for a method', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[0] as Method
      const volarSentence = volarMethod.sentences[0]
      getMethodContainer(volarSentence)!.should.equal(volarMethod)
    })

    it('should find method container for a test', () => {
      const firstDescribe = replEnvironment.getNodeByFQN('test."some describe"') as Describe
      const firstTest = firstDescribe.allMembers[0] as Test
      const assertSentence = firstTest.sentences[0]
      getMethodContainer(assertSentence)!.should.equal(firstTest)
    })

    it('should find method container for a program', () => {
      const program = replEnvironment.getNodeByFQN('program.Prueba') as Program
      const anySentence = program.sentences()[3]
      getMethodContainer(anySentence)!.should.equal(program)
    })

  })

  describe('getExpression', () => {
    const replEnvironment = environmentWithREPLInitializedFile(`
      object pajarito {
        energia = 100
        contenta = false

        method jugar() {
          contenta = true
        }

        method volar() {
          if (energia > 100) {
            self.jugar()
          }
          return energia
        }

        method valorBase() = 2

        method bad() {
          throw new Exception(message = "Do not call me!")
        }
      }`
    )

    it('should show if expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const ifExpression = volarMethod.sentences[0] as Expression
      getExpressionFor(ifExpression)!.should.equal('if expression')
    })

    it('should show send expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const sendExpression = (volarMethod.sentences[0] as If).thenBody.sentences[0] as Expression
      getExpressionFor(sendExpression)!.should.equal('message jugar/0')
    })

    it('should show reference expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const referenceExpression = (volarMethod.sentences[1] as Return).value as Expression
      getExpressionFor(referenceExpression)!.should.equal('reference \'energia\'')
    })

    it('should show literal expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const valorBaseMethod = birdSingleton.allMethods[2] as Method
      const literalExpression = (valorBaseMethod.sentences[0] as Return).value as Expression
      getExpressionFor(literalExpression)!.should.equal('literal 2')
    })

    it('should show self expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const selfExpression = ((volarMethod.sentences[0] as If).thenBody.sentences[0] as Send).receiver as Expression
      getExpressionFor(selfExpression)!.should.equal('self')
    })

    it('should show default expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const badMethod = birdSingleton.allMethods[3] as Method
      const throwException = badMethod.sentences[0] as Expression
      getExpressionFor(throwException)!.should.equal('expression')
    })

  })

})