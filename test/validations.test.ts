import { assert, should } from 'chai'
import link from '../src/linker'
import { Body as BodyNode, Class as ClassNode, Method as MethodNode, Package as PackageNode, Try as TryNode } from '../src/model'
import validations from '../src/validations'
import { Problem } from '../src/validator'
import { Class, Method, Package, Parameter, Reference, Singleton, Try } from './builders'

should()
const WRE = Package('wollok')(
  Class('Object')(),
  Class('Closure')()
)

describe('Package', () => {

  it('Unnamed singleton', () => {
    const environment = link([
      WRE,
      Package('p')(
        Singleton()()
      ),
    ])
    const { singletonIsNotUnnamed } = validations(environment)
    const packageExample = environment.members[1] as PackageNode

    const t = singletonIsNotUnnamed(packageExample, 'unnamedSingleton') as Problem
    assert.ok(!!t)
  })

  /*
  it('localReferenceImported', () => {
    const enviroment = link([
      WRE,
      Package('p', {
        imports: [Import(Reference('c'))],
      })(Package('c')()),
    ])

    const packageExample = enviroment.members[1] as PackageNode
    const importExample = packageExample.imports[0]
    const { importHasNotLocalReference } = validations(enviroment)

    const t = importHasNotLocalReference(importExample, 'referenceIsNotlocalReferenceImported') as Problem
    assert.ok(!!t)
  })*/
})

describe('References', () => {
  it('References named as key word return error', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('C',
          {
            superclass: Reference('program'),
          }
        )(),
        Class('program')(),
      ),
    ])

    const { nameIsNotKeyword } = validations(environment)
    const packageExample = environment.members[1] as PackageNode
    const classExample = packageExample.members[0] as ClassNode
    const referenceExample = classExample.superclass!

    const t = nameIsNotKeyword(referenceExample, 'isKeyWord') as Problem
    assert.ok(!!t)
  })
})

describe('Classes', () => {

  it('Name is pascal case', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('c')(),
      ),
    ])

    const packageExample = environment.members[1] as PackageNode
    const classExample = packageExample.members[0] as ClassNode
    const { nameIsPascalCase } = validations(environment)

    const t = nameIsPascalCase(classExample, 'camelcaseName') as Problem
    assert.ok(!!t)
  })

})
describe('Methods', () => {

  it('onlyLastParameterIsVarArg', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('C')(
          Method('m', {
            parameters: [Parameter('c'), Parameter('q', { isVarArg: true }), Parameter('p')],
          })()),
      ),
    ])

    const { onlyLastParameterIsVarArg } = validations(environment)

    const packageExample = environment.members[1] as PackageNode
    const classExample = packageExample.members[0] as ClassNode
    const methodExample = classExample.members[0] as MethodNode

    const t = onlyLastParameterIsVarArg(methodExample, 'onlyLastParameterIsVarArg') as Problem
    assert.ok(!!t)
  })
})


describe('Try', () => {

  it('Try has catch or always', () => {

    const environment = link([
      WRE,
      Package('p')(
        Class('C')(
          Method('m')(Try([Reference('x')], {})),
        ),
      ),
    ])

    const { hasCatchOrAlways } = validations(environment)

    const packageExample = environment.members[1] as PackageNode
    const classExample = packageExample.members[0] as ClassNode
    const methodExample = classExample.members[0] as MethodNode
    const bodyExample = methodExample.body as BodyNode
    const tryExample = bodyExample.sentences[0] as TryNode

    const t = hasCatchOrAlways(tryExample, 'tryWithoutCatchOrAlways') as Problem
    assert.ok(!!t)
  })

})
