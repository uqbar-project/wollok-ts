import { assert } from 'chai'
import { basename } from 'path'
import yargs from 'yargs'
import { Evaluation, RuntimeObject, Frame, PUSH, INIT_NAMED, compileSentence, stepAll } from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import { List, Node, Module } from '../src/model'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './assertions'

const { fail } = assert

const ARGUMENTS = yargs
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .option('root', {
    demandOption: true,
    type: 'string',
    description: 'Path to the root test folder',
  })
  .argv


function registerTests(baseEvaluation: Evaluation, nodes: List<Node>) {
  nodes.forEach(node => {
    if (node.is('Package')) describe(node.name, () => registerTests(baseEvaluation, node.members))

    else if (node.is('Describe')) {
      const evaluation = baseEvaluation.copy()

      describe(node.name, () => {
        before(() => {
          const describeInstance = RuntimeObject.object(evaluation, node as unknown as Module) // TODO: Describe is a module?

          evaluation.frameStack.push(new Frame(describeInstance, [
            PUSH(describeInstance.id),
            INIT_NAMED([]),
            ...compileSentence(evaluation.environment)(
              ...node.fixtures().flatMap(fixture => fixture.body.sentences),
            ),
          ]))
          stepAll(natives)(evaluation)
        })

        registerTests(evaluation, node.members)
      })
    }

    else if (node.is('Test')) it(node.name, () => {
      log.resetStep()

      const evaluation = baseEvaluation.copy()
      const instructions = compileSentence(evaluation.environment)(...node.body.sentences)

      try {
        evaluation.frameStack.push(new Frame(evaluation.currentContext, instructions))
        stepAll(natives)(evaluation)
        evaluation.frameStack.pop()!
      } catch (error) {
        log.error(error)
        fail(`${error}`)
      }

    })

  })
}

describe(basename(ARGUMENTS.root), () => {
  if (ARGUMENTS.verbose) enableLogs(LogLevel.DEBUG)

  const environment = buildEnvironment('**/*.@(wlk|wtest)', ARGUMENTS.root)

  const evaluation = Evaluation.of(environment, natives)

  registerTests(evaluation, evaluation.environment.members)
})