import { assert } from 'chai'
import { basename } from 'path'
import yargs from 'yargs'
import interpreter, { Evaluation, Natives } from '../src/interpreter'
import log, { enableLogs, LogLevel } from '../src/log'
import { List, Node } from '../src/model'
import natives from '../src/wre/wre.natives'
import { buildInterpreter } from './assertions'

const { fail } = assert
const { time, timeEnd } = console

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


function registerTests(evaluation: Evaluation, nodes: List<Node>) {
  nodes.forEach(node => {

    if (node.is('Describe') || node.is('Package'))
      describe(node.name, () => registerTests(evaluation, node.members))

    if (node.is('Test'))
      it(node.name, () => {
        const { runTest } = interpreter(evaluation.environment, natives as Natives)
        const { error } = runTest(evaluation.copy(), node)
        if (error) {
          log.error(error)
          fail(`${error}`)
        }
      })

  })
}


describe(basename(ARGUMENTS.root), () => {

  if (ARGUMENTS.verbose) enableLogs(LogLevel.DEBUG)

  const { stepAll, buildEvaluation } = buildInterpreter('**/*.@(wlk|wtest)', ARGUMENTS.root)

  time('Initializing Evaluation')
  const baseEvaluation = buildEvaluation()
  stepAll(baseEvaluation)
  baseEvaluation.popFrame()

  timeEnd('Initializing Evaluation')

  registerTests(baseEvaluation, baseEvaluation.environment.members)

})