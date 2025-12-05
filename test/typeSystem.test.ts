
import { buildEnvironment, Closure, Literal, Method, Name, Parameter, Self, Send, Singleton } from '../src'
import { bindReceivedMessages, maxTypeFromMessages, propagateMaxTypes, propagateMessages, propagateMinTypes } from '../src/typeSystem/constraintBasedTypeSystem'
import { newSyntheticTVar, newTypeVariables, TypeVariable, typeVariableFor } from '../src/typeSystem/typeVariables'
import { AtomicType, RETURN, WollokAtomicType, WollokClosureType, WollokMethodType, WollokParameterType, WollokParametricType } from '../src/typeSystem/wollokTypes'
import { describe, expect, it, beforeEach } from 'vitest'

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

      expect(supertype.allMinTypes()[0]).toBe(stubType)
    })

    it('should propagate min types from type variable to supertypes with other min types', () => {
      const supertype = newSyntheticTVar()
      supertype.addMinType(otherStubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      expect(supertype.allMinTypes()).toHaveLength(2)
    })

    it('should not propagate min types if already exist in supertypes', () => {
      const supertype = newSyntheticTVar()
      supertype.addMinType(stubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      propagateMinTypes(tVar)

      expect(supertype.allMinTypes()).toHaveLength(1)
    })

    it('should not propagate max types', () => {
      const supertype = newSyntheticTVar()
      tVar.addSupertype(supertype)
      tVar.addMaxType(stubType)

      propagateMinTypes(tVar)

      expect(supertype.allMaxTypes()).toHaveLength(0)
    })

    it('propagate to a closed type variables should report a problem', () => {
      const supertype = newSyntheticTVar().setType(otherStubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      expect(supertype.closed).toBe(true)
      propagateMinTypes(tVar)

      expect(supertype.allMinTypes().length).toBe(1) // Not propagated
      expect(tVar.hasProblems || supertype.hasProblems).toBe(true)
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      const supertype = newSyntheticTVar().setType(stubType)
      tVar.addSupertype(supertype)
      tVar.addMinType(stubType)

      expect(supertype.closed).toBe(true)
      propagateMinTypes(tVar)

      expect(tVar.hasProblems || supertype.hasProblems).toBe(false)
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
      expect(propagateMaxTypes(tVar)).toBe(true)

      expect(subtype.allMaxTypes()[0]).toBe(stubType)
    })

    it('should propagate max types from type variable to subtypes with other max types', () => {
      subtype.addMaxType(otherStubType)

      expect(propagateMaxTypes(tVar)).toBe(true)

      expect(subtype.allMaxTypes()).toHaveLength(2)
    })

    it('should not propagate max types if already exist in subtypes', () => {
      subtype.addMaxType(stubType)

      expect(propagateMaxTypes(tVar)).toBe(false)

      expect(subtype.allMaxTypes().length).toBe(1)
    })

    it('should not propagate min types', () => {
      tVar.addMinType(otherStubType)

      expect(propagateMaxTypes(tVar)).toBe(true) // There is a max type

      expect(subtype.allPossibleTypes().includes(otherStubType)).toBe(false)
    })

    it('propagate to a closed type variables should report a problem', () => {
      subtype.setType(otherStubType)
      expect(subtype.closed).toBe(true)

      expect(propagateMaxTypes(tVar)).toBe(true)

      expect(subtype.allMaxTypes().length).toBe(1) // Not propagated
      expect(tVar.hasProblems || subtype.hasProblems).toBe(true)
    })

    it('propagate to a closed type variables with same type should not report a problem', () => {
      subtype.setType(stubType)
      expect(subtype.closed).toBe(true)

      expect(propagateMaxTypes(tVar)).toBe(false)

      expect(tVar.hasProblems || subtype.hasProblems).toBe(false)
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
      expect(propagateMessages(tVar)).toBe(true)

      expect(subtype.messages).toEqual([testSend])
    })

    it('should propagate messages from type variable to subtypes with other messages', () => {
      const otherSend = testSend.copy()
      subtype.addSend(otherSend)

      expect(propagateMessages(tVar)).toBe(true)

      expect(subtype.messages).toEqual([otherSend, testSend])
    })

    it('should not propagate messages if already exist in subtypes', () => {
      subtype.addSend(testSend)

      expect(propagateMessages(tVar)).toBe(false)

      expect(subtype.messages.length).toBe(1)
    })

    it('propagate to a closed type variables with MNU types should report a problem', () => {
      subtype.setType(mnuStubType)

      expect(propagateMessages(tVar)).toBe(true)

      expect(subtype.messages.length).toBe(0) // Not propagated
      expect(subtype.hasProblems).toBe(true)
    })

    it('propagate to a closed type variables with types that understand the message should not report a problem', () => {
      subtype.setType(otherStubType)

      expect(propagateMessages(tVar)).toBe(true)

      expect(subtype.messages).toEqual([testSend])
      expect(tVar.hasProblems || subtype.hasProblems).toBe(false)
    })
  })

  describe('Bind sends to methods', () => {

    beforeEach(() => {
      newSyntheticTVar(testMethod)
      tVar.addSend(testSend)
      tVar.node = testSend.receiver
    })

    function assertReturnSendBinding(method: Method, send?: Send) {
      expect(typeVariableFor(method).atParam(RETURN).supertypes).toEqual([...send ? [typeVariableFor(send)] : []])
    }

    function assertArgsSendBinding(method: Method, send?: Send) {
      expect(method.parameters.length).toBeGreaterThan(0)
      method.parameters.forEach((param, index) => {
        expect(typeVariableFor(param).subtypes).toEqual([...send ? [typeVariableFor(send.args[index])] : []])
      })
    }

    it('should add send as return supertype (for next propagation)', () => {
      tVar.setType(stubType)

      expect(bindReceivedMessages(tVar)).toBe(true)

      assertReturnSendBinding(testMethod, testSend)
    })

    it('should add send arguments as parameters subtypes (for next propagation)', () => {
      tVar.setType(stubType)

      expect(bindReceivedMessages(tVar)).toBe(true)

      assertArgsSendBinding(testMethod, testSend)
    })

    it('send should not have references to the method (for avoiding errors propagation)', () => {
      tVar.setType(stubType)

      expect(bindReceivedMessages(tVar)).toBe(true)

      expect(typeVariableFor(testSend).subtypes.length).toBe(0)
      expect(testSend.args.length).toBeGreaterThan(0)
      testSend.args.forEach(arg => {
        expect(typeVariableFor(arg).supertypes.length).toBe(0)
      })
    })

    it('should bind methods for any min and max type', () => {
      tVar.addMinType(stubType)
      tVar.addMaxType(otherStubType)

      expect(bindReceivedMessages(tVar)).toBe(true);

      [testMethod, otherTestMethod].forEach(method => {
        assertReturnSendBinding(method, testSend)
        assertArgsSendBinding(method, testSend)
      })
    })

    it('should not bind message if type variable is not the receiver', () => {
      tVar.setType(stubType)
      tVar.node = new Self()

      expect(bindReceivedMessages(tVar)).toBe(false)

      assertReturnSendBinding(testMethod)
      assertArgsSendBinding(testMethod)
    })
  })

  describe('Max types from methods', () => {

    function assertMaxTypes(_tVar: TypeVariable, ...types: string[]) {
      expect(_tVar.allMaxTypes().map(type => type.name)).toEqual(types)
    }

    it('should do nothing when there is no messages', () => {
      expect(tVar.messages.length).toBe(0)

      expect(maxTypeFromMessages(tVar)).toBe(false)

      expect(tVar.allMaxTypes().length).toBe(0)
    })

    it('should infer maximal types', () => {
      tVar.addSend(newSend('even'))
      expect(maxTypeFromMessages(tVar)).toBe(true)

      assertMaxTypes(tVar, 'Number')
    })

    it('should infer all maximal types', () => {
      tVar.addSend(newSend('+', 1))
      expect(maxTypeFromMessages(tVar)).toBe(true)

      assertMaxTypes(tVar, 'Collection<Any>', 'Set<Any>', 'List<Any>', 'Number', 'String') // TODO: check params and return types
    })

    it('should infer maximal types that implements all messages', () => {
      tVar.addSend(newSend('+', 1))
      tVar.addSend(newSend('even'))
      expect(maxTypeFromMessages(tVar)).toBe(true)

      assertMaxTypes(tVar, 'Number')
    })

    it('should not infer maximal types if there is no method implementation', () => {
      tVar.addSend(testSend)
      expect(maxTypeFromMessages(tVar)).toBe(false)

      assertMaxTypes(tVar, ...[])
    })

    describe('should infer maximal types from a subset of messages', () => {

      it('between two different types', () => {
        const problemSend = newSend('toLowerCase')
        tVar.addSend(newSend('even'))
        tVar.addSend(problemSend)
        tVar.node = problemSend.receiver

        expect(maxTypeFromMessages(tVar)).toBe(true)

        assertMaxTypes(tVar, 'Number')
        expect(problemSend.receiver.problems!.length).toBe(1)
      })

      it('between two different types (reverse)', () => {
        const problemSend = newSend('even')
        tVar.addSend(newSend('toLowerCase'))
        tVar.addSend(problemSend)
        tVar.node = problemSend.receiver

        expect(maxTypeFromMessages(tVar)).toBe(true)

        assertMaxTypes(tVar, 'String')
        expect(problemSend.receiver.problems!.length).toBe(1)
      })

      // TODO: Improve inferMaxTypesFromMessages algorithm
      it.skip('between a type and not implemented method', () => {
        tVar.addSend(testSend)
        tVar.node = testSend.receiver
        tVar.addSend(newSend('toLowerCase'))

        expect(maxTypeFromMessages(tVar)).toBe(true)

        assertMaxTypes(tVar, 'String')
        expect(testSend.receiver.problems!.length).toBe(1)
      })

      it('between a type and not implemented method (reverse)', () => {
        tVar.addSend(newSend('toLowerCase'))
        tVar.addSend(testSend)
        tVar.node = testSend.receiver

        expect(maxTypeFromMessages(tVar)).toBe(true)

        assertMaxTypes(tVar, 'String')
        expect(testSend.receiver.problems!.length).toBe(1)
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

          expect(supertype.allMinTypes()[0]).toBe(parametricType)
        })

        it('To param inside an equivalent type', () => {
          parametricType.atParam('param').setType(stubType)
          const param = newSyntheticTVar()
          const supertype = newSyntheticTVar().setType(new WollokParametricType(module, { param }), false)
          tVar.addSupertype(supertype)
          propagateMinTypes(tVar)

          expect(param.allMinTypes()[0]).toBe(stubType)
          expect(supertype.hasType(parametricType)).toBe(true)
        })

        it('To partial params inside an equivalent type', () => {
          parametricType = new WollokParametricType(module, {
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

          expect(param1.allMinTypes()[0]).toBe(stubType)
          expect(param2.allMinTypes()[0]).toBe(otherStubType)
          expect(param3.allMinTypes().length).toBe(0)
          supertype.hasType(parametricType)
        })

      })

      it('Link instance type variables', () => {
        tVar.atParam('param').setType(new WollokParameterType('ELEMENT_TEST'))
        const innerInstance = newSyntheticTVar().setType(stubType)
        const instance = newSyntheticTVar().setType(new WollokParametricType(module, { 'ELEMENT_TEST': innerInstance }))
        const newInstance = tVar.instanceFor(instance)

        expect(newInstance).not.toBe(tVar) // New TVAR
        expect(newInstance.atParam('param')).toBe(innerInstance)
      })

      it('Create message type variables', () => {
        const innerTVar = tVar.atParam('param').setType(new WollokParameterType('MAP_TEST'))
        const instance = newSyntheticTVar().setType(new WollokParametricType(module)) // Empty for parameter // Mismatche with basic types... :(
        const send = newSyntheticTVar() // Without send there is no instance
        const newInstance = tVar.instanceFor(instance, send)

        expect(newInstance).not.toBe(tVar) // New TVAR
        expect(newInstance.atParam('param')).not.toBe(innerTVar)  // New inner TVAR
      })

      it('Link message type variables between them', () => {
        const parameter = new WollokParameterType('MAP_TEST')
        const innerType = newSyntheticTVar().setType(parameter)
        const otherInnerType = newSyntheticTVar().setType(parameter)
        tVar.setType(new WollokParametricType(module, { innerType, otherInnerType }))

        const instance = newSyntheticTVar().setType(new WollokParametricType(module)) // Empty for parameter // Mismatche with basic types... :(
        const send = newSyntheticTVar() // Without send there is no instance
        const newInstance = tVar.instanceFor(instance, send)

        expect(newInstance).not.toBe(tVar) // New TVAR
        expect(newInstance.atParam('innerType')).not.toBe(innerType)  // New inner TVAR
        expect(newInstance.atParam('otherInnerType')).not.toBe(otherInnerType)  // New inner TVAR
        expect(newInstance.atParam('innerType')).toBe(newInstance.atParam('otherInnerType')) // Same instance
      })

      it('Not create new type variables if there is not new intances (optimised)', () => {
        const newInstance = tVar.instanceFor(newSyntheticTVar(), newSyntheticTVar())
        expect(newInstance).toBe(tVar)
      })

    })

    it('Generic type string', () => {
      const parametricType = new WollokParametricType(module, { 'param': newSyntheticTVar().setType(stubType) })
      expect(parametricType.name).toBe(`${module.name}<${stubType.name}>`)
    })

    it('Method type string', () => {
      const methodType = new WollokMethodType(newSyntheticTVar().setType(stubType), [newSyntheticTVar().setType(otherStubType)])
      expect(methodType.name).toBe(`(${otherStubType.name}) => ${stubType.name}`)

    })
    it('Closure type string', () => {
      const closureType = new WollokClosureType(newSyntheticTVar().setType(stubType), [newSyntheticTVar().setType(otherStubType)], Closure({ code: 'TEST' }))
      expect(closureType.name).toBe(`{ (${otherStubType.name}) => ${stubType.name} }`)
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