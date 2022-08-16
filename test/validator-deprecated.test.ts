// import { should, use } from 'chai'
// import { buildEnvironment } from '../src'
// import validate, { shouldNotBeEmpty, shouldNotCompareAgainstBooleanLiterals, shouldHaveCatchOrAlways, isNotWithin, methodShouldHaveDifferentSignature, shouldNotInstantiateAbstractClass, shouldNotOnlyCallToSuper, nameShouldBeginWithLowercase, nameShouldBeginWithUppercase, nameShouldNotBeKeyword, shouldNotAssignToItself, shouldNotAssignToItselfInDeclaration, onlyLastParameterCanBeVarArg, topLevelSingletonShouldHaveAName } from '../src/validator'
// import link from '../src/linker'
// import { Assignment,
//   Body,
//   Catch,
//   Class,
//   Field,
//   Literal,
//   Method,
//   New,
//   Package,
//   Parameter,
//   ParameterizedType,
//   Program,
//   Reference,
//   Return,
//   Self,
//   Send,
//   Singleton,
//   SourceMap,
//   Super,
//   Test,
//   Try } from '../src/model'
// import { validatorAssertions } from './assertions'

// use(validatorAssertions)
// should()

// // TODO: Remove all tests in favor of language implementation

// const WRE = new Package({
//   name: 'wollok',
//   members: [
//     new Package({
//       name: 'lang',
//       members: [
//         new Class({ name: 'Object' }),
//         new Class({ name: 'Closure' }),
//         new Package({ name: 'lib' }),
//       ],
//     }),
//   ],
// })

// describe('Wollok Validator', () => {

//   describe('Singleton', () => {
//     describe('Singleton is not unnamed', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p',
//           members: [
//             new Singleton({}),
//             new Singleton({ name: 's' }),
//           ],
//         }),
//       ])


//       const packageExample = environment.members[1]
//       const unnamedSingleton = packageExample.members[0]
//       const namedSingleton = packageExample.members[1]

//       it('should pass when singleton has a name', () => {
//         namedSingleton.should.pass(topLevelSingletonShouldHaveAName)
//       })

//       it('should not pass when singleton has no name', () => {
//         unnamedSingleton.should.not.pass(topLevelSingletonShouldHaveAName)
//       })
//     })
//   })

//   /*
//   describe('Imports', () => {

//     it('importHasNotLocalReference', () => {
//       const enviroment = link([
//         WRE,
//         Package('p', {
//           imports: [Import(Reference('c'))],
//         })(Package('c')()),
//       ])

//       const packageExample = enviroment.members[1] as PackageNode
//       const importExample = packageExample.imports[0]
// (enviroment)

//       assert.ok(!!importHasNotLocalReference(importExample, 'importHasNotLocalReference'))
//     })
//   })*/

//   describe('References', () => {
//     describe('Name is not a keyword', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p',
//           members: [
//             new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'program' }) })] }),
//             new Class({ name: 'C2', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'C' }) })] }),
//             new Class({ name: 'program' }),
//           ],
//         }),
//       ])


//       const packageExample = environment.members[1]
//       const classExample = packageExample.members[0] as Class
//       const referenceWithKeywordName = classExample.supertypes[0].reference

//       const classExample2 = packageExample.members[1] as Class
//       const referenceWithValidName = classExample2.supertypes[0].reference

//       it('should pass when name is not a keyword', () => {
//         referenceWithValidName.should.pass(nameShouldNotBeKeyword)
//       })

//       it('should not pass when name is a keyword', () => {
//         referenceWithKeywordName.should.not.pass(nameShouldNotBeKeyword)
//       })
//     })
//   })

//   describe('Classes', () => {

//     describe('Name is in Uppercase', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p',
//           members: [
//             new Class({ name: 'c' }),
//             new Class({ name: 'C' }),
//           ],
//         }),
//       ])

//       const packageExample = environment.members[1]
//       const classWithLowercaseName = packageExample.members[0]
//       const classWithUppercaseName = packageExample.members[1]


//       it('should pass when name begins with uppercase', () => {
//         classWithUppercaseName.should.pass(nameShouldBeginWithUppercase)
//       })

//       it('should not pass when name begins with lowercase', () => {
//         classWithLowercaseName.should.not.pass(nameShouldBeginWithUppercase)
//       })
//     })

//     describe('Methods have distinct signatures', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p',
//           members: [
//             new Class({
//               name: 'classExample',
//               members: [
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })] }),
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'd' })] }),
//               ],
//             }),
//             new Class({
//               name: 'classExample2',
//               members: [
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'a' })] }),
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'd' })] }),
//               ],
//             }),
//             new Class({
//               name: 'classExample3',
//               members: [
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' })] }),
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'q', isVarArg: true })] }),
//               ],
//             }),
//             new Class({
//               name: 'classExample4',
//               members: [
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'a' })] }),
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'a' }), new Parameter({ name: 'b' }), new Parameter({ name: 'q', isVarArg: true })] }),
//               ],
//             }),
//           ],
//         }),
//       ])

//       const packageExample = environment.members[1]
//       const classWithDuplicatedSignatures = packageExample.members[0] as Class
//       const classWithDistinctSignatures = packageExample.members[1] as Class
//       const classWithOverlappingVarArgSignature = packageExample.members[2] as Class
//       const classWithDistinctSignaturesAndVarArg = packageExample.members[3] as Class


//       it('should pass when there is a method with the same name and different arity', () => {
//         classWithDistinctSignatures.methods()[0].should.pass(methodShouldHaveDifferentSignature)
//       })

//       it('should pass when there is a method with the same name and cannot be called with the same amount of arguments', () => {
//         classWithDistinctSignaturesAndVarArg.methods()[0].should.pass(methodShouldHaveDifferentSignature)
//       })

//       it('should not pass when there is a method with the same name and arity', () => {
//         classWithDuplicatedSignatures.methods()[0].should.not.pass(methodShouldHaveDifferentSignature)
//       })

//       it('should not pass when there is a method with the same name and can be called with the same amount of arguments', () => {
//         classWithOverlappingVarArgSignature.methods()[0].should.not.pass(methodShouldHaveDifferentSignature)
//       })
//     })
//   })

//   describe('New', () => {

//     describe('Instantiation is not abstract class', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p',
//           members: [
//             new Class({
//               name: 'C',
//               members: [
//                 new Method({ name: 'm' }),
//               ],
//             }),
//             new Class({
//               name: 'C2',
//               members: [
//                 new Method({ name: 'm', body: new Body({ sentences: [new Literal({ value: 5 })] }) }),
//               ],
//             }),
//             new Test({
//               name: 't',
//               body: new Body({
//                 sentences: [
//                   new New({ instantiated: new Reference({ name: 'C' }) }),
//                 ],
//               }),
//             }),
//             new Test({
//               name: 't',
//               body: new Body({
//                 sentences: [
//                   new New({ instantiated: new Reference({ name: 'C2' }) }),
//                 ],
//               }),
//             }),
//           ],
//         }),
//       ])

//       const packageExample = environment.members[1]
//       const instantiationOfAbstractClass = (packageExample.members[2] as Test).body.sentences[0] as New
//       const instantiationOfConcreteClass = (packageExample.members[3] as Test).body.sentences[0] as New


//       it('should pass when instantiating a concrete class', () => {
//         instantiationOfConcreteClass.should.pass(shouldNotInstantiateAbstractClass)
//       })

//       it('should not pass when instantiating an abstract class', () => {
//         instantiationOfAbstractClass.should.not.pass(shouldNotInstantiateAbstractClass)
//       })
//     })
//   })

//   describe('Methods', () => {

//     describe('Only last parameter is var arg', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'q', isVarArg: true }), new Parameter({ name: 'p' })] }),
//                 new Method({ name: 'm2', parameters: [new Parameter({ name: 'c' }), new Parameter({ name: 'q', isVarArg: true })] }),
//               ],
//             }),
//           ],
//         }),
//       ])


//       const packageExample = environment.members[1]
//       const classExample = packageExample.members[0] as Class
//       const methodWithVarArgInSecondToLastParameter = classExample.members[0]
//       const methodWithVarArgInLastParameter = classExample.members[1]

//       it('should pass when only the last parameter is var arg', () => {
//         methodWithVarArgInLastParameter.should.pass(onlyLastParameterCanBeVarArg)
//       })

//       it('should not pass when a parameter that is not the last is var arg', () => {
//         methodWithVarArgInSecondToLastParameter.should.not.pass(onlyLastParameterCanBeVarArg)
//       })
//     })

//     describe('Body is not only a call to super', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Method({ name: 'm', body: new Body() }),
//               ],
//             }),
//             new Class({
//               name: 'C2', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'C' }) })], members: [
//                 new Method({ name: 'm', body: new Body({ sentences: [new Super()] }) }),
//               ],
//             }),
//           ],
//         })])


//       const packageExample = environment.members[1]
//       const classExample = packageExample.members[1] as Class
//       const methodWithOnlyCallToSuper = classExample.members[0]

//       it('should not pass when the method body is only a call to super', () => {
//         methodWithOnlyCallToSuper.should.not.pass(shouldNotOnlyCallToSuper)
//       })
//     })

//     describe('Methods with different signatures', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Method({ name: 'm', body: new Body() }),
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'param' })], body: new Body() }),
//               ],
//             }),
//           ],
//         }),
//       ])


//       const packageExample = environment.members[1]
//       const classExample = packageExample.members[0] as Class
//       const methodMNoParameter = classExample.members[0] as Method
//       const methodM1Parameter = classExample.members[1] as Method

//       it('should not confuse methods with different parameters', () => {
//         methodMNoParameter.should.pass(methodShouldHaveDifferentSignature)
//         methodM1Parameter.should.pass(methodShouldHaveDifferentSignature)
//       })
//     })

//   })

//   describe('Assignments', () => {

//     describe('Not assign to itself', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Field({ name: 'a', isConstant: false }),
//                 new Field({ name: 'b', isConstant: false }),
//                 new Method({
//                   name: 'm', body: new Body({
//                     sentences: [
//                       new Assignment({ variable: new Reference({ name: 'a' }), value: new Reference({ name: 'a' }) }),
//                       new Assignment({ variable: new Reference({ name: 'a' }), value: new Reference({ name: 'b' }) }),
//                     ],
//                   }),
//                 }),
//               ],
//             }),
//           ],
//         })])


//       const packageExample = environment.members[1]
//       const classExample = packageExample.members[0] as Class
//       const methodExample = classExample.members[2] as Method
//       const bodyExample = methodExample.body as Body
//       const selfAssignment = bodyExample.sentences[0]
//       const validAssignment = bodyExample.sentences[1]

//       it('should pass when not assigning to itself', () => {
//         validAssignment.should.pass(shouldNotAssignToItself)
//       })

//       it('should not pass when assigning to itself', () => {
//         selfAssignment.should.not.pass(shouldNotAssignToItself)
//       })
//     })
//   })

//   describe('Try', () => {

//     describe('Try has catch or always', () => {

//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C',
//               members: [
//                 new Method({
//                   name: 'm', body: new Body({
//                     sentences: [
//                       new Try({ body: new Body({ sentences: [new Reference({ name: 'p' })] }) }),
//                     ],
//                   }),
//                 }),
//                 new Method({
//                   name: 'm2', body: new Body({
//                     sentences: [
//                       new Try({
//                         body: new Body({ sentences: [new Reference({ name: 'p' })] }),
//                         catches: [
//                           new Catch({ parameter: new Parameter({ name: 'e' }), body: new Body({ sentences: [new Reference({ name: 'p' })] }) }),
//                         ],
//                       }),
//                     ],
//                   }),
//                 }),
//                 new Method({
//                   name: 'm3', body: new Body({
//                     sentences: [
//                       new Try({
//                         body: new Body({ sentences: [new Reference({ name: 'p' })] }),
//                         always: new Body({
//                           sentences: [
//                             new Reference({ name: 'p' }),
//                           ],
//                         }),
//                       }),
//                     ],
//                   }),
//                 }),
//               ],
//             }),
//           ],
//         }),
//       ])


//       const packageExample = environment.members[1] as Package
//       const classExample = packageExample.members[0] as Class
//       const methodExample = classExample.members[0] as Method
//       const bodyExample = methodExample.body as Body
//       const tryWithEmptyAlways = bodyExample.sentences[0]

//       const methodExample2 = classExample.members[1] as Method
//       const bodyExample2 = methodExample2.body as Body
//       const tryWithCatch = bodyExample2.sentences[0]

//       const methodExample3 = classExample.members[2] as Method
//       const bodyExample3 = methodExample3.body as Body
//       const tryWithAlways = bodyExample3.sentences[0]

//       it('should pass when try has catch', () => {
//         tryWithCatch.should.pass(shouldHaveCatchOrAlways)
//       })

//       it('should pass when try has always', () => {
//         tryWithAlways.should.pass(shouldHaveCatchOrAlways)
//       })

//       it('should not pass when try has an empty always', () => {
//         tryWithEmptyAlways.should.not.pass(shouldHaveCatchOrAlways)
//       })
//     })
//   })

//   describe('Parameters', () => {
//     describe('Name is lowercase', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Method({ name: 'm', parameters: [new Parameter({ name: 'C' }), new Parameter ({ name: 'k' })] }),
//               ],
//             }),
//           ],
//         }),
//       ])


//       const packageExample = environment.members[1] as Package
//       const classExample = packageExample.members[0] as Class
//       const methodExample = classExample.members[0] as Method
//       const uppercaseParameter = methodExample.parameters[0]
//       const lowercaseParameter = methodExample.parameters[1]

//       it('should pass when name is a lowercase letter', () => {
//         lowercaseParameter.should.pass(nameShouldBeginWithLowercase)
//       })

//       it('should not pass when name is an uppercase letter', () => {
//         uppercaseParameter.should.not.pass(nameShouldBeginWithLowercase)
//       })
//     })
//   })

//   describe('Fields', () => {

//     describe('Not assign to itself in variable declaration', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Field({ name: 'v', isConstant: false, value: new Reference({ name: 'v' }) }),
//                 new Field({ name: 'b', isConstant: false, value: new Reference({ name: 'v' }) }),
//                 new Field({ name: 'a', isConstant: false }),
//               ],
//             }),
//           ],
//         })])


//       const packageExample = environment.members[1] as Package
//       const classExample = packageExample.members[0] as Class
//       const declarationWithSelfAssignment = classExample.members[0]
//       const declarationWithoutSelfAssignment = classExample.members[1]

//       it('should pass when not self-assigning', () => {
//         declarationWithoutSelfAssignment.should.pass(shouldNotAssignToItselfInDeclaration)
//       })

//       it('should not pass when self-assigning', () => {
//         declarationWithSelfAssignment.should.not.pass(shouldNotAssignToItselfInDeclaration)
//       })
//     })
//   })

//   describe('Tests', () => {
//     describe('Test is not empty', () => {
//       const environment = link([
//         WRE,
//         new Package({ name: 'p', members: [new Test({ name: 't', body: new Body({ sourceMap: { covers: () => true, start: { offset: 0, line: 0, column: 0 }, end: { offset: 0, line: 0, column: 0 } } }) })] }
//         )])


//       const emptyTest = environment.getNodeByFQN<Test>('p.t')

//       it('should not pass when test is empty', () => {
//         emptyTest.body.should.not.pass(shouldNotBeEmpty)
//       })
//     })
//   })

//   describe('Packages', () => {
//     /*
//     it('duplicatedPackageName', () => {
//       const environment = link([
//         WRE,
//         new Package({name: 'p', members: [),
//         Package('p')(),
//         Package('c')(),
//       ])

//       const packageExample = environment.members[1] as PackageNode
//       const packageExample2 = environment.members[3] as PackageNode
//       assert.ok(!!notDuplicatedPackageName(packageExample, 'duplicatedPackageName'))
//       assert.ok(!notDuplicatedPackageName(packageExample2, 'duplicatedPackageName'))
//     })*/
//   })

//   describe('Self', () => {
//     describe('self is not in a program', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Program({
//               name: 'pr', body: new Body({
//                 sentences: [
//                   new Return({ value: new Self({ sourceMap: {} as SourceMap }) }),
//                 ],
//               }),
//             }),
//             new Class({
//               name: 'C', members: [
//                 new Method({
//                   name: 'm', body: new Body({
//                     sentences: [
//                       new Return({ value: new Self({ sourceMap: {} as SourceMap }) }),
//                     ],
//                   }),
//                 }),
//               ],
//             }),
//           ],
//         })])


//       const programExample = environment.getNodeByFQN<Program>('p.pr')
//       const selfInProgram = (programExample.body.sentences[0] as Return).value!
//       const classExample = environment.getNodeByFQN<Class>('p.C')
//       const methodExample = classExample.members[0] as Method
//       const selfInMethod = (methodExample.sentences()[0] as Return).value!

//       it('should pass when self is in a method', () => {
//         selfInMethod.should.pass(isNotWithin(Program))
//       })

//       it('should not pass when self is in a program', () => {
//         selfInProgram.should.not.pass(isNotWithin(Program))
//       })
//     })
//   })

//   describe('Send', () => {
//     describe('Do not compare against true or false', () => {
//       const environment = link([
//         WRE,
//         new Package({
//           name: 'p', members: [
//             new Class({
//               name: 'C', members: [
//                 new Field({ name: 'd', isConstant: false }),
//                 new Method({
//                   name: 'm', body: new Body({
//                     sentences: [
//                       new Return({
//                         value: new Send({
//                           receiver: new Reference({ name: 'd' }),
//                           message: '==',
//                           args: [new Literal({ value: true })],
//                         }),
//                       }),
//                     ],
//                   }),
//                 }),
//               ],
//             }),
//           ],
//         })])


//       const packageExample = environment.members[1] as Package
//       const classExample = packageExample.members[0] as Class
//       const methodExample = classExample.members[1] as Method
//       const comparisonAgainstTrue = (methodExample.sentences()[0] as Return).value as Send

//       it('should not pass when comparing against true literal', () => {
//         comparisonAgainstTrue.should.not.pass(shouldNotCompareAgainstBooleanLiterals)
//       })
//     })
//   })

//   describe('Wollok Core Library Health', () => {
//     const environment = buildEnvironment([])
//     const problems = validate(environment).map(
//       ({ code, node: { scope, ...node } }) => ({
//         code,
//         node,
//         line: node.sourceMap?.start.line,
//         offset: node.sourceMap?.start.offset,
//       })
//     )

//     it('should pass without validation errors', () => {
//       problems.should.deep.equal([], 'Wollok Core Libraries has errors: ' + JSON.stringify(problems))
//     })
//   })
// })