import { should, use } from 'chai'
import { Environment, Method, Name, Node, Self, Send } from '../src'
import { AtomicType, bindReceivedMessages, newSynteticTVar, propagateMaxTypes, propagateMinTypes, TypeVariable, typeVariableFor, WollokAtomicType } from '../src/typeSystem'
import { typeAssertions } from './assertions'

use(typeAssertions)
should()

class TestWollokType extends WollokAtomicType {
  testMethod: Node = new Method({ name: 'testMethod' })

  constructor(name: string) {
    super(name as AtomicType)
    this.testMethod.parent = new Environment({ members: [] })
  }

  override lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    return this.testMethod
  }

}

const stubType = new TestWollokType('TEST')
const otherStubType = new TestWollokType('OTHER_TEST')

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

})