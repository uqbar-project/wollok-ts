import { expect, should } from 'chai'
import { getMessage, LANGUAGES } from '../src'

should()

const MISSING_WOLLOK_TS_CLI = 'missing_wollok_ts_cli'
const EXAMPLE_WITH_VALUES = 'example'

const getCustomMessages = () => {
  const lspMessagesEn = {
    [MISSING_WOLLOK_TS_CLI]: 'Missing configuration WollokLSP/cli-path in order to run Wollok tasks',
    [EXAMPLE_WITH_VALUES]: '{0} needs a previous {1} installation',
  }
  const lspMessagesEs = {
    [MISSING_WOLLOK_TS_CLI]: 'Falta la configuración WollokLSP/cli-path para poder ejecutar tareas de Wollok',
    [EXAMPLE_WITH_VALUES]: '{0} debe tener instalado {1} previamente',
  }

  return {
    en: lspMessagesEn,
    es: lspMessagesEs,
  }
}

describe('message reporter', () => {
  describe('get message', () => {

    it('should convert a camel case english message into a human readable message', () => {
      expect(getMessage({ message: 'shouldConvertHumanReadableMessage' })).to.equal('Rule failure: Should convert human readable message')
    })

    it('should convert a camel case spanish message into a human readable message', () => {
      expect(getMessage({ message: 'shouldConvertHumanReadableMessage', language: LANGUAGES.SPANISH })).to.equal('La siguiente regla falló: Should convert human readable message')
    })

    it('should convert an existing english message into a human readable message', () => {
      expect(getMessage({ message: 'possiblyReturningBlock' })).to.equal('This method is returning a block, consider removing the \'=\' before curly braces.')
    })

    it('should convert an existing spanish message into a human readable message', () => {
      expect(getMessage({ message: 'possiblyReturningBlock', language: LANGUAGES.SPANISH })).to.equal('Este método devuelve un bloque, si no es la intención elimine el \'=\' antes de las llaves.')
    })

    it('should convert an existing english message with values into a human readable message', () => {
      expect(getMessage({ message: 'shouldPassValuesToAllAttributes', values: ['Ave', 'energia, calor'] })).to.equal('Ave cannot be instantiated, you must pass values to the following attributes: energia, calor')
    })

    it('should convert an existing spanish message with values into a human readable message', () => {
      expect(getMessage({ message: 'shouldPassValuesToAllAttributes', language: LANGUAGES.SPANISH, values: ['Ave', 'energia, calor'] })).to.equal('No se puede instanciar Ave. Falta pasar valores a los siguientes atributos: energia, calor')
    })

    it('should convert a custom english message into a human readable message', () => {
      expect(getMessage({ message: MISSING_WOLLOK_TS_CLI, customMessages: getCustomMessages() })).to.equal('Missing configuration WollokLSP/cli-path in order to run Wollok tasks')
    })

    it('should convert a custom spanish message into a human readable message', () => {
      expect(getMessage({ message: MISSING_WOLLOK_TS_CLI, customMessages: getCustomMessages(), language: LANGUAGES.SPANISH })).to.equal('Falta la configuración WollokLSP/cli-path para poder ejecutar tareas de Wollok')
    })

    it('should convert a custom english message with values into a human readable message', () => {
      expect(getMessage({ message: EXAMPLE_WITH_VALUES, customMessages: getCustomMessages(), values: ['wollok-lsp-ide', 'wollok-ts-cli'] })).to.equal('wollok-lsp-ide needs a previous wollok-ts-cli installation')
    })

    it('should convert a custom spanish message with values into a human readable message', () => {
      expect(getMessage({ message: EXAMPLE_WITH_VALUES, customMessages: getCustomMessages(), values: ['wollok-lsp-ide', 'wollok-ts-cli'], language: LANGUAGES.SPANISH })).to.equal('wollok-lsp-ide debe tener instalado wollok-ts-cli previamente')
    })

  })
})