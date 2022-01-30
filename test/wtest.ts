import { basename } from 'path'
import yargs from 'yargs'
import { Node } from '../src/model'
import { List } from '../src/extensions'
import { buildEnvironment } from './assertions'
import interpret, { Interpreter } from '../src/interpreter/interpreter'
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


function registerTests(nodes: List<Node>, interpreter: Interpreter) {
  nodes.forEach(node => {
    if (node.is('Package')) describe(node.name, () => registerTests(node.members, interpreter))

    else if (node.is('Describe')) describe(node.name, () => {
      const onlyTest = node.tests().find(test => test.isOnly)
      registerTests(onlyTest ? [onlyTest] : node.tests(), interpreter)
    })

    else if (node.is('Test') && !node.parent.children().some(sibling => node !== sibling && sibling.is('Test') && sibling.isOnly))
      it(node.name, () => interpreter.fork().exec(node) )

  })
}

(async function () {
  const environment = await buildEnvironment('**/*.@(wlk|wtest)', (await ARGUMENTS).root, true)
  describe(basename((await ARGUMENTS).root), () => registerTests(environment.members, interpret(environment, natives)))
})()
  .then(run)
  .catch(e => {
    error(e)
    process.exit(1)
  })