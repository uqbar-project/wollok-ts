// import { expect, should, use } from 'chai'
// import { restore } from 'sinon'
// import sinonChai from 'sinon-chai'
// import { Evaluation } from '../src'
// import { DirectedInterpreter, Interpreter } from '../src/interpreter/interpreter'
// import link from '../src/linker'
// import { Body, Class, Literal, Method, Package, ParameterizedType, Reference, Return, Send, Singleton } from '../src/model'


// use(sinonChai)
// should()

// const WRE = link([
//   new Package({
//     name: 'wollok',
//     members: [
//       new Package({
//         name: 'lang',
//         members: [
//           new Class({ name: 'Object', members: [new Method({ name: 'initialize', body: new Body() })] }),
//           new Class({ name: 'Boolean' }),
//           new Class({ name: 'Number' }),
//           new Class({ name: 'String' }),
//           new Class({ name: 'List' }),
//           new Class({ name: 'Set' }),
//           new Class({ name: 'EvaluationError', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Exception' }) })] }),
//           new Class({ name: 'Exception' }),
//         ],
//       }),
//     ],
//   }),
// ])


// describe('Wollok Interpreter', () => {

//   afterEach(restore)

//   describe('Interpreter', () => {

//     it('should be able to execute unlinked sentences', () => {
//       const environment = link([
//         new Package({
//           name:'p',
//           members: [
//             new Singleton({
//               name: 'o',
//               members: [
//                 new Method({
//                   name: 'm',
//                   body: new Body({
//                     sentences: [
//                       new Return({ value: new Literal({ value: 5 }) }),
//                     ],
//                   }),
//                 }),
//               ],
//             }),
//           ],
//         }),
//       ], WRE)

//       const sentence = new Send({ receiver: new Reference({ name: 'p.o' }), message: 'm' })
//       const interpreter = new Interpreter(Evaluation.build(environment, {}))

//         interpreter.exec(sentence)!.innerNumber!.should.equal(5)
//     })

//     it('should fail when executing a missing unlinked reference', () => {
//       const sentence = new Reference({ name: 'x' })
//       const interpreter = new Interpreter(Evaluation.build(WRE, {}))
//       expect(() => interpreter.exec(sentence)).to.throw(`Could not resolve unlinked reference to ${sentence.name}`)
//     })

//   })

//   describe('DirectedInterpreter', () => {

//     it('should stop at breakpoints', () => {
//       const breakpoint = new Literal({ value: 17 })
//       const expression = new Send({
//         message: '*',
//         receiver: new Literal({ value: 2 }),
//         args: [new Send({
//           message: '+',
//           receiver: breakpoint,
//           args: [new Literal({ value: 4 })],
//         })],
//       })

//       const interpreter = new DirectedInterpreter(Evaluation.build(WRE, {}))
//       const director = interpreter.exec(expression)
//       director.breakpoints.push(breakpoint)

//       const state = director.resume()


//       state.done.should.be.false
//       state.should.have.property('next').equal(breakpoint)
//     })

//   })

// })