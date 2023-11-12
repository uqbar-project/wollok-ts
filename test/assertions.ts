import dedent from 'dedent'
import { promises } from 'fs'
import globby from 'globby'
import { formatError, Parser } from 'parsimmon'
import { join } from 'path'
import { buildEnvironment as buildEnv, print } from '../src'
import { List } from '../src/extensions'
import link from '../src/linker'
import { Environment, Environment as EnvironmentType, Name, Node, Package, Reference } from '../src/model'
import { ParseError } from '../src/parser'
import validate, { Validation } from '../src/validator'

const { readFile } = promises

declare global {
  export namespace Chai {
    interface Assertion { // TODO: split into the separate modules
      also: Assertion
      parsedBy(parser: Parser<any>): Assertion
      into(expected: any): Assertion
      tracedTo(start: number, end: number): Assertion
      recoveringFrom(code: Name, start: number, end: number): Assertion

      formattedTo(expected: string): Assertion

      linkedInto(expected: List<Package>): Assertion
      target(node: Node): Assertion

      pass<N extends Node>(validation: Validation<N>): Assertion
    }

    interface ArrayAssertion {
      be: Assertion
    }
  }
}

// TODO: Implement this without calling JSON?
const dropKeys = (...keys: string[]) => (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => keys.includes(k) ? undefined : v))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ALSO
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const also: Chai.ChaiPlugin = ({ Assertion }, { flag }) => {

  Assertion.overwriteMethod('property', base => function (this: Chai.AssertionStatic, ...args: any[]) {
    if (!flag(this, 'objectBeforePropertyChain')) flag(this, 'objectBeforePropertyChain', this._obj)

    base.apply(this, args)
  })


  Assertion.addProperty('also', function () {
    this._obj = flag(this, 'objectBeforePropertyChain')
  })

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const parserAssertions: Chai.ChaiPlugin = (chai, utils) => {
  const { Assertion } = chai
  const { flag } = utils

  also(chai, utils)
  chai.config.truncateThreshold = 0

  chai.use(function (_chai, utils) {
    utils.objDisplay = function (obj) { return '!!!' + obj + '!!!' }
  })

  Assertion.addMethod('parsedBy', function (parser: Parser<any>) {
    const result = parser.parse(this._obj)

    this.assert(
      result.status,
      () => formatError(this._obj, result),
      'Expected parser to fail for input #{this}',
      true,
      result.status,
    )

    if (result.status) this._obj = result.value
  })


  Assertion.addMethod('into', function (this: Chai.AssertionStatic, expected: any) {
    const plucked = dropKeys('sourceMap', 'problems')
    const expectedProblems = flag(this, 'expectedProblems') ?? []
    const actualProblems = this._obj.problems?.map(({ code, sourceMap: { start, end } }: ParseError) => ({ code, start: start.offset, end: end.offset })) ?? []

    new Assertion(expectedProblems).to.deep.contain.all.members(actualProblems, 'Unexpected problem found')
    new Assertion(actualProblems).to.deep.contain.all.members(expectedProblems, 'Expected problem not found')
    new Assertion(plucked(this._obj)).to.deep.equal(plucked(expected))
  })


  Assertion.addMethod('tracedTo', function (start: number, end: number) {
    new Assertion(this._obj)
      .to.have.nested.property('sourceMap.start.offset', start).and.also
      .to.have.nested.property('sourceMap.end.offset', end)
  })


  Assertion.addMethod('recoveringFrom', function (this: Chai.AssertionStatic, code: Name, start: number, end: number) {
    flag(this, 'expectedProblems', [...flag(this, 'expectedProblems') ?? [], { code, start, end }])
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PRINTER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const printerAssertions: Chai.ChaiPlugin = (chai) => {
  const { Assertion } = chai

  Assertion.addMethod('formattedTo', function (expected: string) {
    const name = 'formatted'
    const environment = buildEnv([{ name, content: this._obj }])
    const printerConfig = { maxWidth: 80, indentation: { size: 2, useSpaces: true }, abbreviateAssignments: true }
    const formatted = print(environment.getNodeByFQN(name), printerConfig)
    new Assertion(formatted).to.equal(dedent(expected))
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const linkerAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('linkedInto', function (expected: List<Package>) {
    const dropLinkedFields = dropKeys('id', 'scope')
    const actualEnvironment = link(this._obj)
    const expectedEnvironment = new Environment({ members: expected })

    new Assertion(dropLinkedFields(actualEnvironment)).to.deep.equal(dropLinkedFields(expectedEnvironment))
  })


  Assertion.addMethod('target', function (node: Node) {
    const reference: Reference<Node> = this._obj

    new Assertion(reference.is(Reference), `can't check "target" of ${reference.kind} node`).to.be.true
    new Assertion(this._obj.target.id).to.equal(node.id)
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATOR ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const validatorAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('pass', function (validation: Validation<Node>) {
    const result = validation(this._obj, '')

    this.assert(
      result === null,
      `Expected ${this._obj.kind} to pass validation, but got #{act} instead`,
      `Expected ${this._obj.kind} to not pass validation`,
      null,
      result
    )
  })

}


// TODO: check if needed
export const buildEnvironment = async (pattern: string, cwd: string, skipValidations = false): Promise<EnvironmentType> => {
  const { time, timeEnd, log } = console

  time('Parsing files')
  const files = await Promise.all(globby.sync(pattern, { cwd }).map(async name =>
    ({ name, content: await readFile(join(cwd, name), 'utf8') })
  ))
  timeEnd('Parsing files')

  time('Building environment')
  const environment = buildEnv(files)
  timeEnd('Building environment')

  if(!skipValidations) {
    const problems = validate(environment)
    if (problems.length) throw new Error(`Found ${problems.length} problems building the environment!: ${problems.map(({ code, node }) => `${code} at ${node?.sourceInfo ?? 'unknown'}`).join('\n')}`)
    else log('No problems found building the environment!')
  }

  return environment
}