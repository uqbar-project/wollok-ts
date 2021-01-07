import { should, use } from 'chai'
import { restore, stub, spy, match } from 'sinon'
import sinonChai from 'sinon-chai'
import { Class, Constructor, Field, Literal, Method, Package, Parameter, Reference } from '../src/builders'
import { CALL, CONDITIONAL_JUMP, DUP, INHERITS, CALL_CONSTRUCTOR, INIT, INSTANTIATE, INTERRUPT, JUMP, LOAD, POP, POP_CONTEXT, PUSH, PUSH_CONTEXT, RETURN, STORE, SWAP } from '../src/interpreter/compiler'
import * as compiler from '../src/interpreter/compiler'
import link from '../src/linker'
import { Constructor as ConstructorNode, Filled, Package as PackageNode } from '../src/model'
import { interpreterAssertions, evaluation, obj, ctx, lazy } from './assertions'
import { NativeFunction, Evaluation } from '../src/interpreter/runtimeModel'


should()
use(interpreterAssertions)
use(sinonChai)


const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')( Method('messageNotUnderstood', { parameters: [Parameter('messageName'), Parameter('parameters')] })() ),
    Class('Closure', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('String', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('Boolean', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('Number', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('List', { superclassRef: Reference('wollok.lang.Object') })(),
    Class('EvaluationError', { superclassRef: Reference('wollok.lang.Object') })(),
  ),
  Package('lib')(),
) as unknown as PackageNode<Filled>

const environment = link([WRE])


afterEach(restore)


describe('Wollok Interpreter', () => {

  describe('evaluation of Instructions', () => {

    describe('LOAD', () => {

      it('should push the local with the given name from the current locals into the current operand stack', () => {
        evaluation({
          environment,
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
          environment,
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
          environment,
          frames: [
            { instructions: [LOAD('x')], contexts: [ctx`c1`({ locals:{} })] },
          ],
        }).should
          .onCurrentFrame.pushOperands(undefined)
          .whenStepped()
      })

      it('should not search through the frame stack', () => {
        evaluation({
          environment,
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
        evaluation({
          environment,
          instances: [obj`target`({ locals: { x: lazy`x`(obj`target`, [INSTANTIATE('wollok.lang.Number', 7)]) } })],
          frames: [
            { instructions: [LOAD('x')], contexts: [ctx`c1`({ parent: obj`target` })] },
          ],
        }).should
          .createInstance(obj`N!7.00000`({ moduleFQN: 'wollok.lang.Number', locals: { self: obj`N!7.00000` }, innerValue: 7 }))
          .onInstance(obj`target`).setLocal('x', obj`N!7.00000`)
          .onCurrentFrame.pushOperands(obj`N!7.00000`)
          .whenStepped()
      })

    })


    describe('STORE', () => {

      it('should pop the current operand stack and save it to the given name in the current locals', () => {
        evaluation({
          environment,
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
          environment,
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
          environment,
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
          environment,
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
          environment,
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
          environment,
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
          environment,
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
          environment,
          frames: [
            { instructions: [PUSH_CONTEXT()], contexts: [ctx`base`] },
          ],
        }).should
          .onCurrentFrame.pushContexts(ctx`_new_1_`({ parent: ctx`base` }))
          .whenStepped()
      })

      it('if argument is provided, should set the contexts exception handler index relative to the instruction position', () => {
        evaluation({
          environment,
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
          environment,
          frames: [
            { instructions: [POP_CONTEXT], contexts: [ctx`top`, ctx`middle`, ctx`base`] },
          ],
        }).should
          .onCurrentFrame.popContexts(1)
          .whenStepped()
      })

      it('should raise an error if the frame base context would be popped', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [POP_CONTEXT], contexts: [ctx`base`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('SWAP', () => {

      it('should swap the top two operands of the stack if no distance is specified', () => {
        evaluation({
          environment,
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
          environment,
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
          environment,
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
          environment,
          instances: [obj`v1`],
          frames: [
            { instructions: [SWAP()], operands:[obj`v1`] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the current operand stack has length < 2, if distance is not specified', () => {
        evaluation({
          environment,
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
          environment,
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
          environment,
          frames: [
            { instructions: [DUP], operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('INSTANTIATE', () => {

      it('should create a new instance from the given module and push it to the operand stack', () => {
        evaluation({
          environment: link([Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(),
          )] as PackageNode<Filled>[], environment),
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
          environment,
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
          environment,
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
          environment,
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
          environment,
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
          environment,
          frames: [
            { instructions: [POP, JUMP(2), POP, POP, POP], nextInstructionIndex: 1 },
          ],
        }).should.onCurrentFrame
          .jumpTo(4)
          .whenStepped()
      })

      it('should decrement the current frame pc (moving back to the previous N-1 instruction) when a N < 0 jump is provided', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [POP, POP, POP, JUMP(-2), POP], nextInstructionIndex: 3 },
          ],
        }).should.onCurrentFrame
          .jumpTo(2)
          .whenStepped()
      })

      it('should cause no effect when a N == 0 jump is provided', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [POP, JUMP(0), POP], nextInstructionIndex: 1 },
          ],
        }).should.whenStepped()
      })

      it('should raise an error if the given count overflows the instruction list', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [JUMP(1), POP] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the given count underflows the instruction list', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [POP, JUMP(-3), POP], nextInstructionIndex: 1 },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('CONDITIONAL_JUMP', () => {

      it('should pop a boolean from the operand stack and, if it is true, increment the current frame pc (skipping the next N instructions) when a N > 0 jump is provided', () => {
        evaluation({
          environment,
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
          environment,
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
          environment,
          frames: [
            { instructions: [CONDITIONAL_JUMP(0), POP], operands:[obj`true`] },
          ],
        }).should.onCurrentFrame.popOperands(1)
          .whenStepped()
      })

      it('should pop a boolean from the operand stack and, if it is false, cause no jump', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [CONDITIONAL_JUMP(1)], operands:[obj`false`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .whenStepped()
      })

      it('should raise an error if the operand stack is empty', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [CONDITIONAL_JUMP(1), POP, POP], operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if true is popped and the given count overflows the instruction list', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [CONDITIONAL_JUMP(1), POP], operands:[obj`true`] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if true is popped and the given count underflows the instruction list', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [POP, CONDITIONAL_JUMP(-3), POP], nextInstructionIndex: 1, operands:[obj`true`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('CALL', () => {

      it('should pop the arguments (in reverse order) and receiver from the operand stack and create a new frame for the method body', () => {
        const mockCode = [POP, POP, POP]
        stub(compiler, 'default').withArgs(match({ name: 'm' })).returns(mockCode)

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(),
            )
          )] as PackageNode<Filled>[]),
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg2`, obj`arg1`, obj`receiver`] },
          ],
        }).should
          .onCurrentFrame.popOperands(3)
          .and.pushFrame({ instructions: mockCode, contexts:[ctx`_new_1_`({ locals: { p1: obj`arg1`, p2: obj`arg2` }, parent: obj`receiver` })] })
          .whenStepped()
      })

      it('should group all trailing arguments as a single list if the method has a varargs parameter', () => {
        const mockCode = [POP, POP, POP]
        stub(compiler, 'default').withArgs(match({ name: 'm' })).returns(mockCode)

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Method('m', { parameters: [Parameter('p1'), Parameter('p2', { isVarArg: true })] })(),
            )
          )] as PackageNode<Filled>[]),
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
          .and.pushFrame({
            instructions: mockCode,
            contexts:[ctx`_new_2_`({ locals: { p1: obj`arg1`, p2: obj`_new_1_` }, parent: obj`receiver` })],
          })
          .whenStepped()
      })

      it('lookup should start on lookup start if one is provided', () => {
        const mockCode = [POP, POP, POP]
        const codeForMock = stub(compiler, 'default')
        codeForMock.withArgs(match({ name: 'm', isOverride: false })).returns(mockCode)
        codeForMock.callThrough()

        evaluation({
          environment: link([WRE, Package('test')(
            Class('B', { superclassRef: Reference('wollok.lang.Object') })(
              Method('m')(),
            ),
            Class('C', { superclassRef: Reference('test.B') })(
              Method('m', { isOverride: true })()
            ),
          )] as PackageNode<Filled>[]),
          instances: [obj`receiver`({ moduleFQN: 'test.C' })],
          frames: [
            { instructions: [CALL('m', 0, 'test.C')], operands:[obj`receiver`] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.pushFrame({ instructions: mockCode, contexts:[ctx`_new_1_`({ parent: obj`receiver` })] })
          .whenStepped()
      })

      it('if method is native it should pop the arguments and receiver and use them to call the native function', () => {
        const nativeBody = spy(() => {})
        const native: NativeFunction = spy(() => nativeBody)

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Method('m', { parameters: [Parameter('p1'), Parameter('p2')], body: 'native' })(),
            ),
          )] as PackageNode<Filled>[]),
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

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Method('m', { parameters: [Parameter('p1'), Parameter('p2', { isVarArg: true })], body: 'native' })(),
            ),
          )] as PackageNode<Filled>[]),
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
        stub(compiler, 'default').withArgs(match({ name: 'messageNotUnderstood' })).returns(mockCode)

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(),
          )] as PackageNode<Filled>[]),
          rootContext: ctx`root`,
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg2`, obj`arg1`, obj`receiver`], contexts: [ctx`c1`] },
          ],
        }).should
          .createInstance(obj`S!m`({ moduleFQN: 'wollok.lang.String', locals: { self: obj`S!m` }, innerValue: 'm', parent: ctx`root` }))
          .createInstance(obj`_new_1_`({ moduleFQN: 'wollok.lang.List', locals: { self: obj`_new_1_` }, innerValue: ['arg1', 'arg2'], parent: ctx`c1` }))
          .onCurrentFrame.popOperands(3)
          .and.pushFrame({ instructions: mockCode, contexts:[ctx`_new_2_`({ locals: { messageName: obj`S!m`, parameters: obj`_new_1_` }, parent: obj`receiver` })] })
          .whenStepped()
      })

      it('should raise an error if the current operand stack length is < arity + 1', () => {
        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Method('m')(),
            ),
          )] as PackageNode<Filled>[]),
          instances: [obj`receiver`({ moduleFQN: 'test.C' }), obj`arg1`],
          frames: [
            { instructions: [CALL('m', 2)], operands:[obj`arg1`, obj`receiver`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('CALL_CONSTRUCTOR', () => {

      it('should pop the target instance and arguments (in reverse order) from the operand stack and create a new frame for the constructor body', () => {
        const mockCode = [POP, POP, POP]
        stub(compiler, 'default').withArgs(match.instanceOf(ConstructorNode)).returns(mockCode)

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })(),
            )
          )] as PackageNode<Filled>[]),
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(2, 'test.C')], operands:[obj`target`, obj`arg2`, obj`arg1`] },
          ],
        }).should
          .onCurrentFrame.popOperands(3)
          .and.pushFrame({ instructions: mockCode, contexts:[ctx`_new_1_`({ locals: { p1: obj`arg1`, p2: obj`arg2` }, parent: obj`target` })] })
          .whenStepped()
      })

      it('should prepends supercall to the constructor call', () => {
        evaluation({
          environment: link([WRE, Package('test')(
            Class('B', { superclassRef: Reference('wollok.lang.Object') })(),
            Class('C', { superclassRef: Reference('test.B') })(
              Constructor({ baseCall: { callsSuper: true, args: [] } })(),
            )
          )] as PackageNode<Filled>[]),
          instances: [obj`target`({ moduleFQN: 'test.C' })],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(0, 'test.C')], operands:[obj`target`] },
          ],
        }).should
          .onCurrentFrame.popOperands(1)
          .and.pushFrame({
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
        const mockCode = [POP, POP, POP]
        stub(compiler, 'default').withArgs(match.instanceOf(ConstructorNode)).returns(mockCode)

        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Constructor({ parameters: [Parameter('p1'), Parameter('p2', { isVarArg: true })] })(),
            )
          )] as PackageNode<Filled>[]),
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
          .and.pushFrame({ instructions: mockCode, contexts:[ctx`_new_2_`({ locals: { p1: obj`arg1`, p2: obj`_new_1_` }, parent: obj`target` })] })
          .whenStepped()
      })

      it('should raise an error if the constructor is not found', () => {
        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(),
          )] as PackageNode<Filled>[]),
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`, obj`arg2`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(2, 'test.C')], operands:[obj`target`, obj`arg2`, obj`arg1`] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the current operand stack length is < arity + 1', () => {
        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })(),
            ),
          )] as PackageNode<Filled>[]),
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`],
          frames: [
            { instructions: [CALL_CONSTRUCTOR(2, 'test.C')], operands:[obj`target`, obj`arg1`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('INIT', () => {

      it('should pop the instance and arguments and initialize all fields', () => {
        const f2InitMockCode = [POP, POP, POP]
        const f4InitMockCode = [POP, POP, POP, POP, POP]
        const codeForMock = stub(compiler, 'default')
        codeForMock.withArgs(match({ value: 4 })).returns(f4InitMockCode)
        codeForMock.withArgs(match({ value: 2 })).returns(f2InitMockCode)
        codeForMock.callThrough()

        evaluation({
          environment: link([WRE, Package('test')(
            Class('B', { superclassRef: Reference('wollok.lang.Object') })(
              Field('f1', { value: Literal(1) }),
              Field('f2', { value: Literal(2) }),
            ),
            Class('C', { superclassRef: Reference('test.B') })(
              Field('f3', { value: Literal(3) }),
              Field('f4', { value: Literal(4) }),
            ),
          )] as PackageNode<Filled>[]),
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg3`, obj`arg1`],
          frames: [
            { instructions: [INIT(['f3', 'f1'])], operands:[obj`target`, obj`arg1`, obj`arg3`] },
          ],
        }).should
          .onInstance(obj`target`)
          .setLocal('f3', obj`arg3`)
          .setLocal('f4', lazy`f4`(obj`target`, f4InitMockCode))
          .setLocal('f1', obj`arg1`)
          .setLocal('f2', lazy`f2`(obj`target`, f2InitMockCode))
          .and.onCurrentFrame.popOperands(3)
          .and.pushOperands(obj`target`)
          .whenStepped()
      })

      it('should raise an error if there are not enough operands', () => {
        evaluation({
          environment: link([WRE, Package('test')(
            Class('C', { superclassRef: Reference('wollok.lang.Object') })(
              Field('f1', { value: Literal(1) }),
              Field('f2', { value: Literal(2) }),
            ),
          )] as PackageNode<Filled>[]),
          instances: [obj`target`({ moduleFQN: 'test.C' }), obj`arg1`],
          frames: [
            { instructions: [INIT(['f1', 'f2'])], operands:[obj`target`, obj`arg1`] },
          ],
        }).should.throwException.whenStepped()
      })

    })


    describe('INTERRUPT', () => {

      it('should drop contexts until one with an exception handler is dropped and jump to the handler index', () => {
        evaluation({
          environment,
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
          .popContexts(3)
          .and.jumpTo(1)
          .whenStepped()
      })

      it('if no context in the current frame has an exception handler it should drop frames until one is found', () => {
        evaluation({
          environment,
          instances: [obj`exception`],
          frames: [
            { instructions: [INTERRUPT], operands:[obj`exception`], contexts:[ctx`c4`] },
            { },
            { instructions: [POP, POP], contexts:[ctx`c3`, ctx`c2`({ exceptionHandlerIndex: 1 }), ctx`c1`] },
          ],
        }).should.onCurrentFrame
          .popOperands(1)
          .and.popFrames(2)
          .and.onBaseFrame
          .popContexts(2)
          .and.pushOperands(obj`exception`)
          .and.jumpTo(1)
          .whenStepped()
      })

      it('should raise an error if the current operand stack is empty', () => {
        evaluation({
          environment,
          rootContext: ctx`root`,
          frames: [
            {
              instructions: [INTERRUPT],
              operands:[],
              contexts:[ctx`c2`({ exceptionHandlerIndex: 0 }), ctx`c1`],
            },
          ],
        }).should
          .createInstance(obj`_new_1_`({ moduleFQN: 'wollok.lang.EvaluationError', parent: ctx`c2`, locals:{ self: obj`_new_1_`, message: obj`S!Stack underflow` } }))
          .createInstance(obj`S!Stack underflow`({ moduleFQN: 'wollok.lang.String', parent: ctx`root`, locals:{ self: obj`S!Stack underflow` }, innerValue: 'Stack underflow' }))
          .and.onCurrentFrame
          .popContexts(1)
          .jumpTo(0)
          .pushOperands(obj`_new_1_`)
          .whenStepped()
      })

      it('should raise an error if the handler index is out of range', () => {
        evaluation({
          environment,
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
          environment,
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
          environment,
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
          environment,
          instances: [obj`result`, obj`other`],
          frames: [
            { instructions: [RETURN], operands:[obj`result`] },
            { operands:[obj`other`] },
          ],
        }).should
          .popFrames(1)
          .and.onBaseFrame.pushOperands(obj`result`)
          .whenStepped()
      })

      it('should raise an error if the current operand stack is empty', () => {
        evaluation({
          environment,
          frames: [
            { instructions: [RETURN], operands:[] },
            { operands:[] },
          ],
        }).should.throwException.whenStepped()
      })

      it('should raise an error if the frame stack length is < 2', () => {
        evaluation({
          environment,
          instances: [obj`result`],
          frames: [
            { instructions: [RETURN], operands:[obj`result`] },
          ],
        }).should.throwException.whenStepped()
      })

    })

  })

})