import { Entity, Package, Reference } from '../model'
import { Interpreter } from './interpreter'

export const getImportedDefinitions = (interpreter: Interpreter) => (nodeFQN: string): string[] => {
  const imports = interpreter.evaluation.environment.getNodeByFQN<Package>(nodeFQN).imports
  return imports.flatMap(imp => imp.children.map(child => (child as unknown as Reference<Entity>).name))
}