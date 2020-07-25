import { expect, should, use } from 'chai'
import { Return, Class, Closure, Field, Import, Method, Mixin, Package, Parameter, Reference, Singleton, Variable, fromJSON } from '../src/builders'
import link from '../src/linker'
import { Return as ReturnNode, Class as ClassNode, Environment, Field as FieldNode, Filled, Linked, List, Literal as LiteralNode, Method as MethodNode,  Package as PackageNode, Reference as ReferenceNode, Singleton as SingletonNode, Variable as VariableNode } from '../src/model'
import wre from '../src/wre/wre.json'
import { linkerAssertions } from './assertions'


should() 
use(linkerAssertions)
// TODO: Split uber-tests into smaller tests with clearer descriptions
// TODO: Using the whole WRE in tests was a mistake. Build back a minimal WRE for testing so analysis is easier.
const WRE: Environment = fromJSON<Environment>(wre)

describe('Wollok linker', () => {

  describe('merge', () => {

    it('should merge independent packages into a single environment', () => {
      [
        ...WRE.members,
        Package('A')(Package('B')()),
        Package('B')(),
        Package('C')(Class('B', { superclassRef: Reference('Object') })()),
      ].should.be.linkedInto([
        ...WRE.members,
        Package('A')(Package('B')()),
        Package('B')(),
        Package('C')(Class('B', { superclassRef: Reference('Object') })()),
      ] as unknown as List<PackageNode>)
    })

    it('should merge same name packages into a single package', () => {
      [
        ...WRE.members,
        Package('A')(Class('X', { superclassRef: Reference('Object') })()), 
        Package('A')(Class('Y', { superclassRef: Reference('Object') })()),
        Package('B')(Class('X', { superclassRef: Reference('Object') })()),
      ].should.be.linkedInto([
        ...WRE.members,
        Package('A')(
          Class('X', { superclassRef: Reference('Object') })(),
          Class('Y', { superclassRef: Reference('Object') })(),
        ),
        Package('B')(Class('X', { superclassRef: Reference('Object') })()),
      ] as unknown as List<PackageNode>)
    })

    it('should recursively merge same name packages into a single package', () => {
      [
        ...WRE.members,
        Package('A')(Package('B')(Class('X', { superclassRef: Reference('Object') })(Field('u')))),
        Package('A')(Package('B')(Class('Y', { superclassRef: Reference('Object') })(Field('v')))),
      ].should.be.linkedInto([
        ...WRE.members,
        Package('A')(Package('B')(
          Class('X', { superclassRef: Reference('Object') })(Field('u')),
          Class('Y', { superclassRef: Reference('Object') })(Field('v')),
        )),
      ] as unknown as List<PackageNode>)
    })

    it('should replace old entities prioritizing right to left', () => {
      [
        ...WRE.members,
        Package('p')(Class('C')(Field('x'))),

        Package('p')(Class('C')(Field('y'))),
      ].should.be.linkedInto([
        ...WRE.members,
        Package('p')(Class('C')(Field('y'))),
      ] as unknown as List<PackageNode>)
    })

  })

  it('should assign an id to all nodes', () => {
    const environment = link([
      Package('p')(
        Class('C', { superclassRef: Reference('Object') })(),
        Package('q')(Mixin('M')()),
      ),
    ] as PackageNode<Filled>[], WRE)

    const nodes = [environment, ...environment.descendants()]

    nodes.forEach(node => node.should.have.property('id'))
  })

  describe('references', () => {

    it('should target their definitions', () => {
      const environment = link([
        Package('p')(Class('C', { superclassRef: Reference('Object') })(
          Field('f', { value: Reference('C') }),
          Field('g', { value: Reference('p') }),
          Field('h', { value: Reference('f') }),
        )),
      ] as PackageNode<Filled>[], WRE)

      const Object = environment.getNodeByFQN<'Class'>('wollok.lang.Object')
      const p = environment.members[1] as PackageNode<Linked>
      const C = p.members[0] as ClassNode<Linked>
      const f = C.members[0] as FieldNode<Linked>
      const g = C.members[1] as FieldNode<Linked>
      const h = C.members[2] as FieldNode<Linked>

      C.superclassRef!.should.target(Object)
      f.value.should.target(C)
      g.value.should.target(p)
      h.value.should.target(f)
    })

    it('should override targets according to scope level', () => {
      const environment = link([
        Package('x')(
          Singleton('x', { superCall: { superclassRef: Reference('Object'), args: [Reference('x')] } })(
            Field('x', { value: Reference('x') }),
            Method('m1', { parameters: [Parameter('x')] })(
              Reference('x'),
              Closure({
                parameters: [Parameter('x')],
                sentences: [Return(Reference('x'))],
              })
            ),
            Method('m2')(
              Variable('x', { value: Reference('x') }),
              Reference('x')
            ),
            Method('m3')(Reference('x'))
          ),
          Class('C', { superclassRef: Reference('x') })(),
        ),
      ] as PackageNode<Filled>[], WRE)

      const p = environment.members[1]
      const S = p.members[0] as SingletonNode<Linked>
      const f = S.members[0] as FieldNode<Linked>
      const m1 = S.members[1] as MethodNode<Linked>
      const m1p = m1.parameters[0]
      const m1r = m1.sentences()[0] as ReferenceNode<any, Linked>
      const m1c = m1.sentences()[1] as LiteralNode<Linked, SingletonNode<Linked>>
      const m1cm = m1c.value.members[0] as MethodNode<Linked>
      const m1cmp = m1cm.parameters[0]
      const m1cmr = (m1cm.sentences()[0] as ReturnNode).value as ReferenceNode<any, Linked>
      const m2 = S.members[2] as MethodNode<Linked>
      const m2v = m2.sentences()[0] as VariableNode<Linked>
      const m2r = m2.sentences()[1] as ReferenceNode<any, Linked>
      const m3 = S.members[3] as MethodNode<Linked>
      const m3r = m3.sentences()[0] as ReferenceNode<any, Linked>
      const C = p.members[1] as ClassNode<Linked>

      S.superCall.args[0].should.target(f)
      f.value.should.target(f)
      m1r.should.target(m1p)
      m1cmr.should.target(m1cmp)
      m2v.value.should.target(m2v)
      m2r.should.target(m2v)
      m3r.should.target(f)
      C.superclassRef!.should.target(S)
    })

    it('should target inherited members', () => {
      const environment = link([
        Package('p')(
          Mixin('M')(Field('y')),
          Class('A')(Field('x')),
          Class('B', { superclassRef: Reference('A') })(),
          Class('C', { superclassRef: Reference('B'), mixins: [Reference('M')] })(Method('m')(
            Reference('x'),
            Reference('y'),
          )),
        ),
      ] as PackageNode<Filled>[], WRE)

      const A = environment.getNodeByFQN<'Class'>('p.A')
      const Ax = A.fields()[0]
      const M = environment.getNodeByFQN<'Class'>('p.M')
      const My = M.fields()[0]
      const C = environment.getNodeByFQN<'Class'>('p.C')
      const m = C.methods()[0] as MethodNode<Linked>
      const mx = m.sentences()[0] as ReferenceNode<any, Linked>
      const my = m.sentences()[1] as ReferenceNode<any, Linked>

      mx.should.target(Ax)
      my.should.target(My)
    })

    it('should target local overriden references to members inherited from mixins', () => {
      const environment = link([
        Package('p')(
          Mixin('M')(Field('x')),
          Class('C', { mixins: [Reference('M')] })(
            Field('x'),
            Method('m')(Reference('x'))
          ),
        ),
      ] as PackageNode<Filled>[], WRE)

      const C = environment.getNodeByFQN<'Class'>('p.C')
      const m = C.methods()[0] as MethodNode<Linked>
      const x = C.fields()[0]
      const mx = m.sentences()[0] as ReferenceNode<any, Linked>

      mx.should.target(x)
    })

    it('should target local overriden references to members inherited from superclass', () => {
      const environment = link([
        Package('p')(
          Class('A')(Field('x')),
          Class('B', { superclassRef: Reference('A') })(),
          Class('C', { superclassRef: Reference('B') })(
            Field('x'),
            Method('m')(Reference('x'))
          ),
        ),
      ] as PackageNode<Filled>[], WRE)

      const C = environment.getNodeByFQN<'Class'>('p.C')
      const m = C.methods()[0] as MethodNode<Linked>
      const x = C.fields()[0]
      const mx = m.sentences()[0] as ReferenceNode<any, Linked>

      mx.should.target(x)
    })

    it('should target references overriden on mixins to members inherited from superclass', () => {
      const environment = link([
        Package('p')(
          Mixin('M')(Field('x')),
          Class('A')(Field('x')),
          Class('C', { superclassRef: Reference('A'), mixins: [Reference('M')] })(Method('m')(Reference('x'))),
        ),
      ] as PackageNode<Filled>[], WRE)

      const M = environment.getNodeByFQN<'Class'>('p.M')
      const Mx = M.fields()[0]
      const C = environment.getNodeByFQN<'Class'>('p.C')
      const m = C.methods()[0] as MethodNode<Linked>
      const mx = m.sentences()[0] as ReferenceNode<any, Linked>

      mx.should.target(Mx)
    })

    it('should target references overriden on mixins to members inherited from further mixin', () => {
      const environment = link([
        Package('p')(
          Mixin('M', { mixins: [Reference('N')] })(Field('x')),
          Mixin('N')(Field('x')),
          Class('C', { mixins: [Reference('M')] })(Method('m')(Reference('x'))),
        ),
      ] as PackageNode<Filled>[], WRE)

      const M = environment.getNodeByFQN<'Class'>('p.M')
      const Mx = M.fields()[0]
      const C = environment.getNodeByFQN<'Class'>('p.C')
      const m = C.methods()[0] as MethodNode<Linked>
      const mx = m.sentences()[0] as ReferenceNode<any, Linked>

      mx.should.target(Mx)
    })

    it('should target references overriden on superclass to members inherited from further superclass', () => {
      const environment = link([
        Package('p')(
          Class('A')(Field('x')),
          Class('B', { superclassRef: Reference('A') })(Field('x')),
          Class('C', { superclassRef: Reference('B') })(Method('m')(Reference('x'))),
        ),
      ] as PackageNode<Filled>[], WRE)

      const B = environment.getNodeByFQN<'Class'>('p.B')
      const Bx = B.fields()[0]
      const C = environment.getNodeByFQN<'Class'>('p.C')
      const m = C.methods()[0] as MethodNode<Linked>
      const mx = m.sentences()[0] as ReferenceNode<any, Linked>

      mx.should.target(Bx)
    })

    it('should target imported references', () => {
      const environment = link([
        Package('p', {
          imports: [
            Import(Reference('q'), { isGeneric: true }),
            Import(Reference('r.T')),
          ],
        })(
          Class('C', { superclassRef: Reference('S') })(),
          Class('D', { superclassRef: Reference('T') })(),
        ),
        Package('q')(Class('S', { superclassRef: Reference('Object') })()),
        Package('r')(Class('T', { superclassRef: Reference('Object') })()),
      ] as PackageNode<Filled>[], WRE)

      const p = environment.members[1]
      const C = p.members[0] as ClassNode<Linked>
      const D = p.members[1] as ClassNode<Linked>
      const q = environment.members[2]
      const S = q.members[0] as ClassNode<Linked>
      const r = environment.members[3]
      const T = r.members[0] as ClassNode<Linked>

      C.superclassRef!.should.target(S)
      D.superclassRef!.should.target(T)
    })

  })

  describe('error handling', () => {

    it('should not crash if a class inherits from itself', () => {
      link([
        Package('p')(Class('C', { superclassRef: Reference('C') })()),
      ] as PackageNode<Filled>[], WRE)
    })

    it('should not crash if there is an inheritance cycle', () => {
      link([
        Package('p')(
          Class('A', { superclassRef: Reference('C') })(),
          Class('B', { superclassRef: Reference('A') })(),
          Class('C', { superclassRef: Reference('B') })(),
        ),
      ] as PackageNode<Filled>[], WRE)
    })

    it('should not crash if a mixin includes itself', () => {
      link([
        Package('p')(Mixin('A', { mixins: [Reference('A')] })()),
      ] as PackageNode<Filled>[], WRE)
    })

    it('should not crash if there is an linearization cycle', () => {
      link([
        Package('p')(
          Mixin('A', { mixins: [Reference('C')] })(),
          Mixin('B', { mixins: [Reference('A')] })(),
          Mixin('C', { mixins: [Reference('B')] })(),
        ),
      ] as PackageNode<Filled>[], WRE)
    })

    it('should not be linkable if target is missing', () => {
      expect(() => {
        link([
          Package('p')(Class('C', { superclassRef: Reference('S') })()),
        ] as PackageNode<Filled>[], WRE)
      }).to.throw()
    })

  })

})