import { basename } from 'path'
import yargs from 'yargs'
import { TEST_FILE_EXTENSION, WOLLOK_FILE_EXTENSION } from '../src'
import { List } from '../src/extensions'
import { interpret, Interpreter } from '../src/interpreter/interpreter'
import { Describe, Node, Package, Test } from '../src/model'
import { buildEnvironment, readNatives } from './utils'

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


function registerTests(nodes: List<Node>, interpreter: Interpreter) {
  nodes.forEach(node => {
    if (node.is(Package)) describe(node.name, () => registerTests(node.members, interpreter))

    else if (node.is(Describe)) describe(node.name, () => {
      const onlyTest = node.tests.find(test => test.isOnly)
      registerTests(onlyTest ? [onlyTest] : node.tests, interpreter)
    })

    else if (node.is(Test) && !node.parent.children.some(sibling => node !== sibling && sibling.is(Test) && sibling.isOnly))
      it(node.name, () => interpreter.fork().exec(node))

  })
}

(async function () {
  const root = (await ARGUMENTS).root
  const environment = await buildEnvironment(`**/*.@(${WOLLOK_FILE_EXTENSION}|${TEST_FILE_EXTENSION})`, root, true)
  const natives = await readNatives(root)
  describe(basename(root), () => registerTests(environment.members, interpret(environment, natives)))
})()
  .then(run)
  .catch(e => {
    error(e)
    process.exit(1)
  })