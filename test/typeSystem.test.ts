import { should } from 'chai'
import { Closure, Environment, Literal, Method, Name, Parameter, Self, Send, Singleton } from '../src'
import { bindReceivedMessages, propagateMaxTypes, propagateMinTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import { newSyntheticTVar, TypeVariable, typeVariableFor } from '../src/typeSystem/typeVariables'
import { AtomicType, RETURN, WollokAtomicType, WollokClosureType, WollokMethodType, WollokParameterType, WollokParametricType } from '../src/typeSystem/wollokTypes'

should()

describe('Wollok Type System', () => {
  let tVar: TypeVariable

  beforeEach(() => {
    tVar = newSyntheticTVar()
  })

  describe('Minimal types propagation', () => {

    it('should propagate min types from type variable to supertypes without min types', () => {
      const supertype = newSyntheticTVar()
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      supertype.allMinTypes()[0].should.be.equal(stubType)
    })

    it('should propagate min types from type variable to supertypes with other min types', () => {
      const supertype = newSyntheticTVar()
      supertype.addMinType(otherStubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      supertype.allMinTypes().should.be.have.length(2)
    })

    it('should not propagate min types if already exist in supertypes', () => {
      const supertype = newSyntheticTVar()
      supertype.addMinType(stubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      supertype.allMinTypes().should.have.length(1)
    })

    it('should not propagate max types', () => {
      const supertype = newSyntheticTVar()
      tVar.addSupertype(supertype)
      tVar.addMaxType(stubType)

      propagateMinTypes(tVar)

      supertype.allMaxTypes().should.be.empty
    })

    it('propagate to a closed type variables should report a problem', () => {
      const supertype = newSyntheticTVar().setType(otherStubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      supertype.closed.should.be.true
      propagateMinTypes(tVar)

      supertype.allMinTypes().should.have.length(1); // Not propagated
      (tVar.hasProblems || supertype.hasProblems).should.be.true
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      const supertype = newSyntheticTVar().setType(stubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      supertype.closed.should.be.true
      propagateMinTypes(tVar);

      (tVar.hasProblems || supertype.hasProblems).should.be.false
    })

  })

  describe('Maximal types propagation', () => {

    it('should propagate max types from type variable to subtypes without max types', () => {
      const subtype = newSyntheticTVar()
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMaxTypes()[0].should.be.equal(stubType)
    })

    it('should propagate max types from type variable to subtypes with other max types', () => {
      const subtype = newSyntheticTVar()
      subtype.addMaxType(otherStubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMaxTypes().should.be.have.length(2)
    })

    it('should not propagate max types if already exist in subtypes', () => {
      const subtype = newSyntheticTVar()
      subtype.addMaxType(stubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMaxTypes().should.have.length(1)
    })

    it('should not propagate min types', () => {
      const subtype = newSyntheticTVar()
      tVar.addSubtype(subtype)
      tVar.addMinType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMinTypes().should.be.empty
    })

    it('propagate to a closed type variables should report a problem', () => {
      const subtype = newSyntheticTVar().setType(otherStubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      subtype.closed.should.be.true
      propagateMaxTypes(tVar)

      subtype.allMaxTypes().should.have.length(1); // Not propagated
      (tVar.hasProblems || subtype.hasProblems).should.be.true
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      const subtype = newSyntheticTVar().setType(stubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      subtype.closed.should.be.true
      propagateMaxTypes(tVar);

      (tVar.hasProblems || subtype.hasProblems).should.be.false
    })

  })

  describe('Bind sends to methods', () => {

    beforeEach(() => {
      tVar.addSend(testSend)
    })

    function assertReturnSendBinding(method: Method, send: Send) {
      typeVariableFor(method).atParam(RETURN).supertypes.should.deep.equal([typeVariableFor(send)])
    }
    function assertArgsSendBinding(method: Method, send: Send) {
      method.parameters.should.not.be.empty
      method.parameters.forEach((param, index) => {
        typeVariableFor(param).subtypes.should.deep.equal([typeVariableFor(send.args[index])])
      })
    }

    it('should add send as return supertype (for next propagation)', () => {
      tVar.setType(stubType)

      bindReceivedMessages(tVar)

      assertReturnSendBinding(testMethod, testSend)
    })

    it('should add send arguments as parameters subtypes (for next propagation)', () => {
      tVar.setType(stubType)

      bindReceivedMessages(tVar)

      assertArgsSendBinding(testMethod, testSend)
    })

    it('send should not have references to the method (for avoiding errors propagation)', () => {
      tVar.setType(stubType)

      bindReceivedMessages(tVar)

      typeVariableFor(testSend).subtypes.should.be.empty
      testSend.args.should.not.be.empty
      testSend.args.forEach(arg => {
        typeVariableFor(arg).supertypes.should.be.empty
      })
    })

    it('should bind methods for any min and max type', () => {
      tVar.addMinType(stubType)
      tVar.addMaxType(otherStubType)

      bindReceivedMessages(tVar);

      [testMethod, otherTestMethod].forEach(method => {
        assertReturnSendBinding(method, testSend)
        assertArgsSendBinding(method, testSend)
      })
    })

  })

  describe('Wollok types', () => {
    const module = new Singleton({ name: 'MODULE_TEST' })

    // TODO: Test method `includes()` for all Wollok Types

    describe('Parametric types', () => {
      let parametricType: WollokParametricType

      beforeEach(() => {
        parametricType = new WollokParametricType(module, { 'param': newSyntheticTVar() })
        tVar.setType(parametricType)
      })

      describe('should be propagated', () => {

        it('To Any variable', () => {
          const supertype = newSyntheticTVar()
          tVar.addSupertype(supertype)
          propagateMinTypes(tVar)

          supertype.allMinTypes()[0].should.be.equal(parametricType)
        })

        it('To param inside an equivalent type', () => {
          parametricType.atParam('param').setType(stubType)
          const param = newSyntheticTVar()
          const supertype = newSyntheticTVar().setType(new WollokParametricType(module, { param }), false)
          tVar.addSupertype(supertype)
          propagateMinTypes(tVar)

          param.allMinTypes()[0].should.be.equal(stubType)
          supertype.hasType(parametricType).should.be.true
        })

        it('To partial params inside an equivalent type', () => {
          parametricType =new WollokParametricType(module, {
            'param1': newSyntheticTVar(),
            'param2': newSyntheticTVar().setType(otherStubType),
            'param3': newSyntheticTVar(),
          })
          const param1 = newSyntheticTVar().setType(stubType)
          const param2 = newSyntheticTVar()
          const param3 = newSyntheticTVar()
          const supertype = newSyntheticTVar().setType(new WollokParametricType(module, { param1, param2, param3 }), false)
          tVar.setType(parametricType)
          tVar.addSupertype(supertype)
          propagateMinTypes(tVar)

          param1.allMinTypes()[0].should.be.equal(stubType)
          param2.allMinTypes()[0].should.be.equal(otherStubType)
          param3.allMinTypes().should.be.empty
          supertype.hasType(parametricType)
        })

      })

      it('Link instance type variables', () => {
        tVar.atParam('param').setType(new WollokParameterType('ELEMENT_TEST'))
        const innerInstance = newSyntheticTVar().setType(stubType)
        const instance = newSyntheticTVar().setType(new WollokParametricType(module, { 'ELEMENT_TEST': innerInstance }))
        const newInstance = tVar.instanceFor(instance)

        newInstance.should.not.be.eq(tVar) // New TVAR
        newInstance.atParam('param').should.be.eq(innerInstance)
      })

      it('Create message type variables', () => {
        const innerTVar = tVar.atParam('param').setType(new WollokParameterType('MAP_TEST'))
        const instance = newSyntheticTVar().setType(new WollokParametricType(module)) // Empty for parameter // Mismatche with basic types... :(
        const send = newSyntheticTVar() // Without send there is no instance
        const newInstance = tVar.instanceFor(instance, send)

        newInstance.should.not.be.eq(tVar) // New TVAR
        newInstance.atParam('param').should.not.be.eq(innerTVar)  // New inner TVAR
      })

      it('Link message type variables between them', () => {
        const parameter = new WollokParameterType('MAP_TEST')
        const innerType = newSyntheticTVar().setType(parameter)
        const otherInnerType = newSyntheticTVar().setType(parameter)
        tVar.setType(new WollokParametricType(module, { innerType, otherInnerType }))

        const instance = newSyntheticTVar().setType(new WollokParametricType(module)) // Empty for parameter // Mismatche with basic types... :(
        const send = newSyntheticTVar() // Without send there is no instance
        const newInstance = tVar.instanceFor(instance, send)

        newInstance.should.not.be.eq(tVar) // New TVAR
        newInstance.atParam('innerType').should.not.be.eq(innerType)  // New inner TVAR
        newInstance.atParam('otherInnerType').should.not.be.eq(otherInnerType)  // New inner TVAR
        newInstance.atParam('innerType').should.be.eq(newInstance.atParam('otherInnerType')) // Same instance
      })

      it('Not create new type variables if there is not new intances (optimised)', () => {
        const newInstance = tVar.instanceFor(newSyntheticTVar(), newSyntheticTVar())
        newInstance.should.be.eq(tVar)
      })

    })

    it('Generic type string', () => {
      const parametricType = new WollokParametricType(module, { 'param': newSyntheticTVar().setType(stubType) })
      parametricType.name.should.be.eq(`${module.name}<${stubType.name}>`)
    })

    it('Method type string', () => {
      const methodType = new WollokMethodType(newSyntheticTVar().setType(stubType), [newSyntheticTVar().setType(otherStubType)])
      methodType.name.should.be.eq(`(${otherStubType.name}) => ${stubType.name}`)

    })
    it('Closure type string', () => {
      const closureType = new WollokClosureType(newSyntheticTVar().setType(stubType), [newSyntheticTVar().setType(otherStubType)], Closure({ code: 'TEST' }))
      closureType.name.should.be.eq(`{ (${otherStubType.name}) => ${stubType.name} }`)
    })

  })

})


const env = new Environment({ members: [] })


const testSend = new Send({
  receiver: new Self(),
  message: 'someMessage',
  args: [new Literal({ value: 1 })],
})
testSend.parent = env

class TestWollokType extends WollokAtomicType {
  method: Method

  constructor(name: string, method: Method) {
    super(name as AtomicType)
    this.method = method
  }

  override lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    return this.method
  }

}

function newMethod(name: string) {
  const method = new Method({ name, parameters: [new Parameter({ name: 'param' })] })
  method.parent = env as any
  return method
}

const testMethod = newMethod('TEST_METHOD')
const otherTestMethod = newMethod('OTHER_TEST_METHOD')

const stubType = new TestWollokType('TEST_TYPE', testMethod)
const otherStubType = new TestWollokType('OTHER_TEST_TYPE', otherTestMethod)