import { should } from 'chai'
import link from '../src/linker'

should()

describe('Wollok linker', () => {

  it('should merge independent packages into a single environment', () => {

    link([
      { kind: 'Package', name: 'A', imports: [], members: [{ kind: 'Package', name: 'B', imports: [], members: [] }] },
      { kind: 'Package', name: 'B', imports: [], members: [] },
      { kind: 'Package', name: 'C', imports: [], members: [{ kind: 'Class', name: 'B', mixins: [], members: [] }] },
    ]).should.deep.equal({
      members: [
        { kind: 'Package', name: 'A', imports: [], members: [{ kind: 'Package', name: 'B', imports: [], members: [] }] },
        { kind: 'Package', name: 'B', imports: [], members: [] },
        { kind: 'Package', name: 'C', imports: [], members: [{ kind: 'Class', name: 'B', mixins: [], members: [] }] },
      ],
    })


    link([
      { kind: 'Package', name: 'A', imports: [], members: [{ kind: 'Class', name: 'X', mixins: [], members: [] }] },
      { kind: 'Package', name: 'A', imports: [], members: [{ kind: 'Class', name: 'Y', mixins: [], members: [] }] },
      { kind: 'Package', name: 'B', imports: [], members: [{ kind: 'Class', name: 'X', mixins: [], members: [] }] },
    ]).should.deep.equal({
      members: [
        {
          kind: 'Package', name: 'A', imports: [], members: [
            { kind: 'Class', name: 'X', mixins: [], members: [] },
            { kind: 'Class', name: 'Y', mixins: [], members: [] },
          ],
        },
        { kind: 'Package', name: 'B', imports: [], members: [{ kind: 'Class', name: 'X', mixins: [], members: [] }] }, ],
    })


    link([
      {
        kind: 'Package', name: 'A', imports: [], members: [
          {
            kind: 'Package', name: 'B', imports: [], members: [
              { kind: 'Class', name: 'X', mixins: [], members: [{ kind: 'Field', isReadOnly: true, name: 'u' }] },
            ],
          },
        ],
      },
      {
        kind: 'Package', name: 'A', imports: [], members: [
          {
            kind: 'Package', name: 'B', imports: [], members: [
              { kind: 'Class', name: 'Y', mixins: [], members: [{ kind: 'Field', isReadOnly: true, name: 'v' }] },
            ],
          },
        ],
      },
    ]).should.deep.equal({
      members: [
        {
          kind: 'Package', name: 'A', imports: [], members: [
            {
              kind: 'Package', name: 'B', imports: [], members: [
                { kind: 'Class', name: 'X', mixins: [], members: [{ kind: 'Field', isReadOnly: true, name: 'u' }] },
                { kind: 'Class', name: 'Y', mixins: [], members: [{ kind: 'Field', isReadOnly: true, name: 'v' }] },
              ],
            },
          ],
        },
      ],
    })


  })
})