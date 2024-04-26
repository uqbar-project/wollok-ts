import { Node } from '../model'

export const valuesForNodeName = (node: Node & { name?: string }): string[] => [node.name ?? '']
export const valuesForFileName = (node: Node): string[] => [node.sourceFileName ?? '']