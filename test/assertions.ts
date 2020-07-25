import { formatError, Parser } from 'parsimmon'
import { ImportMock } from 'ts-mock-imports'
import uuid from 'uuid'
import { Environment } from '../src/builders'
import { step, Natives } from '../src/interpreter'
import link from '../src/linker'
import { Linked, Node, Package, Reference, List } from '../src/model'
import { Validation } from '../src/validator'

declare global {
  export namespace Chai {
    interface Assertion {
      also: Assertion
      parsedBy(parser: Parser<any>): Assertion
      into(expected: any): Assertion
      tracedTo(start: number, end: number): Assertion
      linkedInto(expected: List<Package>): Assertion
      filledInto(expected: any): Assertion
      target(node: Node): Assertion
      pass(validation: Validation<Node>): Assertion
      stepped(natives?: Natives): Assertion
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

  also(chai, utils)
  

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


  Assertion.addMethod('into', function (expected: any) {
    const unsourced = dropKeys('source')

    new Assertion(unsourced(this._obj)).to.deep.equal(unsourced(expected))
  })


  Assertion.addMethod('tracedTo', function (start: number, end: number) {
    new Assertion(this._obj)
      .to.have.nested.property('source.start.offset', start).and.also
      .to.have.nested.property('source.end.offset', end)
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
    const reference: Reference<Linked> = this._obj

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