import { basename } from 'path'
import yargs from 'yargs'
import { List, Node } from '../src/model'
import { buildEnvironment } from './assertions'
import { Evaluation, WollokException, RuntimeObject, ExecutionDirector } from '../src/interpreter/runtimeModel'
import natives from '../src/wre/wre.natives'

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


function registerTests(nodes: List<Node>, evaluation: Evaluation) {
  nodes.forEach(node => {
    if (node.is('Package')) describe(node.name, () => registerTests(node.members, evaluation))

    else if (node.is('Describe')) describe(node.name, () => {
      const onlyTest = node.tests().find(test => test.isOnly)
      registerTests(onlyTest ? [onlyTest] : node.tests(), evaluation)
    })

    else if (node.is('Test') && !node.parent().children().some(sibling => node !== sibling && sibling.is('Test') && sibling.isOnly))
      it(node.name, () => {
        const testEvaluation = evaluation.copy()
        const execution = new ExecutionDirector(testEvaluation, function*(){ yield* this.exec(node) })
        const result = execution.finish()
        if(result.error) {
          logError(result.error)
          throw result.error
        }
      })

  })
}

function logError(error: any) {
  if(error instanceof WollokException) {
    const errorInstance: RuntimeObject = error.instance // TODO: implement innerError instead ?
    errorInstance.assertIsException()
    console.group(errorInstance.innerValue ? `Unhandled TypeScript Exception during Wollok evaluation - ${errorInstance.innerValue}` : `Unhandled Wollok Exception - ${errorInstance.module.fullyQualifiedName()}: "${errorInstance.get('message')?.innerString}"`)
    for(const frame of [...error.frameStack].reverse())
      console.info(`at ${frame.label} [${frame.node.kind}:${frame.node.id.slice(-5)}](${frame.node.sourceFileName() ?? '--'}:${frame.node.sourceMap ? frame.node.sourceMap.start.line + ':' + frame.node.sourceMap.start.column : '--'})`)
    console.groupEnd()
  }
}


(async function () {
  const environment = await buildEnvironment('**/*.@(wlk|wtest)', (await ARGUMENTS).root, true)
  describe(basename((await ARGUMENTS).root), () => registerTests(environment.members, Evaluation.build(environment, natives)))
})()
  .then(run)
  .catch(e => {
    error(e)
    process.exit(1)
  })