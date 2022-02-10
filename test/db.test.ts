import { should } from 'chai'
import { join } from 'path'
import { buildEnvironment } from './assertions'
import natives from '../src/wre/wre.natives'
import { Environment } from '../src'
import interpret from '../src/interpreter/interpreter'

should()

describe('DataBase', () => {

  describe('savings', () => {

    let environment: Environment

    before(async () => {
      environment = await buildEnvironment('**/*.wpgm', join('test', 'db'))
    })

    it('saveAndLoadPepita', () => {
      const interpreterForSaving = interpret(environment, natives)
      interpreterForSaving.run('savings.savePepitaCaso1')
      const interpreterForLoading = interpret(environment, natives)
      interpreterForLoading.run('savings.loadPepitaCaso1')
    })
  })
})