import { use, should } from 'chai'
import { printerAssertions } from './assertions'

use(printerAssertions)
should()

describe('Wollok Printer', () => {
  describe('Object definitions', () => {
    it('testBasicObjectDefinition', () => {
      `object        pepita     { var energia = 0  
            method volar() { energia    += 10 }     
      }     
		`.should.be.formattedTo(`
            object pepita {
              var energia = 0

              method volar() {
                  energia += 10
              }
            }`)
    })

    it('testBasicUnnamedObjectDefinition', () => {
      `program prueba {    

        const pepita = object      {var energia             =
        0
                method volar() {energia++ }
            }        	
     }`.should.be.formattedTo(`
        program prueba {
            const pepita = object {
            var energia = 0
            method volar() {
                energia++
            }
            }
        }
    `)
    })
  })


  it('Should format a WKO', () => {
    'object    a{ }'.should.be.formattedTo(`
        object a {
          
        }
    `)
  })
})