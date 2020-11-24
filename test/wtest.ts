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
  .option('ignore', {
    type: 'array',
    string: true,
    default: [],
    description: 'Paths to ignore',
  })
  .argv


function selectTests(nodes: List<Node>) {
  const onlyTest = nodes.find(node => node.is('Test') && node.isOnly)
  return onlyTest ? [onlyTest] : nodes
}

function registerTests(evaluation: Evaluation, nodes: List<Node>) {
  nodes.forEach(node => {

    if (node.is('Describe') || node.is('Package'))
      describe(node.name, () => registerTests(evaluation, selectTests(node.members)))

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

  const { buildEvaluation } = buildInterpreter('**/*.@(wlk|wtest)', ARGUMENTS.root, ...ARGUMENTS.ignore)

  time('Initializing Evaluation')
  const baseEvaluation = buildEvaluation()

  timeEnd('Initializing Evaluation')

  registerTests(baseEvaluation, baseEvaluation.environment.members)

})