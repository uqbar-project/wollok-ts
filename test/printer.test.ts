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
  describe('Methods formatter', () => {
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

    it('testClassFormattingOneLineMethod', () => {
      `class    Golondrina {    const    energia      =      10 
		
		
        const                  kmRecorridos= 0 method comer(gr) { energia = energia + gr } }`.should.be.formattedTo(`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
      }`)
    })

    it('testClassFormattingOneLineMethodStaysInNewLine', () => {
      `class Golondrina { const energia = 10 const kmRecorridos = 0 method comer(gr) { 
    		energia = energia + gr
    	} }`.should.be.formattedTo(`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
      }`)
    })

    it('keepNewlinesInSequences', () => {
      `object foo {
        method bar() {
          self.bar().bar().bar()
          
          console.println("") console.println("")
          
          console.println("") 
          console.println("")
        }
      }`.should.be.formattedTo( `
      object foo {
        method bar() {
          self.bar().bar().bar()
          console.println("")
          console.println("")
          console.println("")
          console.println("")
        }
      }`)
    })

    it('testClassFormattingOneLineMethodStaysInNewLine', () => {
      `class Golondrina { const energia = 10 const kmRecorridos = 0 method comer(gr) { 
    		energia = energia + gr
    	} }`.should.be.formattedTo (`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
      }`)
    })

    it('keepNewlinesInSequences', () => {
      `
      object foo {
        method bar() {
          self.bar().bar().bar()
          
          console.println("") console.println("")
          
          console.println("") 
          console.println("")
        }
      }`.should.be.formattedTo (`
      object foo {
        method bar() {
          self.bar().bar().bar()
          console.println("")
          console.println("")
          console.println("")
          console.println("")
        }
      }`)
    })

    // ToDo: Not parsable
    // it('messageSendParameters', () => {
    //   `program p {
    // 		const a = null

    // 		a . doSomething  ( a, a,    a , a ,  a   )
    // 		a ?. doSomething  ( a, a,    a , a ,  a   )
    // 		a ?. doSomething  ({=> a .doSomething()})
    // 	}`.should.be.formattedTo (`
    //   program p {
    //     const a = null
    //     a.doSomething(a, a, a, a, a)
    //     a?.doSomething(a, a, a, a, a)
    //     a?.doSomething({=> a.doSomething() })
    //   })`)
    // })


    it('listWithPreviousConflicts', () => {
      `
        class Presentacion {
        var fecha
        var musicos = []
        var lugar

        method fecha(_fecha) {
          fecha = _fecha
        }
        method lugar(_lugar) {
          lugar = _lugar
        }
        method agregarMusico(musico) {
          musicos.add(musico)
        }
        method eliminarMusicos() {
          musicos.clear()
        }
        method fecha() = fecha

        method lugarConcurrido() = lugar.capacidad(fecha) > 5000
        method tocaSolo(musico) = [ musico ] == musicos
        method costo() = musicos.sum{
          musico =>
            musico.precioPorPresentacion(self)
        }
      }		
		  `.should.be.formattedTo(`
      class Presentacion {
        var fecha
        var musicos = []
        var lugar
        
        method fecha(_fecha) {
          fecha = _fecha
        }
        
        method lugar(_lugar) {
          lugar = _lugar
        }
        
        method agregarMusico(musico) {
          musicos.add(musico)
        }
        
        method eliminarMusicos() {
          musicos.clear()
        }
        
        method fecha() = fecha
        
        method lugarConcurrido() = lugar.capacidad(fecha) > 5000
        
        method tocaSolo(musico) = [musico] == musicos
        
        method costo() = musicos.sum({ musico => musico.precioPorPresentacion(self) })
      }`)
    })


    it('testSuperInvocation', () => {
      `class   Ave { 
			
			
			var energia = 0
			method volar(minutos) { energia -= minutos}}
			class Golondrina {
				
				override method volar(minutos) {  super
				
				(minutos * ( 10 - 2 ) ) }        
      }`.should.be.formattedTo (`
      class Ave {
        var energia = 0
        
        method volar(minutos) {
          energia -= minutos
        }
      }
      
      class Golondrina {
        override method volar(minutos) {
          super(minutos * (10 - 2))
        }
      }`)
    })


    it('methodReturningValuesFromIfExpression', () => {
      `
			object luisAlberto inherits Musico (       valor
			
			 =    8) {
			
				var guitarra
			
				method guitarra() = guitarra
			
				method guitarra(_guitarra) {
					guitarra = _guitarra
				}
			
				override method costo(presentacion) {
					if (presentacion.dia() < ( new Date(day = 30, month = 9, year = 2017) )) {
						return 
						
						
						
						1000
					} else {
						return 1200
					}
				}
			
			}
			`.should.be.formattedTo(`
      object luisAlberto inherits Musico (valor = 8) {
        var guitarra
        
        method guitarra() = guitarra
        
        method guitarra(_guitarra) {
          guitarra = _guitarra
        }
        
        override method costo(presentacion) {
          if (presentacion.dia() < new Date(day = 30, month = 9, year = 2017)) {
            return 1000
          } else {
            return 1200
          }
        }
      }`)
    })

    it('testWithSeveralExpressions', () => {
      `
        class Presentacion {
        
          var escenario
          var dia
          var musicos = #{}
          var restricciones = #{}
        
          method agregarMusico(_musico) {
            restricciones.forEach{ restriccion => restriccion.aplica(_musico) }
            musicos.add(_musico)
            return self
          }
        }
        `.should.be.formattedTo(`
        class Presentacion {
          var escenario
          var dia
          var musicos = #{}
          var restricciones = #{}
          
          method agregarMusico(_musico) {
            restricciones.forEach({ restriccion => restriccion.aplica(_musico) })
            musicos.add(_musico)
            return self
          }
        }`)
    })
  })
  describe('Package definitions', () => {
    // ToDo: package???
    // it('testBasicPackageDefinition', () => {
    //   `
    //   package           aves


    //   {
    //           object        pepita     { var energia = 0  method volar() { energia    +=
    //   10 }
    //     }`.should.be.formattedTo(`
    //   package aves {
    //     object pepita {
    //       var energia = 0

    //       method volar() {
    //         energia += 10
    //       }
    //     }
    //   }`)
    // })

    it('testBasicImportDefinition', () => {
      `import wollok.   game.*
      import     pepita

			 program abc{
				game.addVisual(pepita)
				game.start()         pepita.vola(100)

			}
      `.should.be.formattedTo(`
      import wollok.game.*
      import pepita

      program abc {
        game.addVisual(pepita)
        game.start()
        pepita.vola(100)
      }`)
    })
  })
  describe('Program formatter', () => {
    it('testSimpleProgramWithVariablesAndMessageSend', () => {
      'program p { const a = 10 const b = 20 self.println(a + b) }'.should.be.formattedTo(`
      program p {
        const a = 10
        const b = 20
        self.println(a + b)
      }`)
    })
  })
  describe('Testing formatter', () => {
    it('testConstantsFormatting', () => {
      `const a = new Sobreviviente()
        
        
        const b = new Sobreviviente()
        test "aSimpleTest"{              assert.that(true)           }`.should.be.formattedTo( `
        const a = new Sobreviviente()
        
        const b = new Sobreviviente()
  
        test "aSimpleTest" {
          assert.that(true)
        }
      `)
    })


    it('testSimpleTestFormatting', () => {
      'test "aSimpleTest"{              assert.that(true)           }'.should.be.formattedTo (`
        test "aSimpleTest" {
          assert.that(true)
        }
      `)
    })

    it('severalTestsSimplesTestFormatting', () => {
      `test "aSimpleTest" {
              assert.that(true)
            } test "secondTest"
            
        {
            var text = "hola"
            
        assert.equals(4, text.length()       )		
        assert.equals(4    -     0, (   -   4)   .   inverted()       )
        }`.should.be.formattedTo( `
        test "aSimpleTest" {
          assert.that(true)
        }
        
        test "secondTest" {
          var text = "hola"
          assert.equals(4, text.length())
          assert.equals(4 - 0, (-4).inverted())
        }
      `)
    })

    it('testTestSeveralLinesFormatting', () => {
      `test "aSimpleTest"{assert.that(true) assert.notThat(false)
        
        const a = 1 assert.equals(  1 , a)
        assert.equals(a, a)
        }`.should.be.formattedTo (`
        test "aSimpleTest" {
          assert.that(true)
          assert.notThat(false)
          const a = 1
          assert.equals(1, a)
          assert.equals(a, a)
        }
      `)
    })

    it('testSimpleDescribeFormatting', () => {
      `describe            "group of tests" 
  { 
  
  
  test "aSimpleTest"
  {
  
  
  
  assert.that(true)}}`.should.be.formattedTo(`
        describe "group of tests" {
          test "aSimpleTest" {
            assert.that(true)
          }
        }`)
    })

    it('testSimpleDescribeFormatting2', () => {
      'describe            "group of tests"{test "aSimpleTest"{assert.that(true)}}'.should.be.formattedTo (`
        describe "group of tests" {
          test "aSimpleTest" {
            assert.that(true)
          }
        }`)
    })

    it('testSimpleDescribeWithInitializeMethod', () => {
      `describe            "group of tests" 
        { 
          var a method
        initialize() { a = 1 }
        
        test "aSimpleTest"
        {
        
        
        
        assert.equals(1, a)}}`.should.be.formattedTo(`
        describe "group of tests" {
          var a
          
          method initialize() {
            a = 1
          }
          
          test "aSimpleTest" {
            assert.equals(1, a)
          }
        }`)
    })

    it('testSimpleDescribeWithInitializeMethodInSeveralLines', () => {
      `describe            "group of tests" 
        { 
          var a var b var c           = 3
        method                   
        initialize() { 
          a = 1

          b = "hola"
                  }
        
        test "aSimpleTest"
        {
        
        
        
        assert.equals(1, a)
        
        
        assert.equals(b.length() - 1, c)
        }}
      `.should.be.formattedTo( `
        describe "group of tests" {
          var a
          var b
          var c = 3
          
          method initialize() {
            a = 1
            
            b = "hola"
          }
          
          test "aSimpleTest" {
            assert.equals(1, a)
            assert.equals(b.length() - 1, c)
          }
        }
        
      `)
    })

    it('testDescribeWithObjectDefinition', () => {
      `object foo { method bar() = 1 }describe            "group of tests" 
      { 
        var a  
        = foo.bar()
        
      test "aSimpleTest"
      {
      
      
      
      assert.equals(1, a)
      
      
       }}`.should.be.formattedTo (`
      object foo {
        method bar() = 1
      }
      
      describe "group of tests" {
        var a = foo.bar()
        
        test "aSimpleTest" {
          assert.equals(1, a)
        }
      }`)
    })

    it('testComplexInitializeDefinition', () => {
      `
      
      describe "tests - entrega 1" {
      
      var cisne
        var laFamilia var presentacionLunaPark         var presentacionLaTrastienda
      
        method initialize() {
          cisne = new Cancion(minutos = 312, letra = "Hoy el viento se abrió quedó vacío el aire una vez más y el manantial brotó y nadie está aquí y puedo ver que solo estallan las hojas al brillar")
          laFamilia = new Cancion(   minutos = 264,   letra   = "Quiero brindar por mi gente sencilla, por el amor brindo por la familia")
          presentacionLunaPark = new Presentacion()
          presentacionLunaPark.fecha(new Date(day = 20, month = 4, year = 2017))
          presentacionLunaPark.lugar(lunaPark)
          presentacionLunaPark.agregarMusico(luisAlberto)
          presentacionLunaPark.agregarMusico(joaquin)
          presentacionLunaPark.agregarMusico(lucia)
          presentacionLaTrastienda = new Presentacion()
          presentacionLaTrastienda.fecha(new Date(day = 15, month = 11, year = 2017))
          presentacionLaTrastienda.lugar(laTrastienda)    				presentacionLaTrastienda.agregarMusico(luisAlberto)
          presentacionLaTrastienda.agregarMusico(joaquin)
          presentacionLaTrastienda.agregarMusico(lucia)
        }
      
        test "habilidad de Joaquín en grupo" {
          assert.equals(25, joaquin.habilidad())
        }
      
  
  }
      `.should.be.formattedTo(`
        describe "tests - entrega 1" {
          var cisne
          var laFamilia
          var presentacionLunaPark
          var presentacionLaTrastienda
          
          method initialize() {
            cisne = new Cancion(
              minutos = 312,
              letra = "Hoy el viento se abrió quedó vacío el aire una vez más y el manantial brotó y nadie está aquí y puedo ver que solo estallan las hojas al brillar"
            )
            laFamilia = new Cancion(
              minutos = 264,
              letra = "Quiero brindar por mi gente sencilla, por el amor brindo por la familia"
            )
            presentacionLunaPark = new Presentacion()
            presentacionLunaPark.fecha(new Date(day = 20, month = 4, year = 2017))
            presentacionLunaPark.lugar(lunaPark)
            presentacionLunaPark.agregarMusico(luisAlberto)
            presentacionLunaPark.agregarMusico(joaquin)
            presentacionLunaPark.agregarMusico(lucia)
            presentacionLaTrastienda = new Presentacion()
            presentacionLaTrastienda.fecha(new Date(day = 15, month = 11, year = 2017))
            presentacionLaTrastienda.lugar(laTrastienda)
            presentacionLaTrastienda.agregarMusico(luisAlberto)
            presentacionLaTrastienda.agregarMusico(joaquin)
            presentacionLaTrastienda.agregarMusico(lucia)
          }
          
          test "habilidad de Joaquín en grupo" {
            assert.equals(25, joaquin.habilidad())
          }
        }`)
    })

    it('testUsingPreviousExpressions', () => {
      `
          test "La capacidad del Luna Park el 08 de agosot de 2017 es 9290" {
          
            var dia = new Date(              
            day = 08,                      month = 08, year = 2017)
          
               assert.equals(9290, lunaPark.capacidad(dia))
          }
          
             
        `.should.be.formattedTo(`
        test "La capacidad del Luna Park el 08 de agosot de 2017 es 9290" {
          var dia = new Date(day = 8, month = 8, year = 2017)
          assert.equals(9290, lunaPark.capacidad(dia))
        }`)
    })

    it('testAnotherInitializeWithComplexDefinition', () => {
      `
      describe "testDeMusicGuide" {
      
        // musicos
        var soledad
        var kike
        var lucia
        var joaquin
        // canciones
        const cisne = new Cancion(titulo = "Cisne", minutos    =   312,    letra    ="Hoy el viento se abrio quedo vacio el aire una vez mas y el manantial broto y nadie esta aqui y puedo ver que solo estallan las hojas al brillar")
        const laFamilia = new Cancion(titulo = "La Familia", minutos=264, letra      = "Quiero brindar por mi gente sencilla, por el amor brindo por la familia")
        const almaDeDiamante = new Cancion(titulo
        ="Alma de Diamante", 
        minutos=216, letra 
        = "Ven a mi con tu dulce luz alma de diamante. Y aunque el sol se nuble despues sos alma de diamante. Cielo o piel silencio o verdad sos alma de diamante. Por eso ven asi con la humanidad alma de diamante")
        const crisantemo = new Cancion(titulo="Crisantemo", minutos=175, letra="Tocame junto a esta pared, yo quede por aqui...cuando no hubo mas luz...quiero mirar a traves de mi piel...Crisantemo, que se abrio...encuentra el camino hacia el cielo")
        const eres = new Cancion(titulo="Eres",    minutos=145,    letra
        ="Eres lo mejor que me paso en la vida, no tengo duda, no habra mas nada despues de ti. Eres lo que le dio brillo al dia a dia, y asi sera por siempre, no cambiara, hasta el final de mis dias")
        const corazonAmericano = new Cancion(titulo
        ="Corazon Americano",minutos= 154, letra="Canta corazon, canta mas alto, que tu pena al fin se va marchando, el nuevo milenio ha de encontrarnos, junto corazon, como soiamos")
        const aliciaEnElPais = new Cancion(titulo="Cancion de Alicia en el pais", minutos=510, letra="Quien sabe Alicia, este pais no estuvo hecho porque si. Te vas a ir, vas a salir pero te quedas, ¿donde más vas a ir? Y es que aqui, sabes el trabalenguas, trabalenguas, el asesino te asesina, y es mucho para ti. Se acabo ese juego que te hacia feliz")
        const remixLaFamilia = new Remix(titulo =    laFamilia.nombre(), minutos
        =    
        laFamilia.duracion(), letra =laFamilia.letra())
        const mashupAlmaCrisantemo = new Mashup(titulo = "nombre", minutos = "duracion", letra = "letra", temas = [ almaDeDiamante, crisantemo ])
        // albumes
        const paraLosArboles = new Album(titulo = "Para los arboles", fecha = new Date(day = 31, month = 3, year = 2003), editados = 50000, vendidos = 49000).agregarCancion(cisne).agregarCancion(almaDeDiamante)
        const justCrisantemo = new Album(titulo = "Just Crisantemo", fecha = new Date(day=05, month=12, year=2007), editados = 28000, vendidos=27500).agregarCancion(crisantemo)
        const especialLaFamilia = new Album(titulo = "Especial La Familia", fecha = new Date(day = 17, month = 06, year = 1992), editados = 100000, vendidos = 89000).agregarCancion(laFamilia)
        const laSole = new Album(titulo = "La Sole", fecha = new Date(day = 04, month = 02, year = 2005), editados = 200000, vendidos = 130000).agregarCancion(eres).agregarCancion(corazonAmericano)
        // presentaciones
        var presentacionEnLuna
        var presentacionEnTrastienda
        // guitarras
        const fender = new Guitarra()
        const gibson = new Gibson() method
      
        initialize() {
          soledad = new VocalistaPopular().habilidad(55).palabraBienInterpretada("amor").agregarAlbum(laSole).agregarCancionDeSuAutoria(eres).agregarCancionDeSuAutoria(corazonAmericano)
          kike = new MusicoDeGrupo().habilidad(60).plusPorCantarEnGrupo(20)
          lucia = new VocalistaPopular().habilidad(70).palabraBienInterpretada("familia").grupo("Pimpinela")
          joaquin = new MusicoDeGrupo().habilidad(20).plusPorCantarEnGrupo(5).grupo("Pimpinela").agregarAlbum(especialLaFamilia).agregarCancionDeSuAutoria(laFamilia)
          luisAlberto.agregarGuitarra(fender).agregarGuitarra(gibson).agregarAlbum(paraLosArboles).agregarAlbum(justCrisantemo).agregarCancionDeSuAutoria(cisne).agregarCancionDeSuAutoria(almaDeDiamante).agregarCancionDeSuAutoria(crisantemo).cambiarGuitarraActiva(gibson)
          presentacionEnLuna = new Presentacion(lugar = lunaPark, fecha = new Date(day = 20, month = 04, year = 2017), artistas = [ joaquin, lucia, luisAlberto ])
          presentacionEnTrastienda = new Presentacion(lugar = laTrastienda, fecha =        new Date(day = 15,
          month
          = 11, year=2017), artistas =
          [ joaquin, lucia, luisAlberto ])
          pdpalooza.lugar(lunaPark).fecha(new Date(day = 15, month = 12, year =2017))
          restriccionPuedeCantarCancion.parametroRestrictivo(aliciaEnElPais)
        }
        
        test "fake" { assert.that(true) }
        }			
        `.should.be.formattedTo(`
        describe "testDeMusicGuide" {
        
          // musicos
          var soledad
          var kike
          var lucia
          var joaquin
          // canciones
          const cisne = new Cancion(
            titulo = "Cisne",
            minutos = 312,
            letra = "Hoy el viento se abrio quedo vacio el aire una vez mas y el manantial broto y nadie esta aqui y puedo ver que solo estallan las hojas al brillar"
          )
          const laFamilia = new Cancion(
            titulo = "La Familia",
            minutos = 264,
            letra = "Quiero brindar por mi gente sencilla, por el amor brindo por la familia"
          )
          const almaDeDiamante = new Cancion(
            titulo = "Alma de Diamante",
            minutos = 216,
            letra = "Ven a mi con tu dulce luz alma de diamante. Y aunque el sol se nuble despues sos alma de diamante. Cielo o piel silencio o verdad sos alma de diamante. Por eso ven asi con la humanidad alma de diamante"
          )
          const crisantemo = new Cancion(
            titulo = "Crisantemo",
            minutos = 175,
            letra = "Tocame junto a esta pared, yo quede por aqui...cuando no hubo mas luz...quiero mirar a traves de mi piel...Crisantemo, que se abrio...encuentra el camino hacia el cielo"
          )
          const eres = new Cancion(
            titulo = "Eres",
            minutos = 145,
            letra = "Eres lo mejor que me paso en la vida, no tengo duda, no habra mas nada despues de ti. Eres lo que le dio brillo al dia a dia, y asi sera por siempre, no cambiara, hasta el final de mis dias"
          )
          const corazonAmericano = new Cancion(
            titulo = "Corazon Americano",
            minutos = 154,
            letra = "Canta corazon, canta mas alto, que tu pena al fin se va marchando, el nuevo milenio ha de encontrarnos, junto corazon, como soiamos"
          )
          const aliciaEnElPais = new Cancion(
            titulo = "Cancion de Alicia en el pais",
            minutos = 510,
            letra = "Quien sabe Alicia, este pais no estuvo hecho porque si. Te vas a ir, vas a salir pero te quedas, ¿donde más vas a ir? Y es que aqui, sabes el trabalenguas, trabalenguas, el asesino te asesina, y es mucho para ti. Se acabo ese juego que te hacia feliz"
          )
          const remixLaFamilia = new Remix(
            titulo = laFamilia.nombre(),
            minutos = laFamilia.duracion(),
            letra = laFamilia.letra()
          )
          const mashupAlmaCrisantemo = new Mashup(
            titulo = "nombre",
            minutos = "duracion",
            letra = "letra",
            temas = [almaDeDiamante, crisantemo]
          )
          // albumes
          const paraLosArboles = new Album(
            titulo = "Para los arboles",
            fecha = new Date(day = 31, month = 3, year = 2003),
            editados = 50000,
            vendidos = 49000
          ).agregarCancion(cisne).agregarCancion(almaDeDiamante)
          const justCrisantemo = new Album(
            titulo = "Just Crisantemo",
            fecha = new Date(day = 5, month = 12, year = 2007),
            editados = 28000,
            vendidos = 27500
          ).agregarCancion(crisantemo)
          const especialLaFamilia = new Album(
            titulo = "Especial La Familia",
            fecha = new Date(day = 17, month = 6, year = 1992),
            editados = 100000,
            vendidos = 89000
          ).agregarCancion(laFamilia)
          const laSole = new Album(
            titulo = "La Sole",
            fecha = new Date(day = 4, month = 2, year = 2005),
            editados = 200000,
            vendidos = 130000
          ).agregarCancion(eres).agregarCancion(corazonAmericano)
          // presentaciones
          var presentacionEnLuna
          var presentacionEnTrastienda
          // guitarras
          const fender = new Guitarra()
          const gibson = new Gibson()
          
          method initialize() {
            soledad = new VocalistaPopular().habilidad(55).palabraBienInterpretada(
              "amor"
            ).agregarAlbum(laSole).agregarCancionDeSuAutoria(
              eres
            ).agregarCancionDeSuAutoria(corazonAmericano)
            kike = new MusicoDeGrupo().habilidad(60).plusPorCantarEnGrupo(20)
            lucia = new VocalistaPopular().habilidad(70).palabraBienInterpretada(
              "familia"
            ).grupo("Pimpinela")
            joaquin = new MusicoDeGrupo().habilidad(20).plusPorCantarEnGrupo(5).grupo(
              "Pimpinela"
            ).agregarAlbum(especialLaFamilia).agregarCancionDeSuAutoria(laFamilia)
            luisAlberto.agregarGuitarra(fender).agregarGuitarra(gibson).agregarAlbum(
              paraLosArboles
            ).agregarAlbum(justCrisantemo).agregarCancionDeSuAutoria(
              cisne
            ).agregarCancionDeSuAutoria(almaDeDiamante).agregarCancionDeSuAutoria(
              crisantemo
            ).cambiarGuitarraActiva(gibson)
            presentacionEnLuna = new Presentacion(
              lugar = lunaPark,
              fecha = new Date(day = 20, month = 4, year = 2017),
              artistas = [joaquin, lucia, luisAlberto]
            )
            presentacionEnTrastienda = new Presentacion(
              lugar = laTrastienda,
              fecha = new Date(day = 15, month = 11, year = 2017),
              artistas = [joaquin, lucia, luisAlberto]
            )
            pdpalooza.lugar(lunaPark).fecha(new Date(day = 15, month = 12, year = 2017))
            restriccionPuedeCantarCancion.parametroRestrictivo(aliciaEnElPais)
          }
          
          test "fake" {
            assert.that(true)
          }
        }`)


    })

    it('testDescribeWithMethodDefinition', () => {
      `describe "group of tests"              
        
        
        
        
        { method bar() = 1
        
        
        
        
        
        
        method bar2() {
          
          
          
          
          
          
          
          
          
          return 1} test "aSimpleTest"
      {
      
      
      
      assert.equals(       self.bar(), 
                self.bar2())
      
      
      }}
  
  
      `.should.be.formattedTo(`
      describe "group of tests" {
        method bar() = 1
        
        method bar2() = 1
        
        test "aSimpleTest" {
          assert.equals(self.bar(), self.bar2())
        }
      }`)
    })
  })
})