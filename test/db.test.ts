import { should } from 'chai'
import { join } from 'path'
import { buildEnvironment } from './assertions'
import natives from '../src/wre/wre.natives'
import { Environment } from '../src'
import interpret from '../src/interpreter/interpreter'

should()

// TODO: Move the wollok code to language

describe('DataBase', () => {

  describe('savings', () => {

    let environment: Environment

    before(async () => {
      environment = await buildEnvironment('**/*.wpgm', join('test', 'db'))
    })

    it('saveAndLoadPepita', () => {
      const interpreterForSaving = interpret(environment, natives)
      interpreterForSaving.run('savings.savePepita')
      const interpreterForLoading = interpret(environment, natives)
      interpreterForLoading.run('savings.loadPepita')
    })
  })
})