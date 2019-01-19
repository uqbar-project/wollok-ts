import { assert, should } from 'chai'
import link from '../src/linker'
import { Assignment as AssignmentNode, Body as BodyNode, Class as ClassNode, Constructor as ConstructorNode, Field as FieldNode, Method as MethodNode, New as NewNode, Package as PackageNode, Parameter as ParameterNode, Program as ProgramNode, Return as ReturnNode, Self as SelfNode, Send as SendNode, Singleton as SingletonNode, Super as SuperNode, Test as TestNode, Try as TryNode } from '../src/model'
import { validations } from '../src/validator'
import { Assignment, Catch, Class, Constructor, Field, Literal, Method, New, Package, Parameter, Program, Reference, Return, Self, Send, Singleton, Super, Test, Try } from './builders'

should()

// TODO: General cleanup
// TODO: Use custom assertions

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure')()
  )
)

describe('Wollok Validations', () => {

  describe('Singleton', () => {

    it('Unnamed singleton', () => {
      const environment = link([
        WRE,
        Package('p')(
          Singleton()(),
          Singleton('s')(),
        ),
      ] as PackageNode<'Filled'>[])

      const { singletonIsNotUnnamed } = validations(environment)
      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const singletonExample = packageExample.members[0] as SingletonNode<'Linked'>
      const singletonExample2 = packageExample.members[1] as SingletonNode<'Linked'>

      assert.ok(!!singletonIsNotUnnamed(singletonExample, 'singletonIsNotUnnamed'))
      assert.ok(!singletonIsNotUnnamed(singletonExample2, 'singletonIsNotUnnamed'))
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

      const packageExample = enviroment.members[1] as PackageNode<'Linked'>
      const importExample = packageExample.imports[0]
      const { importHasNotLocalReference } = validations(enviroment)

      assert.ok(!!importHasNotLocalReference(importExample, 'importHasNotLocalReference'))
    })
  })*/

  describe('References', () => {
    it('nameIsNotKeyword', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C',
            {
              superclass: Reference('program'),
            }
          )(),
          Class('C2',
            {
              superclass: Reference('C'),
            }
          )(),
          Class('program')(),
        ),
      ] as PackageNode<'Filled'>[])

      const { nameIsNotKeyword } = validations(environment)
      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const referenceExample = classExample.superclass!

      const classExample2 = packageExample.members[1] as ClassNode<'Linked'>
      const referenceExample2 = classExample2.superclass!

      assert.ok(!!nameIsNotKeyword(referenceExample, 'nameIsNotKeyword')!)
      assert.ok(!nameIsNotKeyword(referenceExample2, 'nameIsNotKeyword')!)
    })
  })

  describe('Classes', () => {

    it('nameIsPascalCase', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(),
          Class('C')(),
        ),
      ] as PackageNode<'Filled'>[])

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const classExample2 = packageExample.members[1] as ClassNode<'Linked'>
      const { nameIsPascalCase } = validations(environment)

      assert.ok(!!nameIsPascalCase(classExample, 'nameIsPascalCase'))
      assert.ok(!nameIsPascalCase(classExample2, 'nameIsPascalCase'))

    })

    it('methodsHaveDistinctSignatures', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('classExample')(
            Method('m', {
              parameters: [Parameter('a'), Parameter('b')],
            })(),
            Method('m', {
              parameters: [Parameter('c'), Parameter('d')],
            })(),
          ),

          Class('classExample2')(
            Method('m', {
              parameters: [Parameter('a')],
            })(),
            Method('m', {
              parameters: [Parameter('c'), Parameter('d')],
            })(),
          ),

          Class('classExample3')(
            Method('m', {
              parameters: [Parameter('a'), Parameter('b')],
            })(),
            Method('m', {
              parameters: [Parameter('q', { isVarArg: true })],
            })(),
          ),

          Class('classExample4')(
            Method('m', {
              parameters: [Parameter('a'), Parameter('b')],
            })(),
            Method('m', {
              parameters: [Parameter('a'), Parameter('b'), Parameter('q', { isVarArg: true })],
            })(),
          ),

        ),
      ] as PackageNode<'Filled'>[])

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const classExample2 = packageExample.members[1] as ClassNode<'Linked'>
      const classExample3 = packageExample.members[2] as ClassNode<'Linked'>
      const classExample4 = packageExample.members[3] as ClassNode<'Linked'>

      const { methodsHaveDistinctSignatures } = validations(environment)

      assert.ok(!!methodsHaveDistinctSignatures(classExample, 'methodsHaveDistinctSignatures'))
      assert.ok(!!methodsHaveDistinctSignatures(classExample3, 'methodsHaveDistinctSignatures'))
      assert.ok(!methodsHaveDistinctSignatures(classExample4, 'methodsHaveDistinctSignatures'))
      assert.ok(!methodsHaveDistinctSignatures(classExample2, 'methodsHaveDistinctSignatures'))

    })


  })

  describe('New', () => {

    it('cannotInstantiateAbstractClasses', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(Method('m')()),
          Class('C2')(Method('m')(Literal(5))),
          Test('t')(New(Reference('C'), [])),
          Test('t')(New(Reference('C2'), [])),
        ),
      ] as PackageNode<'Filled'>[])

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const newExample = (packageExample.members[2] as TestNode<'Linked'>).body.sentences[0] as NewNode<'Linked'>
      const newExample2 = (packageExample.members[3] as TestNode<'Linked'>).body.sentences[0] as NewNode<'Linked'>

      const { instantiationIsNotAbstractClass } = validations(environment)

      assert.ok(!!instantiationIsNotAbstractClass(newExample, 'instantiationIsNotAbstractClass'))
      assert.ok(!instantiationIsNotAbstractClass(newExample2, 'instantiationIsNotAbstractClass'))

    })

  })

  describe('Constructors', () => {

    it('constructorsHaveDistinctArity', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(
            Constructor({
              parameters: [Parameter('p'), Parameter('q')],
            })(),
            Constructor({
              parameters: [Parameter('k'), Parameter('l')],
            })()
          ),
          Class('c2')(
            Constructor({
              parameters: [Parameter('p'), Parameter('q')],
            })(),
            Constructor({
              parameters: [Parameter('q', {
                isVarArg: true,
              })],
            })()
          ),
          Class('c3')(
            Constructor({
              parameters: [Parameter('a'), Parameter('b')],
            })(),
            Constructor({
              parameters: [Parameter('a'), Parameter('b'), Parameter('q', { isVarArg: true })],
            })()
          ),
        ),
      ] as PackageNode<'Filled'>[])

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const constructorExample = classExample.members[0] as ConstructorNode<'Linked'>
      const classExample2 = packageExample.members[1] as ClassNode<'Linked'>
      const constructorExample2 = classExample2.members[0] as ConstructorNode<'Linked'>
      const classExample3 = packageExample.members[2] as ClassNode<'Linked'>
      const constructorExample3 = classExample3.members[0] as ConstructorNode<'Linked'>

      const { constructorsHaveDistinctArity } = validations(environment)

      assert.ok(!!constructorsHaveDistinctArity(constructorExample, 'constructorsHaveDistinctArity'))
      assert.ok(!!constructorsHaveDistinctArity(constructorExample2, 'constructorsHaveDistinctArity'))
      assert.ok(!constructorsHaveDistinctArity(constructorExample3, 'constructorsHaveDistinctArity'))
    })


  })

  describe('Methods', () => {

    it('onlyLastParameterIsVarArg', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Method('m', {
              parameters: [Parameter('c'), Parameter('q', { isVarArg: true }), Parameter('p')],
            })(),
            Method('m2', {
              parameters: [Parameter('c'), Parameter('q', { isVarArg: true })],
            })()),
        ),
      ] as PackageNode<'Filled'>[])

      const { onlyLastParameterIsVarArg } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[0] as MethodNode<'Linked'>
      const methodExample2 = classExample.members[1] as MethodNode<'Linked'>

      assert.ok(!!onlyLastParameterIsVarArg(methodExample, 'onlyLastParameterIsVarArg'))
      assert.ok(!onlyLastParameterIsVarArg(methodExample2, 'onlyLastParameterIsVarArg'))

    })

    it('notOnlyCallToSuper', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Method('m')(),
          ),
          Class('C2',
            { superclass: Reference('C') }
          )(Method('m')(Super())),

        ),
      ] as PackageNode<'Filled'>[])

      const { methodNotOnlyCallToSuper } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[1] as ClassNode<'Linked'>
      const methodExample = classExample.members[0] as MethodNode<'Linked'>

      assert.ok(!!methodNotOnlyCallToSuper(methodExample, 'onlyLastParameterIsVarArg'))

    })
  })

  describe('Assignments', () => {

    it('nonAsignationOfFullyQualifiedReferences', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Field('a'),
            Field('b'),
            Method('m')(Assignment(Reference('p.C'), Reference('a')), Assignment(Reference('a'), Reference('b'))),
          )
        ),
      ] as PackageNode<'Filled'>[])


      const { nonAsignationOfFullyQualifiedReferences } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[2] as MethodNode<'Linked'>
      const bodyExample = methodExample.body as BodyNode<'Linked'>
      const assingnmentExample = bodyExample.sentences[0] as AssignmentNode<'Linked'>
      const assingnmentExample2 = bodyExample.sentences[1] as AssignmentNode<'Linked'>

      assert.ok(!!nonAsignationOfFullyQualifiedReferences(assingnmentExample, 'nonAsignationOfFullyQualifiedReferences'))
      assert.ok(!nonAsignationOfFullyQualifiedReferences(assingnmentExample2, 'nonAsignationOfFullyQualifiedReferences'))

    })

    it('notAssignToItself', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Field('a'),
            Field('b'),
            Method('m')(Assignment(Reference('a'), Reference('a')), Assignment(Reference('a'), Reference('b'))),
          )
        ),
      ] as PackageNode<'Filled'>[])


      const { notAssignToItself } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[2] as MethodNode<'Linked'>
      const bodyExample = methodExample.body as BodyNode<'Linked'>
      const assingnmentExample = bodyExample.sentences[0] as AssignmentNode<'Linked'>
      const assingnmentExample2 = bodyExample.sentences[1] as AssignmentNode<'Linked'>

      assert.ok(!!notAssignToItself(assingnmentExample, 'notAssignToItself'))
      assert.ok(!notAssignToItself(assingnmentExample2, 'notAssignToItself'))

    })


  })

  describe('Try', () => {

    it('Try has catch or always', () => {

      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Method('m')(Try([Reference('p')], { always: [] })),
            Method('m2')(
              Try([Reference('p')], {
                catches: [
                  Catch(Parameter('e'))(Reference('p')),
                ],
              })
            ),
            Method('m3')(
              Try([Reference('p')], {
                always: [Reference('p')],
              })
            )
          ),
        ),
      ] as PackageNode<'Filled'>[])

      const { hasCatchOrAlways } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[0] as MethodNode<'Linked'>
      const bodyExample = methodExample.body as BodyNode<'Linked'>
      const tryExample = bodyExample.sentences[0] as TryNode<'Linked'>

      const methodExample2 = classExample.members[1] as MethodNode<'Linked'>
      const bodyExample2 = methodExample2.body as BodyNode<'Linked'>
      const tryExample2 = bodyExample2.sentences[0] as TryNode<'Linked'>

      const methodExample3 = classExample.members[2] as MethodNode<'Linked'>
      const bodyExample3 = methodExample3.body as BodyNode<'Linked'>
      const tryExample3 = bodyExample3.sentences[0] as TryNode<'Linked'>

      assert.ok(!!hasCatchOrAlways(tryExample, 'hasCatchOrAlways'))
      assert.ok(!hasCatchOrAlways(tryExample2, 'hasCatchOrAlways'))
      assert.ok(!hasCatchOrAlways(tryExample3, 'hasCatchOrAlways'))

    })

  })

  describe('Parameters', () => {
    it('nameIsCamelCase', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Method('m', {
              parameters: [Parameter('C'), Parameter('k')],
            })()
          ),
        ),
      ] as PackageNode<'Filled'>[])

      const { nameIsCamelCase } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[0] as MethodNode<'Linked'>
      const parameterExample = methodExample.parameters[0] as ParameterNode<'Linked'>
      const parameterExample2 = methodExample.parameters[1] as ParameterNode<'Linked'>

      assert.ok(!!nameIsCamelCase(parameterExample, 'nameIsCamelCase'))
      assert.ok(!nameIsCamelCase(parameterExample2, 'nameIsCamelCase'))
    })
  })

  describe('Fields', () => {
    it('fieldNameDifferentFromTheMethods', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(
            Field('m'),
            Field('a'),
            Method('m')(),
          ),

        ),
      ] as PackageNode<'Filled'>[])

      const { fieldNameDifferentFromTheMethods } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const fieldExample = classExample.members[0] as FieldNode<'Linked'>
      const fieldExample2 = classExample.members[1] as FieldNode<'Linked'>

      assert.ok(!!fieldNameDifferentFromTheMethods(fieldExample, 'fieldNameDifferentFromTheMethods'))
      assert.ok(!fieldNameDifferentFromTheMethods(fieldExample2, 'fieldNameDifferentFromTheMethods'))

    })

    it('notAssignToItselfInVariableDeclaration', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(
            Field('v', {
              value: Reference('v'),
            }),
            Field('b', {
              value: Reference('a'),
            }),
            Field('a'),
          ),
        ),
      ] as PackageNode<'Filled'>[])

      const { notAssignToItselfInVariableDeclaration } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const fieldExample = classExample.members[0] as FieldNode<'Linked'>
      const fieldExample2 = classExample.members[1] as FieldNode<'Linked'>

      assert.ok(!!notAssignToItselfInVariableDeclaration(fieldExample, 'notAssignToItselfInVariableDeclaration'))
      assert.ok(!notAssignToItselfInVariableDeclaration(fieldExample2, 'notAssignToItselfInVariableDeclaration'))

    })

  })

  describe('Tests', () => {
    it('testIsNotEmpty', () => {
      const environment = link([
        WRE,
        Package('p')(
          Test('t')()
        ),
      ] as PackageNode<'Filled'>[])

      const { testIsNotEmpty } = validations(environment)
      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const testExample = packageExample.members[0] as TestNode<'Linked'>

      assert.ok(!!testIsNotEmpty(testExample, 'testIsNotEmpty'))
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

      const { notDuplicatedPackageName } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const packageExample2 = environment.members[3] as PackageNode<'Linked'>

      assert.ok(!!notDuplicatedPackageName(packageExample, 'duplicatedPackageName'))
      assert.ok(!notDuplicatedPackageName(packageExample2, 'duplicatedPackageName'))
    })*/
  })

  describe('Self', () => {
    it('selfIsNotInAProgram', () => {
      const environment = link([
        WRE,
        Package('p')(
          Program('pr')(
            Return(Self)
          ),
          Class('C')(
            Method('m')(Return(Self))
          )
        ),
      ] as PackageNode<'Filled'>[])

      const { selfIsNotInAProgram } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const programExample = packageExample.members[0] as ProgramNode<'Linked'>
      const selfExample = (programExample.body.sentences[0] as ReturnNode<'Linked'>).value as SelfNode<'Linked'>
      const classExample = (packageExample.members[1] as ClassNode<'Linked'>)
      const methodExample = classExample.members[0] as MethodNode<'Linked'>
      const selfExample2 = methodExample.body!.sentences[0] as SelfNode<'Linked'>

      assert.ok(!!selfIsNotInAProgram(selfExample, 'selfIsNotInAProgram'))
      assert.ok(!selfIsNotInAProgram(selfExample2, 'selfIsNotInAProgram'))
    })
  })

  describe('Send', () => {
    it('dontCompareAgainstTrueOrFalse', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(
            Field('d'),
            Method('m')(Return(Send(Reference('d'), '==', [Literal(true)])))
          )
        ),
      ] as PackageNode<'Filled'>[])

      const { dontCompareAgainstTrueOrFalse } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = (packageExample.members[0] as ClassNode<'Linked'>)
      const methodExample = classExample.members[1] as MethodNode<'Linked'>
      const sendExample = (methodExample.body!.sentences[0] as ReturnNode<'Linked'>).value as SendNode<'Linked'>
      assert.ok(!!dontCompareAgainstTrueOrFalse(sendExample, 'dontCompareAgainstTrueOrFalse'))
    })
  })

  describe('Super', () => {
    it('noSuperInConstructorBody', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(
            Constructor()(Super()),
            Method('m')(Super()),
          )
        ),
      ] as PackageNode<'Filled'>[])

      const { noSuperInConstructorBody } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = (packageExample.members[0] as ClassNode<'Linked'>)
      const constructorExample = classExample.members[0] as ConstructorNode<'Linked'>
      const superExample = constructorExample.body.sentences[0] as SuperNode<'Linked'>
      const method = classExample.members[1] as MethodNode<'Linked'>
      const superExample2 = method.body!.sentences[0] as SuperNode<'Linked'>

      assert.ok(!!noSuperInConstructorBody(superExample, 'noSuperInConstructorBody'))
      assert.ok(!noSuperInConstructorBody(superExample2, 'noSuperInConstructorBody'))
    })
  })

  describe('Return', () => {
    it('noReturnStatementInConstructor', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(
            Constructor()(Return(Literal('a'))),
            Method('m')(Return(Literal('a'))),
          )
        ),
      ] as PackageNode<'Filled'>[])

      const { noReturnStatementInConstructor } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = (packageExample.members[0] as ClassNode<'Linked'>)
      const constructorExample = classExample.members[0] as ConstructorNode<'Linked'>
      const returnExample = constructorExample.body.sentences[0] as ReturnNode<'Linked'>
      const method = classExample.members[1] as MethodNode<'Linked'>
      const returnExample2 = method.body!.sentences[0] as ReturnNode<'Linked'>

      assert.ok(!!noReturnStatementInConstructor(returnExample, 'noReturnStatementInConstructor'))
      assert.ok(!noReturnStatementInConstructor(returnExample2, 'noReturnStatementInConstructor'))
    })
  })
})