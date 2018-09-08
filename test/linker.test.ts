import { should } from 'chai'
import link from '../src/linker'
import { Class, Environment, Field, Package } from './builders'

should()

describe('Wollok linker', () => {

  it('should merge independent packages into a single environment', () => {

    link([
      Package('A')(
        Package('B')(),
      ),
      Package('B')(),
      Package('C')(
        Class('B')(),
      ),
    ]).should.deep.equal(
      Environment(
        Package('A')(
          Package('B')(),
        ),
        Package('B')(),
        Package('C')(
          Class('B')(),
        ),
      )
    )
  })

  it('should merge same name packages into a single package', () => {

    link([
      Package('A')(
        Class('X')()
      ),
      Package('A')(
        Class('Y')()
      ),
      Package('B')(
        Class('X')()
      ),
    ]).should.deep.equal(
      Environment(
        Package('A')(
          Class('X')(),
          Class('Y')(),
        ),
        Package('B')(
          Class('X')(),
        ),
      ),
    )
  })

  it('should recursively merge same name packages into a single package', () => {

    link([
      Package('A')(
        Package('B')(
          Class('X')(
            Field('u')
          ),
        ),
      ),
      Package('A')(
        Package('B')(
          Class('Y')(
            Field('v')
          ),
        ),
      ),
    ]).should.deep.equal(
      Environment(
        Package('A')(
          Package('B')(
            Class('X')(
              Field('u')
            ),
            Class('Y')(
              Field('v')
            ),
          ),
        )
      )
    )


  })
})