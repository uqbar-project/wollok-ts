import { use, should } from 'chai'
import { printerAssertions } from './assertions'

use(printerAssertions)
should()

describe('Wollok Printer', () => {
  describe('Basic expressions', () => {
    describe('Send', () => {
      it('Send long parameters', () => {
        `object pepita {
          method volar(a,b,c,d,e){}
  
          method prueba() {
            self.volar("aaaaaaaaaaaa", "bbbbbbbbbbb", "cccccccccc", "dddddddddd", "eeeeeeeeee")
          }
        }`.should.be.formattedTo(`
          object pepita {
            method volar(a, b, c, d, e) {
              
            }
            
            method prueba() {
              self.volar(
                "aaaaaaaaaaaa",
                "bbbbbbbbbbb",
                "cccccccccc",
                "dddddddddd",
                "eeeeeeeeee"
              )
            }
          }
        `)
      })
      it('Send short parameters', () => {
        `object pepita {
          method volar(a,b){}
  
          method prueba() {
            self.volar("aaaaaaaaaaaa",
            "bbbbbbbbbbb")
          }
        }`.should.be.formattedTo(`
          object pepita {
            method volar(a, b) {
              
            }
            
            method prueba() {
              self.volar("aaaaaaaaaaaa", "bbbbbbbbbbb")
            }
          }
        `)
      })
    })
  })
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

    it('testInheritingPositionalUnnamedObjectDefinition', () => {
      `
      class A { var _n = 0              }
          program prueba {    
            
  const pepita = object     inherits A(n= 
  
  5
  
  )
   {var energia             =
  0
      method volar() {energia+=1 }
    }        	
   }          
      `.should.be.formattedTo(`
        class A {
          var _n = 0
        }
  
        program prueba {
          const pepita = object inherits A(n = 5) {
            var energia = 0
            
            method volar() {
              energia += 1
            }
          }
        }
      `
        )
    })

    it('testInheritingNamedParametersUnnamedObjectDefinition', () => {

      `
      class A { var edad = 0 var nombre = ""}
          program prueba {    
            
  const pepita = object     inherits A( 
  
  
  
  edad = 22
  
  
  ,
  
  
  nombre
  
  
  =       
  "Carlono"
  )
   {var energia             =
  0
      method volar() {energia+=1 }
    }        	
   }          
      `.should.be.formattedTo(`
        class A {
          var edad = 0
          var nombre = ""
        }
  
        program prueba {
          const pepita = object inherits A(edad = 22, nombre = "Carlono") {
            var energia = 0
            
            method volar() {
              energia += 1
            }
          }
        }
      `
        )
    })

    it('testUnnamedObjectDefinitionInAnExpression', () => {
      `
          program prueba {    
  
  assert.equals(
  
  object { var energia
  = 0},                        object { 
    var energia = 0  
  var color = "rojo"     }
  )        	
   }`.should.be.formattedTo(`
        program prueba {
          assert.equals(
            object {
              var energia = 0
            },
            object {
              var energia = 0
              var color = "rojo"
            }
          )
        }`)
    })

    it('testInheritingPositionalParametersObjectDefinition', () => {
      `class Ave{}
        object pepita  
          inherits 
          Ave           { 
                    var energia = 0  
                          method volar() { energia    = energia +10 }  
        }        
		`.should.be.formattedTo(`
      class Ave {
        
      }

      object pepita inherits Ave {
        var energia = 0
        
        method volar() {
          energia += 10
        }
      }`)
    })

    it('classFormatting_oneLineBetweenVarsAndMethods', () => {
      `class Golondrina { 
    		const energia = 10 
    		const kmRecorridos = 0
            method comer(gr){energia=energia+gr} method jugar(){     return true      }}`.should.be.formattedTo(`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
        
        method jugar() = true
      }`)
    })

    it('testObjectDefinitionWithOneVariableOnly', () => {
      `
      object        pepita  {
      

          var        
          
          z   }
      `.should.be.formattedTo(`
        object pepita {
          var z
        }`)
    })

    it('testObjectDefinitionWithOneMethodOnly', () => {
      `
          object        pepita  
          

              { method volar() { return 2 }    }      
		`.should.be.formattedTo(`
      object pepita {
        method volar() = 2
      }`)
    })

    it('testClassDefinitionWithOneMethodOnly', () => {
      `
          class                 Ave  
          

              { method volar() { return 2 }  }`.should.be.formattedTo(`
        class Ave {
          method volar() = 2
        }`)
    })

    it('testInheritingObjectDefinitionWithDefinitionItself', () => {
      `class Ave{method volar() {}
				
			}
          object        pepita  
          
          
          
      inherits                    
      Ave


              { var energia = 0  
              
              
              override            method volar() { energia    +=
      10 }}`.should.be.formattedTo(`
      class Ave {
        method volar() {
          
        }
      }
      
      object pepita inherits Ave {
        var energia = 0
        
        override method volar() {
          energia += 10
        }
      }
			`)
    })
  })
})