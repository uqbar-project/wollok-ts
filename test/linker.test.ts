import { should } from 'chai'
import link from '../src/linker'
import { Class, Environment, Field, Package } from './builders'

should()

describe('Wollok linker', () => {

  it('should merge independent packages into a single environment', () => {

    link([
      Package('A', { members: [Package('B')] }),
      Package('B'),
      Package('C', { members: [Class('B')] }),
    ]).should.deep.equal(
      Environment(
        Package('A', { members: [Package('B')] }),
        Package('B'),
        Package('C', { members: [Class('B')] }),
      )
    )


    link([
      Package('A', { members: [Class('X')] }),
      Package('A', { members: [Class('Y')] }),
      Package('B', { members: [Class('X')] }),
    ]).should.deep.equal(
      Environment(
        Package('A', { members: [Class('X'), Class('Y')] }),
        Package('B', { members: [Class('X')] }),
      ),
    )


    link([
      Package('A', {
        members: [
          Package('B', {
            members: [
              Class('X', { members: [Field('u')] }),
            ],
          }),
        ],
      }),
      Package('A', {
        members: [
          Package('B', {
            members: [
              Class('Y', { members: [Field('v')] }),
            ],
          }),
        ],
      }),
    ]).should.deep.equal(
      Environment(
        Package('A', {
          members: [
            Package('B', {
              members: [
                Class('X', { members: [Field('u')] }),
                Class('Y', { members: [Field('v')] }),
              ],
            }),
          ],
        })
      )
    )


  })
})