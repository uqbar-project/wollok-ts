import { should } from 'chai'
import { Class as ClassNode, Package as PackageNode } from '../src/model'
import validate from '../src/validator'
import { Class, Method, Mixin, Package, Parameter } from './builders'

import link from '../src/linker'

should()

describe('Validator', () => {

  const WRE = Package('wollok')(
    Class('Object')(),
    Class('Closure')()
  )

  const environment = link([
    WRE,
    Package('p')(
      Class('C')(),
      Package('q')(
        Mixin('M')()
      )
    ),
  ])

  const environment2 = link([
    WRE,
    Package('p')(
      Class('c')(),
      Package('q')(
        Mixin('M')()
      )
    ),
  ])

  const packageExample = environment.members[1] as PackageNode
  const C = packageExample.members[0] as ClassNode
  const packageExample2 = environment2.members[1] as PackageNode
  const C2 = packageExample2.members[0] as ClassNode
  // const q = p.members[1] as PackageNode
  // const M = q.members[0] as MixinNode

  describe('Classes', () => {
    // TODO: Test only "positive" cases and add one extra case with a valid node for each node kind and test it returns empty list

    it('Class with first uppercase letter returns empty list of error', () => {
      validate(C).should.deep.equal([])
    })

    it('Class with non first uppercase letter returns empty list of error returns notUppercase', () => {
      validate(C2).should.deep.equal([{
        code: 'camelcaseName',
        level: 'Warning',
        node: C2,
      }])
    })

  })
  describe('Methods', () => {

    // tslint:disable-next-line:no-shadowed-variable
    const environment3 = link([
      WRE,
      Package('p')(
        Class('C')(
          Method('m', {
            parameters: [Parameter('p'), Parameter('q', {
              isVarArg: true,
            })],
          })()),
        Package('q')(
          Mixin('M')()
        )
      ),
    ])

    const environment4 = link([
      WRE,
      Package('p')(
        Class('C')(
          Method('m', {
            parameters: [Parameter('c'), Parameter('q', {
              isVarArg: true,
            }), Parameter('p')],
          })()),
        Package('q')(
          Mixin('M')()
        )
      ),
    ])

    const packageExample3 = environment3.members[1] as PackageNode
    const cl = packageExample3.members[0] as ClassNode

    const packageExample4 = environment4.members[1] as PackageNode
    const cl2 = packageExample4.members[0] as ClassNode
    const m = cl2.members[0]

    it('Last parameter as vararg returns empty list of error', () => {
      validate(cl).should.deep.equal([])
    })

    it('Non Last parameter as vararg returns error', () => {
      validate(m).should.deep.equal([{
        code: 'onlyLastParameterIsVarArg',
        level: 'Error',
        node: m,
      }])
    })

  })


})
