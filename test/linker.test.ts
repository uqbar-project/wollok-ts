import { should } from 'chai'
import link from '../src/linker'
import { Environment } from '../src/model'
import { Class, Field, Package } from './builders'

should()

describe('Wollok linker', () => {

  const dropIds = (env: Environment) => JSON.parse(JSON.stringify(env, (k, v) => k === 'id' ? undefined : v))
  it('should merge independent packages into a single environment', () => {
    dropIds(link([
      Package('A')(
        Package('B')(),
      ),
      Package('B')(),
      Package('C')(
        Class('B')(),
      ),
    ])).should.deep.equal(
      {
        members: [
          Package('A')(
            Package('B')(),
          ),
          Package('B')(),
          Package('C')(
            Class('B')(),
          ),
        ],
      }
    )
  })

  it('should merge same name packages into a single package', () => {

    dropIds(link([
      Package('A')(
        Class('X')()
      ),
      Package('A')(
        Class('Y')()
      ),
      Package('B')(
        Class('X')()
      ),
    ])).should.deep.equal(
      {
        members: [
          Package('A')(
            Class('X')(),
            Class('Y')(),
          ),
          Package('B')(
            Class('X')(),
          ),
        ],
      },
    )
  })

  it('should recursively merge same name packages into a single package', () => {

    dropIds(link([
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
    ])).should.deep.equal(
      {
        members: [
          Package('A')(
            Package('B')(
              Class('X')(
                Field('u')
              ),
              Class('Y')(
                Field('v')
              ),
            ),
          ),
        ],
      }
    )

  })
})