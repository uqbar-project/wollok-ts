import { fail } from 'assert'
import { readFileSync } from 'fs'
import globby from 'globby'
import { join } from 'path'
import { Annotation, buildEnvironment, Class, Environment, FileContent, fromJSON, link, Literal, Node, Package, Problem, PROGRAM_FILE_EXTENSION, Reference, REPL, SourceMap, TEST_FILE_EXTENSION, WOLLOK_FILE_EXTENSION } from '../src'
import { divideOn, List, notEmpty } from '../src/extensions'
import wre from '../src/wre/wre.json'

export const INIT_FILE = 'definitions'

export function buildEnvironmentForEachFile(folderPath: string, iterator: (filePackage: Package, fileContent: FileContent) => void): void {
  const files = globby.sync(`**/*.@(${WOLLOK_FILE_EXTENSION}|${TEST_FILE_EXTENSION}|${PROGRAM_FILE_EXTENSION})`, { cwd: folderPath }).map(name => ({
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
  return problem.code === code && matchSourceMap(annotatedNode.sourceMap, problem.sourceMap)
}


function matchSourceMap(annotatedSourceMap?: SourceMap, problemSourceMap?: SourceMap): boolean {
  return annotatedSourceMap === undefined && problemSourceMap === undefined
    || !!problemSourceMap && !!annotatedSourceMap?.includes(problemSourceMap)
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

export const environmentWithREPLInitializedFile = (content: string, name = INIT_FILE): Environment => {
  const environment = buildEnvironment([{ name: name + '.wlk', content }])
  const initPackage = environment.getNodeByFQN<Package>(name)
  environment.scope.register([REPL, initPackage])
  return environment
}

export const environmentWithEntities = (...fqns: string[]): Environment =>
  fqns.reduce((env, fqn) => link([newPackageWith(WREEnvironment, fqn)], env), link([]))


const newPackageWith = (env: Environment, fullFQN: string): Package => {
  const buildNewPackages = (_fqn: string): Package => {
    const [start, rest] = divideOn('.')(_fqn)

    return rest.length
      ? new Package({ name: start, members: [buildNewPackages(rest)] })
      : link([], env).getNodeByFQN(fullFQN) // Finish with the real node
  }
  return buildNewPackages(fullFQN)
}

// TODO: Split uber-tests into smaller tests with clearer descriptions (??)
// TODO: How about creating FQN for more nodes? Like p.q.C.m(0) ? YES!
export const WREEnvironment: Environment = fromJSON(wre)