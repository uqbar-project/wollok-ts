import { fail } from 'assert'
import { should } from 'chai'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { Annotation, buildEnvironment, Class, Literal, Node, Reference } from '../src'
import { List } from '../src/extensions'
import { getType, infer } from '../src/typeSystem'
import validate from '../src/validator'

const TESTS_PATH = 'language/test/typeSystem'

should()

describe('Wollok Type System Inference', () => {
  const files = globby.sync('**/*.@(wlk|wtest|wpgm)', { cwd: TESTS_PATH }).map(name => ({
    name,
    content: readFileSync(join(TESTS_PATH, name), 'utf8'),
  }))
  const environment = buildEnvironment(files)
  const logger = undefined
  // You can use the logger to debug the type system inference in customized way, for example:
  // { log: (message: String) => { if (message.includes('[Reference]')) console.log(message) } }
  infer(environment, logger)

  for (const file of files) {
    const packageName = file.name.split('.')[0]

    it(packageName, () => {
      const expectations = new Map<Node, Annotation[]>()
      const filePackage = environment.getNodeByFQN(packageName)
      const problems = [...validate(filePackage)]

      filePackage.forEach(node => {
        node.metadata.filter(_ => _.name === 'Expect').forEach(expectedProblem => {
          if (!expectations.has(node)) expectations.set(node, [])
          expectations.get(node)!.push(expectedProblem)
        })
      })

      filePackage.forEach(node => {
        const expectationsForNode = expectations.get(node) || []

        for (const expectation of expectationsForNode) {
          const type = expectation.args['type']
          if (type) { // Assert type
            if (type !== getType(node)) fail(`Expected ${type} but got ${getType(node)} for ${node}`)

          } else { // Assert error
            //TODO: Reuse this in validator.test.ts
            const code = expectation.args['code']
            if (!code) fail(`Missing required "type" argument in @Expect annotation ${expectation}`)
            const level = expectation.args['level']
            if (!level) fail(`Missing required "level" argument in @Expect annotation ${expectation}`)
            const literalValues = expectation.args['values'] as [Reference<Class>, List<Literal<string>>]
            const values = literalValues
              ? literalValues[1].map(literal => literal.value)
              : []
            const expectedProblem = problems.find(problem =>
              problem.node === node && problem.code === code && problem.level === level
              && problem.values.join(',') === values.join(','))

            if (!expectedProblem) fail(`Expected problem ${code} not found for ${node}`)
            problems.splice(problems.indexOf(expectedProblem), 1)
          }
        }
      })

      problems.should.be.empty
    })
  }
})