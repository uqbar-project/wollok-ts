import { fail } from 'assert'
import { should } from 'chai'
import { join } from 'path'
import { getPotentiallyUninitializedLazy } from '../src/decorators'
import { inferTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import validate from '../src/validator'
import { allExpectations, forEachFileBuildEnvironment, validateExpectationProblem } from './utils'

const TESTS_PATH = join('language', 'test', 'typesystem')

should()

describe('Wollok Type System Inference', () => {

  forEachFileBuildEnvironment(TESTS_PATH, (filePackage, fileContent) => {
    const { environment } = filePackage
    const logger = // undefined
    // You can use the logger to debug the type system inference in customized way, for example:
    { log: (message: string) => { if (message.includes('collections.wlk:144')) console.log(message) } }
    
    // if (!filePackage.name.includes('instantiation')) return;
    
    it(filePackage.name, () => {
      inferTypes(environment, logger)
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

        problems.should.be.empty
      })
    })
  })
})