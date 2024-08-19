import { expect } from 'chai'
import { buildEnvironment, Evaluation, getDataDiagram, NUMBER_MODULE, Package, REPL, STRING_MODULE, WRENatives } from '../src'
import { DynamicDiagramElement, DynamicDiagramNode, DynamicDiagramReference } from '../src/interpreter/dynamicDiagramGenerator'
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
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
        referenceLabel: 'a',
        targetLabel: '2',
        targetType: 'literal',
        targetModule: NUMBER_MODULE,
      })
    })

    it('should include strings', () => {
      interprete(interpreter, 'const a = "pepita"')
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
        referenceLabel: 'a',
        targetLabel: '"pepita"',
        targetType: 'literal',
        targetModule: STRING_MODULE,
      })
    })

    it('should include unnamed singleton', () => {
      interprete(interpreter, `
        const a = object {
          var energy = 100
        }`)
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
        referenceLabel: 'a',
        targetLabel: 'Object',
        targetType: 'literal',
        targetModule: 'wollok.lang.Object#unnamed',
      })
    })

    it('should include several references', () => {
      interprete(interpreter, `
        const a = object {
          var energy = 100
          var anotherEnergy = 100
        }`)
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: 'Object',
        referenceLabel: 'energy, anotherEnergy',
        targetLabel: '100',
        targetType: 'literal',
        targetModule: 'wollok.lang.Number',
      })
    })

    it('should include sets', () => {
      interprete(interpreter, 'const a = #{ { 2.even() }, 2..3}')
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
        referenceLabel: 'a',
        targetLabel: 'Set',
        targetType: 'literal',
        targetModule: 'wollok.lang.Set',
      })
      checkConnection(elements, {
        sourceLabel: 'Set',
        referenceLabel: '',
        targetLabel: '{ 2.even() }',
        targetType: 'literal',
        targetModule: 'wollok.lang.Closure#unnamed',
      })
      checkConnection(elements, {
        sourceLabel: 'Set',
        referenceLabel: '',
        targetLabel: '2..3',
        targetType: 'literal',
        targetModule: 'wollok.lang.Range',
      })
    })

    it('should include lists', () => {
      interprete(interpreter, 'const a = [new Date(day = 1, month = 1, year = 2018), true]')
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
        referenceLabel: 'a',
        targetLabel: 'List',
        targetType: 'literal',
        targetModule: 'wollok.lang.List',
      })
      checkConnection(elements, {
        sourceLabel: 'List',
        referenceLabel: '0',
        targetLabel: '1/1/2018',
        targetType: 'literal',
        targetModule: 'wollok.lang.Date',
      })
      checkConnection(elements, {
        sourceLabel: 'List',
        referenceLabel: '1',
        targetLabel: 'true',
        targetType: 'literal',
        targetModule: 'wollok.lang.Boolean',
      })
    })

    it('should include dictionaries', () => {
      interprete(interpreter, 'const a = new Dictionary()')
      interprete(interpreter, 'a.put("key", "pepita")')
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
        referenceLabel: 'a',
        targetLabel: 'a Dictionary ["key" -> "pepita"]',
        targetType: 'literal',
        targetModule: 'wollok.lang.Dictionary',
      })
    })

    it('should mark constants reference', () => {
      interprete(interpreter, 'const a = true')
      const elements = getDataDiagram(interpreter)
      const reference = elements.find((element) => element.label === 'a') as DynamicDiagramReference
      expect(reference.constant).to.be.true
    })

    it('should mark variable reference', () => {
      interprete(interpreter, 'var a = true')
      const elements = getDataDiagram(interpreter)
      const reference = elements.find((element) => element.label === 'a') as DynamicDiagramReference
      expect(reference.constant).to.be.false
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
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: 'pepita',
        referenceLabel: 'energia',
        targetLabel: '100',
        targetType: 'literal',
        targetModule: 'wollok.lang.Number',
      })
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
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
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
        targetModule: 'wollok.lang.Number',
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
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
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
        targetModule: 'REPL.pepita',
      })
      checkConnection(elements, {
        sourceLabel: 'pepita',
        referenceLabel: 'amigue',
        targetLabel: 'Ave',
        targetType: 'object',
        targetModule: 'REPL.Ave',
      })

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
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
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
        targetModule: 'REPL.Ave',
      })

    })

    it('should include imported definitions', () => {
      const replEnvironment = buildEnvironment([{
        name: 'entrenador', content: `
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
      const elements = getDataDiagram(interpreter)
      checkConnection(elements, {
        sourceLabel: REPL,
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

const checkReference = (elements: DynamicDiagramElement[], sourceId: string, targetId: string, referenceLabel: string, targetModule: string): DynamicDiagramReference => {
  const reference = elements.find((element) => {
    const elementReference = element as DynamicDiagramReference
    return elementReference.elementType === 'reference' && elementReference.sourceId === sourceId && elementReference.targetId === targetId
  }) as DynamicDiagramReference
  expect(reference, `Reference '${referenceLabel}' not found in diagram`).not.to.be.undefined
  expect(reference!.label).to.be.equal(referenceLabel)
  expect(reference!.targetModule, 'Reference points to another target module').to.be.equal(targetModule)
  return reference
}

const checkConnection = (elements: DynamicDiagramElement[], { sourceLabel, referenceLabel, targetLabel, targetType, targetModule }: { sourceLabel: string, referenceLabel: string, targetLabel: string, targetType: string, targetModule: string }) => {
  const source = checkNode(elements, sourceLabel)
  const target = checkNode(elements, targetLabel)
  checkReference(elements, source.id, target.id, referenceLabel, targetModule)
  expect(target.type, `Target '${targetLabel}' points to another target type`).to.be.equal(targetType)
  expect(target.module, `Target '${targetLabel}' points to another target module`).to.be.equal(targetModule)
}