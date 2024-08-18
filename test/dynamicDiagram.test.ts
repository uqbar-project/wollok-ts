import { expect } from 'chai'
import { Evaluation, getDataDiagram, NUMBER_MODULE, Package, REPL, STRING_MODULE, WRENatives } from '../src'
import { interprete, Interpreter } from '../src/interpreter/interpreter'
import linker from '../src/linker'
import { WREEnvironment } from './utils'
import { DynamicDiagramElement, DynamicDiagramNode, DynamicDiagramReference } from '../src/interpreter/dynamicDiagramGenerator'

// const projectPath = join('examples', 'diagram-examples')
// const simpleFile = join(projectPath, 'fish.wlk')
// const fileWithImports = join(projectPath, 'using-imports', 'base.wlk')

describe('Dynamic diagram', () => {
  // const options = {
  //   project: projectPath,
  //   skipValidations: true,
  //   port: '8080',
  //   host: 'localhost',
  //   darkMode: true,
  //   skipDiagram: false,
  // }
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