import { assert, should } from 'chai'
import link from '../src/linker'
import { Body as BodyNode, Class as ClassNode, Method as MethodNode, Package as PackageNode, Try as TryNode } from '../src/model'
import { validations } from '../src/validator'
import { Class, Method, Package, Parameter, Reference, Singleton, Try } from './builders'

should()

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure')()
  )
)

describe('Wollok Validations', () => {

  describe('Package', () => {

    it('Unnamed singleton', () => {
      const environment = link([
        WRE,
        Package('p')(
          Singleton()(),
        ),
      ] as unknown as PackageNode<'Filled'>[])
      const { singletonIsNotUnnamed } = validations(environment)
      const packageExample = environment.members[1] as PackageNode<'Linked'>

      assert.ok(!!singletonIsNotUnnamed(packageExample, 'unnamedSingleton')!)
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
      ] as unknown as PackageNode<'Filled'>[])

      const { nameIsNotKeyword } = validations(environment)
      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const referenceExample = classExample.superclass!

      assert.ok(!!nameIsNotKeyword(referenceExample, 'isKeyWord')!)
    })
  })

  describe('Classes', () => {

    it('Name is pascal case', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('c')(),
          Class('C')(),
        ),
      ] as unknown as PackageNode<'Filled'>[])

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const classExample2 = packageExample.members[1] as ClassNode<'Linked'>
      const { nameIsPascalCase } = validations(environment)

      assert.ok(!!nameIsPascalCase(classExample, 'camelcaseName')!)
      assert.ok(!nameIsPascalCase(classExample2, 'camelcaseName')!)

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
      ] as unknown as PackageNode<'Filled'>[])

      const { onlyLastParameterIsVarArg } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[0] as MethodNode<'Linked'>

      assert.ok(!!onlyLastParameterIsVarArg(methodExample, 'onlyLastParameterIsVarArg')!)
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
      ] as unknown as PackageNode<'Filled'>[])

      const { hasCatchOrAlways } = validations(environment)

      const packageExample = environment.members[1] as PackageNode<'Linked'>
      const classExample = packageExample.members[0] as ClassNode<'Linked'>
      const methodExample = classExample.members[0] as MethodNode<'Linked'>
      const bodyExample = methodExample.body as BodyNode<'Linked'>
      const tryExample = bodyExample.sentences[0] as TryNode<'Linked'>

      assert.ok(!!hasCatchOrAlways(tryExample, 'tryWithoutCatchOrAlways')!)
    })

  })

})