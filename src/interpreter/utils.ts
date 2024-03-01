import { Entity, Import, Package, Reference } from '../model'
import { Interpreter } from './interpreter'

export const getImportedDefinitions = (interpreter: Interpreter) => (nodeFQN: string): string[] => {
  const imports = interpreter.evaluation.environment.getNodeByFQN<Package>(nodeFQN).imports
  return imports.flatMap(imp => imp.children.map(child => (child as unknown as Reference<Entity>).name))
}

export const getImportedEntities = (interpreter: Interpreter, basePackage: Package, rootFQN?: Package): Entity[] => {
  const importedPackage = rootFQN ?? basePackage
  return [
    ...importedPackage.members,
    ...importedPackage.imports.flatMap(resolveImport),
  ]
}

export const resolveImport = (_import: Import): Entity[] => {
  const importedEntity = _import.entity.target!
  return _import.isGeneric
    ? [...(importedEntity as Package).members]
    : [importedEntity]
}