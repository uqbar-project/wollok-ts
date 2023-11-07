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

    describe('If', () => {
      it('full then and else body', () => {
        `program prueba {
          if(true){return 1}else{return 2}
        }`.should.be.formattedTo(`
        program prueba {
          if (true) {
            return 1
          } else {
            return 2
          }
        }`)
      })


      it('with no else body', () => {
        `program prueba {
          if(true){return 1}
        }`.should.be.formattedTo(`
        program prueba {
          if (true) {
            return 1
          }
        }`)
      })

      it('if expression short', () => {
        `program prueba {
          if(true)1    
          else      2
        }`.should.be.formattedTo(`
        program prueba {
          if (true) 1 else 2
        }`)
      })

      it('if expression long', () => {
        `program prueba {
          const pepita = object {
            method volar(param){}
          }
          if ("a very very very very very very very very long string".length() > 0)pepita.volar("a very very very very very very very very long argument")    else      2
        }`.should.be.formattedTo(`
        program prueba {
          const pepita = object {
            method volar(param) {
              
            }
          }
          if ("a very very very very very very very very long string".length() > 0)
            pepita.volar("a very very very very very very very very long argument")
          else 2
        }`)
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
          const pepita = object inherits A (n = 5) {
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
          const pepita = object inherits A (edad = 22, nombre = "Carlono") {
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
      }`)
    })

    it('testInheritingObjectDefinitionWithDefinitionItselfAfter', () => {
      `
          object        pepita  
                
                
                
      inherits                    
      Ave


                    { var energia = 0  
                    
                    
                    override            method volar() { energia    +=
      10 }          }


			class Ave{method volar() {}}

		`.should.be.formattedTo(`
      object pepita inherits Ave {
        var energia = 0
        
        override method volar() {
          energia += 10
        }
      }
      
      class Ave {
        method volar() {
          
        }
      }`)
    })

    it('testClassDefinitionWithVar', () => {
      `
      class          Ave {  
      
      
      var energia

                                                                 }`.should.be.formattedTo(`
      class Ave {
        var energia
      }`)
    })

    it('testBasicMixinDefinition', () => {
      `
          
             mixin           Volador {  
          
          
          var energia

              method volar(lugar) {energia             = 0 }}   
		  `.should.be.formattedTo(`
        mixin Volador {
          var energia
          
          method volar(lugar) {
            energia = 0
          }
        }`)
    })

    it('testBasicMixinUse', () => {
      ` 
             mixin           Volador {  
          
          
          var energia

              method volar(lugar) {energia             = 0 }} class Ave 
              
              inherits  
              
               Volador {
              	
              	method                 comer() { energia = 100
              	}
              }`.should.be.formattedTo(
          `
      mixin Volador {
        var energia
        
        method volar(lugar) {
          energia = 0
        }
      }
      
      class Ave inherits Volador {
        method comer() {
          energia = 100
        }
      }`)

    })

    it('testObjectInheritingNamedParametersForWKO', () => {
      `class Musico{var calidad}
              object luisAlberto inherits Musico (calidad
                
                
                
              = 
              8
                
                , 
                
                
                      cancionPreferida                      =
                "estrelicia"
              ) {

                var guitarra
              }`.should.be.formattedTo(`
      class Musico {
        var calidad
      }
      
      object luisAlberto inherits Musico (
        calidad = 8,
        cancionPreferida = "estrelicia"
      ) {
        var guitarra
      }`)
    })

    it('testClassDefinition', () => {
      `
         




        class Cancion {
          
          
          }`.should.be.formattedTo(`
      class Cancion {
        
      }`)
    })

    it('objectDefinition', () => {
      `
      class Musico{} object luisAlberto inherits Musico {

        var guitarra = null

        method cambiarGuitarra(_guitarra) {
          guitarra = _guitarra
        }

        override method habilidad() = 100.min(8 * guitarra.unidadesDeGuitarra())
        override method remuneracion(presentacion) = if (presentacion.participo(self)) self.costoPresentacion(presentacion) else 0

        method costoPresentacion(presentacion) = if (presentacion.fecha() < new Date(day = 01, month = 09, year = 2017)) {
          return 1000
        } else {
          return 1200
        }

        override method interpretaBien(cancion) = true

      }`.should.be.formattedTo(`
        class Musico {
          
        }
        
        object luisAlberto inherits Musico {
          var guitarra = null
          
          method cambiarGuitarra(_guitarra) {
            guitarra = _guitarra
          }
          
          override method habilidad() = 100.min(8 * guitarra.unidadesDeGuitarra())
          
          override method remuneracion(presentacion) = if (presentacion.participo(self))
                                                         self.costoPresentacion(
                                                           presentacion
                                                         )
                                                       else 0
          
          method costoPresentacion(presentacion) = if (presentacion.fecha() < new Date(
            day = 1,
            month = 9,
            year = 2017
          )) {
            return 1000
          } else {
            return 1200
          }
          
          override method interpretaBien(cancion) = true
        }`
        )
    })

    it('testPresentacion', () => {
      `class Presentacion {

        const fecha
        const locacion
        var participantes = []
      
        method fecha() = fecha
      
        method locacion() = locacion
      
        method participantes() = participantes
      
        method participo(musico) = participantes.contains(musico)
      
        method capacidad() = self.locacion().capacidadPorDia(fecha)
      
        method agregarParticipantes(persona) {
          if (participantes.contains(persona)) {
            self.error("La persona que se desea agregar ya pertence a la presentacion")
          } else {
            participantes.add(persona)
          }
        }
      
        method quitarParticipante(persona) {
          if (not        (participantes.isEmpty())) {
            if (participantes.contains(persona)) {
              participantes.remove(persona)
            } else {
              self.error("La persona que se desea quitar no era integrante de la presentacion")
            }
          } else {
            self.error("El conjunto de participantes esta vacio")
          }
        }
      
        method costoPresentacion() {
          var costo = 0
          self.participantes().forEach{ participante => costo += participante.remuneracion(self) }
          return costo
        }
      
      }`.should.be.formattedTo(`
      class Presentacion {
        const fecha
        const locacion
        var participantes = []
        
        method fecha() = fecha
        
        method locacion() = locacion
        
        method participantes() = participantes
        
        method participo(musico) = participantes.contains(musico)
        
        method capacidad() = self.locacion().capacidadPorDia(fecha)
        
        method agregarParticipantes(persona) {
          if (participantes.contains(persona)) self.error(
              "La persona que se desea agregar ya pertence a la presentacion"
            )
          else participantes.add(persona)
        }
        
        method quitarParticipante(persona) {
          if (participantes.isEmpty().negate()) if (participantes.contains(persona))
                                                  participantes.remove(persona)
                                                else self.error(
                                                    "La persona que se desea quitar no era integrante de la presentacion"
                                                  )
          else self.error("El conjunto de participantes esta vacio")
        }
        
        method costoPresentacion() {
          var costo = 0
          self.participantes().forEach(
            { participante => costo += participante.remuneracion(self) }
          )
          return costo
        }
      }`)
    })

    it('testObjectVarsInitialized', () => {
      `class Musico{}
      object luisAlberto inherits Musico {

        const valorFechaTope = 1200
        const valorFechaNoTope = 1000
        var guitarra = fender
        const initializedAsNullVar = null
        const uninitializedVar

        const fechaTope = new Date(day = 01, month = 09, year = 2017)

        override method habilidad() = (8 * guitarra.valor()).min(100)

        override method interpretaBien(cancion) = true

        method guitarra(_guitarra) {
          guitarra = _guitarra
        }

        method costo(presentacion) = if (presentacion.fecha() < fechaTope) valorFechaNoTope else valorFechaTope

      }`.should.be.formattedTo(`
      class Musico {
        
      }
      
      object luisAlberto inherits Musico {
        const valorFechaTope = 1200
        const valorFechaNoTope = 1000
        var guitarra = fender
        const initializedAsNullVar = null
        const uninitializedVar
        const fechaTope = new Date(day = 1, month = 9, year = 2017)
        
        override method habilidad() = (8 * guitarra.valor()).min(100)
        
        override method interpretaBien(cancion) = true
        
        method guitarra(_guitarra) {
          guitarra = _guitarra
        }
        
        method costo(presentacion) = if (presentacion.fecha() < fechaTope)
                                       valorFechaNoTope
                                     else valorFechaTope
      }`)
    })
  })
  describe('Methods Formatter', () => {
    it('testBasicFormattingInMethod', () => {
      `
      object        foo     {
      method bar(     param  ,  param2      ) {
      console.println("")
      console.println("")
      }
      }
		  `.should.be.formattedTo(`
      object foo {
        method bar(param, param2) {
          console.println("")
          console.println("")
        }
      }`)
    })

    it('testBasicFormattingSeveralMethods', () => {
      `
      object        foo     {
      method bar(     param  ,  param2      ) {
      console.println("")
      console.println("")
      }method bar2() { return 3 }


      method bar3() { assert.that(true)		var a = 1 + 1 console.println(a)}		
      }
      `.should.be.formattedTo(`
      object foo {
        method bar(param, param2) {
          console.println("")
          console.println("")
        }
        
        method bar2() = 3
        
        method bar3() {
          assert.that(true)
          var a = 1 + 1
          console.println(a)
        }
      }`)
    })

    it('testReturnMethod', () => {
      `
      object        foo     {
      method bar(     param  ,  param2      )     
      = 2 
      
            method      bar2()          =                                self.bar(1, "hola")
      }
      `.should.be.formattedTo(`
      object foo {
        method bar(param, param2) = 2
        
        method bar2() = self.bar(1, "hola")
      }`)
    })

    it('testOverrideMethod', () => {
      `
      class Parent        {
      method bar(     param  ,  param2      )     
      = 2 
      
            method      bar2()     {  
              
              return self.bar(1, "hola")
              }
      } class Child                     
        inherits       Parent{ var a = 0
                override method bar(param, param2) = super()
                
                + 10
                override method bar2() { a+=1        }   
      }
      `.should.be.formattedTo(`
      class Parent {
        method bar(param, param2) = 2
        
        method bar2() = self.bar(1, "hola")
      }
      
      class Child inherits Parent {
        var a = 0
        
        override method bar(param, param2) = super() + 10
        
        override method bar2() {
          a += 1
        }
      }`)
    })

    it('testNativeMethod', () => {
      `
      object        foo     {
      method bar(     param  ,  param2      )           native
      method bar2()
      
      
      native
      
      }
      `.should.be.formattedTo(`
      object foo {
        method bar(param, param2) native
        
        method bar2() native
      }`)
    })

    it('abstractMethods', () => {
      `class Vehicle {
          method numberOfPassengers()   method maxSpeed() 
          method expenseFor100Km() 
          method efficiency() {
              return        self.numberOfPassengers()      *     self.maxSpeed()     /       
              
              
              self.expenseFor100Km()
          } 
      }
      `.should.be.formattedTo(`
      class Vehicle {
        method numberOfPassengers()
        
        method maxSpeed()
        
        method expenseFor100Km()
        
        method efficiency() = (self.numberOfPassengers() * self.maxSpeed()) / self.expenseFor100Km()
      }`)
    })
  })
})