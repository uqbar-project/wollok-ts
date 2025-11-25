
import { resolve } from 'path'
import { Environment, Execution, get, Natives, PROGRAM_FILE_EXTENSION, RuntimeObject } from '../src'
import { interpret, Interpreter } from '../src/interpreter/interpreter'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './utils'
import { beforeAll, beforeEach, describe, it, expect } from 'vitest'

describe('Wollok Game', () => {

  describe('actions', () => {

    let environment: Environment
    let interpreter: Interpreter
    const logs: string[] = []

    const mockNativeFunction = function* (_self: RuntimeObject, obj: RuntimeObject): Execution<void> {
      logs.push(obj.innerString!)
    }

    beforeAll(async () => {
      environment = await buildEnvironment(`**/*.${PROGRAM_FILE_EXTENSION}`, resolve('language', 'test', 'game'))
      const wConsole = get<Natives>(natives, 'wollok.lib.console')!
      wConsole.println = mockNativeFunction
    })

    beforeEach(() => {
      interpreter = interpret(environment, natives)
    })

    it('say set message and time to visual', () => {
      interpreter.run('actions.say')

      expect(
        interpreter.object('actions.visual').get('message')!.innerValue
      ).toBe('Hi!')

      expect(
        interpreter.object('actions.visual').get('messageTime')!.innerValue
      ).toBe(2000)
    })


    it('on DomainError, visual source says the message', () => {
      interpreter.run('actions.domainError')
      expect(interpreter.object('actions.visual').get('message')!.innerValue).toBe('DOMAIN_ERROR')
      expect(interpreter.object('actions.visual').get('messageTime')!.innerValue).toBe(2000)
    })

    it('on DomainError with error reporter, it says the message', () => {
      interpreter.run('actions.domainErrorWithReporter')
      expect(interpreter.object('actions.reporter').get('message')!.innerValue).toBe('DOMAIN_ERROR')
      expect(interpreter.object('actions.reporter').get('messageTime')!.innerValue).toBe(2000)
    })

    it('on Error, console should print stack trace', () => {
      interpreter.run('actions.genericError')
      expect(logs).toEqual([
        'wollok.lang.Exception: ERROR',
        '\tat actions.genericError [actions.wpgm:37]'])
    })

    it('with file name game (devil test)', () => {
      expect(() => interpreter.run('game.juego')).not.toThrow()
    })
  })
})