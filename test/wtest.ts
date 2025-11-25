#!/usr/bin/env tsx

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { TEST_FILE_EXTENSION, WOLLOK_FILE_EXTENSION } from '../src'
import { interpret } from '../src/interpreter/interpreter'
import { buildEnvironment, readNatives } from './utils'
import { Describe, Node, Package, Test } from '../src/model'
import { List } from '../src/extensions'

const args = yargs(hideBin(process.argv))
  .option('verbose', { type: 'boolean' })
  .option('root', {
    type: 'string',
    demandOption: true,
    describe: 'Path to test root (folder containing .wtest files)',
  })
  .hide('version')
  .parseSync()

const root = args.root

async function main() {
  const pattern = `**/*.@(${WOLLOK_FILE_EXTENSION}|${TEST_FILE_EXTENSION})`

  const environment = await buildEnvironment(pattern, root, true)
  const natives = await readNatives(root)

  const interpreter = interpret(environment, natives)

  let failures = 0

  function runNodes(nodes: List<Node>) {
    nodes.forEach(node => {
      if (node.is(Package)) {
        runNodes(node.members)
      }

      else if (node.is(Describe)) {
        const onlyTest = node.tests.find(t => t.isOnly)
        runNodes(onlyTest ? [onlyTest] : node.tests)
      }

      else if (node.is(Test)) {
        const skip =
          node.parent.children.some(
            sibling => node !== sibling && sibling.is(Test) && sibling.isOnly
          )

        if (!skip) {
          try {
            interpreter.fork().exec(node)
            console.info(`✔  ${node.name}`)
          } catch (e: any) {
            failures++
            console.error(`✘  ${node.name}`)
            console.error('    ', e?.message ?? e)
          }
        }
      }
    })
  }

  console.info(`Running Wollok tests in ${root}...\n`)
  runNodes(environment.members)

  if (failures > 0) {
    console.error(`\n${failures} tests failed.`)
    process.exit(1)
  }

  console.info('\nAll Wollok tests passed.')
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})