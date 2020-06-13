import { assert } from 'chai'
import { formatError, Parser } from 'parsimmon'
import { ImportMock } from 'ts-mock-imports'
import uuid from 'uuid'
import { Environment } from '../src/builders'
import { step, Natives } from '../src/interpreter'
import link from '../src/linker'
import { Linked, Node, Package, Raw, Reference } from '../src/model'
import { Validation } from '../src/validator'

declare global {
  export namespace Chai {
    interface Assertion {
      also: Assertion
      parsedBy(parser: Parser<any>): Assertion
      into(expected: any): Assertion
      tracedTo(start: number, end: number): Assertion
      linkedInto(expected: Package<Raw>[]): Assertion
      filledInto(expected: any): Assertion
      target(node: Node<Linked>): Assertion
      pass<N extends Node<Linked>>(validation: Validation<N>): Assertion
      stepped(natives?: Natives): Assertion
    }
  }
}


// TODO: Improve these
const dropKeys = (...keys: string[]) => (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => keys.includes(k) ? undefined : v))

const dropMethods = (target: any) =>
  JSON.parse(JSON.stringify(target, (_, value) => typeof value === 'function' ? '<function>' : value))


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ALSO
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const also: Chai.ChaiPlugin = ({ Assertion }, { flag }) => {
  Assertion.overwriteMethod('property', base => {
    return function (this: any) {
      if (!flag(this, 'objectBeforePropertyChain')) {
        flag(this, 'objectBeforePropertyChain', this._obj)
      }

      //TODO:
      // eslint-disable-next-line prefer-rest-params
      base.apply(this, arguments)
    }
  })

  Assertion.addProperty('also', function () {
    this._obj = flag(this, 'objectBeforePropertyChain')
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const parserAssertions: Chai.ChaiPlugin = ({ Assertion, ...rest }, conf) => {
  also({ Assertion, ...rest }, conf)

  Assertion.addMethod('parsedBy', function (parser: Parser<any>) {
    // TODO:
    const result: any = parser.parse(this._obj);

    (this as any).assert(
      result.status,
      !result.status && formatError(this._obj, result),
      'expected parser to fail for input #{this}'
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

  Assertion.addMethod('linkedInto', function (expected: Package<Raw>[]) {
    const dropLinkedFields = dropKeys('id', 'scope')
    const actualEnvironment = link(this._obj)
    const expectedEnvironment = Environment(...expected as any)
    new Assertion(dropLinkedFields(actualEnvironment)).to.deep.equal(dropLinkedFields(expectedEnvironment))
  })

  Assertion.addMethod('target', function (node: Node<Linked>) {
    const reference: Reference<Linked> = this._obj

    if (reference.kind !== 'Reference') assert.fail(`can't check target of ${reference.kind} node`);

    // TODO:
    (this as any).assert(
      this._obj.target().id === node.id,
      `expected reference ${reference.name} to target ${node.kind} ${(node as any).name} ${node.id} but found ${reference.target().kind} ${reference.target<any>().name} ${reference.target().id} instead`,
      `expected reference ${reference.name} to not target node ${node.kind} ${(node as any).name} ${node.id}`,
    )
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATOR ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const validatorAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('pass', function (validation: Validation<Node<Linked>>) {
    // TODO:
    (this as any).assert(
      validation(this._obj, '') === null,
      'expected node to pass validation',
      'expected node to not pass validation'
    )
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERPRETER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const interpreterAssertions: Chai.ChaiPlugin = ({ Assertion, ...rest }, conf) => {
  also({ Assertion, ...rest }, conf)

  Assertion.addMethod('stepped', function (this: Chai.AssertionStatic, natives: Natives = {}) {
    let n = 0
    const stub = ImportMock.mockFunction(uuid, 'v4').callsFake(() => `new_id_${n++}`)
    try {
      step(natives)(this._obj)
    } finally {
      stub.restore()
    }

  })

  Assertion.addMethod('into', function (this: Chai.AssertionStatic, expected: any) {
    new Assertion(dropMethods(this._obj)).to.deep.equal(dropMethods(expected))
  })
}