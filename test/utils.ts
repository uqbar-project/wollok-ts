import { fail } from 'assert'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { Annotation, buildEnvironment, Class, FileContent, Literal, Node, Package, Problem, Reference, SourceMap } from '../src'
import { List, notEmpty } from '../src/extensions'

export function buildEnvironmentForEachFile(folderPath: string, iterator: (filePackage: Package, fileContent: FileContent) => void): void {
  const files = globby.sync('**/*.@(wlk|wtest|wpgm)', { cwd: folderPath }).map(name => ({
    name,
    content: readFileSync(join(folderPath, name), 'utf8'),
  }))
  const environment = buildEnvironment(files)

  for (const file of files) {
    const packageName = file.name.split('.')[0]
    iterator(environment.getNodeByFQN(packageName), file)
  }
}

export function allExpectations(parentNode: Node): Map<Node, Annotation[]> {
  const allExpectations = new Map<Node, Annotation[]>()
  parentNode.forEach(node => {
    node.metadata.filter(_ => _.name === 'Expect').forEach(expectedProblem => {
      const path = expectedProblem.args['path']
      const expectedNode: Node = path ? (node as any)[path as any] : node
      if (!allExpectations.has(expectedNode)) allExpectations.set(expectedNode, [])
            allExpectations.get(expectedNode)!.push(expectedProblem)
    })
  })
  return allExpectations
}

export const matchesExpectationProblem = (problem: Problem, annotatedNode: Node, expected: Annotation): boolean => {
  const code = expected.args['code']!
  return problem.code === code && !!annotatedNode.sourceMap?.includes(problem.sourceMap!)
}

export const errorLocation = (node: Node | Problem): string => `${node.sourceMap}`

const getProblemAsTextFor = (content: string, sourceMap: SourceMap) =>
  content.substring(sourceMap.start.offset, sourceMap.end.offset)

export const validateExpectationProblem = (expectedProblem: Annotation, nodeProblems: Problem[], node: Node, fileContent: FileContent): Problem => {
  const code = expectedProblem.args['code']
  const level = expectedProblem.args['level']
  const values = expectedProblem.args['values']

  if (!code) fail('Missing required "code" argument in @Expect annotation')

  const errors = nodeProblems.filter(problem => !matchesExpectationProblem(problem, node, expectedProblem))
  if (notEmpty(errors))
    fail(`File contains errors: ${errors.map((_error) => _error.code + ' at ' + errorLocation(_error)).join(', ')}`)

  const effectiveProblem = nodeProblems.find(problem => matchesExpectationProblem(problem, node, expectedProblem))
  if (!effectiveProblem)
    fail(`Missing expected ${code} ${level ?? 'problem'} at ${errorLocation(node)}`)

  if (level && effectiveProblem.level !== level)
    fail(`Expected ${code} to be ${level} but was ${effectiveProblem.level} at ${errorLocation(node)}`)

  const expectedOn = expectedProblem.args['expectedOn']
  if (expectedOn) {
    const underlinedProblem = getProblemAsTextFor(fileContent.content, effectiveProblem.sourceMap ?? node.sourceMap!)
    if (underlinedProblem != expectedOn) {
      fail(`Expected ${code} to fail in [${expectedOn}] but failed in [${underlinedProblem}] at ${errorLocation(node)}`)
    }
  }

  if (values) {
    const stringValues = (values as [Reference<Class>, List<Literal<string>>])[1].map(v => v.value)
    if (stringValues.join('||') !== effectiveProblem.values.join('||'))
      fail(`Expected ${code} to have ${JSON.stringify(stringValues)} but was ${JSON.stringify(effectiveProblem.values)} at ${errorLocation(node)}`)
  }

  return effectiveProblem
}