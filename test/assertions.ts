import { formatError, Parser } from 'parsimmon'

declare global {
  export namespace Chai {
    interface Assertion {
      parsedBy(parser: Parser<any>): Assertion
      into(expected: {}): Assertion
      tracedTo(start: number, end: number): Assertion
      also: Assertion
    }
  }
}

export const also = ({ Assertion }: any, { flag }: any) => {
  Assertion.overwriteMethod('property', (base: any) => {
    return function(this: any) {
      if (!flag(this, 'objectBeforePropertyChain')) {
        flag(this, 'objectBeforePropertyChain', this._obj)
      }

      base.apply(this, arguments)
    }
  })

  Assertion.addProperty('also', function(this: any) {
    this._obj = flag(this, 'objectBeforePropertyChain')
  })
}

export const parserAssertions = ({ Assertion }: any, conf: any) => {
  also({ Assertion }, conf)

  Assertion.addMethod('parsedBy', function(this: any, parser: Parser<any>) {
    const result = parser.parse(this._obj)

    this.assert(
      result.status,
      !result.status && formatError(this._obj, result),
      'expected parser to fail for input #{this}'
    )

    if (result.status) this._obj = result.value
  })

  Assertion.addMethod('into', function(this: any, expected: any) {
    // TODO: Improve this, maybe with rambda?
    const unsourced = JSON.parse(JSON.stringify(this._obj, (k, v) => k === 'source' ? undefined : v))
    new Assertion(unsourced).to.deep.equal(expected)
  })

  Assertion.addMethod('tracedTo', function(this: any, start: number, end: number) {
    new Assertion(this._obj)
      .to.have.nested.property('source.start.offset', start).and.also
      .to.have.nested.property('source.end.offset', end)
  })

}