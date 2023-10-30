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
      `program prueba{    

             const pepita =         object{
            var energia  = 0
            method volar() { 
              energia+=1 }
        }        	
     }`.should.be.formattedTo(`
        program prueba {
          const pepita = object {
            var energia = 0
            
            method volar() {
              energia += 1
            }
          }
        }
    `)
    })
  })
})