import { Node } from '../model'

export const valuesForNodeName = (node: Node & { name?: string }): string[] => [node.name ?? '']