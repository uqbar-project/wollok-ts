
import { buildEnvironment, print } from '../src'
import { describe, it, expect } from 'vitest'

describe('Wollok Printer', () => {

  it('aborts on malformed nodes', () => {
    expect(() => print(buildEnvironment([{
      name: 'formatted', content: `object pepita {
      var energia =
      method tieneEnergia() = energia > 50
      }`,
    }]).getNodeByFQN('formatted'), {
      abbreviateAssignments: true,
      maxWidth: 80,
      useSpaces: true,
    })).to.throw('Failed to print, found malformed node')
  })

  describe('Basic expressions', () => {
    describe('Send', () => {
      it('Send long parameters', () => {
        expect(`object pepita {
          method volar(a,b,c,d,e){}
  
          method prueba() {
            self.volar("aaaaaaaaaaaa", "bbbbbbbbbbb", "cccccccccc", "dddddddddd", "eeeeeeeeee")
          }
        }`).formattedTo(`
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
        expect(`object pepita {
          method volar(a,b){}
  
          method prueba() {
            self.volar("aaaaaaaaaaaa",
            "bbbbbbbbbbb")
          }
        }`).formattedTo(`
          object pepita {
            method volar(a, b) {
              
            }
            
            method prueba() {
              self.volar("aaaaaaaaaaaa", "bbbbbbbbbbb")
            }
          }
        `)
      })
      it('Prefix operator', () => {
        expect(`object pepita {
          method prueba() {
            return not(!false && false.negate()) && (-1 < +2)
          }
        }`).formattedTo(`
          object pepita {
            method prueba() = (not ((!false) && false.negate())) && ((-1) < (+2))
          }
        `)
      })
    })

    describe('If', () => {
      it('full then and else body', () => {
        expect(`program prueba {
          if(true){return 1}else{return 2}
        }`).formattedTo(`
        program prueba {
          if (true) {
            return 1
          } else {
            return 2
          }
        }`)
      })

      it('with no else body', () => {
        expect(`program prueba {
          if(true){return 1}
        }`).formattedTo(`
        program prueba {
          if (true) {
            return 1
          }
        }`)
      })

      it('if expression short', () => {
        expect(`program prueba {
          if(true)1    
          else      2
        }`).formattedTo(`
        program prueba {
          if (true) 1 else 2
        }`)
      })

      it('if expression long', () => {
        expect(`program prueba {
          const pepita = object {
            method volar(param){}
          }
          if ("a very very very very very very very very long string".length() > 0)pepita.volar("a very very very very very very very very long argument")    else      2
        }`).formattedTo(`
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

    describe('Comments', () => {
      it('single line comment', () => {
        expect(`program prueba {
          // comentario
          const a = 1 // other comment but this comment is actually very veeeeeeeeeeeeery veeeeeeeeeery long
          const b = 2
          // last comentario
        }`).formattedTo(`
        program prueba {
          // comentario
          const a = 1
          // other comment but this comment is actually very veeeeeeeeeeeeery veeeeeeeeeery long
          const b = 2 // last comentario
        }`)
      })

      it('comments on send', () => {
        expect(`program prueba {
          // ok
          5.even() // ok
        }`).formattedTo(`
        program prueba {
          // ok
          5.even() // ok
        }`)
      })

      it('many comments', () => {
        expect(`program prueba {
          // comentario
          // comentario
          const a = 1
        }`).formattedTo(`
        program prueba {
          // comentario
          // comentario
          const a = 1
        }`)
      })

      //ToDo smarter trimming
      it('multi line comments', () => {
        expect(`program prueba {
          /* comentario
           comentario */
          const a = 1
        }`).formattedTo(`
        program prueba {
          /* comentario
          comentario */
          const a = 1
        }`)
      })

      it('side comment', () => {
        expect(`program prueba {
          const a = 1 // comentario
          }`).formattedTo(`
          program prueba {
            const a = 1 // comentario
          }`)
      })

      it.skip('comment on a list', () => {
        expect(`program prueba {
          const a = [1
            ,2//comment on a lista
            ,3]
          }`).formattedTo(`
          program prueba {
            const a = [
              1,
              2, //comment on a lista
              3
            ]
          }`)
      })
    })

    describe('Test', () => {
      it('only test', () => {
        expect('only test "aSimpleTest"{assert.that(true)} test "anotherTest" {assert.that(true)}').formattedTo(`
        only test "aSimpleTest" {
          assert.that(true)
        }

        test "anotherTest" {
          assert.that(true)
        }`)
      })
    })
  })

  describe('Object', () => {
    it('testBasicObjectDefinition', () => {
      expect(`object        pepita     { var energia = 0  
            method volar() { energia    += 10 }     
      }     
		`).formattedTo(`
            object pepita {
              var energia = 0
              
              method volar() {
                energia += 10
              }
            }`)
    })

    it('testBasicUnnamedObjectDefinition', () => {
      expect(`program prueba{    

             const pepita =         object{
            var energia  = 0
            method volar() { 
              energia+=1 }
        }        	
     }`).formattedTo(`
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
      expect(`
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
      `).formattedTo(`
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

      expect(`
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
      `).formattedTo(`
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
      expect(`
          program prueba {    
  
  assert.equals(
  
  object { var energia
  = 0},                        object { 
    var energia = 0  
  var color = "rojo"     }
  )        	
   }`).formattedTo(`
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
      expect(`class Ave{}
        object pepita  
          inherits 
          Ave           { 
                    var energia = 0  
                          method volar() { energia    = energia +10 }  
        }        
		`).formattedTo(`
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
      expect(`class Golondrina { 
    		const energia = 10 
    		const kmRecorridos = 0
            method comer(gr){energia=energia+gr} method jugar(){     return true      }}`).formattedTo(`
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
      expect(`
      object        pepita  {
      

          var        
          
          z   }
      `).formattedTo(`
        object pepita {
          var z
        }`)
    })

    it('testObjectDefinitionWithOneMethodOnly', () => {
      expect(`
          object        pepita  
          

              { method volar() { return 2 }    }      
		`).formattedTo(`
      object pepita {
        method volar() = 2
      }`)
    })

    it('testClassDefinitionWithOneMethodOnly', () => {
      expect(`
          class                 Ave  
          

              { method volar() { return 2 }  }`).formattedTo(`
        class Ave {
          method volar() = 2
        }`)
    })

    it('testInheritingObjectDefinitionWithDefinitionItself', () => {
      expect(`class Ave{method volar() {}
				
			}
          object        pepita  
          
          
          
      inherits                    
      Ave

              { var energia = 0  
              
              
              override            method volar() { energia    +=
      10 }}`).formattedTo(`
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
      expect(`
          object        pepita  
                
                
                
      inherits                    
      Ave

                    { var energia = 0  
                    
                    
                    override            method volar() { energia    +=
      10 }          }

			class Ave{method volar() {}}

		`).formattedTo(`
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
      expect(`
      class          Ave {  
      
      
      var energia

                                                                 }`).formattedTo(`
      class Ave {
        var energia
      }`)
    })

    it('testBasicMixinDefinition', () => {
      expect(`
          
             mixin           Volador {  
          
          
          var energia

              method volar(lugar) {energia             = 0 }}   
		  `).formattedTo(`
        mixin Volador {
          var energia
          
          method volar(lugar) {
            energia = 0
          }
        }`)
    })

    it('testBasicMixinUse', () => {
      expect(` 
             mixin           Volador {  
          
          
          var energia

              method volar(lugar) {energia             = 0 }} class Ave 
              
              inherits  
              
               Volador {
              	
              	method                 comer() { energia = 100
              	}
              }`).formattedTo(
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
      expect(`class Musico{var calidad}
              object luisAlberto inherits Musico (calidad
                
                
                
              = 
              8
                
                , 
                
                
                      cancionPreferida                      =
                "estrelicia"
              ) {

                var guitarra
              }`).formattedTo(`
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
      expect(`
         

        class Cancion {
          
          
          }`).formattedTo(`
      class Cancion {
        
      }`)
    })

    it('objectDefinition', () => {
      expect(`
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

      }`).formattedTo(`
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
      expect(`class Presentacion {

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
          if (!        (participantes.isEmpty())) {
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
      
      }`).formattedTo(`
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
          if (!participantes.isEmpty()) {
            if (participantes.contains(persona)) participantes.remove(persona)
            else self.error(
                "La persona que se desea quitar no era integrante de la presentacion"
              )
          } else {
            self.error("El conjunto de participantes esta vacio")
          }
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
      expect(`class Musico{}
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

      }`).formattedTo(`
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

  describe('Methods', () => {
    it('testBasicFormattingInMethod', () => {
      expect(`
      object        foo     {
      method bar(     param  ,  param2      ) {
      console.println("")
      console.println("")
      }
      }`).formattedTo(`
      object foo {
        method bar(param, param2) {
          console.println("")
          console.println("")
        }
      }`)
    })

    it('testBasicFormattingSeveralMethods', () => {
      expect(`
      object        foo     {
      method bar(     param  ,  param2      ) {
      console.println("")
      console.println("")
      }method bar2() { return 3 }

      method bar3() { assert.that(true)		var a = 1 + 1 console.println(a)}		
      }`).formattedTo(`
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
      expect(`
      object        foo     {
      method bar(     param  ,  param2      )     
      = 2 
      
            method      bar2()          =                                self.bar(1, "hola")
      }`).formattedTo(`
      object foo {
        method bar(param, param2) = 2
        
        method bar2() = self.bar(1, "hola")
      }`)
    })

    it('testOverrideMethod', () => {
      expect(`
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
      }`).formattedTo(`
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
      expect(`
      object        foo     {
      method bar(     param  ,  param2      )           native
      method bar2()
      
      
      native
      
      }`).formattedTo(`
      object foo {
        method bar(param, param2) native
        
        method bar2() native
      }`)
    })

    it('abstractMethods', () => {
      expect(`class Vehicle {
          method numberOfPassengers()   method maxSpeed() 
          method expenseFor100Km() 
          method efficiency() {
              return        self.numberOfPassengers()      *     self.maxSpeed()     /       
              
              
              self.expenseFor100Km()
          } 
      }`).formattedTo(`
      class Vehicle {
        method numberOfPassengers()
        
        method maxSpeed()
        
        method expenseFor100Km()
        
        method efficiency() = (self.numberOfPassengers() * self.maxSpeed()) / self.expenseFor100Km()
      }`)
    })

    it('testClassFormattingOneLineMethod', () => {
      expect(`class    Golondrina {    const    energia      =      10 
		
		
        const                  kmRecorridos= 0 method comer(gr) { energia = energia + gr } }`).formattedTo(`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
      }`)
    })

    it('testClassFormattingOneLineMethodStaysInNewLine', () => {
      expect(`class Golondrina { const energia = 10 const kmRecorridos = 0 method comer(gr) { 
    		energia = energia + gr
    	} }`).formattedTo(`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
      }`)
    })

    it('keepNewlinesInSequences', () => {
      expect(`object foo {
        method bar() {
          self.bar().bar().bar()
          
          console.println("") console.println("")
          
          console.println("") 
          console.println("")

        }
      }`).formattedTo( `
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
      expect(`class Golondrina { const energia = 10 const kmRecorridos = 0 method comer(gr) { 
    		energia = energia + gr
    	} }`).formattedTo(`
      class Golondrina {
        const energia = 10
        const kmRecorridos = 0
        
        method comer(gr) {
          energia += gr
        }
      }`)
    })

    it('keepNewlinesInSequences', () => {
      expect(`
      object foo {
        method bar() {
          self.bar().bar().bar()
          
          console.println("") console.println("")
          
          console.println("") 
          console.println("")
        }
      }`).formattedTo(`
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

    it('messageSendParameters', () => {
      expect(`program p {
    		const a = null

    		a . doSomething  ( a, a,    a , a ,  a   )
    		a. doSomething  ( a, a,    a , a ,  a   )
    		a. doSomething  ({=> a .doSomething()})
    	}`).formattedTo(`
        program p {
        const a = null
        
        a.doSomething(a, a, a, a, a)
        a.doSomething(a, a, a, a, a)
        a.doSomething({ a.doSomething() })
      }`)
    })

    it('listWithPreviousConflicts', () => {
      expect(`
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
		  `).formattedTo(`
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
      expect(`class   Ave { 
			
			
			var energia = 0
			method volar(minutos) { energia -= minutos}}
			class Golondrina {
				
				override method volar(minutos) {  super
				
				(minutos * ( 10 - 2 ) ) }        
      }`).formattedTo(`
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
      expect(`
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
			`).formattedTo(`
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
      expect(`
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
        `).formattedTo(`
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

  describe('Package', () => {
    it('testBasicPackageDefinition', () => {
      expect(`
      package           aves

      {
              object        pepita     { var energia = 0  method volar() { energia    +=
      10 }}
        }`).formattedTo(`
      package aves {
        object pepita {
          var energia = 0
          
          method volar() {
            energia += 10
          }
        }
      }`)
    })

    it('testBasicImportDefinition', () => {
      expect(`import wollok.   game.*
      import     pepita

			 program abc{
				game.addVisual(pepita)
				game.start()         pepita.vola(100)

			}
      `).formattedTo(`
      import wollok.game.*
      import pepita

      program abc {
        game.addVisual(pepita)
        game.start()
        pepita.vola(100)
      }`)
    })
  })

  describe('Program', () => {
    it('testSimpleProgramWithVariablesAndMessageSend', () => {
      expect('program p { const a = 10 const b = 20 self.println(a + b) }').formattedTo(`
      program p {
        const a = 10
        const b = 20
        self.println(a + b)
      }`)
    })

    it('testSimpleProgramWithSpacesBetweenSends', () => {
      expect(`program p {
        self.println(1)
        self.println(2)

        self.println(3)

        self.println(4)
      }`).formattedTo(`
      program p {
        self.println(1)
        self.println(2)
        
        self.println(3)
        
        self.println(4)
      }`)
    })
  })

  describe('Testing', () => {
    it('testConstantsFormatting', () => {
      expect(`const a = new Sobreviviente()
        
        
        const b = new Sobreviviente()
        test "aSimpleTest"{              assert.that(true)           }`).formattedTo( `
        const a = new Sobreviviente()
        
        const b = new Sobreviviente()
  
        test "aSimpleTest" {
          assert.that(true)
        }
      `)
    })

    it('testSimpleTestFormatting', () => {
      expect('test "aSimpleTest"{              assert.that(true)           }').formattedTo(`
        test "aSimpleTest" {
          assert.that(true)
        }
      `)
    })

    it('severalTestsSimplesTestFormatting', () => {
      expect(`test "aSimpleTest" {
              assert.that(true)
            } test "secondTest"
            
        {
            var text = "hola"
            
        assert.equals(4, text.length()       )		
        assert.equals(4    -     0, (   -   4)   .   inverted()       )
        }`).formattedTo( `
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
      expect(`test "aSimpleTest"{assert.that(true) assert.notThat(false)
        
        const a = 1 assert.equals(  1 , a)
        assert.equals(a, a)
        }`).formattedTo(`
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
      expect(`describe            "group of tests" 
  { 
  
  
  test "aSimpleTest"
  {
  
  
  
  assert.that(true)}}`).formattedTo(`
        describe "group of tests" {
          test "aSimpleTest" {
            assert.that(true)
          }
        }`)
    })

    it('testSimpleDescribeFormatting2', () => {
      expect('describe            "group of tests"{test "aSimpleTest"{assert.that(true)}}').formattedTo(`
        describe "group of tests" {
          test "aSimpleTest" {
            assert.that(true)
          }
        }`)
    })

    it('testSimpleDescribeWithInitializeMethod', () => {
      expect(`describe            "group of tests" 
        { 
          var a method
        initialize() { a = 1 }
        
        test "aSimpleTest"
        {
        
        
        
        assert.equals(1, a)}}`).formattedTo(`
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
      expect(`describe            "group of tests" 
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
      `).formattedTo( `
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
      expect(`object foo { method bar() = 1 }describe            "group of tests" 
      { 
        var a  
        = foo.bar()
        
      test "aSimpleTest"
      {
      
      
      
      assert.equals(1, a)
      
      
       }}`).formattedTo(`
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
      expect(`
      
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
      `).formattedTo(`
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
      expect(`
          test "La capacidad del Luna Park el 08 de agosto de 2017 es 9290" {
          
            var dia = new Date(              
            day = 08,                      month = 08, year = 2017)
          
               assert.equals(9290, lunaPark.capacidad(dia))
          }
          
             
        `).formattedTo(`
        test "La capacidad del Luna Park el 08 de agosto de 2017 es 9290" {
          var dia = new Date(day = 8, month = 8, year = 2017)
          
          assert.equals(9290, lunaPark.capacidad(dia))
        }`)
    })

    it('testAnotherInitializeWithComplexDefinition', () => {
      expect(`
      describe "testDeMusicGuide" {
      
        var soledad
        var kike
        var lucia
        var joaquin
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
        const paraLosArboles = new Album(titulo = "Para los arboles", fecha = new Date(day = 31, month = 3, year = 2003), editados = 50000, vendidos = 49000).agregarCancion(cisne).agregarCancion(almaDeDiamante)
        const justCrisantemo = new Album(titulo = "Just Crisantemo", fecha = new Date(day=05, month=12, year=2007), editados = 28000, vendidos=27500).agregarCancion(crisantemo)
        const especialLaFamilia = new Album(titulo = "Especial La Familia", fecha = new Date(day = 17, month = 06, year = 1992), editados = 100000, vendidos = 89000).agregarCancion(laFamilia)
        const laSole = new Album(titulo = "La Sole", fecha = new Date(day = 04, month = 02, year = 2005), editados = 200000, vendidos = 130000).agregarCancion(eres).agregarCancion(corazonAmericano)
        var presentacionEnLuna
        var presentacionEnTrastienda
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
      `).formattedTo(`
        describe "testDeMusicGuide" {
          var soledad
          var kike
          var lucia
          var joaquin
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
          var presentacionEnLuna
          var presentacionEnTrastienda
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
      expect(`describe "group of tests"              
        
        
        
        
        { method bar() = 1
        
        
        
        
        
        
        method bar2() {
          
          
          
          
          
          
          
          
          
          return 1} test "aSimpleTest"
      {
      
      
      
      assert.equals(       self.bar(), 
                self.bar2())
      
      
      }}
  
  
      `).formattedTo(`
      describe "group of tests" {
        method bar() = 1
        
        method bar2() = 1
        
        test "aSimpleTest" {
          assert.equals(self.bar(), self.bar2())
        }
      }`)
    })
  })

  describe('Variables', () => {
    it('testSeveralVariableDefinitionsToConstantsInMethods', () => {
      expect(`
      class Foo {
        var x var y var z		
        method addition() { var   a    =    x x   =     1         y   = 2 z=x+y	}
      }`).formattedTo (`
      class Foo {
        var x
        var y
        var z
        
        method addition() {
          var a = x
          x = 1
          y = 2
          z = x + y
        }
      }`)
    })

    it('testSeveralVariableDefinitionsToConstantsInMethods2', () => {
      expect(`
      class Foo {
        var x var y =     5 var z		
        method addition() { 
          
          
          var a = x 
          
          
          x = 1 
          
          
          y = 2             z = x + y	}
          
          
      }`).formattedTo (`
      class Foo {
        var x
        var y = 5
        var z
        
        method addition() {
          var a = x
          
          
          x = 1
          
          
          y = 2
          z = x + y
        }
      }`)
    })

    it('testSeveralVariableDefinitionsToConstantsInMethods3', () => {
      expect(`
      class Foo {
              var x var y var z		
              method      addition   ()           { 
                      var a = x
          x = 1
          y = 2
                      z = x + y	}
          
          
      }`).formattedTo (`
      class Foo {
        var x
        var y
        var z
        
        method addition() {
          var a = x
          x = 1
          y = 2
          z = x + y
        }
      }`)
    })

    it('testSeveralVariableDefinitionsToConstantsInMethods4', () => {
      expect(`
      class Foo {
        var x		
        method addition() { x = 1 var a = 2 a = x a   +=  1       a  .  inverted() }
      }`).formattedTo (
        `
      class Foo {
        var x
        
        method addition() {
          x = 1
          var a = 2
          a = x
          a += 1
          a.inverted()
        }
      }`)
    })

    it('propertyDefinitionInClass', () => {
      expect(`
      class Foo {
        var              property 
        
        
         x
         
         const 
         property
         
         
         y
            =    
              1		
      }`).formattedTo (`
      class Foo {
        var property x
        const property y = 1
      }`)
    })

    it('propertyDefinitionInWko', () => {
      expect(`
      object romualdo {
        var      property 
        
        
         x
         
         const
         
         property
         
         
          y
            =    
              1		
      }`).formattedTo (`
      object romualdo {
        var property x
        const property y = 1
      }`)
    })

    it('propertyDefinitionInMixin', () => {
      expect(`mixin Jugable {
                 var   property 
        
        
         x
         
         const         
         property
         
         
          y
            =    
              1		
      }`).formattedTo (`
      mixin Jugable {
        var property x
        const property y = 1
      }`)
    })

    it('propertyDefinitionInDescribe', () => {
      expect(`
      describe
      
       "group of tests"  
       {
        var					property         
        
        
         x
         
         const  			property
         
         
         y
            =    
              1		
              
              test "true is true" { assert.that(true) }
      }`).formattedTo (`
      describe "group of tests" {
        var property x
        const property y = 1
        
        test "true is true" {
          assert.that(true)
        }
      }`)
    })
  })

  describe('Constructor call', () => {
    it('constructorCallFormatting', () => {
      expect(`class A { var a
      var b = 2 var c var d 
      }
      class B {
        
      method buildA() {
      new A(                     a
      
      
       = 
       
       200			
      ,
      b                = "Hello"
      
      ,
      
      c =               new        Date()    
      
      , d=#{1   , 8} )	
      }}
      `).formattedTo(`
      class A {
        var a
        var b = 2
        var c
        var d
      }
      
      class B {
        method buildA() {
          new A(a = 200, b = "Hello", c = new Date(), d = #{1, 8})
        }
      }`)
    })

  })

  describe('Complex flow', () => {
    it('program_ifInline', () => {
      expect(`program p {
        const a = 10
        const b = 0
    		
    			   const c = if     (a > 0)    b                    else 
    			   
    			   
    			   0
    	}`).formattedTo( `
    program p {
      const a = 10
      const b = 0
      
      const c = if (a > 0) b else 0
    }`)
    })

    it('program_ifInlineWithExpressions', () => {
      expect(`program p {
    		const a = 10
    		const b = 0
    		
    		const c = if (a > 0) b+1 else b-1
    	}`).formattedTo( `
    program p {
      const a = 10
      const b = 0
      
      const c = if (a > 0) b + 1 else b - 1
    }`)
    })

    it('issue702_forEachAndIf', () => {
      expect(`
		object foo {
		    method bar() {
		        [3,              4        ,50,      100 ].forEach({ it => if (it > 4) { console.println(4) } else {console.println(it)
		            }
		        })
		    }
		}
		`).formattedTo(`
    object foo {
      method bar() {
        [3, 4, 50, 100].forEach(
          { it => if (it > 4) console.println(4) else console.println(it) }
        )
      }
    }`)
    })

    it('issue702_forEachAndIf_2', () => {
      expect(`
		object foo {
		    method bar() {
		        [3,              4        ,50,      100 ].forEach({ it => if (it > 4) console.println(4) else console.println(it)
		           
		        })
		    }
		}
		`).formattedTo(`
    object foo {
      method bar() {
        [3, 4, 50, 100].forEach(
          { it => if (it > 4) console.println(4) else console.println(it) }
        )
      }
    }`)
    })

    it('program_maxOneLineBreakBetweenLines', () => {
      expect(`program p {
        const a = 10
        const b = 0
        
        
        
        const c = a + b
      }`).formattedTo( `
      program p {
        const a = 10
        const b = 0
        
        
        
        const c = a + b
      }`)
    })

    it('basicTryCatch', () => {
      expect(`
program abc {
    console.println(4)
    try
        {
            5 + 5
        }
            catch e : Exception
            {
                console.println(e)
            }
        }		
		`).formattedTo(`
    program abc {
      console.println(4)
      try {
        5 + 5
      } catch e : Exception {
        console.println(e)
      }
    }`)
    })

    it('tryBlockWithSeveralCatchsAndAFinally', () => {
      expect(`
    program abc {
    console.println(4)
    try{5 + 5}
            catch e : UserException       {
                console.println(e)
            }              catch e2:Exception {console.println("Bad error")       console.println("Do nothing")} 
            
            
            
            
            
            then always { console.println("finally") 
            
            
            }
        }		
		`).formattedTo(`
    program abc {
      console.println(4)
      try {
        5 + 5
      } catch e : UserException {
        console.println(e)
      } catch e2 : Exception {
        console.println("Bad error")
        console.println("Do nothing")
      } then always {
        console.println("finally")
      }
    }`)
    })

    it('oneLineTryCatch', () => {
      expect(`
    program abc {
        console.println(4)
    try
    
    
    
    
            5 + 5
    
    
            catch e : Exception
    
    
                console.println(e)
        }		
		`).formattedTo(`
    program abc {
      console.println(4)
      try {
        5 + 5
      } catch e : Exception {
        console.println(e)
      }
    }`)
    })

    it('throwFormattingTest', () => {

      expect(`
		object foo {
    method attack(target) {
                              var attackers = self.standingMembers()
                if (attackers.isEmpty()) throw
                                    new CannotAttackException(
                                    
                                    
                                    
                                    message
                                    
                                    
                                    ="No attackers available") attackers.forEach({
                                            aMember          =>   
                                            
                                            
                                            aMember.
                                            attack(target) })
    }		
    }
		`).formattedTo(`
    object foo {
      method attack(target) {
        var attackers = self.standingMembers()
        if (attackers.isEmpty()) {
          throw new CannotAttackException(message = "No attackers available")
        }
        attackers.forEach({ aMember => aMember.attack(target) })
      }
    }`)
    })

    it('testAllWithClosure', () => {

      expect(`
		class Cantante { const albumes = new Set()
method esMinimalista() = albumes.all{
				album =>
					album.sonTodasCancionesCortas()
			}
	}	
		`).formattedTo(`
    class Cantante {
      const albumes = new Set()
      
      method esMinimalista() = albumes.all(
        { album => album.sonTodasCancionesCortas() }
      )
    }`)
    })

    it('testForEachWithComplexClosure', () => {

      expect(`
		class Cantante { const albumes = new Set()
      method mejorarAlbumes() {
	        albumes.forEach{
				album =>
					album.agregarCancion(new Cancion())
					album.sumarCosto(100)
			}}
	      }	
		`).formattedTo(`
    class Cantante {
      const albumes = new Set()
      
      method mejorarAlbumes() {
        albumes.forEach(
          { album =>
            album.agregarCancion(new Cancion())
            return album.sumarCosto(100)
          }
        )
      }
    }`)
    })

    it('doubleIfInMethod', () => {
      expect(`
		object pepita {
			const posicion = game.at(2, 0)
			var energia = 50
			method energia() {
				return energia
			}
			method imagen() {
				if (energia < 150) return "pepita.png"
				if (energia < 300) return "pepita1.png"
				return "pepita2.png"
			}
			
			
			}
		`).formattedTo(`
    object pepita {
      const posicion = game.at(2, 0)
      var energia = 50
      
      method energia() = energia
      
      method imagen() {
        if (energia < 150) {
          return "pepita.png"
        }
        if (energia < 300) {
          return "pepita1.png"
        }
        return "pepita2.png"
      }
    }`)
    })

    it('testWithIfExpression', () => {

      expect(`
		object laTrastienda {
		
			const capacidadPlantaBaja = 400
			const capacidadPrimerPiso = 300
		
			method capacidad(dia) {
				if (dia.dayOfWeek() 
				
				
				== 6) {
					return capacidadPlantaBaja + capacidadPrimerPiso
				} else {
					return capacidadPlantaBaja
				}
			}
		
		}
		`).formattedTo(`
    object laTrastienda {
      const capacidadPlantaBaja = 400
      const capacidadPrimerPiso = 300
      
      method capacidad(dia) {
        if (dia.dayOfWeek() == 6) {
          return capacidadPlantaBaja + capacidadPrimerPiso
        } else {
          return capacidadPlantaBaja
        }
      }
    }`)

    })

    it('testFold', () => {
      expect(`
      class Mashup inherits Cancion {

      var nombre = ""
              var   duracion = 0         
              var letra = ""
                
              var bloqueNumeroPositivo =        {    num   =>          num > 0 }               
              
              

        method concatenarNombres(canciones) {
          return canciones.fold(""      ,       { acum , cancion => acum + cancion.nombre() } 
          
          
          )
        }

			}
			`).formattedTo(`
      class Mashup inherits Cancion {
        var nombre = ""
        var duracion = 0
        var letra = ""
        var bloqueNumeroPositivo = { num => num > 0 }
        
        method concatenarNombres(canciones) = canciones.fold(
          "",
          { acum, cancion => acum + cancion.nombre() }
        )
      }`)
    })

    it( 'testReturnAndIf', () => {
      expect(`
    object lucia {

      const costePresentacionNoConcurrida = 400
      const costePresentacionConcurrida = 500
      var cantaEnGrupo = true
      const habilidad = 70

      method habilidad() = habilidad + self.sumaHabilidad()

      method sumaHabilidad() {
        if (cantaEnGrupo) return   -  20
        return 0
      }
			}
			`).formattedTo(`
      object lucia {
        const costePresentacionNoConcurrida = 400
        const costePresentacionConcurrida = 500
        var cantaEnGrupo = true
        const habilidad = 70
        
        method habilidad() = habilidad + self.sumaHabilidad()
        
        method sumaHabilidad() {
          if (cantaEnGrupo) {
            return -20
          }
          return 0
        }
      }`
      )
    })

    it('testReturnSelfExpression', () => {
      expect(`
    class AlbumBuilder {

      var fechaLanzamiento

      method fechaLanzamiento(dia, mes, anio) {
        fechaLanzamiento = new Date(day = dia, month = mes, year = anio)
        return self
      }

    }		`).formattedTo(`
    class AlbumBuilder {
      var fechaLanzamiento
      
      method fechaLanzamiento(dia, mes, anio) {
        fechaLanzamiento = new Date(day = dia, month = mes, year = anio)
        return self
      }
    }`)
    })

    it('unaryWordExpression', () => {
      expect(`
		object lunaPark {}
		class Presentacion { var fecha var lugar var musicos }
    object pdpalooza inherits Presentacion(fecha = new Date(day = 15, month = 12, year = 2017), lugar = lunaPark, musicos = []){
      const restriccionHabilidad = { musico => if (musico.habilidad() < 70) throw new Exception(message = "La habilidad del músico debe ser mayor a 70")}
      const restriccionCompusoAlgunaCancion = {musico => if (!  musico.compusoAlgunaCancion()) throw new Exception(message = "El músico debe haber compuesto al menos una canción")}
    }		
    `).formattedTo(`
    object lunaPark {
      
    }
    
    class Presentacion {
      var fecha
      var lugar
      var musicos
    }
    
    object pdpalooza inherits Presentacion (
      fecha = new Date(day = 15, month = 12, year = 2017),
      lugar = lunaPark,
      musicos = []
    ) {
      const restriccionHabilidad = { musico => if (musico.habilidad() < 70) {
          throw new Exception(
            message = "La habilidad del músico debe ser mayor a 70"
          )
        } }
      const restriccionCompusoAlgunaCancion = { musico =>
        if (!musico.compusoAlgunaCancion()) {
          throw new Exception(
            message = "El músico debe haber compuesto al menos una canción"
          )
        } }
    }`)
    })

    it('testObjectWithClosureImplementingRestrictions', () => {

      expect(`
    object restriccionCompositor {

      method verificarMusico(musico) {
        if (!musico.cancionesPublicadas().any{ unaCancion => musico.esSuCancion(unaCancion)}) {
          throw new UserException(message = "No se puede agregar al musico ya que no compuso ninguna cancion")
        }
      }

    }
    `).formattedTo(`
    object restriccionCompositor {
      method verificarMusico(musico) {
        if (!musico.cancionesPublicadas().any(
          { unaCancion => musico.esSuCancion(unaCancion) }
        )) {
          throw new UserException(
            message = "No se puede agregar al musico ya que no compuso ninguna cancion"
          )
        }
      }
    }`)
    })
  })

  describe('Comments', () => {
    it('empty object should keep comments', () => {
      const code = `
      // outside comment
      object pepita {
        // inner comment
      }`
      expect(code).formattedTo(code)
    })
    it('empty object should keep multiline comments', () => {
      expect(`// outside comment
      object pepita {
        /* multi
                line
        comment */
      }`).formattedTo(`
      // outside comment
      object pepita {
        /* multi
        line
        comment */
      }`)
    })
    it('empty object should keep multiline comments without line breaks', () => {
      const code = `
      // outside comment
      object pepita {
        /* inner comment */
      }`
      expect(code).formattedTo(code)
    })
    it('empty object should keep multiple comments', () => {
      const code = `
      // outside comment
      object pepita {
        // inner comment 1
        // inner comment 2
        // inner comment 3
      }`
      expect(code).formattedTo(code)
    })
    it('object with method should keep comments', () => {
      const code = `
        // outside comment
        object pepita {
          // internal comment
          method fly() = 1
        }`
      expect(code).formattedTo(code)
    })
    it('object with method should keep multi line comments', () => {
      const code = `
        // outside comment
        object pepita {
          /* multi
          line
          comment */
          method fly() = 1
        }`
      expect(code).formattedTo(code)
    })
  })

})