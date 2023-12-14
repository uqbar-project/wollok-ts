import { fail } from 'assert'
import { should } from 'chai'
import { getPotentiallyUninitializedLazy } from '../src/decorators'
import { inferTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import validate from '../src/validator'
import { allExpectations, buildEnvironmentForEachFile, validateExpectationProblem } from './utils'

const TESTS_PATH = 'language/test/typeSystem'

should()

describe('Wollok Type System Inference', () => {


  buildEnvironmentForEachFile(TESTS_PATH, (filePackage) => {
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
            const expectedProblem = validateExpectationProblem(expectation, problems, node)
            problems.splice(problems.indexOf(expectedProblem), 1)
          }
        }

        problems.should.be.empty
      })
    })
  })
})