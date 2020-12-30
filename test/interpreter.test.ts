import { should, use } from 'chai'
import { restore, stub, spy } from 'sinon'
import sinonChai from 'sinon-chai'
import { Class, Constructor, Field, Literal, Method, Package, Parameter, Reference } from '../src/builders'
import { CALL, CONDITIONAL_JUMP, DUP, INHERITS, CALL_CONSTRUCTOR, INIT, INSTANTIATE, INTERRUPT, JUMP, LOAD, NativeFunction, POP, POP_CONTEXT, PUSH, PUSH_CONTEXT, RETURN, STORE, SWAP, Evaluation } from '../src/interpreter'
import link from '../src/linker'
import { Constructor as ConstructorNode, Filled, Method as MethodNode, Package as PackageNode, Self as SelfNode, Raw, Expression } from '../src/model'
import { interpreterAssertions, testEvaluation, obj, ctx } from './assertions'
import { ConsoleLogger, LogLevel } from '../src/log'

// TODO:
// - Create and use toJSON methods on model instead of metrics
// - Pass the environment or maybe the new classes to each testcase, to avoid global test domain


should()
use(interpreterAssertions)
use(sinonChai)

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('String', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('Boolean', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('Number', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('List', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('EvaluationError', { superclassRef: Reference('wollok.lang.Object') })(),
  ),
  Package('lib')(),
) as unknown as PackageNode<Filled>

const environment = link([WRE,
  Package('test')(
    Class('B', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('C', { superclassRef: Reference('test.B') })(),
    Class('D', { superclassRef: Reference('wollok.lang.Object') })(
      Field('f5', { value: Literal(5) }),
      Field('f6', { value: Literal(null) }),
      Field('f7', { value: Literal(7) }),
      Field('f8', { value: Literal(null) }),
    ),
    Class('E', { superclassRef: Reference('test.D') })(
      Field('f1', { value: Literal(1) }),
      Field('f2', { value: Literal(null) }),
      Field('f3', { value: Literal(3) }),
      Field('f4', { value: Literal(null) }),
    ),
  ) as unknown as PackageNode<Filled>,
])

const evaluation = testEvaluation(environment)

afterEach(restore)

describe('Wollok Interpreter', () => {

  describe('evaluation of Instructions', () => {

    describe('LOAD', () => {

      it('should push the local with the given name from the current locals into the current operand stack', () => {
        evaluation({
          instances: [obj`target`, obj`other`],
          frames: [
            { instructions: [LOAD('x')], operands: [obj`other`], contexts: [ctx`c1`({ locals:{ x: obj`target` } })] },
          ],
        }).should
          .onCurrentFrame.pushOperands(obj`target`)
          .whenStepped()
      })

      it('should search it through the context hierarchy if the local is missing in the current context of the frame', () => {
        evaluation({
          instances: [
            obj`target`,
            obj`ctx`({ locals: { 'x': obj`target` } }),
          ],
          frames: [
            { instructions: [LOAD('x')], contexts: [ctx`c1`({ locals:{ }, parent: obj`ctx` })] },
          ],
        }).should
          .onCurrentFrame.pushOperands(obj`target`)
          .whenStepped()
      })

      it('should push a void value if the local is not in the context hierarchy', () => {
        evaluation({
          frames: [
            { instructions: [LOAD('x')], contexts: [ctx`c1`({ locals:{} })] },
          ],
        }).should
          .onCurrentFrame.pushOperands(undefined)
          .whenStepped()
      })

      it('should not search through the frame stack', () => {
        evaluation({
          instances: [obj`wrong`],
          frames: [
            { instructions: [LOAD('x')], contexts: [ctx`c1`({ locals:{} })] },
            { contexts: [ctx`c1`({ locals:{ x: obj`wrong` } })] },
          ],
        }).should
          .onCurrentFrame.pushOperands(undefined)
          .whenStepped()
      })

      it('should trigger lazy initialization for uninitialized lazy references', () => {
        const mockCode = [POP, POP, POP]
        const lazyInitializer = new SelfNode<Raw>({}) as Expression
        stub(Evaluation.prototype, 'codeFor').withArgs(lazyInitializer).returns(mockCode)


        evaluation({
          instances: [obj`target`({ lazyInitializer })],
          frames: [
            { instructions: [LOAD('x')], contexts: [ctx`c1`({ locals:{ x: obj`target` } })] },
          ],
        }).should
          .pushFrames({ instructions: [...mockCode, DUP, STORE('x', true), RETURN], contexts: [ctx`_new_1_`({ parent: ctx`c1` })] })
          .whenStepped()
      })

    })


    describe('STORE', () => {

      it('should pop the current operand stack and save it to the given name in the current locals', () => {
        evaluation({
          instances: [obj`value`, obj`other`],
          frames: [
            { instructions: [STORE('x', false)], operands: [obj`value`, obj`other`], contexts: [ctx`c1`({ locals:{ } })] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.setLocal('x', obj`value`)
          .whenStepped()
      })

      it('should override the current local value, if present', () => {
        evaluation({
          instances: [obj`old`, obj`new`],
          frames: [
            { instructions: [STORE('x', false)], operands: [obj`new`], contexts: [ctx`c1`({ locals:{ x: obj`old` } })] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.setLocal('x', obj`new`)
          .whenStepped()
      })

      it('should search the local through the frame stack if lookup is active and the local is missing in the current frame', () => {
        evaluation({
          instances: [
            obj`old`,
            obj`new`,
            obj`context`({ locals:{ x: obj`old` } }),
          ],
          frames: [
            { instructions: [STORE('x', true)], operands: [obj`new`], contexts: [ctx`c1`({ locals:{ }, parent: obj`context` })] },
          ],
        }).should
          .onInstance(obj`context`).setLocal('x', obj`new`)
          .and.onCurrentFrame.popOperands(1)
          .whenStepped()
      })

      it('should add the local to the current frame context if lookup is active but local is not present in the context hierarchy', () => {
        evaluation({
          instances: [
            obj`value`,
            obj`context`({ locals:{ } }),
          ],
          frames: [
            { instructions: [STORE('x', true)], operands: [obj`value`], contexts: [ctx`c1`({ locals:{ }, parent: obj`context` })] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.setLocal('x', obj`value`)
          .whenStepped()
      })

    })


    describe('PUSH', () => {

      it('should push the instance with the given id to the current operand stack', () => {
        evaluation({
          instances: [obj`value`, obj`other`],
          frames: [
            { instructions: [PUSH('value')], operands: [obj`other`] },
          ],
        }).should
          .onCurrentFrame.pushOperands(obj`value`)
          .whenStepped()
      })

    })


    describe('POP', () => {

      it('should pop the top of the operand stack and discard it', () => {
        evaluation({
          instances: [obj`value`, obj`other`],
          frames: [
            { instructions: [POP], operands:[obj`value`, obj`other`] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .whenStepped()
      })

      it('should raise an error if the current operand is empty', () => {
        evaluation({
          instances: [obj`value`],
          frames: [
            { instructions: [POP], operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('PUSH_CONTEXT', () => {

      it('should push a new, empty context to the current frame context stack', () => {
        evaluation({
          frames: [
            { instructions: [PUSH_CONTEXT()], contexts: [ctx`base`] },
          ],
        }).should
          .onCurrentFrame.pushContexts(ctx`_new_1_`({ parent: ctx`base` }))
          .whenStepped()
      })

      it('if argument is provided, should set the contexts exception handler index relative to the instruction position', () => {
        evaluation({
          frames: [
            { instructions: [POP, PUSH_CONTEXT(7)], nextInstructionIndex: 1, contexts: [ctx`base`] },
          ],
        }).should
          .onCurrentFrame.pushContexts(ctx`_new_1_`({ parent: ctx`base`, exceptionHandlerIndex: 9 }))
          .whenStepped()
      })

    })


    describe('POP_CONTEXT', () => {

      it('should discard the current frame context and replace it with its parent', () => {
        evaluation({
          frames: [
            { instructions: [POP_CONTEXT], contexts: [ctx`top`, ctx`middle`, ctx`base`] },
          ],
        }).should
          .onCurrentFrame.popContexts(1)
          .whenStepped()
      })

      it('should raise an error if the frame base context would be popped', () => {
        evaluation({
          frames: [
            { instructions: [POP_CONTEXT], contexts: [ctx`base`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('SWAP', () => {

      it('should swap the top two operands of the stack if no distance is specified', () => {
        evaluation({
          instances: [obj`v1`, obj`v2`, obj`v3`],
          frames: [
            { instructions: [SWAP()], operands:[obj`v2`, obj`v1`, obj`v3`] },
          ],
        }).should
          .onCurrentFrame.popOperands(2)
          .and.pushOperands(obj`v1`, obj`v2`)
          .whenStepped()
      })

      it('should swap the top two operands of the stack if distance 0 is specified', () => {
        evaluation({
          instances: [obj`v1`, obj`v2`],
          frames: [
            { instructions: [SWAP(0)], operands:[obj`v2`, obj`v1`] },
          ],
        }).should
          .onCurrentFrame.popOperands(2)
          .and.pushOperands(obj`v1`, obj`v2`)
          .whenStepped()
      })

      it('should swap the top operand with the one N levels below, if distance N is specified', () => {
        evaluation({
          instances: [obj`v1`, obj`v2`, obj`v3`, obj`v4`, obj`v5`],
          frames: [
            { instructions: [SWAP(3)], operands:[obj`v5`, obj`v2`, obj`v3`, obj`v4`, obj`v1`] },
          ],
        }).should
          .onCurrentFrame.popOperands(5)
          .and.pushOperands(obj`v1`, obj`v2`, obj`v3`, obj`v4`, obj`v5`)
          .whenStepped()
      })

      it('should raise an error if the current operand stack has length < 2, if distance is not specified', () => {
        evaluation({
          instances: [obj`v1`],
          frames: [
            { instructions: [SWAP()], operands:[obj`v1`] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the current operand stack has length < 2, if distance is not specified', () => {
        evaluation({
          instances: [obj`v1`, obj`v2`],
          frames: [
            { instructions: [SWAP(1)], operands:[obj`v1`, obj`v2`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('DUP', () => {

      it('should duplicate the top operand of the stack', () => {
        evaluation({
          instances: [obj`right`, obj`wrong`],
          frames: [
            { instructions: [DUP], operands:[obj`right`, obj`wrong`] },
          ],
        }).should
          .onCurrentFrame.pushOperands(obj`right`)
          .whenStepped()
      })

      it('should raise an error if the current operand stack is empty', () => {
        evaluation({
          frames: [
            { instructions: [DUP], operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('INSTANTIATE', () => {

      it('should create a new instance from the given module and push it to the operand stack', () => {
        evaluation({
          frames: [
            { instructions: [INSTANTIATE('test.C')], contexts:[ctx`c1`] },
          ],
        }).should
          .createInstance(obj`_new_1_`({ moduleFQN: 'test.C', locals: { self: obj`_new_1_` }, parent: ctx`c1` }))
          .and.onCurrentFrame.pushOperands(obj`_new_1_`)
          .whenStepped()
      })

      it('should set the inner value if one is specified', () => {
        const innerValue = ['42', '17', '5']
        evaluation({
          frames: [
            { instructions: [INSTANTIATE('wollok.lang.List', innerValue)], contexts:[ctx`c1`] },
          ],
        }).should
          .createInstance(obj`_new_1_`({ moduleFQN: 'wollok.lang.List', locals: { self: obj`_new_1_` }, innerValue, parent: ctx`c1` }))
          .and.onCurrentFrame.pushOperands(obj`_new_1_`)
          .whenStepped()
      })

    })


    describe('INHERITS', () => {

      it('should pop an object from the operand stack and push true if it inherits the given module', () => {
        evaluation({
          instances: [obj`target`({ moduleFQN: 'wollok.lang.List', innerValue: [] })],
          frames: [
            { instructions: [INHERITS('wollok.lang.Object')], operands: [obj`target`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .and.pushOperands(obj`true`)
          .whenStepped()
      })

      it('should pop an object from the operand stack and push false if it does not inherits the given module', () => {
        evaluation({
          instances: [obj`target`({ moduleFQN: 'wollok.lang.List', innerValue: [] })],
          frames: [
            { instructions: [INHERITS('wollok.lang.Number')], operands: [obj`target`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .and.pushOperands(obj`false`)
          .whenStepped()
      })

      it('should raise an error if the current operand stack is empty', () => {
        evaluation({
          instances: [obj`target`({ moduleFQN: 'wollok.lang.List', innerValue: [] })],
          frames: [
            { instructions: [INHERITS('wollok.lang.List')], operands: [] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('JUMP', () => {

      it('should increment the current frame pc (skipping the next N instructions) when a N > 0 jump is provided', () => {
        evaluation({
          frames: [
            { instructions: [POP, JUMP(2), POP, POP, POP], nextInstructionIndex: 1 },
          ],
        }).should.onCurrentFrame
          .jumpTo(4)
          .whenStepped()
      })

      it('should decrement the current frame pc (moving back to the previous N-1 instruction) when a N < 0 jump is provided', () => {
        evaluation({
          frames: [
            { instructions: [POP, POP, POP, JUMP(-2), POP], nextInstructionIndex: 3 },
          ],
        }).should.onCurrentFrame
          .jumpTo(2)
          .whenStepped()
      })

      it('should cause no effect when a N == 0 jump is provided', () => {
        evaluation({
          frames: [
            { instructions: [POP, JUMP(0), POP], nextInstructionIndex: 1 },
          ],
        }).should.whenStepped()
      })

      it('should raise an error if the given count overflows the instruction list', () => {
        evaluation({
          frames: [
            { instructions: [JUMP(1), POP] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the given count underflows the instruction list', () => {
        evaluation({
          frames: [
            { instructions: [POP, JUMP(-3), POP], nextInstructionIndex: 1 },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('CONDITIONAL_JUMP', () => {

      it('should pop a boolean from the operand stack and, if it is true, increment the current frame pc (skipping the next N instructions) when a N > 0 jump is provided', () => {
        evaluation({
          frames: [
            { instructions: [POP, CONDITIONAL_JUMP(2), POP, POP, POP], nextInstructionIndex: 1, operands:[obj`true`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .and.jumpTo(4)
          .whenStepped()
      })

      it('should pop a boolean from the operand stack and, if it is true, decrement the current frame pc (moving back to the previous N-1 instruction) when a N < 0 jump is provided', () => {
        evaluation({
          frames: [
            { instructions: [POP, POP, POP, CONDITIONAL_JUMP(-2), POP], nextInstructionIndex: 3, operands:[obj`true`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .and.jumpTo(2)
          .whenStepped()
      })

      it('should pop a boolean from the operand stack and, if it is true, cause no jump if N == 0 is provided', () => {
        evaluation({
          frames: [
            { instructions: [CONDITIONAL_JUMP(0), POP], operands:[obj`true`] },
          ],
        }).should.onCurrentFrame.popOperands(1)
          .whenStepped()
      })

      it('should pop a boolean from the operand stack and, if it is false, cause no jump', () => {
        evaluation({
          frames: [
            { instructions: [CONDITIONAL_JUMP(1)], operands:[obj`false`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .whenStepped()
      })

      it('should raise an error if the operand stack is empty', () => {
        evaluation({
          frames: [
            { instructions: [CONDITIONAL_JUMP(1), POP, POP], operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if true is popped and the given count overflows the instruction list', () => {
        evaluation({
          frames: [
            { instructions: [CONDITIONAL_JUMP(1), POP], operands:[obj`true`] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if true is popped and the given count underflows the instruction list', () => {
        evaluation({
          frames: [
            { instructions: [POP, CONDITIONAL_JUMP(-3), POP], nextInstructionIndex: 1, operands:[obj`true`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('CALL', () => {

      it('should pop the arguments (in reverse order) and receiver from the operand stack and create a new frame for the method body', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })() as MethodNode
        const mockCode = [POP, POP, POP]
        stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod').returns(method)
        stub(Evaluation.prototype, 'codeFor').withArgs(method).returns(mockCode)

        evaluation({
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg2`, obj`arg1`, obj`receiver`] },
          ],
        }).should
          .onCurrentFrame.popOperands(3)
          .and.pushFrames({ instructions: mockCode, contexts:[ctx`_new_1_`({ locals: { p1: obj`arg1`, p2: obj`arg2` }, parent: obj`receiver` })] })
          .whenStepped()
      })

      it('should group all trailing arguments as a single list if the method has a varargs parameter', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2', { isVarArg: true })] })() as MethodNode
        const mockCode = [POP, POP, POP]
        stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod').returns(method)
        stub(Evaluation.prototype, 'codeFor').withArgs(method).returns(mockCode)

        evaluation({
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`, obj`arg3`],
          frames: [
            { instructions: [CALL('m', 3)], operands:[obj`arg3`, obj`arg2`, obj`arg1`, obj`receiver`], contexts:[ctx`c1`] },
          ],
        }).should
          .createInstance(obj`_new_1_`({
            moduleFQN: 'wollok.lang.List',
            locals:{ self: obj`_new_1_` },
            innerValue: ['arg2', 'arg3'],
            parent: ctx`c1`,
          }))
          .onCurrentFrame.popOperands(4)
          .and.pushFrames({
            instructions: mockCode,
            contexts:[ctx`_new_2_`({ locals: { p1: obj`arg1`, p2: obj`_new_1_` }, parent: obj`receiver` })],
          })
          .whenStepped()
      })

      it('lookup should start on lookup start if one is provided', () => {
        const mockCode = [POP, POP, POP]
        const method = Method('m')() as MethodNode
        stub(Evaluation.prototype, 'codeFor').withArgs(method).returns(mockCode)
        const methodSpy = stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod').returns(method)

        evaluation({
          instances: [obj`receiver`({ moduleFQN: 'test.C' })],
          frames: [
            { instructions: [CALL('m', 0, 'test.B')], operands:[obj`receiver`] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.pushFrames({ instructions: mockCode, contexts:[ctx`_new_1_`({ parent: obj`receiver` })] })
          .whenStepped()

        methodSpy.should.have.been.called.calledOnceWithExactly('m', 0, 'test.B')
      })

      it('if method is native it should pop the arguments and receiver and use them to call the native function', () => {
        const nativeBody = spy(() => {})
        const native: NativeFunction = spy(() => nativeBody)
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')], body: 'native' })() as MethodNode
        stub(method, 'parent').returns(environment.getNodeByFQN<'Module'>('test.C'))
        stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod').returns(method)

        evaluation({
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg2`, obj`arg1`, obj`receiver`] },
          ],
          natives: { test: { C: { m: native } } },
        }).should
          .onCurrentFrame.popOperands(3)
          .whenStepped()

        native.should.have.been.calledWithMatch({ id: 'receiver' }, { id: 'arg1' }, { id:'arg2' })
        nativeBody.should.have.been.calledWithMatch((arg: any) => arg instanceof Evaluation)
      })

      it('if method is native and has varargs the arguments are spread on the native instead of grouped in an array', () => {
        const nativeBody = spy(() => {})
        const native: NativeFunction = spy(() => nativeBody)
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2', { isVarArg: true })], body: 'native' })() as MethodNode
        stub(method, 'parent').returns(environment.getNodeByFQN<'Module'>('test.C'))
        stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod').returns(method)

        evaluation({
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`, obj`arg3`],
          frames: [
            { instructions: [CALL('m', 3)], operands:[obj`arg3`, obj`arg2`, obj`arg1`, obj`receiver`] },
          ],
          natives: { test: { C: { m: native } } },
        }).should
          .onCurrentFrame.popOperands(4)
          .whenStepped()

        native.should.have.been.calledWithMatch({ id: 'receiver' }, { id: 'arg1' }, { id:'arg2' }, { id:'arg3' })
        nativeBody.should.have.been.calledWithMatch((arg: any) => arg instanceof Evaluation)
      })

      it('should pop the arguments and receiver and use them to call messageNotUnderstood if method is not found', () => {
        const mockCode = [POP, POP, POP]
        const messageNotUnderstood = Method('m', { parameters: [Parameter('messageName'), Parameter('parameters')] })() as MethodNode
        const lookupStub = stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod')
        lookupStub.withArgs('m', 2).returns(undefined)
        lookupStub.withArgs('messageNotUnderstood', 2).returns(messageNotUnderstood)
        stub(Evaluation.prototype, 'codeFor').withArgs(messageNotUnderstood).returns(mockCode)

        evaluation({
          rootContext: ctx`root`,
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg2`, obj`arg1`, obj`receiver`], contexts: [ctx`c1`] },
          ],
        }).should
          .createInstance(obj`S!m`({ moduleFQN: 'wollok.lang.String', locals: { self: obj`S!m` }, innerValue: 'm', parent: ctx`root` }))
          .createInstance(obj`_new_1_`({ moduleFQN: 'wollok.lang.List', locals: { self: obj`_new_1_` }, innerValue: ['arg1', 'arg2'], parent: ctx`c1` }))
          .onCurrentFrame.popOperands(3)
          .and.pushFrames({ instructions: mockCode, contexts:[ctx`_new_2_`({ locals: { messageName: obj`S!m`, parameters: obj`_new_1_` }, parent: obj`receiver` })] })
          .whenStepped()
      })

      it('should raise an error if the current operand stack length is < arity + 1', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })() as MethodNode
        const mockCode = [POP, POP, POP]
        stub(environment.getNodeByFQN<'Module'>('test.C'), 'lookupMethod').returns(method)
        stub(Evaluation.prototype, 'codeFor').withArgs(method).returns(mockCode)

        evaluation({
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg1`, obj`receiver`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('CALL_CONSTRUCTOR', () => {

      it('should pop the target instance and arguments (in reverse order) from the operand stack and create a new frame for the constructor body', () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as ConstructorNode
        const mockCode = [POP, POP, POP]
        stub(environment.getNodeByFQN<'Class'>('test.C'), 'lookupConstructor').returns(constructor)
        stub(Evaluation.prototype, 'codeFor').withArgs(constructor).returns(mockCode)

        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(2, 'test.C')], operands:[obj`target`, obj`arg2`, obj`arg1`] },
          ],
        }).should
          .onCurrentFrame.popOperands(3)
          .and.pushFrames({ instructions: mockCode, contexts:[ctx`_new_1_`({ locals: { p1: obj`arg1`, p2: obj`arg2` }, parent: obj`target` })] })
          .whenStepped()
      })

      it('should prepends supercall to the constructor call', () => {
        const subConstructor = Constructor({ baseCall: { callsSuper: true, args: [] } })() as ConstructorNode
        stub(subConstructor, 'parent').returns(environment.getNodeByFQN<'Class'>('test.C'))
        stub(environment.getNodeByFQN<'Class'>('test.C'), 'lookupConstructor').returns(subConstructor)

        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.C' })],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(0, 'test.C')], operands:[obj`target`] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.pushFrames({
            instructions: [
              LOAD('self'),
              CALL_CONSTRUCTOR(0, 'test.B', true),
              LOAD('self'),
              CALL('initialize', 0),
              LOAD('self'),
              RETURN,
            ],
            contexts:[ctx`_new_1_`({ parent: obj`target` })],
          })
          .whenStepped()
      })

      it('should group all trailing arguments as a single list if the constructor has a varargs parameter', () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2', { isVarArg: true })] })() as ConstructorNode
        const mockCode = [POP, POP, POP]
        stub(environment.getNodeByFQN<'Class'>('test.C'), 'lookupConstructor').returns(constructor)
        stub(Evaluation.prototype, 'codeFor').withArgs(constructor).returns(mockCode)

        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`, obj`arg3`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(3, 'test.C')], operands:[obj`target`, obj`arg3`, obj`arg2`, obj`arg1`], contexts:[ctx`c1`] },
          ],
        }).should
          .createInstance(obj`_new_1_`({
            moduleFQN: 'wollok.lang.List',
            locals:{ self: obj`_new_1_` },
            innerValue: ['arg2', 'arg3'],
            parent: ctx`c1`,
          }))
          .onCurrentFrame.popOperands(4)
          .and.pushFrames({ instructions: mockCode, contexts:[ctx`_new_2_`({ locals: { p1: obj`arg1`, p2: obj`_new_1_` }, parent: obj`target` })] })
          .whenStepped()
      })

      it('should raise an error if the constructor is not found', () => {
        stub(environment.getNodeByFQN<'Class'>('test.C'), 'lookupConstructor').returns(undefined)

        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(2, 'test.C')], operands:[obj`target`, obj`arg2`, obj`arg1`] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the current operand stack length is < arity + 1', () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as ConstructorNode
        stub(environment.getNodeByFQN<'Class'>('test.C'), 'lookupConstructor').returns(constructor)

        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(2, 'test.C')], operands:[obj`target`, obj`arg1`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('INIT', () => {

      it('should pop the instance and arguments and initialize all fields', () => {
        // TODO: field/1 method to search by name?
        const f3 = environment.getNodeByFQN<'Class'>('test.E').fields().find(({ name }) => name === 'f3')!
        const f4 = environment.getNodeByFQN<'Class'>('test.E').fields().find(({ name }) => name === 'f4')!
        const f7 = environment.getNodeByFQN<'Class'>('test.D').fields().find(({ name }) => name === 'f7')!
        const f8 = environment.getNodeByFQN<'Class'>('test.D').fields().find(({ name }) => name === 'f8')!
        const f3InitMockCode = [POP, POP, POP]
        const f7InitMockCode = [POP, POP, POP, POP, POP]
        const initNullMockCode = [LOAD('null')]
        const codeForMock = stub(Evaluation.prototype, 'codeFor')
        codeForMock.withArgs(f3.value).returns(f3InitMockCode)
        codeForMock.withArgs(f4.value).returns(initNullMockCode)
        codeForMock.withArgs(f7.value).returns(f7InitMockCode)
        codeForMock.withArgs(f8.value).returns(initNullMockCode)
        codeForMock.callThrough()

        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.E' }), obj`arg1`, obj`arg2`, obj`arg5`, obj`arg6`],
          frames: [
            { instructions: [INIT(['f1', 'f2', 'f5', 'f6'])], operands:[obj`target`, obj`arg6`, obj`arg5`, obj`arg2`, obj`arg1`] },
          ],
        }).should
          .onInstance(obj`target`)
          .setLocal('f1', obj`arg1`) // TODO: setLocals?
          .setLocal('f2', obj`arg2`)
          .setLocal('f3', undefined)
          .setLocal('f4', undefined)
          .setLocal('f5', obj`arg5`)
          .setLocal('f6', obj`arg6`)
          .setLocal('f7', undefined)
          .setLocal('f8', undefined)
          .and.onCurrentFrame.popOperands(5)
          .and.pushFrames({
            instructions: [
              ...f3InitMockCode,
              STORE('f3', true),
              ...initNullMockCode,
              STORE('f4', true),
              ...f7InitMockCode,
              STORE('f7', true),
              ...initNullMockCode,
              STORE('f8', true),
              LOAD('self'),
              RETURN,
            ],
            contexts: [ctx`_new_1_`({ parent: obj`target` })],
          })
          .whenStepped()
      })

      it('should raise an error if there are not enough operands', () => {
        evaluation({
          instances: [obj`target`({ moduleFQN: 'test.E' }), obj`arg1`],
          frames: [
            { instructions: [INIT(['f1', 'f2'])], operands:[obj`target`, obj`arg1`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('INTERRUPT', () => {

      it('should drop contexts until one with an exception handler is dropped and make the frame pop an operand, store it as local <exception> and jump to the handler index', () => {
        evaluation({
          instances: [obj`exception`],
          frames: [
            {
              instructions: [POP, POP, INTERRUPT],
              nextInstructionIndex: 2,
              operands:[obj`exception`],
              contexts:[ctx`c4`, ctx`c3`, ctx`c2`({ exceptionHandlerIndex: 1 }), ctx`c1`],
            },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .popContexts(3)
          .and.setLocal('<exception>', obj`exception`) // TODO: Would it not be simpler to push it to the operand stack?
          .and.jumpTo(1)
          .whenStepped()
      })

      it('if no context in the current frame has an exception handler it should drop frames until one is found', () => {
        evaluation({
          instances: [obj`exception`],
          frames: [
            { instructions: [INTERRUPT], operands:[obj`exception`], contexts:[ctx`c4`] },
            { },
            { instructions: [POP, POP], contexts:[ctx`c3`, ctx`c2`({ exceptionHandlerIndex: 1 }), ctx`c1`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .and.popFrames(2)
          .and.onFrame(0)
          .popContexts(2)
          .and.setLocal('<exception>', obj`exception`)
          .and.jumpTo(1)
          .whenStepped()
      })

      // it('should raise an error if the current operand stack is empty (but it would get caught by the handler)', () => {
      //   evaluation({
      //     log: new ConsoleLogger(LogLevel.DEBUG),
      //     rootContext: ctx`root`,
      //     frames: [
      //       {
      //         instructions: [INTERRUPT],
      //         operands:[],
      //         contexts:[ctx`c2`({ exceptionHandlerIndex: 0 }), ctx`c1`],
      //       },
      //     ],
      //   }).should
      //     .createInstance(obj`_new_1_`({ moduleFQN: 'wollok.lang.EvaluationError', parent: ctx`c2`, locals:{ self: obj`_new_1_` } }))
      //     .createInstance(obj`S!Stack underflow`({ moduleFQN: 'wollok.lang.String', parent: ctx`root`, locals:{ self: obj`S!Stack underflow` } }))
      //     .onCurrentFrame
      //     .popContexts(1)
      //     .jumpTo(0)
      //     .and.setLocal('<exception>', obj`_new_1_`)
      //     .whenStepped()
      // })

      it('should raise an error if the handler index is out of range', () => {
        evaluation({
          instances: [obj`exception`],
          frames: [
            {
              instructions: [INTERRUPT],
              operands:[obj`exception`],
              contexts:[ctx`c2`({ exceptionHandlerIndex: 1 }), ctx`c1`],
            },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the handler context is the frame base context', () => {
        evaluation({
          instances: [obj`exception`],
          frames: [
            {
              instructions: [INTERRUPT],
              operands:[obj`exception`],
              contexts:[ctx`c1`({ exceptionHandlerIndex: 0 })],
            },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if there is no handler context', () => {
        evaluation({
          instances: [obj`exception`],
          frames: [
            {
              instructions: [INTERRUPT],
              operands:[obj`exception`],
              contexts:[ctx`c1`],
            },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('RETURN', () => {

      it('should drop the current frame and push the top of its operand stack to the next active frame', () => {
        evaluation({
          instances: [obj`result`, obj`other`],
          frames: [
            { instructions: [RETURN], operands:[obj`result`] },
            { operands:[obj`other`] },
          ],
        }).should
          .popFrames(1)
          .and.onFrame(0).pushOperands(obj`result`)
          .whenStepped()
      })

      it('should raise an error if the current operand stack is empty', () => {
        evaluation({
          frames: [
            { instructions: [RETURN], operands:[] },
            { operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the frame stack length is < 2', () => {
        evaluation({
          instances: [obj`result`],
          frames: [
            { instructions: [RETURN], operands:[obj`result`] },
          ],
        }).should.throwException.whenStepped()
      })

    })

  })

})