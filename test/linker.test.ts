import { should, use } from 'chai'
import { assoc } from 'ramda'
import link from '../src/linker'
import { Class as ClassNode, Environment, Field as FieldNode, Literal as LiteralNode, Method as MethodNode, Mixin as MixinNode, Node, Package as PackageNode, Reference as ReferenceNode, Scope, Singleton as SingletonNode, Stage, Variable as VariableNode } from '../src/model'
import utils from '../src/utils'
import { also } from './assertions'
import { Class, Closure, Field, Method, Mixin, Package, Parameter, Reference, Singleton, Variable } from './builders'
/*
TODO:
const enviroment2 = link([
    WRE,
    Package('p', {
      imports: [Import(Reference('p'))],
    })(Class('P')()),
  ])
  infinite loop*/
use(also)
should()

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure')()
  )
) as unknown as PackageNode<'Filled'>

const WREScope = (environment: Environment<'Linked'>): Scope => {
  const { resolve } = utils(environment)
  return resolve<PackageNode<'Linked'>>('wollok.lang').members.reduce((scope, entity) =>
    assoc(entity.name || '', entity.id, scope)
    , { wollok: environment.members.find(m => m.name === 'wollok')!.id })
}

describe('Wollok linker', () => {

  const dropLinkedFields = <S extends Stage, N extends Node<S>>(env: N): N =>
    JSON.parse(JSON.stringify(env, (k, v) => ['scope', 'id'].includes(k) ? undefined : v)
    )

  it('should merge independent packages into a single environment', () => {
    dropLinkedFields(link([
      WRE,
      Package('A')(
        Package('B')(),
      ),
      Package('B')(),
      Package('C')(
        Class('B')(),
      ),
    ] as unknown as PackageNode<'Filled'>[])).should.deep.equal(dropLinkedFields(
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
            Class('B')(),
          ),
        ],
      }
    ))
  })

  it('should merge same name packages into a single package', () => {

    dropLinkedFields(link([
      WRE,
      Package('A')(
        Class('X')()
      ),
      Package('A')(
        Class('Y')()
      ),
      Package('B')(
        Class('X')()
      ),
    ] as unknown as PackageNode<'Filled'>[])).should.deep.equal(dropLinkedFields(
      {
        kind: 'Environment',
        id: undefined,
        members: [
          WRE,
          Package('A')(
            Class('X')(),
            Class('Y')(),
          ),
          Package('B')(
            Class('X')(),
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
    ] as unknown as PackageNode<'Filled'>[])).should.deep.equal(dropLinkedFields(
      {
        kind: 'Environment',
        id: undefined,
        members: [
          WRE,
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
    ))

  })

  it('should assign an id to all nodes', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('C')(),
        Package('q')(
          Mixin('M')()
        ),
      ),
    ] as unknown as PackageNode<'Filled'>[])

    const { descendants } = utils(environment)

    const nodes = [environment, ...descendants(environment)]
    nodes.forEach(node => {
      node.should.have.property('id')
    })
  })

  describe('scopes', () => {

    it('should reference accesible references', () => {
      const environment = link([
        WRE,
        Package('p')(
          Class('C')(),
          Package('q')(
            Mixin('M')()
          )
        ),
      ] as unknown as PackageNode<'Filled'>[])

      const p = environment.members[1] as PackageNode<'Linked'>
      const C = p.members[0] as ClassNode<'Linked'>
      const q = p.members[1] as PackageNode<'Linked'>
      const M = q.members[0] as MixinNode<'Linked'>

      p.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id })
      C.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, C: C.id, q: q.id })
      q.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, C: C.id, q: q.id })
      M.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, C: C.id, q: q.id, M: M.id })

    })

    it('should not include non-visible definitions', () => {
      const environment = link([
        WRE,
        Package('p')(
          Package('q')(
            Class('C')(),
          ),
          Package('r')(
            Mixin('M')()
          )
        ),
      ] as unknown as PackageNode<'Filled'>[])

      const p = environment.members[1] as PackageNode<'Linked'>
      const q = p.members[0] as PackageNode<'Linked'>
      const r = p.members[1] as PackageNode<'Linked'>
      const C = q.members[0] as ClassNode<'Linked'>
      const M = r.members[0] as MixinNode<'Linked'>

      p.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id })
      q.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, q: q.id, r: r.id })
      r.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, q: q.id, r: r.id })
      C.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, q: q.id, r: r.id, C: C.id })
      M.should.have.property('scope').deep.equal({ ...WREScope(environment), p: p.id, q: q.id, r: r.id, M: M.id })

    })

    it('should override outer references with inner ones', () => {
      const environment = link([
        WRE,
        Package('x')(
          Singleton('x', { superCall: { superclass: Reference('Object'), args: [] } })(
            Field('x'),
            Method('m1', { parameters: [Parameter('x')] })(
              Closure(Parameter('x'))(Reference('x'))
            ),
            Method('m2')(
              Variable('x'),
              Reference('x')
            )
          ),
        ),
      ] as unknown as PackageNode<'Filled'>[])

      const p = environment.members[1] as PackageNode<'Linked'>
      const S = p.members[0] as SingletonNode<'Linked'>
      const f = S.members[0] as FieldNode<'Linked'>
      const m1 = S.members[1] as MethodNode<'Linked'>
      const m1p = m1.parameters[0]
      const m1c = m1.body!.sentences[0] as LiteralNode<'Linked', SingletonNode<'Linked'>>
      const m1cm = m1c.value.members[0] as MethodNode<'Linked'>
      const m1cmp = m1cm.parameters[0]
      const m1cmr = m1cm.body!.sentences[0] as ReferenceNode<'Linked'>
      const m2 = S.members[2] as MethodNode<'Linked'>
      const m2v = m2.body!.sentences[0] as VariableNode<'Linked'>
      const m2r = m2.body!.sentences[1] as ReferenceNode<'Linked'>

      p.should.have.property('scope').deep.equal({ ...WREScope(environment), x: p.id })
      S.should.have.property('scope').deep.equal({ ...WREScope(environment), x: S.id })
      f.should.have.property('scope').deep.equal({ ...WREScope(environment), x: f.id })
      m1.should.have.property('scope').deep.equal({ ...WREScope(environment), x: f.id })
      m1p.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m1p.id })
      m1c.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m1p.id })
      m1cm.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m1p.id })
      m1cmp.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m1cmp.id })
      m1cmr.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m1cmp.id })
      m2.should.have.property('scope').deep.equal({ ...WREScope(environment), x: f.id })
      m2v.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m2v.id })
      m2r.should.have.property('scope').deep.equal({ ...WREScope(environment), x: m2v.id })
    })

  })

})

// TODO: test contributions