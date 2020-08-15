import { expect, should, use } from 'chai'
import { Class, Closure, Describe, Field, fromJSON, Import, Method, Mixin, Package, Parameter, Reference, Return, Singleton, Variable, Test } from '../src/builders'
import link from '../src/linker'
import { Environment, Filled, Linked, List, Literal as LiteralNode, Package as PackageNode, Return as ReturnNode, Singleton as SingletonNode, Variable as VariableNode } from '../src/model'
import wre from '../src/wre/wre.json'
import { linkerAssertions } from './assertions'


should() 
use(linkerAssertions)
// TODO: Split uber-tests into smaller tests with clearer descriptions
// TODO: Using the whole WRE in tests was a mistake. Build back a minimal WRE for testing so analysis is easier.
// TODO: How about creting FQN for more nodes? Like p.q.C.m(0) ?
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

  describe('scopes', () => {

    it('references should target their definitions', () => {
      const environment = link([
        Package('p')(Class('C', { superclassRef: Reference('Object') })(
          Field('f', { value: Reference('C') }),
          Field('g', { value: Reference('p') }),
          Field('h', { value: Reference('f') }),
        )),
      ] as PackageNode<Filled>[], WRE)

      const Object = environment.getNodeByFQN<'Class'>('wollok.lang.Object')
      const p = environment.getNodeByFQN<'Package'>('p')
      const C = environment.getNodeByFQN<'Class'>('p.C')
      const f = C.fields()[0]
      const g = C.fields()[1]
      const h = C.fields()[2]

      C.superclassRef!.should.target(Object)
      f.value.should.target(C)
      g.value.should.target(p)
      h.value.should.target(f)
    })

    it('should override targets according to scope level', () => {
      const environment = link([
        Package('x')(
          Singleton('x', { superclassRef: Reference('Object'), supercallArgs: [Reference('x')] })(
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
          Class('D')(
            Method('m4')(
              Reference('x')
            )
          ),
        ),
      ] as PackageNode<Filled>[], WRE)

      const S = environment.getNodeByFQN<'Singleton'>('x.x')
      const C = environment.getNodeByFQN<'Singleton'>('x.C')
      const D = environment.getNodeByFQN<'Singleton'>('x.D')
      const f = S.fields()[0]
      const m1 = S.methods()[0]
      const closure = m1.sentences()[1] as LiteralNode<Linked, SingletonNode<Linked>>
      const closureReturn = closure.value.methods()[0].sentences()[0] as ReturnNode<Linked>
      const m2 = S.methods()[1]
      const m2var = m2.sentences()[0] as VariableNode<Linked>
      const m3 = S.methods()[2]
      const m4 = D.methods()[0]

      S.supercallArgs[0].should.target(f)
      f.value.should.target(f)
      m1.sentences()[0].should.target(m1.parameters[0])
      closureReturn.value!.should.target(closure.value.methods()[0].parameters[0])
      m2var.value.should.target(m2var)
      m2.sentences()[1].should.target(m2var)
      m3.sentences()[0].should.target(f)
      C.superclassRef!.should.target(S)
      m4.sentences()[0].should.target(S)
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
      const M = environment.getNodeByFQN<'Class'>('p.M')
      const C = environment.getNodeByFQN<'Class'>('p.C')

      C.methods()[0].sentences()[0].should.target(A.fields()[0])
      C.methods()[0].sentences()[1].should.target(M.fields()[0])
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

      C.methods()[0].sentences()[0].should.target(C.fields()[0])
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

      C.methods()[0].sentences()[0].should.target(C.fields()[0])
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
      const C = environment.getNodeByFQN<'Class'>('p.C')

      C.methods()[0].sentences()[0].should.target(M.fields()[0])
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
      const C = environment.getNodeByFQN<'Class'>('p.C')

      C.methods()[0].sentences()[0].should.target(M.fields()[0])
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
      const C = environment.getNodeByFQN<'Class'>('p.C')

      C.methods()[0].sentences()[0].should.target(B.fields()[0])
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

      const C = environment.getNodeByFQN<'Class'>('p.C')
      const D = environment.getNodeByFQN<'Class'>('p.D')
      const S = environment.getNodeByFQN<'Class'>('q.S')
      const T = environment.getNodeByFQN<'Class'>('r.T')

      C.superclassRef!.should.target(S)
      D.superclassRef!.should.target(T)
    })

    it('qualified references should not consider parent scopes for non-root steps', () => {
      const environment = link([
        Package('p', { imports: [Import(Reference('r.C'))] })(
          Package('q')(),
          Singleton('s', { supercallArgs: [], superclassRef: Reference('Object') })(),
        ),
        Package('r')(
          Class('C')(),
        ),
      ] as PackageNode<Filled>[], WRE)

      expect(() => environment.getNodeByFQN('p.q.s')).to.throw()
    })

    it('packages should not make imported members referenceable from outside', () => {
      const environment = link([
        Package('p', { imports: [Import(Reference('r.C'))] })(),
        Package('r')(
          Class('C')(),
        ),
      ] as PackageNode<Filled>[], WRE)

      expect(() => environment.getNodeByFQN('p.C')).to.throw()
    })

    it('Entities with string names should not be referenceable without the quotes', () => {
      const environment = link([
        Package('p')(
          Describe('"G"')(),
          Test('"T"')(),
        ),
      ] as PackageNode<Filled>[], WRE)

      expect(() => environment.getNodeByFQN('p.G')).to.throw()
      expect(() => environment.getNodeByFQN('p."G"')).to.not.throw()
      
      expect(() => environment.getNodeByFQN('p.T')).to.throw()
      expect(() => environment.getNodeByFQN('p."T"')).to.not.throw()
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

    it('should', () => {
      link([
        Package('p', { imports: [Import(Reference('q.A'))] })(),
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