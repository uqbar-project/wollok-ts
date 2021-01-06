import { basename } from 'path'
import yargs from 'yargs'
import { Evaluation, RuntimeObject, Frame, PUSH, INIT, compile } from '../src/interpreter'
import { LogLevel, ConsoleLogger } from '../src/log'
import { List, Node, Module } from '../src/model'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './assertions'

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
          // TODO: Describe is a module?
          // TODO: If the GC runs after describe is initialized it will destroy the instance. Maybe they should be treated as singletons...
          const describeInstance = RuntimeObject.object(evaluation, node as unknown as Module)

          evaluation.pushFrame(new Frame(describeInstance, [
            PUSH(describeInstance.id),
            INIT([]),
            ...node.fixtures().flatMap(fixture => compile(fixture)),
          ]))
          evaluation.stepAll()
        })

        registerTests(evaluation, node.members)
      })
    }

    else if (node.is('Test')) it(node.name, () => {
      const evaluation = baseEvaluation.copy()
      const instructions = compile(node)

      evaluation.log.separator(node.name)
      evaluation.log.resetStep()

      evaluation.pushFrame(new Frame(node.parent().is('Describe') ? evaluation.instance(node.parent().id) : evaluation.currentContext, instructions))
      evaluation.stepAll()
    })

  })
}

describe(basename(ARGUMENTS.root), () => {
  const environment = buildEnvironment('**/*.@(wlk|wtest)', ARGUMENTS.root)
  const evaluation = Evaluation.create(environment, natives)

  if (ARGUMENTS.verbose) evaluation.log = new ConsoleLogger(LogLevel.DEBUG)

  registerTests(evaluation, evaluation.environment.members)
})