
// test/assertions.ts
import { expect } from 'vitest'
import dedent from 'dedent'
import { buildEnvironment as buildEnv, print } from '../src'
import { List } from '../src/extensions'
import link from '../src/linker'
import { Name, Node, Package, Reference, SourceIndex } from '../src/model'
import { ParseError } from '../src/parser'

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

  parsedInto(actual: any, expected: any) {
    const plucked = dropKeys('sourceMap', 'problems')

    const actualClean = plucked(actual)
    const expectedClean = plucked(expected)

    const ok =
      deepCompare(actual.metadata ?? [], expected.metadata ?? []) &&
    deepCompare(actualClean, expectedClean)

    return {
      pass: ok,
      message: () => {
        const formatValue = (value: any) => JSON.stringify(value, null, 2)
        const sections: string[] = []

        if (!deepCompare(actual.metadata ?? [], expected.metadata ?? [])) {
          sections.push(`Metadata mismatch!

Actual metadata:
${formatValue(actual.metadata)}

Expected metadata:
${formatValue(expected.metadata)}`)
        }

        if (!deepCompare(actualClean, expectedClean)) {
          sections.push(`Structure mismatch!

Actual structure (cleaned):
${formatValue(actualClean)}

Expected structure (cleaned):
${formatValue(expectedClean)}`)
        }

        return `Expected structures to match

${sections.join('\n\n')}`
      },
    }
  },

  tracedTo(actual: any, [start, end]: [number, number]) {
    const actualStart = actual?.sourceMap?.start?.offset
    const actualEnd = actual?.sourceMap?.end?.offset
    const ok = actualStart === start && actualEnd === end

    return {
      pass: ok,
      message: () =>
        `Expected node to be traced to (${start}, ${end}) but got (${actualStart}, ${actualEnd})`,
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
      message: () => `Expected to be recovering from: ${JSON.stringify(problem)}. Problems: ${JSON.stringify(actual.problems, null, 2)}`,
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

})