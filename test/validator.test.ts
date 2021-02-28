import { should, use } from 'chai'
import { buildEnvironment } from '../src'
import validate from '../src/validator'
import link from '../src/linker'
import { Assignment,
  Body,
  Catch,
  Class,
  Constructor,
  Field,
  Literal,
  Method,
  New,
  Package,
  Parameter,
  Program,
  Reference,
  Return,
  Self,
  Send,
  Singleton,
  Source,
  Super,
  Test,
  Try } from '../src/model'
import { validations } from '../src/validator'
import { validatorAssertions } from './assertions'


use(validatorAssertions)
should()

// TODO: General cleanup

const WRE = new Package({
  name: 'wollok',
  members: [
    new Package({
      name: 'lang',
      members: [
        new Class({ name: 'Object' }),
        new Class({ name: 'Closure' }),
        new Package({ name: 'lib' }),
      ],
    }),
  ],
})

describe('Wollok Validations', () => {

  describe('Singleton', () => {
    describe('Singleton is not unnamed', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p',
          members: [
            new Singleton({}),
            new Singleton({ name: 's' }),
          ],
        }),
      ])

      const { singletonIsNotUnnamed } = validations
      const packageExample = environment.members[1]
      const unnamedSingleton = packageExample.members[0]
      const namedSingleton = packageExample.members[1]

      it('should pass when singleton has a name', () => {
        namedSingleton.should.pass(singletonIsNotUnnamed)
      })

      it('should not pass when singleton has no name', () => {
        unnamedSingleton.should.not.pass(singletonIsNotUnnamed)
      })
    })
  })

  /*
  describe('Imports', () => {

    it('importHasNotLocalReference', () => {
      const enviroment = link([
        WRE,
        Package('p', {
          imports: [Import(Reference('c'))],
        })(Package('c')()),
      ])

      const packageExample = enviroment.members[1] as PackageNode
      const importExample = packageExample.imports[0]
      const { importHasNotLocalReference } = validations(enviroment)

      assert.ok(!!importHasNotLocalReference(importExample, 'importHasNotLocalReference'))
    })
  })*/

  describe('References', () => {
    describe('Name is not a keyword', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'C', superclassRef: new Reference({ name: 'program' }) }),
            new Class({ name: 'C2', superclassRef: new Reference({ name: 'C' }) }),
            new Class({ name: 'program' }),
          ],
        }),
      ])

      const { nameIsNotKeyword } = validations
      const packageExample = environment.members[1]
      const classExample = packageExample.members[0] as Class
      const referenceWithKeywordName = classExample.superclassRef!

      const classExample2 = packageExample.members[1] as Class
      const referenceWithValidName = classExample2.superclassRef!

      it('should pass when name is not a keyword', () => {
        referenceWithValidName.should.pass(nameIsNotKeyword)
      })

      it('should not pass when name is a keyword', () => {
        referenceWithKeywordName.should.not.pass(nameIsNotKeyword)
      })
    })
  })

  describe('Classes', () => {

    describe('Name is in Uppercase', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'c' }),
            new Class({ name: 'C' }),
          ],
        }),
      ])

      const packageExample = environment.members[1]
      const classWithLowercaseName = packageExample.members[0]
      const classWithUppercaseName = packageExample.members[1]
      const { nameBeginsWithUppercase } = validations

      it('should pass when name begins with uppercase', () => {
        classWithUppercaseName.should.pass(nameBeginsWithUppercase)
      })

      it('should not pass when name begins with lowercase', () => {
        classWithLowercaseName.should.not.pass(nameBeginsWithUppercase)
      })
    })

    describe('Methods have distinct signatures', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p',
          members: [
            new Class({
              name: 'classExample',
              members: [
                new Method({ name: 'm', parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })] }),
                new Method({ name: 'm', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'd' })] }),
              ],
            }),
            new Class({
              name: 'classExample2',
              members: [
                new Method({ name: 'm', parameters: [new Parameter({ name: 'a' })] }),
                new Method({ name: 'm', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'd' })] }),
              ],
            }),
            new Class({
              name: 'classExample3',
              members: [
                new Method({ name: 'm', parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })] }),
                new Method({ name: 'm', parameters: [new Parameter({ name: 'q', isVarArg: true })] }),
              ],
            }),
            new Class({
              name: 'classExample4',
              members: [
                new Method({ name: 'm', parameters: [new Parameter({ name: 'a' })] }),
                new Method({ name: 'm', parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' }), new Parameter({ name: 'q', isVarArg: true })] }),
              ],
            }),
          ],
        }),
      ])

      const packageExample = environment.members[1]
      const classWithDuplicatedSignatures = packageExample.members[0] as Class
      const classWithDistinctSignatures = packageExample.members[1] as Class
      const classWithOverlappingVarArgSignature = packageExample.members[2] as Class
      const classWithDistinctSignaturesAndVarArg = packageExample.members[3] as Class

      const { hasDistinctSignature } = validations

      it('should pass when there is a method with the same name and different arity', () => {
        classWithDistinctSignatures.methods()[0].should.pass(hasDistinctSignature)
      })

      it('should pass when there is a method with the same name and cannot be called with the same amount of arguments', () => {
        classWithDistinctSignaturesAndVarArg.methods()[0].should.pass(hasDistinctSignature)
      })

      it('should not pass when there is a method with the same name and arity', () => {
        classWithDuplicatedSignatures.methods()[0].should.not.pass(hasDistinctSignature)
      })

      it('should not pass when there is a method with the same name and can be called with the same amount of arguments', () => {
        classWithOverlappingVarArgSignature.methods()[0].should.not.pass(hasDistinctSignature)
      })
    })
  })

  describe('New', () => {

    describe('Instantiation is not abstract class', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p',
          members: [
            new Class({
              name: 'C',
              members: [
                new Method({ name: 'm' }),
              ],
            }),
            new Class({
              name: 'C2',
              members: [
                new Method({ name: 'm', body: new Body({ sentences: [new Literal({ value: 5 })] }) }),
              ],
            }),
            new Test({
              name: 't',
              body: new Body({
                sentences: [
                  new New({ instantiated: new Reference({ name: 'C' }) }),
                ],
              }),
            }),
            new Test({
              name: 't',
              body: new Body({
                sentences: [
                  new New({ instantiated: new Reference({ name: 'C2' }) }),
                ],
              }),
            }),
          ],
        }),
      ])

      const packageExample = environment.members[1]
      const instantiationOfAbstractClass = (packageExample.members[2] as Test).body.sentences[0] as New
      const instantiationOfConcreteClass = (packageExample.members[3] as Test).body.sentences[0] as New

      const { instantiationIsNotAbstractClass } = validations

      it('should pass when instantiating a concrete class', () => {
        instantiationOfConcreteClass.should.pass(instantiationIsNotAbstractClass)
      })

      it('should not pass when instantiating an abstract class', () => {
        instantiationOfAbstractClass.should.not.pass(instantiationIsNotAbstractClass)
      })
    })
  })

  describe('Constructors', () => {

    describe('Constructors have distinct arity', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'c', members: [
                new Constructor({ parameters: [new Parameter({ name: 'p' }), new Parameter({ name: 'q' })] }),
                new Constructor({ parameters: [new Parameter({ name: 'k' }), new Parameter({ name: 'l' })] }),
              ],
            }),
            new Class({
              name: 'c2', members: [
                new Constructor({ parameters: [new Parameter({ name: 'p' }), new Parameter({ name: 'q' })] }),
                new Constructor({ parameters: [new Parameter({ name: 'q', isVarArg: true })] }),
              ],
            }),
            new Class({
              name: 'c3', members: [
                new Constructor({ parameters: [new Parameter({ name: 'a' })] }),
                new Constructor({ parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' }), new Parameter({ name: 'q', isVarArg: true })] }),
              ],
            }),
            new Class({
              name: 'c4', members: [
                new Constructor({ parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })] }),
              ],
            }),
          ],
        }),
      ])

      const packageExample = environment.members[1]
      const classWithConstructorsOfSameArity = packageExample.members[0] as Class
      const conflictingArityConstructor = classWithConstructorsOfSameArity.members[0]

      const classWithVarArgConflictingConstructors = packageExample.members[1] as Class
      const conflictingArityWithVarArgConstructor = classWithVarArgConflictingConstructors.members[0]

      const classWithVarArgAndDistinctSignatureConstructors = packageExample.members[2] as Class
      const distinctArityWithVarArgConstructor = classWithVarArgAndDistinctSignatureConstructors.members[0]

      const { hasDistinctSignature } = validations
      const classWithSingleConstructor = packageExample.members[3] as Class
      const singleConstructor = classWithSingleConstructor.members[0]

      it('should pass when constructors have distinct arity', () => {
        distinctArityWithVarArgConstructor.should.pass(hasDistinctSignature)
      })

      it('should not pass when constructors have the same arity', () => {
        conflictingArityConstructor.should.not.pass(hasDistinctSignature)
      })

      it('should not pass when constructors can be called with the same amount of arguments', () => {
        conflictingArityWithVarArgConstructor.should.not.pass(hasDistinctSignature)
      })

      it('should pass when single constructor defined', () => {
        singleConstructor.should.pass(hasDistinctSignature)
      })
    })
  })

  describe('Methods', () => {

    describe('Only last parameter is var arg', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Method({ name: 'm', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'q', isVarArg: true }), new Parameter({ name: 'p' })] }),
                new Method({ name: 'm2', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'q', isVarArg: true })] }),
              ],
            }),
          ],
        }),
      ])

      const { onlyLastParameterIsVarArg } = validations

      const packageExample = environment.members[1]
      const classExample = packageExample.members[0] as Class
      const methodWithVarArgInSecondToLastParameter = classExample.members[0]
      const methodWithVarArgInLastParameter = classExample.members[1]

      it('should pass when only the last parameter is var arg', () => {
        methodWithVarArgInLastParameter.should.pass(onlyLastParameterIsVarArg)
      })

      it('should not pass when a parameter that is not the last is var arg', () => {
        methodWithVarArgInSecondToLastParameter.should.not.pass(onlyLastParameterIsVarArg)
      })
    })

    describe('Body is not only a call to super', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Method({ name: 'm', body: new Body() }),
              ],
            }),
            new Class({
              name: 'C2', superclassRef: new Reference({ name: 'C' }), members: [
                new Method({ name: 'm', body: new Body({ sentences: [new Super()] }) }),
              ],
            }),
          ],
        })])

      const { methodNotOnlyCallToSuper } = validations

      const packageExample = environment.members[1]
      const classExample = packageExample.members[1] as Class
      const methodWithOnlyCallToSuper = classExample.members[0]

      it('should not pass when the method body is only a call to super', () => {
        methodWithOnlyCallToSuper.should.not.pass(methodNotOnlyCallToSuper)
      })
    })

    describe('Methods with different signatures', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Method({ name: 'm', body: new Body() }),
                new Method({ name: 'm', parameters: [new Parameter({ name: 'param' })], body: new Body() }),
              ],
            }),
          ],
        }),
      ])

      const { hasDistinctSignature } = validations

      const packageExample = environment.members[1]
      const classExample = packageExample.members[0] as Class
      const methodMNoParameter = classExample.members[0] as Method
      const methodM1Parameter = classExample.members[1] as Method

      it('should not confuse methods with different parameters', () => {
        methodMNoParameter.should.pass(hasDistinctSignature)
        methodM1Parameter.should.pass(hasDistinctSignature)
      })
    })

  })

  describe('Assignments', () => {

    describe('Non assignation of fully qualified references', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Field({ name: 'a', isReadOnly: false }),
                new Field({ name: 'b', isReadOnly: false }),
                new Method({
                  name: 'm', body: new Body({
                    sentences: [
                      new Assignment({ variable: new Reference({ name: 'p.C' }), value: new Reference({ name: 'a' }) }),
                      new Assignment({ variable: new Reference({ name: 'a' }), value: new Reference({ name: 'b' }) }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      ])

      const { nonAsignationOfFullyQualifiedReferences } = validations

      const packageExample = environment.members[1]
      const classExample = packageExample.members[0] as Class
      const methodExample = classExample.members[2] as Method
      const bodyExample = methodExample.body as Body
      const assignmentOfFullyQualifiedReference = bodyExample.sentences[0]
      const validAssignment = bodyExample.sentences[1]

      it('should pass when assignment reference is not fully qualified', () => {
        validAssignment.should.pass(nonAsignationOfFullyQualifiedReferences)
      })

      it('should not pass when assignment reference is fully qualified', () => {
        assignmentOfFullyQualifiedReference.should.not.pass(nonAsignationOfFullyQualifiedReferences)
      })
    })

    describe('Not assign to itself', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Field({ name: 'a', isReadOnly: false }),
                new Field({ name: 'b', isReadOnly: false }),
                new Method({
                  name: 'm', body: new Body({
                    sentences: [
                      new Assignment({ variable: new Reference({ name: 'a' }), value: new Reference({ name: 'a' }) }),
                      new Assignment({ variable: new Reference({ name: 'a' }), value: new Reference({ name: 'b' }) }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        })])


      const { notAssignToItself } = validations

      const packageExample = environment.members[1]
      const classExample = packageExample.members[0] as Class
      const methodExample = classExample.members[2] as Method
      const bodyExample = methodExample.body as Body
      const selfAssignment = bodyExample.sentences[0]
      const validAssignment = bodyExample.sentences[1]

      it('should pass when not assigning to itself', () => {
        validAssignment.should.pass(notAssignToItself)
      })

      it('should not pass when assigning to itself', () => {
        selfAssignment.should.not.pass(notAssignToItself)
      })
    })
  })

  describe('Try', () => {

    describe('Try has catch or always', () => {

      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C',
              members: [
                new Method({
                  name: 'm', body: new Body({
                    sentences: [
                      new Try({ body: new Body({ sentences: [new Reference({ name: 'p' })] }) }),
                    ],
                  }),
                }),
                new Method({
                  name: 'm2', body: new Body({
                    sentences: [
                      new Try({
                        body: new Body({ sentences: [new Reference({ name: 'p' })] }),
                        catches: [
                          new Catch({ parameter: new Parameter({ name: 'e' }), body: new Body({ sentences: [new Reference({ name: 'p' })] }) }),
                        ],
                      }),
                    ],
                  }),
                }),
                new Method({
                  name: 'm3', body: new Body({
                    sentences: [
                      new Try({
                        body: new Body({ sentences: [new Reference({ name: 'p' })] }),
                        always: new Body({
                          sentences: [
                            new Reference({ name: 'p' }),
                          ],
                        }),
                      }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      ])

      const { hasCatchOrAlways } = validations

      const packageExample = environment.members[1] as Package
      const classExample = packageExample.members[0] as Class
      const methodExample = classExample.members[0] as Method
      const bodyExample = methodExample.body as Body
      const tryWithEmptyAlways = bodyExample.sentences[0]

      const methodExample2 = classExample.members[1] as Method
      const bodyExample2 = methodExample2.body as Body
      const tryWithCatch = bodyExample2.sentences[0]

      const methodExample3 = classExample.members[2] as Method
      const bodyExample3 = methodExample3.body as Body
      const tryWithAlways = bodyExample3.sentences[0]

      it('should pass when try has catch', () => {
        tryWithCatch.should.pass(hasCatchOrAlways)
      })

      it('should pass when try has always', () => {
        tryWithAlways.should.pass(hasCatchOrAlways)
      })

      it('should not pass when try has an empty always', () => {
        tryWithEmptyAlways.should.not.pass(hasCatchOrAlways)
      })
    })
  })

  describe('Parameters', () => {
    describe('Name is lowercase', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Method({ name: 'm', parameters: [new Parameter({ name: 'C' }), new Parameter ({ name: 'k' })] }),
              ],
            }),
          ],
        }),
      ])

      const { nameBeginsWithLowercase } = validations

      const packageExample = environment.members[1] as Package
      const classExample = packageExample.members[0] as Class
      const methodExample = classExample.members[0] as Method
      const uppercaseParameter = methodExample.parameters[0]
      const lowercaseParameter = methodExample.parameters[1]

      it('should pass when name is a lowercase letter', () => {
        lowercaseParameter.should.pass(nameBeginsWithLowercase)
      })

      it('should not pass when name is an uppercase letter', () => {
        uppercaseParameter.should.not.pass(nameBeginsWithLowercase)
      })
    })
  })

  describe('Fields', () => {

    describe('Not assign to itself in variable declaration', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Field({ name: 'v', isReadOnly: false, value: new Reference({ name: 'v' }) }),
                new Field({ name: 'b', isReadOnly: false, value: new Reference({ name: 'v' }) }),
                new Field({ name: 'a', isReadOnly: false }),
              ],
            }),
          ],
        })])

      const { notAssignToItselfInVariableDeclaration } = validations

      const packageExample = environment.members[1] as Package
      const classExample = packageExample.members[0] as Class
      const declarationWithSelfAssignment = classExample.members[0]
      const declarationWithoutSelfAssignment = classExample.members[1]

      it('should pass when not self-assigning', () => {
        declarationWithoutSelfAssignment.should.pass(notAssignToItselfInVariableDeclaration)
      })

      it('should not pass when self-assigning', () => {
        declarationWithSelfAssignment.should.not.pass(notAssignToItselfInVariableDeclaration)
      })
    })
  })

  describe('Tests', () => {
    describe('Test is not empty', () => {
      const environment = link([
        WRE,
        new Package({ name: 'p', members: [new Test({ name: 't', body: new Body() })] }
        )])

      const { containerIsNotEmpty } = validations
      const packageExample = environment.members[1] as Package
      const emptyTest = packageExample.members[0]

      it('should not pass when test is empty', () => {
        emptyTest.should.not.pass(containerIsNotEmpty)
      })
    })
  })

  describe('Packages', () => {
    /*
    it('duplicatedPackageName', () => {
      const environment = link([
        WRE,
        new Package({name: 'p', members: [),
        Package('p')(),
        Package('c')(),
      ])
      const { notDuplicatedPackageName } = validations
      const packageExample = environment.members[1] as PackageNode
      const packageExample2 = environment.members[3] as PackageNode
      assert.ok(!!notDuplicatedPackageName(packageExample, 'duplicatedPackageName'))
      assert.ok(!notDuplicatedPackageName(packageExample2, 'duplicatedPackageName'))
    })*/
  })

  describe('Self', () => {
    describe('self is not in a program', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Program({
              name: 'pr', body: new Body({
                sentences: [
                  new Return({ value: new Self({ source: {} as Source }) }),
                ],
              }),
            }),
            new Class({
              name: 'C', members: [
                new Method({
                  name: 'm', body: new Body({
                    sentences: [
                      new Return({ value: new Self({ source: {} as Source }) }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        })])

      const { selfIsNotInAProgram } = validations

      const programExample = environment.getNodeByFQN<Program>('p.pr')
      const selfInProgram = (programExample.body.sentences[0] as Return).value!
      const classExample = environment.getNodeByFQN<Class>('p.C')
      const methodExample = classExample.members[0] as Method
      const selfInMethod = (methodExample.sentences()[0] as Return).value!

      it('should pass when self is in a method', () => {
        selfInMethod.should.pass(selfIsNotInAProgram)
      })

      it('should not pass when self is in a program', () => {
        selfInProgram.should.not.pass(selfIsNotInAProgram)
      })
    })
  })

  describe('Send', () => {
    describe('Do not compare against true or false', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Field({ name: 'd', isReadOnly: false }),
                new Method({
                  name: 'm', body: new Body({
                    sentences: [
                      new Return({
                        value: new Send({
                          receiver: new Reference({ name: 'd' }),
                          message: '==',
                          args: [new Literal({ value: true })],
                        }),
                      }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        })])

      const { dontCompareAgainstTrueOrFalse } = validations

      const packageExample = environment.members[1] as Package
      const classExample = packageExample.members[0] as Class
      const methodExample = classExample.members[1] as Method
      const comparisonAgainstTrue = (methodExample.sentences()[0] as Return).value as Send

      it('should not pass when comparing against true literal', () => {
        comparisonAgainstTrue.should.not.pass(dontCompareAgainstTrueOrFalse)
      })
    })
  })

  describe('Super', () => {
    describe('No super in constructor body', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'c', members: [
                new Constructor({ body: new Body({ sentences: [new Super({ source: {} as Source })] }) }),
                new Method({ name: 'm', body: new Body({ sentences: [new Super({ source: {} as Source })] }) }),
              ],
            }),
          ],
        })])

      const { noSuperInConstructorBody } = validations

      const packageExample = environment.members[1] as Package
      const classExample = packageExample.members[0] as Class
      const constructorExample = classExample.members[0] as Constructor
      const superInConstructorBody = constructorExample.body.sentences[0] as Super
      const method = classExample.members[1] as Method
      const superInMethodBody = method.sentences()[0] as Super

      it('should pass when super is in method body', () => {
        superInMethodBody.should.pass(noSuperInConstructorBody)
      })

      it('should not pass when super is in constructor body', () => {
        superInConstructorBody.should.not.pass(noSuperInConstructorBody)
      })
    })
  })

  describe('Return', () => {
    describe('No return statement in constructor', () => {
      const environment = link([
        WRE,
        new Package({
          name: 'p', members: [
            new Class({
              name: 'C', members: [
                new Constructor({ body: new Body({ sentences: [new Return({ value: new Literal({ value: 'a' }), source: {} as Source })] }) }),
                new Method({ name: 'm', body: new Body({ sentences:  [new Return({ value: new Literal({ value: 'a' }), source: {} as Source })]  }) }),
              ],
            }),
          ],
        }),
      ])

      const { noReturnStatementInConstructor } = validations

      // TODO: Use the proper methods instead of casting
      const packageExample = environment.members[1] as Package
      const classExample = packageExample.members[0] as Class
      const constructorExample = classExample.members[0] as Constructor
      const returnInConstructor = constructorExample.body.sentences[0] as Return
      const method = classExample.members[1] as Method
      const returnInMethod = method.sentences()[0] as Return

      it('should pass when return is in a method', () => {
        returnInMethod.should.pass(noReturnStatementInConstructor)
      })

      it('should not pass when return is in a constructor', () => {
        returnInConstructor.should.not.pass(noReturnStatementInConstructor)
      })
    })
  })

  describe('Wollok Core Library Health', () => {
    const environment = buildEnvironment([{ name: 'zarlanga.wlk', content: '' }])
    const problems = validate(environment).map(
      ({ code, node }) => ({
        code,
        file: node.source?.file,
        line: node.source?.start.line,
        offset: node.source?.start.offset,
      })
    )

    it('should pass without validation errors', () => {
      problems.should.deep.equal([], 'Wollok Core Libraries has errors: ' + JSON.stringify(problems))
    })
  })
})