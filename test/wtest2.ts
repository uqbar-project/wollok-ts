import { basename } from 'path'
import yargs from 'yargs'
import { List, Node } from '../src/model'
import { buildEnvironment } from './assertions'
import { Runner, Context } from '../src/interpreter2/runtimeModel'
import natives from '../src/wre2/wre.natives'

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


function registerTests(nodes: List<Node>) {
  nodes.forEach(node => {
    if (node.is('Package')) describe(node.name, () => registerTests(node.members))

    else if (node.is('Describe')) {

      describe(node.name, () => {
        before(() => {
          // TODO: Describe is a module?
          // const describeInstance = runner.instantiate(node as unknown as Module)
        })

        registerTests(node.members)
      })
    }

    else if (node.is('Test') && !node.parent().children().some(sibling => node !== sibling && sibling.is('Test') && sibling.isOnly))
      it(node.name, () => {
        const runner = new Runner(node.environment(), natives)

        // TODO: Use a run controller
        const generator = runner.exec(node.body, new Context())
        let result = generator.next()
        while(!result.done) result = generator.next()
      })

  })
}

async function defineTests() {
  const environment = await buildEnvironment('**/*.@(wlk|wtest)', ARGUMENTS.root, true)
  describe(basename(ARGUMENTS.root), () => registerTests(environment.members))
}

defineTests().then(run).catch(e => {
  error(e)
  process.exit(1)
})