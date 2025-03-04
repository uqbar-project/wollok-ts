import { fail } from 'assert'
import { should } from 'chai'
import { join } from 'path'
import validate from '../src/validator'
import { allExpectations, buildEnvironmentForEachPackage, errorLocation, matchesExpectationProblem, validateExpectationProblem } from './utils'

const TESTS_PATH = join('language', 'test', 'validations')

should()

describe('Wollok Validations', () => {

  buildEnvironmentForEachPackage(TESTS_PATH, (filePackage, fileContent) => {

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
            fail(`Unexpected ${problem.code} ${problem.level} at ${errorLocation(node)}`)
        }
      })
    })
  })
})