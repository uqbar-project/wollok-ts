import { join } from 'path'
import validate from '../src/validator'
import { allExpectations, buildEnvironmentForEachFile, errorLocation, matchesExpectationProblem, validateExpectationProblem } from './utils'
import { describe, expect, it } from 'vitest'

const TESTS_PATH = join('language', 'test', 'validations')

describe('Wollok Validations', () => {

  buildEnvironmentForEachFile(TESTS_PATH, (filePackage, fileContent) => {

    it(filePackage.fileName!, () => {
      const allProblems = validate(filePackage)
      const expectations = allExpectations(filePackage)

      filePackage.forEach(node => {
        const problems = allProblems.filter(_ => _.node === node)
        const expectedProblems = expectations.get(node) || []

        for (const expectedProblem of expectedProblems) {
          validateExpectationProblem(expectedProblem, problems, node, fileContent)
        }

        for (const problem of problems) {
          if (!expectedProblems.some(expectedProblem => matchesExpectationProblem(problem, node, expectedProblem)))
            expect.fail(`Unexpected ${problem.code} ${problem.level} at ${errorLocation(node)}`)
        }
      })
    })
  })
})