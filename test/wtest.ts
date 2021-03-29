import { basename } from 'path'
import yargs from 'yargs'
import { is, List, Module, Node } from '../src/model'
import { buildEnvironment } from './assertions'
import { Runner, WollokException, Context, RuntimeObject } from '../src/interpreter/runtimeModel'
import natives from '../src/wre/wre.natives'
import { traverse } from '../src/extensions'

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


function registerTests(nodes: List<Node>, evaluation: Runner) {
  nodes.forEach(node => {
    if (node.is('Package')) describe(node.name, () => registerTests(node.members, evaluation))

    else if (node.is('Describe')) describe(node.name, () => registerTests(node.tests(), evaluation))

    else if (node.is('Test') && !node.parent().children().some(sibling => node !== sibling && sibling.is('Test') && sibling.isOnly))
      it(node.name, () => {
        const runner = evaluation.copy()
        const runTest = function* () {
          const context = node.parent().is('Describe')
            ? yield* runner.instantiate(node.parent() as unknown as Module)
            : new Context(runner.currentContext)

          return yield* runner.exec(node.body, context)
        }

        const generator = runTest()
        try {
          // TODO: Use a run controller
          traverse(generator)
        } catch (error) {
          logError(error)
          throw error
        }
      })

  })
}

// TODO: This is quite ugly...
function logError(error: any) {
  if(error instanceof WollokException) {
    const errorInstance: RuntimeObject = error.instance
    errorInstance.assertIsException()
    console.group(errorInstance.innerValue ? `Unhandled Native Exception: ${errorInstance.innerValue.constructor.name} "${errorInstance.innerValue.message}"` : `Unhandled Wollok Exception: ${error.instance.module.fullyQualifiedName()} "${error.instance.get('message')?.innerValue}"`)
    for(const frame of [...error.frameStack].reverse()) {
      let label: string
      if(frame.node.is('Body')) {
        const parent = frame.node.parent()
        if(parent.is('Method')) label = `${parent.parent().fullyQualifiedName()}.${parent.name}`
        else if(parent.is('Entity')) label = `${parent.fullyQualifiedName()}`
        else {
          const container = parent.ancestors().find(is('Method'))
          label = container
            ? `${container.parent().fullyQualifiedName()}.${container.name} >> ${parent.kind}`
            : `${parent.ancestors().find(is('Entity'))?.fullyQualifiedName()} >> ${parent.kind}`
        }
      } else if(frame.node.is('Method')) {
        label = `${frame.node.parent().fullyQualifiedName()}.${frame.node.name}`
      } else if(frame.node.is('Environment')) {
        label = frame.node.kind
      } else {
        const container = frame.node.ancestors().find(is('Method'))
        label = container
          ? `${container.parent().fullyQualifiedName()}.${container.name} >> ${frame.node.kind} ${frame.node.is('Send') ? frame.node.message : ''}`
          : `${frame.node.ancestors().find(is('Entity'))?.fullyQualifiedName()} >> ${frame.node.kind} ${frame.node.is('Send') ? frame.node.message : ''}`
      }

      console.info(`at wollok ${label}(${frame.node.source?.start?.line ?? '--'}:${frame.node.source?.start?.column ?? '--'})`)
    }
    console.groupEnd()
  }
}


(async function () {
  const environment = await buildEnvironment('**/*.@(wlk|wtest)', ARGUMENTS.root, true)
  describe(basename(ARGUMENTS.root), () => registerTests(environment.members, Runner.build(environment, natives)))
})()
  .then(run)
  .catch(e => {
    error(e)
    process.exit(1)
  })