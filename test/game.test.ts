// import { should } from 'chai'
// import { join } from 'path'
// import { buildEnvironment } from './assertions'
// import natives from '../src/wre/wre.natives'
// import { Environment } from '../src'
// import interpret from '../src/interpreter/interpreter'

// should()

// // TODO: Move the wollok code to language

// describe('Wollok Game', () => {

//   describe('actions', () => {

//     let environment: Environment

//     before(async () => {
//       environment = await buildEnvironment('**/*.wpgm', join('test', 'game'))
//     })

//     it('addVisual', () => {
//       const interpreter = interpret(environment, natives)
//       interpreter.run('actions.addVisual')
//       const visuals = interpreter.object('wollok.game.game').get('visuals')!.innerValue!
//       visuals.should.have.length(1)
//     })

//     it('removeVisual', () => {
//       const interpreter = interpret(environment, natives)
//       interpreter.run('actions.removeVisual')
//       const visuals = interpreter.object('wollok.game.game').get('visuals')!.innerValue!
//       visuals.should.have.length(0)
//     })

//     it('say', () => {
//       const interpreter = interpret(environment, natives)
//       interpreter.run('actions.say')
//       interpreter.object('actions.visual').get('message')!.innerValue!.should.equal('Hi!')
//       interpreter.object('actions.visual').get('messageTime')!.innerValue!.should.equal(2000)
//     })

//     it('clear', () => {
//       const interpreter = interpret(environment, natives)
//       interpreter.run('actions.clear')
//       const visuals = interpreter.object('wollok.game.game')!.get('visuals')!.innerValue!
//       visuals.should.have.length(0)
//     })

//     it('flush event', () => {
//       const interpreter = interpret(environment, natives)
//       const gameMirror = interpreter.object('wollok.gameMirror.gameMirror')!
//       const time = interpreter.reify(1)
//       interpreter.send('flushEvents', gameMirror, time)
//     })
//   })
// })