/// <reference types="vitest" />

import { List, Node, Package } from '../src'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T = any> {
    // Parser assertions
    parsedInto(expected: any): this
    sourceMap([start, end]: [SourceIndex, SourceIndex]): Assertion
    recoveringFrom({ code, start, end }: { code: any, start: number, end: number }): Assertion
    tracedTo(positions: [number, number]): this

    // Formatter assertions
    formattedTo(expected: string): Assertion

    // Linker assertions
    linkedInto(expected: List<Package>): Assertion
    target(node: Node): Assertion

  }

}