import { Node } from './../src/model'
import { Annotation, buildEnvironment } from '../src'
import globby from 'globby'
import { readFileSync } from 'fs'
import { join } from 'path'
import validate, { Problem } from '../src/validator'
import { should } from 'chai'
import { fail } from 'assert'

const TESTS_PATH = 'language/test/validations'

should()

describe('Wollok Validations', () => {
  const files = globby.sync('**/*.@(wlk|wtest)', { cwd: TESTS_PATH }).map(name => ({
    name,
    content: readFileSync(join(TESTS_PATH, name), 'utf8'),
  }))
  const environment = buildEnvironment(files)

  const matchesExpectation = (problem: Problem, expected: Annotation) => {
    const code = expected.args.get('code')!
    return problem.code === code
  }

  const errorLocation = (node: Node): string => `${node.sourceMap?.start.line}:${node.sourceMap?.start.column}`

  for(const file of files) {
    const packageName = file.name.split('.')[0]

    it(packageName, () => {
      const filePackage = environment.getNodeByFQN(packageName)

      const nodesWithFileErrors = filePackage.reduce((nodesWithProblems, node) => node.hasProblems() ? [...nodesWithProblems, node] : nodesWithProblems, [] as Node[])
      if (nodesWithFileErrors.length > 0)
        fail(`Problems in file. ${nodesWithFileErrors.map(node => node.problems![0].code + ' at ' + errorLocation(node))}`)

      const allProblems = validate(filePackage)

      filePackage.forEach(node => {
        const problems = allProblems.filter(_ => _.node === node)
        const expectedProblems = node.metadata.filter(_ => _.name === 'Expect')

        for(const expectedProblem of expectedProblems) {
          const code = expectedProblem.args.get('code')!
          const level = expectedProblem.args.get('level')

          if(!code) fail('Missing required "code" argument in @Expect annotation')

          const errors = allProblems.filter(problem => !matchesExpectation(problem, expectedProblem))
          if (errors.length > 0)
            fail(`File contains errors: ${errors.join(', ')}`)

          const effectiveProblem = problems.find(problem => matchesExpectation(problem, expectedProblem))
          if(!effectiveProblem)
            fail(`Missing expected ${code} ${level ?? 'problem'} at ${errorLocation(node)}`)

          if(level && effectiveProblem.level !== level)
            fail(`Expected ${code} to be ${level} but was ${effectiveProblem.level} at ${errorLocation(node)}`)
        }

        for(const problem of problems) {
          if(!expectedProblems.some(expectedProblem => matchesExpectation(problem, expectedProblem)))
            fail(`Unexpected ${problem.code} ${problem.level} at ${errorLocation(node)}`)
        }
      })
    })
  }
})