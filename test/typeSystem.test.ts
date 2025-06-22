import { should } from 'chai'
import { buildEnvironment, Closure, Literal, Method, Name, Parameter, Self, Send, Singleton } from '../src'
import { bindReceivedMessages, maxTypeFromMessages, propagateMaxTypes, propagateMessages, propagateMinTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import { newSyntheticTVar, newTypeVariables, TypeVariable, typeVariableFor } from '../src/typeSystem/typeVariables'
import { AtomicType, RETURN, WollokAtomicType, WollokClosureType, WollokMethodType, WollokParameterType, WollokParametricType } from '../src/typeSystem/wollokTypes'

should()

describe('Wollok Type System', () => {
  let tVar: TypeVariable

  beforeEach(() => {
    newTypeVariables(env) // Reset caches
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
    let subtype: TypeVariable

    beforeEach(() => {
      subtype = newSyntheticTVar()
      tVar.addSubtype(subtype)
      tVar.addMaxType(stubType)
    })

    it('should propagate max types from type variable to subtypes without max types', () => {
      propagateMaxTypes(tVar).should.be.true

      subtype.allMaxTypes()[0].should.be.equal(stubType)
    })

    it('should propagate max types from type variable to subtypes with other max types', () => {
      subtype.addMaxType(otherStubType)

      propagateMaxTypes(tVar).should.be.true

      subtype.allMaxTypes().should.be.have.length(2)
    })

    it('should not propagate max types if already exist in subtypes', () => {
      subtype.addMaxType(stubType)

      propagateMaxTypes(tVar).should.be.false

      subtype.allMaxTypes().should.have.length(1)
    })

    it('should not propagate min types', () => {
      tVar.addMinType(otherStubType)

      propagateMaxTypes(tVar).should.be.true // There is a max type

      subtype.allPossibleTypes().should.not.include(otherStubType)
    })

    it('propagate to a closed type variables should report a problem', () => {
      subtype.setType(otherStubType)
      subtype.closed.should.be.true

      propagateMaxTypes(tVar).should.be.true

      subtype.allMaxTypes().should.have.length(1); // Not propagated
      (tVar.hasProblems || subtype.hasProblems).should.be.true
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      subtype.setType(stubType)
      subtype.closed.should.be.true

      propagateMaxTypes(tVar).should.be.false;

      (tVar.hasProblems || subtype.hasProblems).should.be.false
    })
  })

  describe('Messages propagation', () => {
    let subtype: TypeVariable

    beforeEach(() => {
      subtype = newSyntheticTVar()
      tVar.addSubtype(subtype)
      tVar.addSend(testSend)
      tVar.node = testSend.receiver
    })

    it('should propagate messages from type variable to subtypes without messages', () => {
      propagateMessages(tVar).should.be.true

      subtype.messages.should.be.deep.equal([testSend])
    })

    it('should propagate messages from type variable to subtypes with other messages', () => {
      const otherSend = testSend.copy()
      subtype.addSend(otherSend)

      propagateMessages(tVar).should.be.true

      subtype.messages.should.be.deep.equal([otherSend, testSend])
    })

    it('should not propagate messages if already exist in subtypes', () => {
      subtype.addSend(testSend)

      propagateMessages(tVar).should.be.false

      subtype.messages.should.have.length(1)
    })

    it('propagate to a closed type variables with MNU types should report a problem', () => {
      subtype.setType(mnuStubType)

      propagateMessages(tVar).should.be.true

      subtype.messages.should.be.empty // Not propagated
      subtype.hasProblems.should.be.true
    })

    it('propagate to a closed type variables with types that understand the message should not report a problem', () => {
      subtype.setType(otherStubType)

      propagateMessages(tVar).should.be.true

      subtype.messages.should.be.deep.equal([testSend]);
      (tVar.hasProblems || subtype.hasProblems).should.be.false
    })
  })

  describe('Bind sends to methods', () => {

    beforeEach(() => {
      newSyntheticTVar(testMethod)
      tVar.addSend(testSend)
      tVar.node = testSend.receiver
    })

    function assertReturnSendBinding(method: Method, send?: Send) {
      typeVariableFor(method).atParam(RETURN).supertypes.should.deep.equal([...send ? [typeVariableFor(send)] : []])
    }
    function assertArgsSendBinding(method: Method, send?: Send) {
      method.parameters.should.not.be.empty
      method.parameters.forEach((param, index) => {
        typeVariableFor(param).subtypes.should.deep.equal([...send ? [typeVariableFor(send.args[index])] : []])
      })
    }

    it('should add send as return supertype (for next propagation)', () => {
      tVar.setType(stubType)

      bindReceivedMessages(tVar).should.be.true

      assertReturnSendBinding(testMethod, testSend)
    })

    it('should add send arguments as parameters subtypes (for next propagation)', () => {
      tVar.setType(stubType)

      bindReceivedMessages(tVar).should.be.true

      assertArgsSendBinding(testMethod, testSend)
    })

    it('send should not have references to the method (for avoiding errors propagation)', () => {
      tVar.setType(stubType)

      bindReceivedMessages(tVar).should.be.true

      typeVariableFor(testSend).subtypes.should.be.empty
      testSend.args.should.not.be.empty
      testSend.args.forEach(arg => {
        typeVariableFor(arg).supertypes.should.be.empty
      })
    })

    it('should bind methods for any min and max type', () => {
      tVar.addMinType(stubType)
      tVar.addMaxType(otherStubType)

      bindReceivedMessages(tVar).should.be.true;

      [testMethod, otherTestMethod].forEach(method => {
        assertReturnSendBinding(method, testSend)
        assertArgsSendBinding(method, testSend)
      })
    })

    it('should not bind message if type variable is not the receiver', () => {
      tVar.setType(stubType)
      tVar.node = new Self()

      bindReceivedMessages(tVar).should.be.false

      assertReturnSendBinding(testMethod)
      assertArgsSendBinding(testMethod)
    })
  })

  describe('Max types from methods', () => {

    function assertMaxTypes(_tVar: TypeVariable, ...types: string[]) {
      _tVar.allMaxTypes().map(type => type.name).should.be.deep.eq(types)
    }

    it('should do nothing when there is no messages', () => {
      tVar.messages.should.be.empty

      maxTypeFromMessages(tVar).should.be.false

      tVar.allMaxTypes().should.be.empty
    })

    it('should infer maximal types', () => {
      tVar.addSend(newSend('even'))
      maxTypeFromMessages(tVar).should.be.true

      assertMaxTypes(tVar, 'Number')
    })

    it('should infer all maximal types', () => {
      tVar.addSend(newSend('+', 1))
      maxTypeFromMessages(tVar).should.be.true

      assertMaxTypes(tVar, 'Collection<Any>', 'Number', 'String') // TODO: check params and return types
    })

    it('should infer maximal types that implements all messages', () => {
      tVar.addSend(newSend('+', 1))
      tVar.addSend(newSend('even'))
      maxTypeFromMessages(tVar).should.be.true

      assertMaxTypes(tVar, 'Number')
    })

    it('should not infer maximal types if there is no method implementation', () => {
      tVar.addSend(testSend)
      maxTypeFromMessages(tVar).should.be.false

      assertMaxTypes(tVar, ...[])
    })

    describe('should infer maximal types from a subset of messages', () => {

      it('between two different types', () => {
        const problemSend = newSend('toLowerCase')
        tVar.addSend(newSend('even'))
        tVar.addSend(problemSend)
        tVar.node = problemSend.receiver

        maxTypeFromMessages(tVar).should.be.true

        assertMaxTypes(tVar, 'Number')
        problemSend.receiver.problems!.should.have.length(1)
      })

      it('between two different types (reverse)', () => {
        const problemSend = newSend('even')
        tVar.addSend(newSend('toLowerCase'))
        tVar.addSend(problemSend)
        tVar.node = problemSend.receiver

        maxTypeFromMessages(tVar).should.be.true

        assertMaxTypes(tVar, 'String')
        problemSend.receiver.problems!.should.have.length(1)
      })

      // TODO: Improve inferMaxTypesFromMessages algorithm
      xit('between a type and not implemented method', () => {
        tVar.addSend(testSend)
        tVar.node = testSend.receiver
        tVar.addSend(newSend('toLowerCase'))

        maxTypeFromMessages(tVar).should.be.true

        assertMaxTypes(tVar, 'String')
        testSend.receiver.problems!.should.have.length(1)
      })

      it('between a type and not implemented method (reverse)', () => {
        tVar.addSend(newSend('toLowerCase'))
        tVar.addSend(testSend)
        tVar.node = testSend.receiver

        maxTypeFromMessages(tVar).should.be.true

        assertMaxTypes(tVar, 'String')
        testSend.receiver.problems!.should.have.length(1)
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
          tVar = newSyntheticTVar().setType(new WollokParametricType(module, {
            'param1': newSyntheticTVar(),
            'param2': newSyntheticTVar().setType(otherStubType),
            'param3': newSyntheticTVar(),
          }))
          const param1 = newSyntheticTVar().setType(stubType)
          const param2 = newSyntheticTVar()
          const param3 = newSyntheticTVar()
          const supertype = newSyntheticTVar().setType(new WollokParametricType(module, { param1, param2, param3 }), false)
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
        tVar = newSyntheticTVar().setType(new WollokParametricType(module, { innerType, otherInnerType }))

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


const env = buildEnvironment([])


class TestWollokType extends WollokAtomicType {
  method: Method

  constructor(name: string, method: Method) {
    super(name as AtomicType)
    this.method = method
  }

  override lookupMethod(_name: Name, _arity: number, _options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
    return _name == this.method.name ? this.method : undefined as any
  }

}

function newMethod(name: string) {
  const node = new Method({ name, parameters: [new Parameter({ name: 'param' })] })
  node.parent = env as any
  node.environment = env
  return node
}

function newSend(message: string, nArgs = 0, receiver = new Self()) {
  const node = new Send({ receiver, message, args: [...new Array(nArgs)].map((_, i) => new Literal({ value: i })) })
  node.parent = env as any
  node.environment = env
  return node
}

const testMethod = newMethod('TEST_MESSAGE')
const otherTestMethod = newMethod('TEST_MESSAGE')

const testSend = newSend('TEST_MESSAGE', 1)

const stubType = new TestWollokType('TEST_TYPE', testMethod)
const otherStubType = new TestWollokType('OTHER_TEST_TYPE', otherTestMethod)
const mnuStubType = new TestWollokType('MNU_TEST_TYPE', newMethod('<NONE>'))