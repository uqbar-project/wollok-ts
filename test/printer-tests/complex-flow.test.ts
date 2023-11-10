import { should, use } from 'chai'
import { printerAssertions } from '../assertions'

use(printerAssertions)
should()


describe('Complex flow', () => {
  it('program_ifInline', () => {
    `program p {
        const a = 10
        const b = 0
    		
    			   const c = if     (a > 0)    b                    else 
    			   
    			   
    			   0
    	}`.should.be.formattedTo( `
    program p {
      const a = 10
      const b = 0
      
      const c = if (a > 0) b else 0
    }`)
  })

  it('program_ifInlineWithExpressions', () => {
    `program p {
    		const a = 10
    		const b = 0
    		
    		const c = if (a > 0) b+1 else b-1
    	}`.should.be.formattedTo( `
    program p {
      const a = 10
      const b = 0
      
      const c = if (a > 0) b + 1 else b - 1
    }`)
  })

  it('issue702_forEachAndIf', () => {
    `
		object foo {
		    method bar() {
		        [3,              4        ,50,      100 ].forEach({ it => if (it > 4) { console.println(4) } else {console.println(it)
		            }
		        })
		    }
		}
		`.should.be.formattedTo(`
    object foo {
      method bar() {
        [3, 4, 50, 100].forEach(
          { it => if (it > 4) console.println(4) else console.println(it) }
        )
      }
    }`)
  })

  it('issue702_forEachAndIf_2', () => {
    `
		object foo {
		    method bar() {
		        [3,              4        ,50,      100 ].forEach({ it => if (it > 4) console.println(4) else console.println(it)
		           
		        })
		    }
		}
		`.should.be.formattedTo(`
    object foo {
      method bar() {
        [3, 4, 50, 100].forEach(
          { it => if (it > 4) console.println(4) else console.println(it) }
        )
      }
    }`)
  })

  it('program_maxOneLineBreakBetweenLines', () => {
    `program p {
    		const a = 10
    		const b = 0
    		
    		
    		
    		const c = a + b
    	}`.should.be.formattedTo( `
    program p {
      const a = 10
      const b = 0
      
      
      
      const c = a + b
    }
		`)
  })

  it('basicTryCatch', () => {
    `
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
		`.should.be.formattedTo(`
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
    `
    program abc {
    console.println(4)
    try{5 + 5}
            catch e : UserException       {
                console.println(e)
            }              catch e2:Exception {console.println("Bad error")       console.println("Do nothing")} 
            
            
            
            
            
            then always { console.println("finally") 
            
            
            }
        }		
		`.should.be.formattedTo(`
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
    `
    program abc {
        console.println(4)
    try
    
    
    
    
            5 + 5
    
    
            catch e : Exception
    
    
                console.println(e)
        }		
		`.should.be.formattedTo(`
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

    `
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
		`.should.be.formattedTo(`
    object foo {
      method attack(target) {
        var attackers = self.standingMembers()
        if (attackers.isEmpty()) throw new CannotAttackException(
            message = "No attackers available"
          )
        attackers.forEach({ aMember => aMember.attack(target) })
      }
    }`)
  })

  it('testAllWithClosure', () => {

    `
		class Cantante { const albumes = new Set()
method esMinimalista() = albumes.all{
				album =>
					album.sonTodasCancionesCortas()
			}
	}	
		`.should.be.formattedTo(`
    class Cantante {
      const albumes = new Set()
      
      method esMinimalista() = albumes.all(
        { album => album.sonTodasCancionesCortas() }
      )
    }`)
  })

  it('testForEachWithComplexClosure', () => {

    `
		class Cantante { const albumes = new Set()
      method mejorarAlbumes() {
	        albumes.forEach{
				album =>
					album.agregarCancion(new Cancion())
					album.sumarCosto(100)
			}}
	      }	
		`.should.be.formattedTo(`
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

  xit('doubleIfInMethod', () => {

    `
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
		`.should.be.formattedTo(`
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

    `
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
		`.should.be.formattedTo(`
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
    `
      class Mashup inherits Cancion {

      var nombre = ""
              var   duracion = 0         
              var letra = ""
                
              var bloqueNumeroPositivo =        {    num   =>          num > 0 }               
              
              



        method concatenarNombres(canciones) {
          return canciones.fold(""      ,       { acum , cancion => acum + cancion.nombre() } 
          
          
          )
        })

			}
			`.should.be.formattedTo(`
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
    `
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
			`.should.be.formattedTo(`
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
    `
    class AlbumBuilder {

      var fechaLanzamiento

      method fechaLanzamiento(dia, mes, anio) {
        fechaLanzamiento = new Date(day = dia, month = mes, year = anio)
        return self
      }

    }		`.should.be.formattedTo(`
    class AlbumBuilder {
      var fechaLanzamiento
      
      method fechaLanzamiento(dia, mes, anio) {
        fechaLanzamiento = new Date(day = dia, month = mes, year = anio)
        return self
      }
    }`)
  })

  xit('unaryWordExpression', () => {
    `
		object lunaPark {}
		class Presentacion { var fecha var lugar var musicos }
    object pdpalooza inherits Presentacion(fecha = new Date(day = 15, month = 12, year = 2017), lugar = lunaPark, musicos = []){
      const restriccionHabilidad = { musico => if (musico.habilidad() < 70) throw new Exception(message = "La habilidad del músico debe ser mayor a 70")}
      const restriccionCompusoAlgunaCancion = {musico => if (not musico.compusoAlgunaCancion()) throw new Exception(message = "El músico debe haber compuesto al menos una canción")}
    }		
		`.should.be.formattedTo(`
    object lunaPark {
    
    }

    class Presentacion {
      var fecha
      var lugar
      var musicos
    }
    
    object pdpalooza inherits Presentacion(fecha = new Date(day = 15, month = 12, year = 2017), lugar = lunaPark, musicos = []) {
      const restriccionHabilidad = { musico =>
        if (musico.habilidad() < 70) throw new Exception(message = "La habilidad del músico debe ser mayor a 70")
      }
      const restriccionCompusoAlgunaCancion = { musico =>
        if (not musico.compusoAlgunaCancion()) throw new Exception(message = "El músico debe haber compuesto al menos una canción")
      }
    }`)
  })

  xit('testObjectWithClosureImplementingRestrictions', () => {

    `
    object restriccionCompositor {

      method verificarMusico(musico) {
        if (!musico.cancionesPublicadas().any{ unaCancion => musico.esSuCancion(unaCancion)}) {
          throw new UserException(message = "No se puede agregar al musico ya que no compuso ninguna cancion")
        }
      }

    }
    `.should.be.formattedTo(`
    object restriccionCompositor {
      method verificarMusico(musico) {
        if (!musico.cancionesPublicadas().any({ unaCancion => musico.esSuCancion(unaCancion)})) {
          throw new UserException(message = "No se puede agregar al musico ya que no compuso ninguna cancion")
        }
      }
    }`)
  })
})