import { should } from 'chai'
import { Class, Method, Raw } from '../src/model'

should()

describe('Wollok model', () => {

  describe('cache', () => {

    it('should be populated the first time the node is used', () => {
      const method = new Method<Raw>({ name: 'm', isOverride: false, isNative: true, parameters: [] })
      const node = new Class<Raw>({ name: 'C', mixins: [], members: [method] })

      node._cache().size.should.equal(0)
      const response = node.lookupMethod(method.name, method.parameters.length)
      response!.should.equal(method)
      node._cache().get(`lookupMethod(${method.name},${method.parameters.length})`).should.equal(response)
    })

    it('should prevent a second call to the same method', () => {
      const method = new Method<Raw>({ name: 'm1', isOverride: false, isNative: true, parameters: [] })
      const otherMethod = new Method<Raw>({ name: 'm2', isOverride: false, isNative: true, parameters: [] })
      const node = new Class<Raw>({ name: 'C', mixins: [], members: [method] })

      node.lookupMethod(method.name, method.parameters.length)
      node._cache().set(`lookupMethod(${method.name},${method.parameters.length})`, otherMethod)

      node.lookupMethod(method.name, method.parameters.length)!.should.equal(otherMethod)
    })

  })

})