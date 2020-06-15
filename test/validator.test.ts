import { should, use } from 'chai'
import { Assignment, Catch, Class, Constructor, Field, Literal, Method, New, Package, Parameter, Program, Reference, Return, Self, Send, Singleton, Super, Test, Try } from '../src/builders'
import fill from '../src/filler'
import link from '../src/linker'
import { Assignment as AssignmentNode, Body as BodyNode, Class as ClassNode, Constructor as ConstructorNode, Field as FieldNode, Filled, Linked, Method as MethodNode, New as NewNode, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Return as ReturnNode, Send as SendNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Try as TryNode } from '../src/model'
import { validations } from '../src/validator'
import { validatorAssertions } from './assertions'


use(validatorAssertions)
should()

// TODO: General cleanup

const WRE = fill(Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure')()
  ),
  Package('lib')(),
))

describe('Wollok Validations', () => {

  describe('Singleton', () => {
    describe('Singleton is not unnamed', () => {
      const environment = link([
        WRE,
        fill(Package('p')(
          Singleton()(),
          Singleton('s')(),
        )),
      ])

      const { singletonIsNotUnnamed } = validations
      const packageExample = environment.members[1] as PackageNode<Linked>
      const unnamedSingleton = packageExample.members[0] as SingletonNode<Linked>
      const namedSingleton = packageExample.members[1] as SingletonNode<Linked>

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

      const packageExample = enviroment.members[1] as PackageNode<Linked>
      const importExample = packageExample.imports[0]
      const { importHasNotLocalReference } = validations(enviroment)

      assert.ok(!!importHasNotLocalReference(importExample, 'importHasNotLocalReference'))
    })
  })*/

  describe('References', () => {
    describe('Name is not a keyword', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class(
            'C',
            { superclassRef: Reference('program') }
          )(),
          Class(
            'C2',
            { superclassRef: Reference('C') }
          )(),
          Class('program')(),
        ),
      ] as PackageNode<Filled>[])

      const { nameIsNotKeyword } = validations
      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const referenceWithKeywordName = classExample.superclassRef!

      const classExample2 = packageExample.members[1] as ClassNode<Linked>
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

    describe('Name is in PascalCase', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(),
          Class('C')(),
        ),
      ] as PackageNode<Filled>[])

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classWithLowercaseName = packageExample.members[0] as ClassNode<Linked>
      const classWithPascalCaseName = packageExample.members[1] as ClassNode<Linked>
      const { nameIsPascalCase } = validations

      it('should pass when name is in PascalCase', () => {
        classWithPascalCaseName.should.pass(nameIsPascalCase)
      })

      it('should not pass when name is not in PascalCase', () => {
        classWithLowercaseName.should.not.pass(nameIsPascalCase)
      })
    })

    describe('Methods have distinct signatures', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('classExample')(
            Method('m', { parameters: [Parameter('a'), Parameter('b')] })(),
            Method('m', { parameters: [Parameter('c'), Parameter('d')] })(),
          ),

          Class('classExample2')(
            Method('m', { parameters: [Parameter('a')] })(),
            Method('m', { parameters: [Parameter('c'), Parameter('d')] })(),
          ),

          Class('classExample3')(
            Method('m', { parameters: [Parameter('a'), Parameter('b')] })(),
            Method('m', { parameters: [Parameter('q', { isVarArg: true })] })(),
          ),

          Class('classExample4')(
            Method('m', { parameters: [Parameter('a'), Parameter('b')] })(),
            Method('m', { parameters: [Parameter('a'), Parameter('b'), Parameter('q', { isVarArg: true })] })(),
          ),

        ),
      ] as PackageNode<Filled>[])

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classWithoutDistinctSignatures = packageExample.members[0] as ClassNode<Linked>
      const classWithDistinctSignatures = packageExample.members[1] as ClassNode<Linked>
      const classWithoutDistinctSignaturesAndVarArg = packageExample.members[2] as ClassNode<Linked>
      const classWithDistinctSignaturesAndVarArg = packageExample.members[3] as ClassNode<Linked>

      const { methodsHaveDistinctSignatures } = validations

      it('should pass when there is a method with the same name and different arity', () => {
        classWithDistinctSignatures.should.pass(methodsHaveDistinctSignatures)
      })

      it('should pass when there is a method with the same name and cannot be called with the same amount of arguments', () => {
        classWithDistinctSignaturesAndVarArg.should.pass(methodsHaveDistinctSignatures)
      })

      it('should not pass when there is a method with the same name and arity', () => {
        classWithoutDistinctSignatures.should.not.pass(methodsHaveDistinctSignatures)
      })

      it('should not pass when there is a method with the same name and can be called with the same amount of arguments', () => {
        classWithoutDistinctSignaturesAndVarArg.should.not.pass(methodsHaveDistinctSignatures)
      })
    })
  })

  describe('New', () => {

    describe('Instantiation is not abstract class', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(Method('m')()),
          Class('C2')(Method('m')(Literal(5))),
          Test('t')(New(Reference('C'), [])),
          Test('t')(New(Reference('C2'), [])),
        ),
      ] as PackageNode<Filled>[])

      const packageExample = environment.members[1] as PackageNode<Linked>
      const instantiationOfAbstractClass = (packageExample.members[2] as TestNode<Linked>).body.sentences[0] as NewNode<Linked>
      const instantiationOfConcreteClass = (packageExample.members[3] as TestNode<Linked>).body.sentences[0] as NewNode<Linked>

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
        Package('p')(
          Class('c')(
            Constructor({ parameters: [Parameter('p'), Parameter('q')] })(),
            Constructor({ parameters: [Parameter('k'), Parameter('l')] })()
          ),
          Class('c2')(
            Constructor({ parameters: [Parameter('p'), Parameter('q')] })(),
            Constructor({ parameters: [Parameter('q', { isVarArg: true })] })()
          ),
          Class('c3')(
            Constructor({ parameters: [Parameter('a'), Parameter('b')] })(),
            Constructor({ parameters: [Parameter('a'), Parameter('b'), Parameter('q', { isVarArg: true })] })()
          ),
        ),
      ] as PackageNode<Filled>[])

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classWithConstructorsOfSameArity = packageExample.members[0] as ClassNode<Linked>
      const conflictingArityConstructor = classWithConstructorsOfSameArity.members[0] as ConstructorNode<Linked>

      const classWithVarArgConflictingConstructors = packageExample.members[1] as ClassNode<Linked>
      const conflictingArityWithVarArgConstructor = classWithVarArgConflictingConstructors.members[0] as ConstructorNode<Linked>

      const classWithVarArgAndDistinctSignatureConstructors = packageExample.members[2] as ClassNode<Linked>
      const distinctArityWithVarArgConstructor = classWithVarArgAndDistinctSignatureConstructors.members[0] as ConstructorNode<Linked>

      const { constructorsHaveDistinctArity } = validations

      it('should pass when constructors have distinct arity', () => {
        distinctArityWithVarArgConstructor.should.pass(constructorsHaveDistinctArity)
      })

      it('should not pass when constructors have the same arity', () => {
        conflictingArityConstructor.should.not.pass(constructorsHaveDistinctArity)
      })

      it('should not pass when constructors can be called with the same amount of arguments', () => {
        conflictingArityWithVarArgConstructor.should.not.pass(constructorsHaveDistinctArity)
      })
    })
  })

  describe('Methods', () => {

    describe('Only last parameter is var arg', () => {
      const environment = link([
        WRE,
        Package('p')(Class('C')(
          Method('m', { parameters: [Parameter('c'), Parameter('q', { isVarArg: true }), Parameter('p')] })(),
          Method('m2', { parameters: [Parameter('c'), Parameter('q', { isVarArg: true })] })()
        )),
      ] as PackageNode<Filled>[])

      const { onlyLastParameterIsVarArg } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const methodWithVarArgInSecondToLastParameter = classExample.members[0] as MethodNode<Linked>
      const methodWithVarArgInLastParameter = classExample.members[1] as MethodNode<Linked>

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
        Package('p')(
          Class('C')(Method('m')()),
          Class(
            'C2',
            { superclassRef: Reference('C') }
          )(Method('m')(Super())),

        ),
      ] as PackageNode<Filled>[])

      const { methodNotOnlyCallToSuper } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[1] as ClassNode<Linked>
      const methodWithOnlyCallToSuper = classExample.members[0] as MethodNode<Linked>

      it('should not pass when the method body is only a call to super', () => {
        methodWithOnlyCallToSuper.should.not.pass(methodNotOnlyCallToSuper)
      })
    })
  })

  describe('Assignments', () => {

    describe('Non assignation of fully qualified references', () => {
      const environment = link([
        WRE,
        Package('p')(Class('C')(
          Field('a'),
          Field('b'),
          Method('m')(Assignment(Reference('p.C'), Reference('a')), Assignment(Reference('a'), Reference('b'))),
        )),
      ] as PackageNode<Filled>[])


      const { nonAsignationOfFullyQualifiedReferences } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const methodExample = classExample.members[2] as MethodNode<Linked>
      const bodyExample = methodExample.body as BodyNode<Linked>
      const assignmentOfFullyQualifiedReference = bodyExample.sentences[0] as AssignmentNode<Linked>
      const validAssignment = bodyExample.sentences[1] as AssignmentNode<Linked>

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
        Package('p')(Class('C')(
          Field('a'),
          Field('b'),
          Method('m')(Assignment(Reference('a'), Reference('a')), Assignment(Reference('a'), Reference('b'))),
        )),
      ] as PackageNode<Filled>[])


      const { notAssignToItself } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const methodExample = classExample.members[2] as MethodNode<Linked>
      const bodyExample = methodExample.body as BodyNode<Linked>
      const selfAssignment = bodyExample.sentences[0] as AssignmentNode<Linked>
      const validAssignment = bodyExample.sentences[1] as AssignmentNode<Linked>

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
        Package('p')(Class('C')(
          Method('m')(Try([Reference('p')], { always: [] })),
          Method('m2')(Try([Reference('p')], {
            catches: [
              Catch(Parameter('e'))(Reference('p')),
            ],
          })),
          Method('m3')(Try([Reference('p')], { always: [Reference('p')] }))
        )),
      ] as PackageNode<Filled>[])

      const { hasCatchOrAlways } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const methodExample = classExample.members[0] as MethodNode<Linked>
      const bodyExample = methodExample.body as BodyNode<Linked>
      const tryWithEmptyAlways = bodyExample.sentences[0] as TryNode<Linked>

      const methodExample2 = classExample.members[1] as MethodNode<Linked>
      const bodyExample2 = methodExample2.body as BodyNode<Linked>
      const tryWithCatch = bodyExample2.sentences[0] as TryNode<Linked>

      const methodExample3 = classExample.members[2] as MethodNode<Linked>
      const bodyExample3 = methodExample3.body as BodyNode<Linked>
      const tryWithAlways = bodyExample3.sentences[0] as TryNode<Linked>

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
    describe('Name is camelCase', () => {
      const environment = link([
        WRE,
        Package('p')(Class('C')(Method('m', { parameters: [Parameter('C'), Parameter('k')] })())),
      ] as PackageNode<Filled>[])

      const { nameIsCamelCase } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const methodExample = classExample.members[0] as MethodNode<Linked>
      const uppercaseParameter = methodExample.parameters[0] as ParameterNode<Linked>
      const lowercaseParameter = methodExample.parameters[1] as ParameterNode<Linked>

      it('should pass when name is a lowercase letter', () => {
        lowercaseParameter.should.pass(nameIsCamelCase)
      })

      it('should not pass when name is an uppercase letter', () => {
        uppercaseParameter.should.not.pass(nameIsCamelCase)
      })
    })
  })

  describe('Fields', () => {
    describe('Field name different from method names', () => {
      const environment = link([
        WRE,
        Package('p')(Class('c')(
          Field('m'),
          Field('a'),
          Method('m')(),
        )),
      ] as PackageNode<Filled>[])

      const { fieldNameDifferentFromTheMethods } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const fieldWithSameNameAsMethod = classExample.members[0] as FieldNode<Linked>
      const fieldWithDifferentNameFromMethods = classExample.members[1] as FieldNode<Linked>

      it('should pass when field name is different from method names', () => {
        fieldWithDifferentNameFromMethods.should.pass(fieldNameDifferentFromTheMethods)
      })

      it('should not pass when field name is a method name', () => {
        fieldWithSameNameAsMethod.should.not.pass(fieldNameDifferentFromTheMethods)
      })
    })

    describe('Not assign to itself in variable declaration', () => {
      const environment = link([
        WRE,
        Package('p')(Class('c')(
          Field('v', { value: Reference('v') }),
          Field('b', { value: Reference('a') }),
          Field('a'),
        )),
      ] as PackageNode<Filled>[])

      const { notAssignToItselfInVariableDeclaration } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = packageExample.members[0] as ClassNode<Linked>
      const declarationWithSelfAssignment = classExample.members[0] as FieldNode<Linked>
      const declarationWithoutSelfAssignment = classExample.members[1] as FieldNode<Linked>

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
        Package('p')(Test('t')()),
      ] as PackageNode<Filled>[])

      const { testIsNotEmpty } = validations
      const packageExample = environment.members[1] as PackageNode<Linked>
      const emptyTest = packageExample.members[0] as TestNode<Linked>

      it('should not pass when test is empty', () => {
        emptyTest.should.not.pass(testIsNotEmpty)
      })
    })
  })

  describe('Packages', () => {

    /*
    it('duplicatedPackageName', () => {
      const environment = link([
        WRE,
        Package('p')(),
        Package('p')(),
        Package('c')(),
      ])

      const { notDuplicatedPackageName } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const packageExample2 = environment.members[3] as PackageNode<Linked>

      assert.ok(!!notDuplicatedPackageName(packageExample, 'duplicatedPackageName'))
      assert.ok(!notDuplicatedPackageName(packageExample2, 'duplicatedPackageName'))
    })*/
  })

  describe('Self', () => {
    describe('self is not in a program', () => {
      const environment = link([
        WRE,
        Package('p')(
          Program('pr')(Return(Self())),
          Class('C')(Method('m')(Return(Self())))
        ),
      ] as PackageNode<Filled>[])

      const { selfIsNotInAProgram } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const programExample = packageExample.members[0] as ProgramNode<Linked>
      const selfInProgram = (programExample.body.sentences[0] as ReturnNode<Linked>).value!
      const classExample = (packageExample.members[1] as ClassNode<Linked>)
      const methodExample = classExample.members[0] as MethodNode<Linked>
      const selfInMethod = (methodExample.body!.sentences[0] as ReturnNode).value!
      
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
        Package('p')(Class('C')(
          Field('d'),
          Method('m')(Return(Send(Reference('d'), '==', [Literal(true)])))
        )),
      ] as PackageNode<Filled>[])

      const { dontCompareAgainstTrueOrFalse } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = (packageExample.members[0] as ClassNode<Linked>)
      const methodExample = classExample.members[1] as MethodNode<Linked>
      const comparisonAgainstTrue = (methodExample.body!.sentences[0] as ReturnNode<Linked>).value as SendNode<Linked>

      it('should not pass when comparing against true literal', () => {
        comparisonAgainstTrue.should.not.pass(dontCompareAgainstTrueOrFalse)
      })
    })
  })

  describe('Super', () => {
    describe('No super in constructor body', () => {
      const environment = link([
        WRE,
        Package('p')(Class('c')(
          Constructor()(Super()),
          Method('m')(Super()),
        )),
      ] as PackageNode<Filled>[])

      const { noSuperInConstructorBody } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = (packageExample.members[0] as ClassNode<Linked>)
      const constructorExample = classExample.members[0] as ConstructorNode<Linked>
      const superInConstructorBody = constructorExample.body.sentences[0] as SuperNode<Linked>
      const method = classExample.members[1] as MethodNode<Linked>
      const superInMethodBody = method.body!.sentences[0] as SuperNode<Linked>

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
        Package('p')(Class('c')(
          Constructor()(Return(Literal('a'))),
          Method('m')(Return(Literal('a'))),
        )),
      ] as PackageNode<Filled>[])

      const { noReturnStatementInConstructor } = validations

      const packageExample = environment.members[1] as PackageNode<Linked>
      const classExample = (packageExample.members[0] as ClassNode<Linked>)
      const constructorExample = classExample.members[0] as ConstructorNode<Linked>
      const returnInConstructor = constructorExample.body.sentences[0] as ReturnNode<Linked>
      const method = classExample.members[1] as MethodNode<Linked>
      const returnInMethod = method.body!.sentences[0] as ReturnNode<Linked>

      it('should pass when return is in a method', () => {
        returnInMethod.should.pass(noReturnStatementInConstructor)
      })

      it('should not pass when return is in a constructor', () => {
        returnInConstructor.should.not.pass(noReturnStatementInConstructor)
      })
    })
  })
})