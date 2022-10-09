import { Node, Problem } from './../src/model'
import { Annotation, buildEnvironment } from '../src'
import globby from 'globby'
import { readFileSync } from 'fs'
import { join } from 'path'
import validate from '../src/validator'
import { should } from 'chai'
import { fail } from 'assert'
import { notEmpty } from '../src/extensions'

const TESTS_PATH = 'language/test/validations'

should()

describe('Wollok Validations', () => {
  const files = globby.sync('**/*.@(wlk|wtest|wpgm)', { cwd: TESTS_PATH }).map(name => ({
    name,
    content: readFileSync(join(TESTS_PATH, name), 'utf8'),
  }))
  const environment = buildEnvironment(files)

  const matchesExpectation = (problem: Problem, expected: Annotation, node: Node) => {
    const code = expected.args.get('code')!
    return problem.code === code && problem.sourceMap?.toString() === node.sourceMap?.toString()
  }

  const errorLocation = (node: Node | Problem): string => `${node.sourceMap}`

  for (const file of files) {
    const packageName = file.name.split('.')[0]

    it(packageName, () => {
      const filePackage = environment.getNodeByFQN(packageName)
      const allProblems = validate(filePackage)

      filePackage.forEach(node => {
        const problems = allProblems.filter(_ => _.node === node)
        const expectedProblems = node.metadata.filter(_ => _.name === 'Expect')

        for (const expectedProblem of expectedProblems) {
          const code = expectedProblem.args.get('code')!
          const level = expectedProblem.args.get('level')

          if (!code) fail('Missing required "code" argument in @Expect annotation')

          const errors = problems.filter(problem => !matchesExpectation(problem, expectedProblem, node))
          if (notEmpty(errors))
            fail(`File contains errors: ${errors.map((_error) => _error.code + ' at ' + errorLocation(_error)).join(', ')}`)

          const effectiveProblem = problems.find(problem => matchesExpectation(problem, expectedProblem, node))
          if (!effectiveProblem) {
            debugger;
            fail(`Missing expected ${code} ${level ?? 'problem'} at ${errorLocation(node)}`)
          }

          if (level && effectiveProblem.level !== level)
            fail(`Expected ${code} to be ${level} but was ${effectiveProblem.level} at ${errorLocation(node)}`)
        }

        for (const problem of problems) {
          if (!expectedProblems.some(expectedProblem => matchesExpectation(problem, expectedProblem, node)))
            fail(`Unexpected ${problem.code} ${problem.level} at ${errorLocation(node)}`)
        }
      })
    })
  }
})