import { basename } from 'path'
import yargs from 'yargs'
import { Evaluation, RuntimeObject, Frame } from '../src/interpreter/runtimeModel'
import compile, { PUSH, INIT } from '../src/interpreter/compiler'
import { LogLevel, ConsoleLogger } from '../src/interpreter/log'
import { List, Node, Module } from '../src/model'
import natives from '../src/wre/wre.natives'
import { buildEnvironment } from './assertions'

const { error } = console

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
          ]))
          evaluation.stepAll()
        })

        registerTests(evaluation, node.members)
      })
    }

    else if (node.is('Test') && !node.parent().children().some(sibling => node !== sibling && sibling.is('Test') && sibling.isOnly))
      it(node.name, () => {
        const evaluation = baseEvaluation.copy()
        const instructions = compile(node)

        evaluation.log.separator(node.name)
        evaluation.log.resetStep()

        evaluation.pushFrame(new Frame(node.parent().is('Describe') ? evaluation.instance(node.parent().id) : evaluation.currentContext, instructions))
        evaluation.stepAll()
      })

  })
}

async function defineTests() {
  const environment = await buildEnvironment('**/*.@(wlk|wtest)', ARGUMENTS.root, true)
  const evaluation = Evaluation.create(environment, natives)

  describe(basename(ARGUMENTS.root), () => {
    if (ARGUMENTS.verbose) evaluation.log = new ConsoleLogger(LogLevel.DEBUG)
    registerTests(evaluation, evaluation.environment.members)
  })
}

defineTests().then(run).catch(e => {
  error(e)
  process.exit(1)
})