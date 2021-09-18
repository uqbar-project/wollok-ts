import { should } from 'chai'
import { Class, Method, Body, Reference, ParameterizedType } from '../src/model'
import { restore, stub } from 'sinon'

should()

describe('Wollok model', () => {

  describe('cache', () => {

    it('should be populated the first time the node is used', () => {
      const method = new Method({ name: 'm', body: 'native', isOverride: false, parameters: [] })
      const node = new Class({ name: 'C', supertypes: [], members: [method] })
      stub(node, 'hierarchy').returns([node])

      node.cache.size.should.equal(0)
      const response = node.lookupMethod(method.name, method.parameters.length)
      response!.should.equal(method)
      node.cache.get(`lookupMethod(${method.name},${method.parameters.length})`).should.equal(response)
    })

    it('should prevent a second call to the same method', () => {
      const method = new Method({ name: 'm1', body: 'native', isOverride: false, parameters: [] })
      const otherMethod = new Method({ name: 'm2', body: 'native', isOverride: false, parameters: [] })
      const node = new Class({ name: 'C', supertypes: [], members: [method] })
      stub(node, 'hierarchy').returns([node])

      node.lookupMethod(method.name, method.parameters.length)
      node.cache.set(`lookupMethod(${method.name},${method.parameters.length})`, otherMethod)

      node.lookupMethod(method.name, method.parameters.length)!.should.equal(otherMethod)
    })

  })

  describe('Method', () => {

    describe('isAbstract', () => {
      it('should return true for methods with no body', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        m.isAbstract().should.be.true
      })

      it('should return false for native methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1',  body: 'native' })
        m.isAbstract().should.be.false
      })

      it('should return false for non-abstract non-native methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1',  body: new Body({ id: 'b1',  sentences: [] }) })
        m.isAbstract().should.be.false
      })
    })

  })

  describe('Class', () => {

    describe('isAbstract', () => {

      afterEach(restore)

      it('should return true for classes with abstract methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        const c = new Class({ name: 'C', supertypes: [], members: [m], id: 'c1'  })
        stub(c, 'fullyQualifiedName').returns('C')

        c.hierarchy = () => [c as any]

        c.isAbstract().should.be.true
      })

      it('should return true for classes with non-overriten inherited abstract methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        const b = new Class({ name: 'B', supertypes: [], members: [m], id: 'c1'  })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r'  })
        bRef.target = () => b as any
        const c = new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: bRef })], id: 'c1' })
        stub(b, 'fullyQualifiedName').returns('B')
        stub(c, 'fullyQualifiedName').returns('C')
        stub(c, 'hierarchy').returns([c, b])

        c.isAbstract().should.be.true
      })

      it('should return false for classes with no abstract methods', () => {
        const c = new Class({ name: 'C', id: 'c1' })
        c.hierarchy = () => [c as any]

        c.isAbstract().should.be.false
      })

      it('should return false for classes with implemented inherited abstract methods', () => {
        const m1 = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        const m2 = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm2',  body: 'native' })
        const b = new Class({ name: 'B', supertypes: [], members: [m1], id: 'c1' })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r' })
        bRef.target = () => b as any
        const c = new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: bRef })], members: [m2], id: 'c1' })
        c.hierarchy = () => [c as any, b as any]

        c.isAbstract().should.be.false
      })

    })

    describe('notCyclicHierarchy', () => {

      afterEach(restore)

      it('should return true for classes with cyclic hierarchy', () => {
        const c1 = new Class({ name: 'C1', supertypes: [], members: [], id: 'c1' })
        const c2 = new Class({ name: 'C2', supertypes: [], members: [], id: 'c2' })
        stub(c1, 'superclass').returns(c2)
        stub(c2, 'superclass').returns(c1)
        c1.hasCyclicHierarchy().should.be.true
      })

      it('should return true for classes pointing to itself', () => {
        const c1 = new Class({ name: 'C1', supertypes: [], members: [], id: 'c1' })
        stub(c1, 'superclass').returns(c1)
        c1.hasCyclicHierarchy().should.be.true
      })

      it('should return false for classes with no superclass', () => {
        const c = new Class({ name: 'C', supertypes: [], members: [], id: 'c' })
        stub(c, 'superclass').returns(undefined)
        c.hasCyclicHierarchy().should.be.false
      })

      it('should return false for classes with a well-formed hierarchy', () => {
        const c1 = new Class({ name: 'C1', supertypes: [], members: [], id: 'c1' })
        stub(c1, 'superclass').returns(undefined)
        const c2 = new Class({ name: 'C2', supertypes: [], members: [], id: 'c2' })
        stub(c2, 'superclass').returns(c1)
        const c3 = new Class({ name: 'C3', supertypes: [], members: [], id: 'c2' })
        stub(c3, 'superclass').returns(c2)
        c3.hasCyclicHierarchy().should.be.false
      })

    })
  })

})