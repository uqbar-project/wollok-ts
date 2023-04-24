import { fail } from 'assert'
import { should } from 'chai'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { Annotation, buildEnvironment } from '../src'
import { notEmpty } from '../src/extensions'
import validate from '../src/validator'
import { Node, Problem } from '../src/model'
import { getType, infer } from '../src/typeSystem'

const TESTS_PATH = 'language/test/typeSystem'

should()

describe('Wollok Type System', () => {
  const files = globby.sync('**/*.@(wlk|wtest|wpgm)', { cwd: TESTS_PATH }).map(name => ({
    name,
    content: readFileSync(join(TESTS_PATH, name), 'utf8'),
  }))
  const environment = buildEnvironment(files)

  infer(environment)

  for (const file of files) {
    const packageName = file.name.split('.')[0]

    it(packageName, () => {
      const filePackage = environment.getNodeByFQN(packageName)
      const allExpectations = new Map<Node, Annotation[]>()

      filePackage.forEach(node => {
        node.metadata.filter(_ => _.name === 'Expect').forEach(expectedProblem => {
          if (!allExpectations.has(node)) allExpectations.set(node, [])
          allExpectations.get(node)!.push(expectedProblem)
        })
      })

      filePackage.forEach(node => {
        const expectedTypes = allExpectations.get(node) || []

        for (const expectedType of expectedTypes) {
          const type = expectedType.args['type']!

          if (!type) fail('Missing required "type" argument in @Expect annotation')

          if (type !== getType(node)) fail(`Expected ${type} but got ${getType(node)} for ${node}`)
        }
      })
    })
  }
})