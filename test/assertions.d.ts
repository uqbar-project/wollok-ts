/// <reference types="vitest" />

import { List, Node, Package } from '../src'
import { Validation } from '../src/validator'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Assertion<T = any> {
    parsedBy(parser: any): this
    into(expected: any): this
    linkedInto(expected: List<Package>): this
    sourceMap(start: any, end: any): Assertion
    recoveringFrom(code: any, start: number, end: number): Assertion

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