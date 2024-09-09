import { KEYWORDS, LIST_MODULE, REPL, WOLLOK_BASE_PACKAGE } from '../constants'
import { uniqueBy } from '../extensions'
import { Entity, Package } from '../model'
import { Interpreter } from './interpreter'
import { RuntimeObject, RuntimeValue } from './runtimeModel'
import { v4 as uuid } from 'uuid'

export interface DynamicDiagramElement {
  id: string
  elementType: 'node' | 'reference',
  label: string
}

export enum DynamicNodeType {
  OBJECT = 'object',
  LITERAL = 'literal',
  NULL = 'null',
  REPL = 'REPL',
}

export interface DynamicDiagramNode extends DynamicDiagramElement {
  type: DynamicNodeType
  module: string
}

export interface DynamicDiagramReference extends DynamicDiagramElement {
  sourceId: string
  targetId: string
  constant: boolean
  targetModule: string | undefined
}

export const getDynamicDiagramData = (interpreter: Interpreter, rootFQN?: Package): DynamicDiagramElement[] => {
  const entitiesImportedFromConsole = getEntitiesImportedFromConsole(interpreter, rootFQN)
  const objects = getCurrentObjects(interpreter)

  const dynamicDiagramObjects = Array.from(objects.keys())
    .filter((name) => {
      const object = objects.get(name)
      return isConsoleLocal(name) || object && autoImportedFromConsole(object, entitiesImportedFromConsole)
    })
    .flatMap((name) => fromLocal(name, objects.get(name)!, interpreter))

  return uniqueBy(dynamicDiagramObjects, 'id')
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// INTERNAL FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const getEntitiesImportedFromConsole = (interpreter: Interpreter, rootFQN?: Package): Entity[] => {
  const environment = interpreter.evaluation.environment
  return (rootFQN ?? environment.replNode()).allScopedEntities()
}

const getCurrentObjects = (interpreter: Interpreter): Map<string, RuntimeValue> => {
  const currentFrame = interpreter.evaluation.currentFrame
  return new Map(Array.from(currentFrame.locals.keys()).map((name) => [name, currentFrame.get(name)]))
}

const autoImportedFromConsole = (obj: RuntimeObject, importedFromConsole: Entity[]) => importedFromConsole.includes(obj.module)

const fromLocal = (name: string, obj: RuntimeObject, interpreter: Interpreter): DynamicDiagramElement[] =>
  [
    ...isConsoleLocal(name)
      ? buildReplElement(obj, name.slice(REPL.length + 1))
      : [],
    ...elementFromObject(obj, interpreter),
  ]

const buildNode = (id: string, label: string, type: DynamicNodeType, module = ''): DynamicDiagramNode => ({
  id,
  elementType: 'node',
  label,
  type,
  module,
})

const buildReference = (id: string, label: string, constant: boolean, sourceId: string, targetObject?: RuntimeObject): DynamicDiagramReference => ({
  id,
  label,
  elementType: 'reference',
  sourceId,
  targetId: targetObject?.id ?? '',
  constant,
  targetModule: targetObject?.module.fullyQualifiedName,
})

const buildReplElement = (object: RuntimeObject, name: string) => {
  const replId = `source_${REPL}_${object.id}`
  return [
    buildNode(replId, REPL, DynamicNodeType.REPL),
    buildReference(uuid(), name, object.module.environment.replNode().isConstant(name), replId, object),
  ]
}

function elementFromObject(object: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[] = []): DynamicDiagramElement[] {
  const { id, module } = object
  if (alreadyVisited.includes(id)) return []
  return concatOverlappedReferences([
    buildNode(id, object.getLabel(interpreter), getType(object, module.fullyQualifiedName), module.fullyQualifiedName),
    ...getInstanceVariables(object, interpreter, alreadyVisited),
    ...getCollections(object, interpreter, alreadyVisited),
  ])
}

const haveSameReference = (element1: DynamicDiagramElement, element2: DynamicDiagramElement): boolean => {
  const firstElement = element1 as DynamicDiagramReference
  const secondElement = element2 as DynamicDiagramReference
  return element1.elementType === 'reference' && element2.elementType === 'reference' &&
    firstElement.sourceId === secondElement.sourceId && firstElement.targetId === secondElement.targetId
}

const concatOverlappedReferences = (elementDefinitions: DynamicDiagramElement[]): DynamicDiagramElement[] => {
  const cleanDefinitions: DynamicDiagramElement[] = []
  elementDefinitions.forEach(elem => {
    if (elem.elementType === 'reference') {
      const repeated = cleanDefinitions.find(def => haveSameReference(elem, def))
      if (repeated) {
        repeated.id = `${repeated.id}_${elem.id}`
        repeated.label = `${repeated.label}, ${elem.label}`
      } else {
        cleanDefinitions.push(elem)
      }
    } else {
      cleanDefinitions.push(elem)
    }
  })
  return cleanDefinitions
}

const isConsoleLocal = (name: string): boolean => name.startsWith(REPL)

const getType = (obj: RuntimeObject, moduleName: string): DynamicNodeType => {
  if (obj.innerValue === null) return DynamicNodeType.NULL
  return moduleName.startsWith(WOLLOK_BASE_PACKAGE) ? DynamicNodeType.LITERAL : DynamicNodeType.OBJECT
}

const shouldIterateChildren = (object: RuntimeObject): boolean =>
  !object.shouldShortenRepresentation() && !object.shouldShowShortValue()

const getLocalKeys = (object: RuntimeObject): string[] => {
  if (object.innerValue === null) return []
  return shouldIterateChildren(object) ? [...object.locals.keys()].filter(key => key !== KEYWORDS.SELF) : []
}

const getCollections = (object: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[]) => {
  const { id } = object
  return (object.innerCollection || [])
    .flatMap((item, i) => {
      const result = [
        buildReference(`${id}_${item.id}`, object.module.fullyQualifiedName === LIST_MODULE ? i.toString() : '', false, id, item),
        ...elementFromObject(item, interpreter, [...alreadyVisited, id]),
      ]
      alreadyVisited.push(item.id)
      return result
    })
}

const getInstanceVariables = (object: RuntimeObject, interpreter: Interpreter, alreadyVisited: string[]): DynamicDiagramElement[] => {
  const { id } = object
  return getLocalKeys(object).flatMap(name => [
    createReference(object, name),
    ...elementFromObject(object.get(name)!, interpreter, [...alreadyVisited, id]),
  ])
}

const createReference = (object: RuntimeObject, label: string): DynamicDiagramReference => {
  const { id } = object
  // TODO: chequear si puede ser undefined (no tendría sentido)
  const runtimeValue = object.get(label)!
  return buildReference(`${id}_${runtimeValue.id}`, label, object.isConstant(label), id, runtimeValue)
}