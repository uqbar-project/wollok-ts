import { formatError, Parser } from 'parsimmon'
import { ImportMock } from 'ts-mock-imports'
import uuid from 'uuid'
import { Environment } from '../src/builders'
import interpreter, { step, Natives } from '../src/interpreter'
import link from '../src/linker'
import { Name, Linked, Node, Package, Reference, List, Environment as EnvironmentType } from '../src/model'
import { Validation } from '../src/validator'
import { ParseError } from '../src/parser'
import globby from 'globby'
import { readFileSync } from 'fs'
import { buildEnvironment as buildEnv } from '../src'
import { join } from 'path'
import validate from '../src/validator'
import natives from '../src/wre/wre.natives'

declare global {
  export namespace Chai {
    interface Assertion {
      also: Assertion
      parsedBy(parser: Parser<any>): Assertion
      into(expected: any): Assertion
      tracedTo(start: number, end: number): Assertion
      recoveringFrom(code: Name, start: number, end: number): Assertion
      linkedInto(expected: List<Package>): Assertion
      filledInto(expected: any): Assertion
      target(node: Node): Assertion
      pass<N extends Node>(validation: Validation<N>): Assertion
      stepped(natives?: Natives): Assertion
    }

    interface ArrayAssertion {
      be: Assertion
    }
  }
}


// TODO: Implement this without calling JSON?
const dropKeys = (...keys: string[]) => (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => keys.includes(k) ? undefined : v))

// TODO: Implement this without calling JSON?
const dropMethods = (target: any) =>
  JSON.parse(JSON.stringify(target, (_, value) => typeof value === 'function' ? '<function>' : value))


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
    const plucked = dropKeys('source', 'problems')
    const expectedProblems = flag(this, 'expectedProblems') ?? []
    const actualProblems = this._obj.problems?.map(({ code, source: { start, end } }: ParseError) => ({ code, start: start.offset, end: end.offset })) ?? []

    new Assertion(expectedProblems).to.deep.contain.all.members(actualProblems, 'Unexpected problem found')
    new Assertion(actualProblems).to.deep.contain.all.members(expectedProblems, 'Expected problem not found')

    new Assertion(plucked(this._obj)).to.deep.equal(plucked(expected))
  })


  Assertion.addMethod('tracedTo', function (start: number, end: number) {
    new Assertion(this._obj)
      .to.have.nested.property('source.start.offset', start).and.also
      .to.have.nested.property('source.end.offset', end)
  })


  Assertion.addMethod('recoveringFrom', function (this: Chai.AssertionStatic, code: Name, start: number, end: number) {
    flag(this, 'expectedProblems', [...flag(this, 'expectedProblems') ?? [], { code, start, end }])
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILLER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const fillerAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('filledInto', function (expected: any) {
    new Assertion(dropMethods(this._obj)).to.deep.equal(dropMethods(expected))
  })

}
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const linkerAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('linkedInto', function (expected: List<Package>) {
    const dropLinkedFields = dropKeys('id', 'scope')
    const actualEnvironment = link(this._obj)
    const expectedEnvironment = Environment(...expected)

    new Assertion(dropLinkedFields(actualEnvironment)).to.deep.equal(dropLinkedFields(expectedEnvironment))
  })


  Assertion.addMethod('target', function (node: Node<Linked>) {
    const reference: Reference<any, Linked> = this._obj

    new Assertion(reference.is('Reference'), `can't check "target" of ${reference.kind} node`).to.be.true
    new Assertion(this._obj.target().id).to.equal(node.id)
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATOR ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const validatorAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('pass', function (validation: Validation<Node<Linked>>) {
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERPRETER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const interpreterAssertions: Chai.ChaiPlugin = (chai, utils) => {
  const { Assertion } = chai

  also(chai, utils)


  Assertion.addMethod('stepped', function (this: Chai.AssertionStatic, natives: Natives = {}) {
    let n = 0
    const stub = ImportMock.mockFunction(uuid, 'v4').callsFake(() => `new_id_${n++}`)

    try { step(natives)(this._obj) }
    finally { stub.restore() }
  })


  Assertion.addMethod('into', function (this: Chai.AssertionStatic, expected: any) {
    new Assertion(dropMethods(this._obj)).to.deep.equal(dropMethods(expected))
  })

}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const buildEnvironment = (pattern: string, cwd: string): EnvironmentType => {

  const { time, timeEnd, log } = console

  time('Parsing files')

  const files = globby.sync(pattern, { cwd }).map(name => ({ name, content: readFileSync(join(cwd, name), 'utf8') }))

  timeEnd('Parsing files')


  time('Building environment')

  const environment = buildEnv(files)

  timeEnd('Building environment')

  const problems = validate(environment)
  if (problems.length) throw new Error(`Found ${problems.length} problems building the environment!: ${problems.map(({ code, node }) => JSON.stringify({ code, source: node.source })).join('\n')}`)
  else log('No problems found building the environment!')

  return environment
}