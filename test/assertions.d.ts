/// <reference types="vitest" />

import { Parser } from 'parsimmon'
import { List, Node, Package } from '../src'
import { Validation } from '../src/validator'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T = any> {
    parsedBy(parser: Parser): this
    parsedInto(expected: any): this
    linkedInto(expected: List<Package>): this
    sourceMap([start, end]: [SourceIndex, SourceIndex]): Assertion
    recoveringFrom({ code, start, end }: { code: any, start: number, end: number }): Assertion
    tracedTo(positions: [number, number]): this

    formattedTo(expected: string): Assertion

    linkedInto(expected: List<Package>): Assertion
    target(node: Node): Assertion

    pass<N extends Node>(validation: Validation<N>): Assertion

    anyType(): Assertion

    deepEquals(excepted: any): Assertion
  }

  interface AsymmetricMatchersContaining {
    linkedInto(expected: any): void
  }

}