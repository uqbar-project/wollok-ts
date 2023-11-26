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






  // const files = globby.sync('**/*.@(wlk|wtest|wpgm)', { cwd: TESTS_PATH }).map(name => ({
  //   name,
  //   content: readFileSync(join(TESTS_PATH, name), 'utf8'),
  // }))
  // const environment = buildEnvironment(files)
  // const logger = undefined
  // // You can use the logger to debug the type system inference in customized way, for example:
  // // { log: (message: string) => { if (message.includes('[Reference]')) console.log(message) } }
  // inferTypes(environment, logger)

  // for (const file of files) {
  //   const packageName = file.name.split('.')[0]

  //   it(packageName, () => {
  //     const expectations = new Map<Node, Annotation[]>()
  //     const filePackage = environment.getNodeByFQN(packageName)
  //     const problems = [...validate(filePackage)]

  //     filePackage.forEach(node => {
  //       node.metadata.filter(_ => _.name === 'Expect').forEach(expectedProblem => {
  //         if (!expectations.has(node)) expectations.set(node, [])
  //         expectations.get(node)!.push(expectedProblem)
  //       })
  //     })

  //     filePackage.forEach(node => {
  //       const expectationsForNode = expectations.get(node) || []

  //       for (const expectation of expectationsForNode) {
  //         const type = expectation.args['type']
  //         if (type) { // Assert type
  //           const nodeType = node.type.name
  //           if (type !== nodeType) fail(`Expected ${type} but got ${nodeType} for ${node}`)

  //         } else { // Assert error
  //           //TODO: Reuse this in validator.test.ts
  //           const code = expectation.args['code']
  //           if (!code) fail(`Missing required "type" argument in @Expect annotation ${expectation}`)
  //           const level = expectation.args['level']
  //           if (!level) fail(`Missing required "level" argument in @Expect annotation ${expectation}`)
  //           const literalValues = expectation.args['values'] as [Reference<Class>, List<Literal<string>>]
  //           const values = literalValues
  //             ? literalValues[1].map(literal => literal.value)
  //             : []
  //           const expectedProblem = problems.find(problem =>
  //             problem.node === node && problem.code === code && problem.level === level
  //             && problem.values.join(',') === values.join(','))

  //           if (!expectedProblem) fail(`Expected problem ${code} not found for ${node}`)
  //           problems.splice(problems.indexOf(expectedProblem), 1)
  //         }
  //       }
  //     })

  //     problems.should.be.empty
  //   })
  // }
})