import { should, use } from 'chai'
import { Environment, Literal, Method, Name, Parameter, Self, Send } from '../src'
import { bindReceivedMessages, propagateMaxTypes, propagateMinTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import { newSynteticTVar, TypeVariable, typeVariableFor } from '../src/typeSystem/typeVariables'
import { AtomicType, RETURN, WollokAtomicType } from '../src/typeSystem/wollokTypes'
import { typeAssertions } from './assertions'

use(typeAssertions)
should()

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

const stubType = new TestWollokType('TEST', testMethod)
const otherStubType = new TestWollokType('OTHER_TEST', otherTestMethod)

describe('Wollok Type System', () => {
  let tVar: TypeVariable

  beforeEach(() => {
    tVar = newSynteticTVar()
  })

  describe('Minimal types propagation', () => {

    it('should propagate min types from type variable to supertypes without min types', () => {
      const supertype = newSynteticTVar()
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      supertype.allMinTypes()[0].should.be.equal(stubType)
    })

    it('should propagate min types from type variable to supertypes with other min types', () => {
      const supertype = newSynteticTVar()
      supertype.addMinType(otherStubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      supertype.allMinTypes().should.be.have.length(2)
    })

    it('should not propagate min types if already exist in supertypes', () => {
      const supertype = newSynteticTVar()
      supertype.addMinType(stubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      supertype.allMinTypes().should.have.length(1)
    })

    it('should not propagate max types', () => {
      const supertype = newSynteticTVar()
      tVar.addSupertype(supertype)
      tVar.addMaxType(stubType)

      propagateMinTypes(tVar)

      supertype.allMaxTypes().should.be.empty
    })

    it('propagate to a closed type variables should report a problem', () => {
      const supertype = newSynteticTVar().setType(otherStubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      supertype.closed.should.be.true
      propagateMinTypes(tVar)

      supertype.allMinTypes().should.have.length(1); // Not propagated
      (tVar.hasProblems || supertype.hasProblems).should.be.true
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      const supertype = newSynteticTVar().setType(stubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      supertype.closed.should.be.true
      propagateMinTypes(tVar);

      (tVar.hasProblems || supertype.hasProblems).should.be.false
    })

  })

  describe('Maximal types propagation', () => {

    it('should propagate max types from type variable to subtypes without max types', () => {
      const subtype = newSynteticTVar()
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMaxTypes()[0].should.be.equal(stubType)
    })

    it('should propagate max types from type variable to subtypes with other max types', () => {
      const subtype = newSynteticTVar()
      subtype.addMaxType(otherStubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMaxTypes().should.be.have.length(2)
    })

    it('should not propagate max types if already exist in subtypes', () => {
      const subtype = newSynteticTVar()
      subtype.addMaxType(stubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMaxTypes().should.have.length(1)
    })

    it('should not propagate min types', () => {
      const subtype = newSynteticTVar()
      tVar.addSubtype(subtype)
      tVar.addMinType(stubType)

      propagateMaxTypes(tVar)

      subtype.allMinTypes().should.be.empty
    })

    it('propagate to a closed type variables should report a problem', () => {
      const subtype = newSynteticTVar().setType(otherStubType)
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)

      subtype.closed.should.be.true
      propagateMaxTypes(tVar)

      subtype.allMaxTypes().should.have.length(1); // Not propagated
      (tVar.hasProblems || subtype.hasProblems).should.be.true
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      const subtype = newSynteticTVar().setType(stubType)
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

})