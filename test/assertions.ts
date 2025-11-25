/* eslint-disable no-console */
// test/assertions.ts
import { expect } from 'vitest'
import dedent from 'dedent'
import { formatError } from 'parsimmon'
import { buildEnvironment as buildEnv, print } from '../src'
import { List } from '../src/extensions'
import link from '../src/linker'
import { Name, Node, Package, Reference, SourceIndex } from '../src/model'
import { ParseError } from '../src/parser'
import { Validation } from '../src/validator'

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

const dropKeys = (...keys: string[]) => (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => keys.includes(k) ? undefined : v))

// primitive compare utilities
const comparePrimitives = (a: unknown, b: unknown): boolean => a === b
const compareObjects = (a: any, b: any): boolean =>
  a !== null &&
  b !== null &&
  typeof a === 'object' &&
  typeof b === 'object' &&
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(k => deepCompare(a[k], b[k]))

const compareArrays = (a: any, b: any): boolean =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((x, i) => deepCompare(x, b[i]))

const compareMaps = (a: any, b: any): boolean =>
  a instanceof Map &&
  b instanceof Map &&
  a.size === b.size &&
  [...a].every(([key, value]) =>
    deepCompare(value, b.get(key)) &&
    deepCompare(key, [...b].find(([k]) => deepCompare(k, key))?.[0])
  )

const compareSets = (a: any, b: any): boolean =>
  a instanceof Set &&
  b instanceof Set &&
  a.size === b.size &&
  [...a].every(elem => b.has(elem))

const deepCompare = (a: any, b: any): boolean =>
  comparePrimitives(a, b) ||
  compareObjects(a, b) ||
  compareArrays(a, b) ||
  compareMaps(a, b) ||
  compareSets(a, b)


// -----------------------------------------------------------------------------
// Vitest matchers
// -----------------------------------------------------------------------------

expect.extend({

  // ---------------------- PARSER ----------------------
  parsedBy(actual, parser) {
    const result = parser.parse(actual)

    return {
      pass: result.status,
      message: () =>
        result.status
          ? ''
          : formatError(actual, result),
    }
  },

  into(actual: any, expected: any) {
    const plucked = dropKeys('sourceMap', 'problems')

    const actualProblems = actual.problems?.map(({ code, sourceMap: { start, end } }: ParseError) =>
      ({ code, start: start.offset, end: end.offset })
    ) ?? []

    const expectedProblems = expected.problems?.() ?? []

    const actualClean = plucked(actual)
    const expectedClean = plucked(expected)

    const ok =
      deepCompare(actual.metadata ?? [], expected.metadata ?? []) &&
    deepCompare(actualProblems, expectedProblems) &&
    deepCompare(actualClean, expectedClean)

    if (!ok) {
      console.log('ACTUAL CLEANED:', JSON.stringify(actualClean, null, 2))
      console.log('EXPECTED CLEANED:', JSON.stringify(expectedClean, null, 2))
      console.log('METADATA ACTUAL:', JSON.stringify(actual.metadata, null, 2))
      console.log('METADATA EXPECTED:', JSON.stringify(expected.metadata, null, 2))
      console.log('PROBLEMS A:', JSON.stringify(actualProblems, null, 2))
      console.log('PROBLEMS E:', JSON.stringify(expectedProblems, null, 2))
    }

    return {
      pass: ok,
      message: () => 'Expected structure to match',
    }
  },

  tracedTo(actual: any, [start, end]: [number, number]) {
    const ok =
      actual?.sourceMap?.start?.offset === start &&
      actual?.sourceMap?.end?.offset === end

    return {
      pass: ok,
      message: () => `Expected node to be traced to (${start}, ${end})`,
    }
  },

  sourceMap(actual: any, [start, end]: [SourceIndex, SourceIndex]) {
    const ok =
      deepCompare(actual?.sourceMap?.start, start) &&
      deepCompare(actual?.sourceMap?.end, end)

    return {
      pass: ok,
      message: () => 'Expected sourceMap to match',
    }
  },

  recoveringFrom(actual: any, problem: { code: Name; start: number; end: number }) {
    if (!actual?.problems) {
      return {
        pass: false,
        message: () => 'Expected object to have problems[]',
      }
    }

    const found = actual.problems.some((p: ParseError) =>
      p.code === problem.code &&
      p.sourceMap.start.offset === problem.start &&
      p.sourceMap.end.offset === problem.end
    )

    return {
      pass: found,
      message: () => `Expected to be recovering from: ${JSON.stringify(problem)}`,
    }
  },

  // ---------------------- PRINTER ----------------------
  formattedTo(actual: string, expected: string) {
    const name = 'formatted'
    const environment = buildEnv([{ name, content: actual }])
    const printerConfig = { maxWidth: 80, useSpaces: true, abbreviateAssignments: true }
    const formatted = print(environment.getNodeByFQN(name), printerConfig)

    const ok = formatted === dedent(expected)

    return {
      pass: ok,
      message: () => `Expected formatted text:\n${formatted}\nto equal:\n${expected}`,
    }
  },

  // ---------------------- LINKER ----------------------
  linkedInto(actual: any, expectedPkgs: List<Package>) {
    const dropLinkedFields = dropKeys('id', 'scope')

    const actualEnv = link(actual)
    const expectedEnv = link(expectedPkgs)

    const ok = deepCompare(dropLinkedFields(actualEnv), dropLinkedFields(expectedEnv))

    return {
      pass: ok,
      message: () => 'Expected linked env to match',
    }
  },

  target(actual: Reference<Node>, expectedNode: Node) {
    if (!actual.is(Reference)) {
      return { pass: false, message: () => 'Object is not a Reference' }
    }

    const ok = actual.target?.id === expectedNode.id

    return {
      pass: ok,
      message: () => `Expected reference target ${actual.target?.id} to equal ${expectedNode.id}`,
    }
  },

  // ---------------------- VALIDATOR ----------------------
  pass(actual: Node, validation: Validation<Node>) {
    const result = validation(actual, '')
    const ok = result === null

    return {
      pass: ok,
      message: () => `Validation failed with: ${JSON.stringify(result)}`,
    }
  },

  // ---------------------- deepEquals ----------------------
  deepEquals(actual: any, expected: any) {
    const ok = deepCompare(actual, expected)

    return {
      pass: ok,
      message: () =>
        `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`,
    }
  },

})