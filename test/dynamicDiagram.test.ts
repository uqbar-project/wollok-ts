import { expect } from 'chai'
import { BOOLEAN_MODULE, buildEnvironment, CLOSURE_MODULE, DATE_MODULE, DICTIONARY_MODULE, Evaluation, getDynamicDiagramData, LIST_MODULE, NUMBER_MODULE, OBJECT_MODULE, Package, RANGE_MODULE, REPL, SET_MODULE, STRING_MODULE, WRENatives } from '../src'
import { DynamicDiagramElement, DynamicDiagramNode, DynamicDiagramReference } from '../src/interpreter/dynamicDiagram'
import { interprete, Interpreter } from '../src/interpreter/interpreter'
import linker from '../src/linker'
import { WREEnvironment } from './utils'

describe('Dynamic diagram', () => {

  let interpreter: Interpreter

  describe('Basic repl expressions', () => {

    beforeEach(() => {
      const replPackage = new Package({ name: REPL })
      const environment = linker([replPackage], WREEnvironment)
      interpreter = new Interpreter(Evaluation.build(environment, WRENatives))
    })

    it('should include numbers', () => {
      interprete(interpreter, 'const a = 2')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: '2',
        targetType: 'literal',
        targetModule: NUMBER_MODULE,
      })
    })

    it('should include strings', () => {
      interprete(interpreter, 'const a = "pepita"')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: '"pepita"',
        targetType: 'literal',
        targetModule: STRING_MODULE,
      })
    })

    it('should include anonymous singleton', () => {
      interprete(interpreter, `
        const a = object {
          var energy = 100
        }`)
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: 'Object',
        targetType: 'literal',
        targetModule: OBJECT_MODULE,
      })
    })

    it('should include several references', () => {
      interprete(interpreter, `
        const a = object {
          var energy = 100
          var anotherEnergy = 100
        }`)
      const elements = getDynamicDiagramData(interpreter)
      checkConnection(elements, {
        sourceLabel: 'Object',
        referenceLabel: 'energy, anotherEnergy',
        targetLabel: '100',
        targetType: 'literal',
        sourceModule: OBJECT_MODULE,
        targetModule: NUMBER_MODULE,
      })
    })

    it('should include sets', () => {
      interprete(interpreter, 'const a = #{ { 2.even() }, 2..3}')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: 'Set',
        targetType: 'literal',
        targetModule: SET_MODULE,
      })
      checkConnection(elements, {
        sourceLabel: 'Set',
        referenceLabel: '',
        targetLabel: '{ 2.even() }',
        targetType: 'literal',
        sourceModule: SET_MODULE,
        targetModule: CLOSURE_MODULE,
      })
      checkConnection(elements, {
        sourceLabel: 'Set',
        referenceLabel: '',
        targetLabel: '2..3',
        targetType: 'literal',
        sourceModule: SET_MODULE,
        targetModule: RANGE_MODULE,
      })
    })

    it('should include lists', () => {
      interprete(interpreter, 'const a = [new Date(day = 1, month = 1, year = 2018), true, null]')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: 'List',
        targetType: 'literal',
        targetModule: LIST_MODULE,
      })
      checkConnection(elements, {
        sourceLabel: 'List',
        referenceLabel: '0',
        targetLabel: '1/1/2018',
        targetType: 'literal',
        sourceModule: LIST_MODULE,
        targetModule: DATE_MODULE,
      })
      checkConnection(elements, {
        sourceLabel: 'List',
        referenceLabel: '1',
        targetLabel: 'true',
        targetType: 'literal',
        sourceModule: LIST_MODULE,
        targetModule: BOOLEAN_MODULE,
      })
      checkConnection(elements, {
        sourceLabel: 'List',
        referenceLabel: '2',
        targetLabel: 'null',
        targetType: 'null',
        sourceModule: LIST_MODULE,
        targetModule: OBJECT_MODULE,
      })
    })

    it('should include dictionaries', () => {
      interprete(interpreter, 'const a = new Dictionary()')
      interprete(interpreter, 'a.put("key", "pepita")')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: 'a Dictionary ["key" -> "pepita"]',
        targetType: 'literal',
        targetModule: DICTIONARY_MODULE,
      })
    })

    it('should mark constants reference', () => {
      interprete(interpreter, 'const a = true')
      const elements = getDynamicDiagramData(interpreter)
      const reference = elements.find((element) => element.label === 'a') as DynamicDiagramReference
      expect(reference.constant).to.be.true
    })

    it('should mark variable reference', () => {
      interprete(interpreter, 'var a = true')
      const elements = getDynamicDiagramData(interpreter)
      const reference = elements.find((element) => element.label === 'a') as DynamicDiagramReference
      expect(reference.constant).to.be.false
    })

    it('should support many REPL references', () => {
      interprete(interpreter, 'const a = 1')
      interprete(interpreter, 'const b = 2')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: '1',
        targetType: 'literal',
        targetModule: NUMBER_MODULE,
      })
      checkConnectionFromRepl(elements, {
        referenceLabel: 'b',
        targetLabel: '2',
        targetType: 'literal',
        targetModule: NUMBER_MODULE,
      })
    })

    it('should support many REPL references to the same object', () => {
      interprete(interpreter, 'const a = 2')
      interprete(interpreter, 'const b = 2')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'a',
        targetLabel: '2',
        targetType: 'literal',
        targetModule: NUMBER_MODULE,
      })
      checkConnectionFromRepl(elements, {
        referenceLabel: 'b',
        targetLabel: '2',
        targetType: 'literal',
        targetModule: NUMBER_MODULE,
      })
    })
  })

  describe('Using file expressions', () => {

    it('should include wko', () => {
      const replEnvironment = buildEnvironment([{
        name: REPL, content: `object pepita {
          var energia = 100
          method capacidad() = energia * 20
        }`,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      const elements = getDynamicDiagramData(interpreter)
      checkConnection(elements, {
        sourceLabel: 'pepita',
        referenceLabel: 'energia',
        targetLabel: '100',
        targetType: 'literal',
        sourceModule: 'REPL.pepita',
        targetModule: NUMBER_MODULE,
      })
      checkNoConnectionToREPL(elements, 'pepita')
    })

    it('should include class', () => {
      const replEnvironment = buildEnvironment([{
        name: REPL, content: `class Ave {
          var energia = 100
          method tieneEnergia() = energia > 0
        }`,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      interprete(interpreter, 'const pepita = new Ave()')
      interprete(interpreter, 'pepita.energia()')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'pepita',
        targetLabel: 'Ave',
        targetType: 'object',
        targetModule: 'REPL.Ave',
      })
      checkConnection(elements, {
        sourceLabel: 'Ave',
        referenceLabel: 'energia',
        targetLabel: '100',
        targetType: 'literal',
        sourceModule: 'REPL.Ave',
        targetModule: NUMBER_MODULE,
      })
    })

    it('should include bidirectional relationships', () => {
      const replEnvironment = buildEnvironment([{
        name: REPL, content: `
        class Ave {
          var property amigue = null
          method tieneEnergia() = energia > 0
        }
        
        object pepita inherits Ave {
          override method tieneEnergia() = true
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      interprete(interpreter, 'const pepona = new Ave(amigue = pepita)')
      interprete(interpreter, 'pepita.amigue(pepona)')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'pepona',
        targetLabel: 'Ave',
        targetType: 'object',
        targetModule: 'REPL.Ave',
      })
      checkConnection(elements, {
        sourceLabel: 'Ave',
        referenceLabel: 'amigue',
        targetLabel: 'pepita',
        targetType: 'object',
        sourceModule: 'REPL.Ave',
        targetModule: 'REPL.pepita',
      })
      checkConnection(elements, {
        sourceLabel: 'pepita',
        referenceLabel: 'amigue',
        targetLabel: 'Ave',
        targetType: 'object',
        sourceModule: 'REPL.pepita',
        targetModule: 'REPL.Ave',
      })
      checkNoConnectionToREPL(elements, 'pepita')
    })

    it('should include recursive relationships', () => {
      const replEnvironment = buildEnvironment([{
        name: REPL, content: `
        class Ave {
          var property amigue = null
          override method tieneEnergia() = true
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      interprete(interpreter, 'const pepita = new Ave()')
      interprete(interpreter, 'pepita.amigue(pepita)')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'pepita',
        targetLabel: 'Ave',
        targetType: 'object',
        targetModule: 'REPL.Ave',
      })
      checkConnection(elements, {
        sourceLabel: 'Ave',
        referenceLabel: 'amigue',
        targetLabel: 'Ave',
        targetType: 'object',
        sourceModule: 'REPL.Ave',
        targetModule: 'REPL.Ave',
      })

    })

    it('should include imported definitions from wko', () => {
      const replEnvironment = buildEnvironment([{
        name: 'entrenador.wlk', content: `
        object gino {
        }
        `,
      }, {
        name: REPL, content: `
        import entrenador.*

        object pepita {
          var property entrenador = gino
          override method tieneEnergia() = true
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      const elements = getDynamicDiagramData(interpreter)
      checkConnection(elements, {
        sourceLabel: 'pepita',
        referenceLabel: 'entrenador',
        targetLabel: 'gino',
        targetType: 'object',
        sourceModule: 'REPL.pepita',
        targetModule: 'entrenador.gino',
      })
      checkNoConnectionToREPL(elements, 'pepita')
      checkNoConnectionToREPL(elements, 'gino')
    })

    it('should include imported definitions from class', () => {
      const replEnvironment = buildEnvironment([{
        name: 'entrenador.wlk', content: `
        class Entrenador {
        }
        `,
      }, {
        name: REPL, content: `
        import entrenador.*

        class Ave {
          var property entrenador = new Entrenador()
          override method tieneEnergia() = true
        }
        `,
      }])
      interpreter = new Interpreter(Evaluation.build(replEnvironment, WRENatives))
      interprete(interpreter, 'const pepita = new Ave()')
      const elements = getDynamicDiagramData(interpreter)
      checkConnectionFromRepl(elements, {
        referenceLabel: 'pepita',
        targetLabel: 'Ave',
        targetType: 'object',
        targetModule: 'REPL.Ave',
      })
      checkConnection(elements, {
        sourceLabel: 'Ave',
        referenceLabel: 'entrenador',
        targetLabel: 'Entrenador',
        targetType: 'object',
        sourceModule: 'REPL.Ave',
        targetModule: 'entrenador.Entrenador',
      })
    })

  })

})

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ASSERTIONS FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const checkNode = (elements: DynamicDiagramElement[], label: string): DynamicDiagramNode => {
  const node = elements.find((element) => element.label === label && element.elementType === 'node')
  expect(node, `Node '${label}' not found in diagram`).not.to.be.undefined
  return node as DynamicDiagramNode
}

const checkReference = (elements: DynamicDiagramElement[], sourceId: string, targetId: string, referenceLabel: string, sourceModule: string | undefined, targetModule: string): DynamicDiagramReference => {
  const references = elements.filter((element) => {
    const elementReference = element as DynamicDiagramReference
    return elementReference.elementType === 'reference' && (sourceId == REPL ? elementReference.sourceId.includes(REPL) : elementReference.sourceId === sourceId) && elementReference.targetId === targetId
  }) as DynamicDiagramReference[]
  expect(references, `Reference '${referenceLabel}' not found in diagram`).not.to.be.empty

  const reference = references.length > 1 ? references.find(ref => ref.label == referenceLabel) : references[0]
  expect(reference).not.to.be.undefined
  if (sourceModule) {
    expect(reference!.sourceModule, `Reference '${referenceLabel}' points to another source module`).to.match(new RegExp(`^${sourceModule}`))
  }
  expect(reference!.targetModule, `Reference '${referenceLabel}' points to another target module`).to.match(new RegExp(`^${targetModule}`))
  return reference!
}

const checkConnection = (elements: DynamicDiagramElement[], { sourceLabel, referenceLabel, targetLabel, targetType, sourceModule, targetModule }: { sourceLabel: string, referenceLabel: string, targetLabel: string, targetType: string, sourceModule: string | undefined, targetModule: string }) => {
  const source = checkNode(elements, sourceLabel)
  const target = checkNode(elements, targetLabel)
  checkReference(elements, source.id, target.id, referenceLabel, sourceModule, targetModule)
  expect(target.type, `Target '${targetLabel}' points to another target type`).to.be.equal(targetType)
  if (source) {
    expect(source!.module, `Reference '${sourceLabel}' points to another source module`).to.match(new RegExp(`^${sourceModule}`))
  }
  expect(target.module, `Target '${targetLabel}' points to another target module`).to.match(new RegExp(`^${targetModule}`))
}

const checkConnectionFromRepl = (elements: DynamicDiagramElement[], { referenceLabel, targetLabel, targetType, targetModule }: { referenceLabel: string, targetLabel: string, targetType: string, targetModule: string }) => {
  const target = checkNode(elements, targetLabel)
  checkReference(elements, REPL, target.id, referenceLabel, undefined, targetModule)
  expect(target.type, `Target '${targetLabel}' points to another target type`).to.be.equal(targetType)
  expect(target.module, `Target '${targetLabel}' points to another target module`).to.match(new RegExp(`^${targetModule}`))
}

const checkNoConnectionToREPL = (elements: DynamicDiagramElement[], name: string) => {
  const reference = elements.find((element) => {
    const elementReference = element as DynamicDiagramReference
    return elementReference.elementType === 'reference' && elementReference.sourceId.includes(REPL) && elementReference.targetModule === `REPL.${name}`
  })
  expect(reference).to.be.undefined
}