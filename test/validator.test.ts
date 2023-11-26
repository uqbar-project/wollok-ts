import { fail } from 'assert'
import { should } from 'chai'
import { Annotation } from '../src'
import validate from '../src/validator'
import { Node, Problem } from './../src/model'
import { allExpectations, buildEnvironmentForEachFile, errorLocation, matchesExpectationProblem, validateExpectationProblem } from './utils'

const TESTS_PATH = 'language/test/validations'

should()

describe('Wollok Validations', () => {

  buildEnvironmentForEachFile(TESTS_PATH, (filePackage) => {

    it(filePackage.name, () => {
      const allProblems = validate(filePackage)
      const expectations = allExpectations(filePackage)

      filePackage.forEach(node => {
        const problems = allProblems.filter(_ => _.node === node)
        const expectedProblems = expectations.get(node) || []

        for (const expectedProblem of expectedProblems) {
          validateExpectationProblem(expectedProblem, problems, node)
        }

        for (const problem of problems) {
          if (!expectedProblems.some(expectedProblem => matchesExpectationProblem(problem, node, expectedProblem)))
            fail(`Unexpected ${problem.code} ${problem.level} at ${errorLocation(node)}`)
        }
      })
    })
  })
})