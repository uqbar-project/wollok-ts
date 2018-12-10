import { expect, should, use } from 'chai'
import link from '../src/linker'
import { Class as ClassNode, Field as FieldNode, Literal as LiteralNode, Method as MethodNode, Node, Package as PackageNode, Reference as ReferenceNode, Singleton as SingletonNode, Stage, Variable as VariableNode } from '../src/model'
import utils from '../src/utils'
import { also } from './assertions'
import { Class, Closure, Field, Import, Method, Mixin, Package, Parameter, Reference, Singleton, Variable } from './builders'

use(also)
should()

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    // TODO: use fully qualified name for this
    Class('Closure', { superclass: Reference('Object') })()
  )
) as PackageNode<'Filled'>

describe('Wollok linker', () => {

  const dropLinkedFields = <S extends Stage, N extends Node<S>>(env: N): N =>
    JSON.parse(JSON.stringify(env, (k, v) => ['id', 'target'].includes(k) ? undefined : v)
    )

  it('should merge independent packages into a single environment', () => {
    dropLinkedFields(link([
      WRE,
      Package('A')(
        Package('B')(),
      ),
      Package('B')(),
      Package('C')(
        Class('B', { superclass: Reference('Object') })(),
      ),
    ] as PackageNode<'Filled'>[])).should.deep.equal(dropLinkedFields(
      {
        kind: 'Environment',
        id: undefined,
        members: [
          WRE,
          Package('A')(
            Package('B')(),
          ),
          Package('B')(),
          Package('C')(
            Class('B', { superclass: Reference('Object') })(),
          ),
        ],
      }
    ))
  })

  it('should merge same name packages into a single package', () => {

    dropLinkedFields(link([
      WRE,
      Package('A')(
        Class('X', { superclass: Reference('Object') })()
      ),
      Package('A')(
        Class('Y', { superclass: Reference('Object') })()
      ),
      Package('B')(
        Class('X', { superclass: Reference('Object') })()
      ),
    ] as PackageNode<'Filled'>[])).should.deep.equal(dropLinkedFields(
      {
        kind: 'Environment',
        id: undefined,
        members: [
          WRE,
          Package('A')(
            Class('X', { superclass: Reference('Object') })(),
            Class('Y', { superclass: Reference('Object') })(),
          ),
          Package('B')(
            Class('X', { superclass: Reference('Object') })(),
          ),
        ],
      }
    ))
  })

  it('should recursively merge same name packages into a single package', () => {
    dropLinkedFields(link([
      WRE,
      Package('A')(
        Package('B')(
          Class('X', { superclass: Reference('Object') })(
            Field('u')
          ),
        ),
      ),
      Package('A')(
        Package('B')(
          Class('Y', { superclass: Reference('Object') })(
            Field('v')
          ),
        ),
      ),
    ] as PackageNode<'Filled'>[])).should.deep.equal(dropLinkedFields(
      {
        kind: 'Environment',
        id: undefined,
        members: [
          WRE,
          Package('A')(
            Package('B')(
              Class('X', { superclass: Reference('Object') })(
                Field('u')
              ),
              Class('Y', { superclass: Reference('Object') })(
                Field('v')
              ),
            ),
          ),
        ],
      }
    ))

  })

  it('should assign an id to all nodes', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('C', { superclass: Reference('Object') })(),
        Package('q')(
          Mixin('M')()
        ),
      ),
    ] as PackageNode<'Filled'>[])

    const { descendants } = utils(environment)

    const nodes = [environment, ...descendants(environment)]
    nodes.forEach(node => {
      node.should.have.property('id')
    })
  })

  describe('references', () => {

    it('should target their definitions', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C', { superclass: Reference('Object') })(
            Field('f', { value: Reference('C') }),
            Field('g', { value: Reference('p') }),
            Field('h', { value: Reference('f') }),
          ),
        ),
      ] as PackageNode<'Filled'>[])

      const Object = (environment.members[0].members[0] as PackageNode<'Linked'>).members[0] as ClassNode<'Linked'>
      const p = environment.members[1] as PackageNode<'Linked'>
      const C = p.members[0] as ClassNode<'Linked'>
      const f = C.members[0] as FieldNode<'Linked'>
      const g = C.members[1] as FieldNode<'Linked'>
      const h = C.members[2] as FieldNode<'Linked'>

      // TODO: create custom assertion target()
      C.superclass!.target.should.equal(Object.id);
      (f.value as ReferenceNode<'Linked'>).target.should.equal(C.id);
      (g.value as ReferenceNode<'Linked'>).target.should.equal(p.id);
      (h.value as ReferenceNode<'Linked'>).target.should.equal(f.id)

    })

    it('should override targets according to scope level', () => {
      const environment = link([
        WRE,
        Package('x')(
          Singleton('x', { superCall: { superclass: Reference('Object'), args: [Reference('x')] } })(
            Field('x', { value: Reference('x') }),
            Method('m1', { parameters: [Parameter('x')] })(
              Reference('x'),
              Closure(Parameter('x'))(Reference('x'))
            ),
            Method('m2')(
              Variable('x', { value: Reference('x') }),
              Reference('x')
            ),
            Method('m3')(
              Reference('x')
            )
          ),
          Class('C', { superclass: Reference('x') })(),
        ),
      ] as PackageNode<'Filled'>[])

      const p = environment.members[1]
      const S = p.members[0] as SingletonNode<'Linked'>
      const f = S.members[0] as FieldNode<'Linked'>
      const m1 = S.members[1] as MethodNode<'Linked'>
      const m1p = m1.parameters[0]
      const m1r = m1.body!.sentences[0] as ReferenceNode<'Linked'>
      const m1c = m1.body!.sentences[1] as LiteralNode<'Linked', SingletonNode<'Linked'>>
      const m1cm = m1c.value.members[0] as MethodNode<'Linked'>
      const m1cmp = m1cm.parameters[0]
      const m1cmr = m1cm.body!.sentences[0] as ReferenceNode<'Linked'>
      const m2 = S.members[2] as MethodNode<'Linked'>
      const m2v = m2.body!.sentences[0] as VariableNode<'Linked'>
      const m2r = m2.body!.sentences[1] as ReferenceNode<'Linked'>
      const m3 = S.members[3] as MethodNode<'Linked'>
      const m3r = m3.body!.sentences[0] as ReferenceNode<'Linked'>
      // const C = p.members[1] as ClassNode<'Linked'>

      (S.superCall.args[0] as ReferenceNode<'Linked'>).target.should.equal(f.id);
      (f.value as ReferenceNode<'Linked'>).target.should.equal(f.id)
      m1r.target.should.equal(m1p.id)
      m1cmr.target.should.equal(m1cmp.id);
      (m2v.value as ReferenceNode<'Linked'>).target.should.equal(m2v.id)
      m2r.target.should.equal(m2v.id)
      m3r.target.should.equal(f.id)
      // TODO: points to field because inner contributions of parent precede parent itself.
      // C.superclass!.target.should.equal(S.id)
    })

    it('should target imported references', () => {
      const environment = link([
        WRE,
        Package('p', {
          imports: [
            Import(Reference('q'), { isGeneric: true }),
            Import(Reference('r.T')),
          ],
        })(
          Class('C', { superclass: Reference('S') })(),
          Class('D', { superclass: Reference('T') })(),
        ),
        Package('q')(
          Class('S', { superclass: Reference('Object') })()
        ),
        Package('r')(
          Class('T', { superclass: Reference('Object') })()
        ),
      ] as PackageNode<'Filled'>[])

      const p = environment.members[1]
      const C = p.members[0] as ClassNode<'Linked'>
      const D = p.members[1] as ClassNode<'Linked'>
      const q = environment.members[2]
      const S = q.members[0] as ClassNode<'Linked'>
      const r = environment.members[3]
      const T = r.members[0] as ClassNode<'Linked'>

      C.superclass!.target.should.equal(S.id)
      D.superclass!.target.should.equal(T.id)
    })

    it('should not be linkable if target is missing', () => {
      expect(() => {
        link([
          WRE,
          Package('p')(
            Class('C', { superclass: Reference('S') })(),
          ),
        ] as PackageNode<'Filled'>[])
      }).to.throw()
    })

  })

})

        // TODO: test contributions