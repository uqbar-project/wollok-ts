import { expect } from 'chai'

describe('parser', () => {

  it('should parse', () => {
    expect({ a: 5 }).to.deep.equal({ a: 5 })
  })

})