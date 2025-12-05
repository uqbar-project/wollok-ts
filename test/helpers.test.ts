import { BOOLEAN_MODULE, Body, Class, Describe, Environment, Evaluation, Field, Import, Interpreter, isError, LIST_MODULE, Literal, Method, methodByFQN, NUMBER_MODULE, New, OBJECT_MODULE, Package, Parameter, Reference, STRING_MODULE, Self, Send, Singleton, Test, Variable, WRENatives, allAvailableMethods, allScopedVariables, allVariables, implicitImport, isNamedSingleton, isNotImportedIn, link, linkInNode, literalValueToClass, mayExecute, parentModule, parse, projectPackages, hasNullValue, hasBooleanValue, projectToJSON, getNodeDefinition, ParameterizedType, sendDefinitions, Super, SourceMap, isVoid, VOID_WKO, REPL, buildEnvironment, assertNotVoid, showParameter, getMethodContainer, Program, getExpressionFor, Expression, If, Return, possiblyReferenced, Referenciable } from '../src'
import { WREEnvironment, environmentWithEntities, environmentWithREPLInitializedFile } from './utils'
import { RuntimeObject } from '../src/interpreter/runtimeModel'
import { beforeEach, describe, expect, it } from 'vitest'

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
      expect(literalValueToClass(environment, 2)).toBe(numberClass)
    })

    it('should work for strings', () => {
      const stringClass = environment.getNodeByFQN(STRING_MODULE)
      expect(literalValueToClass(environment, 'hello')).toBe(stringClass)
    })

    it('should work for booleans', () => {
      const booleanClass = environment.getNodeByFQN(BOOLEAN_MODULE)
      expect(literalValueToClass(environment, false)).toBe(booleanClass)
    })

    it('should work for instances of a class', () => {
      const listClass = environment.getNodeByFQN(LIST_MODULE)
      expect(literalValueToClass(environment, [new Reference({ name: LIST_MODULE }), [
        new Literal({ value: 1 }),
      ]])).toBe(listClass)
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
      const methodNames = allAvailableMethods(baseEnvironment).map((method: Method) => method.name)
      expect(methodNames).toEqual([
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
      const method = aveClass.lookupMethod('volar', 0)!
      expect(parentModule(method)).toBe(aveClass)
    })

  })

  describe('implicitImport', () => {

    const environment = getLinkedEnvironment()

    it('should be true for a lang class', () => {
      const listClass = environment.getNodeByFQN(LIST_MODULE)
      expect(implicitImport(listClass)).toBe(true)
    })

    it('should be false for a custom class', () => {
      const customClass = environment.getNodeByFQN('aves.Ave')
      expect(implicitImport(customClass)).toBe(false)
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
      expect(isNotImportedIn(packageB, packageA)).toBe(false)
    })

    it('should return false if a definition is imported, using generic import', () => {
      expect(isNotImportedIn(packageD, packageA)).toBe(false)
    })

    it('should return true if a definition is not imported', () => {
      expect(isNotImportedIn(packageC, packageA)).toBe(true)
    })
  })

  describe('possiblyReferenced', () => {
    let environment: Environment

    beforeEach(() => {
      environment = buildEnvironment([{
        name: 'def1',
        content: `
          object pepita {
            method energia() = 100
          }
          `,
      },
      {
        name: 'def2',
        content: `
          object pepita {
            method energia() = 200
          }
          `,
      }])
    })

    it('should return all possible imports that match a references name', () => {
      const pepitaReferences = possiblyReferenced(new Reference({ name: 'pepita' }), environment)

      expect(pepitaReferences).toHaveLength(2)
      expect(pepitaReferences).toContain(environment.getNodeByFQN('def1.pepita'))
      expect(pepitaReferences).toContain(environment.getNodeByFQN('def2.pepita'))
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
      linkInNode(assignmentForConst, baseEnvironment.getNodeByFQN('repl'))

      expect(mayExecute(testMethod)(assignmentForConst)).toBe(false)
    })

    it('should not execute if method is different', () => {
      const sendDifferentMethod = parse.Send.tryParse('aves.pepita.comer()')
      linkInNode(sendDifferentMethod, baseEnvironment.getNodeByFQN('repl'))

      expect(mayExecute(testMethod)(sendDifferentMethod)).toBe(false)
    })

    it('should execute if node receiver is a singleton and is the same method', () => {
      const sendOkSentence = parse.Send.tryParse('aves.pepita.volar()')
      linkInNode(sendOkSentence, baseEnvironment.getNodeByFQN('repl'))

      expect(mayExecute(testMethod)(sendOkSentence)).toBe(true)
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
      expect(definitions).toEqual([birdFlyMethod])
    })

    it('should return all methods with same interface if using new to an unreferenced class', () => {
      const sendToNew = {
        ...trainerWKO.allMethods[0].sentences[0],
        receiver: new New({ instantiated: new Reference({ name: 'UnexistentBird' }) }) as unknown,
      } as Send
      const definitions = sendDefinitions(environment)(sendToNew)
      expect(definitions).toEqual([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should return the methods of a singleton when calling to the WKO', () => {
      const sendToTrainer = anotherTrainerWKO.allMethods[0].sentences[0] as Send
      const definitions = sendDefinitions(environment)(sendToTrainer)
      expect(definitions).toEqual([trainerPickMethod])
    })

    it('should return all methods definitions matching message & arity when calling to a class', () => {
      const sendToBird = anotherTrainerWKO.allMethods[0].sentences[1] as Send
      const definitions = sendDefinitions(environment)(sendToBird)
      expect(definitions).toEqual([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should return the methods of a class when calling to self', () => {
      const sendToSelf = birdClass.allMethods[1].sentences[0] as Send
      const definitions = sendDefinitions(environment)(sendToSelf)
      expect(definitions).toEqual([birdFlyMethod])
    })

    it('should return the properties of an entity when calling to wko', () => {
      const sendToName = new Send({
        receiver: trainerWKO,
        message: 'displayName',
      })
      const definitions = sendDefinitions(environment)(sendToName)
      expect(definitions).toEqual([trainerWKO.allFields[0]])
    })

    it('should return the properties of an entity when calling to class methods', () => {
      const sendToName = new Send({
        receiver: new Reference({ name: 'A.bird' }),
        message: 'energy',
      })
      const definitions = sendDefinitions(environment)(sendToName)
      expect(definitions).toEqual([birdClass.allFields[0]])
    })

    it('should return all methods with the same interface when calling to self is not linked to a module', () => {
      const sendToSelf = new Send({
        receiver: new Self(),
        message: 'fly',
      })
      const definitions = sendDefinitions(environment)(sendToSelf)
      expect(definitions).toEqual([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should return all methods with the same name when an error is thrown', () => {
      const sendToSelf = {
        ...birdClass.allMethods[1].sentences[0],
        receiver: undefined as unknown,
      } as Send
      const definitions = sendDefinitions(environment)(sendToSelf)
      expect(definitions).toEqual([birdFlyMethod, anotherTrainerFlyMethod])
    })

    it('should match a reference to the corresponding field', () => {
      const pepitaReference = (anotherTrainerPlayMethod.sentences[1] as Send).receiver
      const pepitaField = anotherTrainerWKO.allFields[0]
      const definitions = getNodeDefinition(environment)(pepitaReference)
      expect(definitions).toEqual([pepitaField])
    })

    it('should match a reference to the corresponding class for a new instance', () => {
      const newBirdReference = ((trainerPlayMethod.sentences[0] as Send).receiver as New).instantiated
      const definitions = getNodeDefinition(environment)(newBirdReference)
      expect(definitions).toEqual([birdClass])
    })

    it('should return the parent method when asking for a super definition', () => {
      const callToSuperCageSize = (specialCageSizeMethod.sentences[0] as Send).receiver as Super
      const definitions = getNodeDefinition(environment)(callToSuperCageSize)
      expect(definitions).toEqual([cageSizeMethod])
    })

    it('should return self when asking for a self definition', () => {
      const callToSelfTrainer = (trainerPickMethod.sentences[0] as Send).receiver as Self
      const definitions = getNodeDefinition(environment)(callToSelfTrainer)
      expect(definitions).toEqual([trainerWKO])
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
      expect(allVariables(method)).toEqual([aNumberVariable, aStringVariable, anotherNumberVariable])
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
      expect(allVariables(test)).toEqual([aNumberVariable, anotherVariable])
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

      const variableNames = allScopedVariables(method).map((variable) => variable.name)
      expect(variableNames).toEqual(['energy', 'aNumber', 'aString', 'anotherNumber'])
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

      const variableNames = allScopedVariables(method).map((variable: Referenciable) => variable.name)
      expect(variableNames).toEqual(['aNumber', 'anotherNumber'])
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

      const testVariableNames = allScopedVariables(aTest).map(variable => variable.name)
      expect(testVariableNames).toEqual(['describeVariable', 'aNumber', 'anotherNumber'])
    })

  })

  describe('isNamedSingleton', () => {

    it('should return true for a named singleton', () => {
      expect(isNamedSingleton(new Singleton({ name: 'entrenador' }))).toBe(true)
    })

    it('should return false for an unnamed singleton', () => {
      expect(isNamedSingleton(new Singleton({}))).toBe(false)
    })

    it('should return false for a named module which is not a singleton', () => {
      expect(isNamedSingleton(new Class({ name: 'Bird' }))).toBe(false)
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
      expect(methodByFQN(environment, 'A.Bird.m/1')).toBe(aMethod)
    })

    it('should return a method if a fqn with no arity is sent', () => {
      expect(methodByFQN(environment, 'A.Bird.m2')).toBe(noParameterMethod)
    })

    it('should return undefined if an incorrect fqn is sent', () => {
      expect(methodByFQN(environment, 'A.Bird.m1/1')).toBeUndefined()
    })

    it('should return undefined if an incorrect fqn is sent', () => {
      expect(methodByFQN(environment, 'A.Bird.m/2')).toBeUndefined()
    })

    it('should return undefined if a Class fqn is sent', () => {
      expect(methodByFQN(environment, 'A.Bird')).toBeUndefined()
    })

  })

  describe('isError', () => {

    it('should return true if problem has an error level', () => {
      expect(isError({ level: 'error', node: new Body(), code: '', values: [] })).toBe(true)
    })

    it('should return false if problem has an warning level', () => {
      expect(isError({ level: 'warning', node: new Body(), code: '', values: [] })).toBe(false)
    })

  })

  describe('hasNullValue', () => {

    it('should return true for a null expression', () => {
      expect(hasNullValue(new Literal({ value: null }))).toBe(true)
    })

    it('should return false for a non null expression', () => {
      expect(hasNullValue(new Literal({ value: 2 }))).toBe(false)
    })

  })

  describe('hasBooleanValue', () => {

    it('should return true if boolean value matches', () => {
      expect(hasBooleanValue(new Literal({ value: true }), true)).toBe(true)
    })

    it('should return false if boolean value does not match', () => {
      expect(hasBooleanValue(new Literal({ value: true }), false)).toBe(false)
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
      expect(projectAsJSON).not.toBeNull()
      expect(projectAsJSON).toContain('AwesomePackage')
      expect(projectAsJSON).toContain('AwesomeClass')
      expect(projectAsJSON).toContain('awesomeMethod')
      expect(projectAsJSON).toContain('awesomeParameter')
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
      expect(isVoid(new RuntimeObject(replEnvironment.getNodeByFQN(VOID_WKO), evaluation.currentFrame, undefined))).toBe(true)
    })

    it('should return false for Wollok elements', () => {
      expect(isVoid(new RuntimeObject(replEnvironment.getNodeByFQN(NUMBER_MODULE), evaluation.currentFrame, 42))).toBe(false)
    })

    it('should return false for custom definitions', () => {
      expect(isVoid(new RuntimeObject(replEnvironment.getNodeByFQN(REPL + '.pajarito'), evaluation.currentFrame, undefined))).toBe(false)
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
      expect(showParameter(new RuntimeObject(replEnvironment.getNodeByFQN(NUMBER_MODULE), evaluation.currentFrame, 2))).toEqual('"2"')
    })

    it('should show a string', () => {
      expect(showParameter(new RuntimeObject(replEnvironment.getNodeByFQN(STRING_MODULE), evaluation.currentFrame, 'pepita'))).toEqual('"pepita"')
    })

    it('should show fqn for custom modules', () => {
      expect(showParameter(new RuntimeObject(replEnvironment.getNodeByFQN(REPL + '.pajarito'), evaluation.currentFrame, undefined))).toEqual(`"${REPL}.pajarito"`)
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
      expect(getMethodContainer(volarSentence)).toEqual(volarMethod)
    })

    it('should find method container for a test', () => {
      const firstDescribe = replEnvironment.getNodeByFQN('test."some describe"') as Describe
      const firstTest = firstDescribe.allMembers[0] as Test
      const assertSentence = firstTest.sentences[0]
      expect(getMethodContainer(assertSentence)).toEqual(firstTest)
    })

    it('should find method container for a program', () => {
      const program = replEnvironment.getNodeByFQN('program.Prueba') as Program
      const anySentence = program.sentences()[3]
      expect(getMethodContainer(anySentence)).toEqual(program)
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
      expect(getExpressionFor(ifExpression)).toEqual('if expression')
    })

    it('should show send expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const sendExpression = (volarMethod.sentences[0] as If).thenBody.sentences[0] as Expression
      expect(getExpressionFor(sendExpression)).toEqual('message jugar/0')
    })

    it('should show reference expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const referenceExpression = (volarMethod.sentences[1] as Return).value as Expression
      expect(getExpressionFor(referenceExpression)).toEqual('reference \'energia\'')
    })

    it('should show literal expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const valorBaseMethod = birdSingleton.allMethods[2] as Method
      const literalExpression = (valorBaseMethod.sentences[0] as Return).value as Expression
      expect(getExpressionFor(literalExpression)).toEqual('literal 2')
    })

    it('should show self expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const volarMethod = birdSingleton.allMethods[1] as Method
      const selfExpression = ((volarMethod.sentences[0] as If).thenBody.sentences[0] as Send).receiver as Expression
      expect(getExpressionFor(selfExpression)).toEqual('self')
    })

    it('should show default expression', () => {
      const birdSingleton = replEnvironment.getNodeByFQN(REPL + '.pajarito') as Singleton
      const badMethod = birdSingleton.allMethods[3] as Method
      const throwException = badMethod.sentences[0] as Expression
      expect(getExpressionFor(throwException)).toEqual('expression')
    })

  })

})