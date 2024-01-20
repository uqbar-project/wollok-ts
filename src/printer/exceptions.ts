import { Node } from '../model'

export class PrintingMalformedNodeError extends Error {
  constructor(public readonly node: Node) {
    super('Failed to print, found malformed node')
  }
}