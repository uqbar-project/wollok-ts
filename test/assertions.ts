import { assert } from 'chai'
import { formatError, Parser } from 'parsimmon'
import { ImportMock } from 'ts-mock-imports'
import uuid from 'uuid'
import { Environment } from '../src/builders'
import { step } from '../src/interpreter'
import link from '../src/linker'
import { Linked, Node, Package, Raw, Reference } from '../src/model'
import { Problem } from '../src/validator'

declare global {

  export namespace Chai {

    interface Assertion {
      also: Assertion
      parsedBy(parser: Parser<any>): Assertion
      into(expected: {}): Assertion
      tracedTo(start: number, end: number): Assertion
      linkedInto(expected: Package<Raw>[]): Assertion
      filledInto(expected: any): Assertion
      target(node: Node<Linked>): Assertion
      pass<N extends Node<Linked>>(validation: (node: N, code: string) => Problem | null): Assertion
      stepped(natives?: {}): Assertion
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

export const also = ({ Assertion }: any, { flag }: any) => {
  Assertion.overwriteMethod('property', (base: any) => {
    return function (this: any) {
      if (!flag(this, 'objectBeforePropertyChain')) {
        flag(this, 'objectBeforePropertyChain', this._obj)
      }

      base.apply(this, arguments)
    }
  })

  Assertion.addProperty('also', function (this: any) {
    this._obj = flag(this, 'objectBeforePropertyChain')
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const parserAssertions = ({ Assertion }: any, conf: any) => {
  also({ Assertion }, conf)

  Assertion.addMethod('parsedBy', function (this: any, parser: Parser<any>) {
    const result = parser.parse(this._obj)

    this.assert(
      result.status,
      !result.status && formatError(this._obj, result),
      'expected parser to fail for input #{this}'
    )

    if (result.status) this._obj = result.value
  })

  Assertion.addMethod('into', function (this: any, expected: any) {
    const unsourced = dropKeys('source')
    new Assertion(unsourced(this._obj)).to.deep.equal(unsourced(expected))
  })

  Assertion.addMethod('tracedTo', function (this: any, start: number, end: number) {
    new Assertion(this._obj)
      .to.have.nested.property('source.start.offset', start).and.also
      .to.have.nested.property('source.end.offset', end)
  })

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILLER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const fillerAssertions = ({ Assertion }: any) => {

  Assertion.addMethod('filledInto', function (this: any, expected: any) {
    new Assertion(dropMethods(this._obj)).to.deep.equal(dropMethods(expected))
  })

}
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const linkerAssertions = ({ Assertion }: any) => {

  Assertion.addMethod('linkedInto', function (this: any, expected: Package<Raw>[]) {
    const dropLinkedFields = dropKeys('id', 'scope')
    const actualEnvironment = link(this._obj)
    const expectedEnvironment = Environment(...expected as any)
    new Assertion(dropLinkedFields(actualEnvironment)).to.deep.equal(dropLinkedFields(expectedEnvironment))
  })

  Assertion.addMethod('target', function (this: any, node: Node<Linked>) {
    const reference: Reference<Linked> = this._obj

    if (reference.kind !== 'Reference') assert.fail(`can't check target of ${reference.kind} node`)

    this.assert(
      this._obj.target().id === node.id,
      `expected reference ${reference.name} to target ${node.kind} ${(node as any).name} ${node.id} but found ${reference.target().kind} ${reference.target<any>().name} ${reference.target().id} instead`,
      `expected reference ${reference.name} to not target node ${node.kind} ${(node as any).name} ${node.id}`,
    )
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATOR ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const validatorAssertions = ({ Assertion }: any) => {

  Assertion.addMethod('pass', function <N extends Node<Linked>>(this: any, validation: (node: N, code: string) => Problem | null) {
    this.assert(
      validation(this._obj, '') === null,
      'expected node to pass validation',
      'expected node to not pass validation'
    )
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERPRETER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const interpreterAssertions = ({ Assertion }: any, conf: any) => {
  also({ Assertion }, conf)

  Assertion.addMethod('stepped', function (this: any, natives: {} = {}) {
    let n = 0
    const stub = ImportMock.mockFunction(uuid, 'v4').callsFake(() => `new_id_${n++}`)
    try {
      step(natives)(this._obj)
    } finally {
      stub.restore()
    }

  })

  Assertion.addMethod('into', function (this: any, expected: any) {
    new Assertion(dropMethods(this._obj)).to.deep.equal(dropMethods(expected))
  })
}
