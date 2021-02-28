import { should } from 'chai'
import { Class, Method, Body, Reference } from '../src/model'
import { restore, stub } from 'sinon'

should()

describe('Wollok model', () => {

  describe('cache', () => {

    it('should be populated the first time the node is used', () => {
      const method = new Method({ name: 'm', body: 'native', isOverride: false, parameters: [] })
      const node = new Class({ name: 'C', mixins: [], members: [method] })
      stub(node, 'hierarchy').returns([node])

      node.cache.size.should.equal(0)
      const response = node.lookupMethod(method.name, method.parameters.length)
      response!.should.equal(method)
      node.cache.get(`lookupMethod(${method.name},${method.parameters.length})`).should.equal(response)
    })

    it('should prevent a second call to the same method', () => {
      const method = new Method({ name: 'm1', body: 'native', isOverride: false, parameters: [] })
      const otherMethod = new Method({ name: 'm2', body: 'native', isOverride: false, parameters: [] })
      const node = new Class({ name: 'C', mixins: [], members: [method] })
      stub(node, 'hierarchy').returns([node])

      node.lookupMethod(method.name, method.parameters.length)
      node.cache.set(`lookupMethod(${method.name},${method.parameters.length})`, otherMethod)

      node.lookupMethod(method.name, method.parameters.length)!.should.equal(otherMethod)
    })

  })

  describe('Method', () => {

    describe('isAbstract', () => {
      it('should return true for methods with no body', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1', scope: null as any })
        m.isAbstract().should.be.true
      })

      it('should return false for native methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1', scope: null as any, body: 'native' })
        m.isAbstract().should.be.false
      })

      it('should return false for non-abstract non-native methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1', scope: null as any, body: new Body({ id: 'b1', scope: null as any, sentences: [] }) })
        m.isAbstract().should.be.false
      })
    })

  })

  describe('Class', () => {

    describe('isAbstract', () => {

      afterEach(restore)

      it('should return true for classes with abstract methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1', scope: null as any })
        const c = new Class({ name: 'C', mixins: [], members: [m], id: 'c1', scope: null as any })
        stub(c, 'fullyQualifiedName').returns('C')

        c.hierarchy = () => [c as any]

        c.isAbstract().should.be.true
      })

      it('should return true for classes with non-overriten inherited abstract methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1', scope: null as any })
        const b = new Class({ name: 'B', mixins: [], members: [m], id: 'c1', scope: null as any })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r', scope: null as any })
        bRef.target = () => b as any
        const c = new Class({ name: 'C', mixins: [], members: [], superclassRef: bRef, id: 'c1', scope: null as any })
        stub(b, 'fullyQualifiedName').returns('B')
        stub(c, 'fullyQualifiedName').returns('C')
        stub(c, 'hierarchy').returns([c, b])

        c.isAbstract().should.be.true
      })

      it('should return false for classes with no abstract methods', () => {
        const c = new Class({ name: 'C', mixins: [], members: [], id: 'c1', scope: null as any })
        c.hierarchy = () => [c as any]

        c.isAbstract().should.be.false
      })

      it('should return false for classes with implemented inherited abstract methods', () => {
        const m1 = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1', scope: null as any })
        const m2 = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm2', scope: null as any, body: 'native' })
        const b = new Class({ name: 'B', mixins: [], members: [m1], id: 'c1', scope: null as any })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r', scope: null as any })
        bRef.target = () => b as any
        const c = new Class({ name: 'C', mixins: [], members: [m2], superclassRef: bRef, id: 'c1', scope: null as any })
        c.hierarchy = () => [c as any, b as any]

        c.isAbstract().should.be.false
      })

    })

  })

})