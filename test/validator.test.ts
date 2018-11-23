/*
import { should } from 'chai'
import link from '../src/linker'
import { Class as ClassNode, Package as PackageNode } from '../src/model'
import validate from '../src/validator'
import { Class, Method, Package, Parameter } from './builders'

should()

describe('Validator', () => {

  const WRE = Package('wollok')(
    Class('Object')(),
    Class('Closure')()
  )

  // TODO: Test only "positive" cases and add one extra case with a valid node for each node kind and test it returns empty list

  describe('Valid node', () => {

    const environment3 = link([
      WRE,
      Package('p')(
        Class('C')(
          Method('m', {
            parameters: [Parameter('p'), Parameter('q', {
              isVarArg: true,
            })],
          })()),

      ),
    ])

    const packageExample3 = environment3.members[1] as PackageNode
    const cl = packageExample3.members[0] as ClassNode


    it('Empty list of error', () => {
      validate(cl, environment3).should.deep.equal([])
    })


  })
})
*/