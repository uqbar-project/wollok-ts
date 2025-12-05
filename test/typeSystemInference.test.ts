import { fail } from 'assert'
import { join } from 'path'
import { getPotentiallyUninitializedLazy } from '../src/decorators'
import { inferTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import validate from '../src/validator'
import { allExpectations, buildEnvironmentForEachFile, validateExpectationProblem } from './utils'
import { describe, expect, it } from 'vitest'

const TESTS_PATH = join('language', 'test', 'typesystem')

describe('Wollok Type System Inference', () => {

  buildEnvironmentForEachFile(TESTS_PATH, (filePackage, fileContent) => {
    const { environment } = filePackage
    if (!getPotentiallyUninitializedLazy(environment, 'typeRegistry')) { // Just run type inference once
      const logger = undefined
      // You can use the logger to debug the type system inference in customized way, for example:
      // { log: (message: string) => { if (message.includes('[Reference]')) console.log(message) } }
      inferTypes(environment, logger)
    }

    it(filePackage.name, () => {
      const allProblems = validate(filePackage)
      const expectations = allExpectations(filePackage)

      filePackage.forEach(node => {
        const problems = allProblems.filter(_ => _.node === node)
        const expectationsForNode = expectations.get(node) || []

        for (const expectation of expectationsForNode) {
          const type = expectation.args['type']

          if (type) { // Assert type
            const nodeType = node.type.name
            if (type !== nodeType) fail(`Expected ${type} but got ${nodeType} for ${node}`)

          } else { // Assert problem
            const expectedProblem = validateExpectationProblem(expectation, problems, node, fileContent)
            problems.splice(problems.indexOf(expectedProblem), 1)
          }
        }

        expect(problems.length).toBe(0)
      })
    })
  })
})