import { expect, should, use } from 'chai'
import { restore, stub } from 'sinon'
import { Class, Constructor, Evaluation, Field, Frame, Literal, Method, Package, Parameter, Reference, Return, RuntimeObject } from '../src/builders'
import { CALL, compile, CONDITIONAL_JUMP, DUP, FALSE_ID, INHERITS, INIT, INIT_NAMED, INSTANTIATE, INTERRUPT, JUMP, LOAD, NativeFunction, POP, POP_CONTEXT, PUSH, PUSH_CONTEXT, RETURN, step, STORE, SWAP, TRUE_ID, VOID_ID } from '../src/interpreter'
import link from '../src/linker'
import { Class as ClassNode, Constructor as ConstructorNode, Field as FieldNode, Filled, Method as MethodNode, Module, Package as PackageNode } from '../src/model'
import { interpreterAssertions } from './assertions'

should()
use(interpreterAssertions)

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure', { superclass: Reference('wollok.lang.Object') })(),
    Class('String', { superclass: Reference('wollok.lang.Object') })(),
    Class('List', { superclass: Reference('wollok.lang.Object') })()
  ),
  Package('lib')(),
) as unknown as PackageNode<Filled>

const environment = link([WRE])

// TODO: Some mocking is quite ugly. Either properly link the mock classes or use sinon for cleaner definitions.
afterEach(() => {
  restore()
})

describe('Wollok Interpreter', () => {

  describe('evaluation of Instructions', () => {

    describe('LOAD', () => {

      it('should push the local with the given name from the current locals into the current operand stack', () => {
        const instruction = LOAD('x')
        const evaluation = Evaluation(environment, {}, { 1: { id: '1', parent: '', locals: { x: '1' } } })(
          Frame({ context: '1', operandStack: ['2'], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, { 1: { id: '1', parent: '', locals: { x: '1' } } })(
            Frame({ context: '1', operandStack: ['2', '1'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame, it should search it through the frame stack', () => {
        const instruction = LOAD('x')
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: {} },
          2: { id: '2', parent: '1', locals: { x: '2' } },
          3: { id: '3', parent: '2', locals: { x: '1' } },
          4: { id: '4', parent: '3', locals: {} },
        })(
          Frame({ context: '4', instructions: [instruction] }),
          Frame({ context: '3' }),
          Frame({ context: '2' }),
          Frame({ context: '1' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: {} },
            2: { id: '2', parent: '1', locals: { x: '2' } },
            3: { id: '3', parent: '2', locals: { x: '1' } },
            4: { id: '4', parent: '3', locals: {} },
          })(
            Frame({ context: '4', operandStack: ['1'], instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '3' }),
            Frame({ context: '2' }),
            Frame({ context: '1' }),
          )
        )
      })

      it('should raise an error if the local is not in scope', () => {
        const instruction = LOAD('x')
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: null, locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('STORE', () => {

      it('should save the current operand stack to the given local name in the current locals', () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: {} },
          2: { id: '2', parent: '1', locals: {} },

        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
          Frame({ context: '2' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { x: '1' } },
            2: { id: '2', parent: '1', locals: {} },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '2' }),
          )
        )
      })

      it('should override the current local value', () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: { x: '2' } },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { x: '1' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should override the current local value', () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: { x: '2' } },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { x: '1' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is active, it should search it through the frame stack', () => {
        const instruction = STORE('x', true)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: { x: '2' } },
          2: { id: '2', parent: '1', locals: { x: '2' } },
          3: { id: '3', parent: '2', locals: {} },
        })(
          Frame({ context: '3', operandStack: ['1'], instructions: [instruction] }),
          Frame({ context: '2' }),
          Frame({ context: '1' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { x: '2' } },
            2: { id: '2', parent: '1', locals: { x: '1' } },
            3: { id: '3', parent: '2', locals: {} },
          })(
            Frame({ context: '3', instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '2' }),
            Frame({ context: '1' }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is not active, it should add it to the current frame', () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: {} },
          2: { id: '2', parent: '1', locals: { x: '2' } },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
          Frame({ context: '2' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { x: '1' } },
            2: { id: '2', parent: '1', locals: { x: '2' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '2' }),
          )
        )
      })

      it('if the local is not in scope, it should add it to the current frame', () => {
        const instruction = STORE('x', true)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: null, locals: {} },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: null, locals: { x: '1' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', () => {

        const instruction = STORE('x', true)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })
    })


    describe('PUSH', () => {

      it('should push the given id to the current operand stack', () => {
        const instruction = PUSH('1')
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ operandStack: ['2', '1'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

    })


    describe('POP', () => {

      const instruction = POP

      it('should pop the top of the operand stack and discard it', () => {
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['2', '1'], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ operandStack: ['2'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand is empty', () => {
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: [], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('PUSH_CONTEXT', () => {


      it('should create a new, empty context for the current frame', () => {
        const instruction = PUSH_CONTEXT()
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: { a: '2' } },
        })(
          Frame({ id: '1', context: '1', operandStack: [], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { a: '2' } },
            new_id_0: { id: 'new_id_0', parent: '1', locals: {} },
          })(
            Frame({ id: '1', context: 'new_id_0', operandStack: [], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if argument is provided, should set an exception handler index for the context based on the instruction position', () => {
        const instruction = PUSH_CONTEXT(2)
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: { a: '2' } },
        })(
          Frame({ id: '1', context: '1', operandStack: [], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { a: '2' } },
            new_id_0: { id: 'new_id_0', parent: '1', locals: {}, exceptionHandlerIndex: 3 },
          })(
            Frame({ id: '1', context: 'new_id_0', operandStack: [], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

    })


    describe('POP_CONTEXT', () => {

      const instruction = POP_CONTEXT

      it('should discard the current frame context and replace it with the parent', () => {
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: { a: '2' } },
          2: { id: '2', parent: '1', locals: {} },
        })(
          Frame({ id: '2', context: '2', operandStack: [], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { id: '1', parent: '', locals: { a: '2' } },
            2: { id: '2', parent: '1', locals: {} },
          })(
            Frame({ id: '2', context: '1', operandStack: [], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

    })


    describe('SWAP', () => {

      it('should swap the top two operands of the stack', () => {
        const instruction = SWAP()
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ operandStack: ['3', '1', '2'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should swap the top operand with the one N levels below, if parameter is provided', () => {
        const instruction = SWAP(3)
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ operandStack: ['1', '4', '3', '2', '5'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack has length < 2', () => {

        const instruction = SWAP()
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack has length < 2 + N, if argument is provided', () => {

        const instruction = SWAP(3)
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['4', '3', '2', '1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

    describe('DUP', () => {

      it('should duplicate the top operand of the stack', () => {
        const instruction = DUP
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['2', '1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ operandStack: ['2', '1', '1'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', () => {

        const instruction = DUP
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: [], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

    describe('INSTANTIATE', () => {

      it('should create a new instance from the given module and push it to the operand stack', () => {
        const instruction = INSTANTIATE('wollok.lang.Object')
        const evaluation = Evaluation(environment, {}, {
          1: { id: '1', parent: '', locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            new_id_0: RuntimeObject('new_id_0', 'wollok.lang.Object'),
          }, {
            1: { id: '1', parent: '', locals: {} },
            new_id_0: { id: 'new_id_0', parent: '1', locals: { self: 'new_id_0' } },
          })(
            Frame({ context: '1', operandStack: ['new_id_0'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

    })


    describe('INHERITS', () => {

      it('should pop an object id from the operand stack and push true if it inherits the given module', () => {
        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Closure'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Closure'),
          })(
            Frame({ operandStack: [TRUE_ID], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should pop an object id from the operand stack and push false if it does not inherit the given module', () => {
        const instruction = INHERITS('wollok.lang.Closure')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: [FALSE_ID], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', () => {

        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', () => {

        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('JUMP', () => {

      it('should increment the next instruction in the given ammount', () => {
        const instruction = JUMP(2)
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ nextInstruction: 3, instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')], }),
          )
        )
      })

      it('should raise an error if the given count overflows the instruction list', () => {
        const instruction = JUMP(3)
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: [TRUE_ID], instructions: [instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('CONDITIONAL_JUMP', () => {

      it('should pop a boolean from the operand stack and increment the Next Instruction the given ammount if it is true', () => {
        const instruction = CONDITIONAL_JUMP(2)
        const evaluation = Evaluation(environment, {})(
          Frame({
            operandStack: [TRUE_ID],
            instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
          }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({
              nextInstruction: 3,
              instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
            }),
          )
        )
      })

      it('should pop a boolean from the operand stack and do nothing if it is false', () => {
        const instruction = CONDITIONAL_JUMP(2)

        const evaluation = Evaluation(environment, {})(
          Frame({
            operandStack: [FALSE_ID],
            instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
          }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({
              instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
              nextInstruction: 1,
            }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', () => {
        const instruction = CONDITIONAL_JUMP(1)
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the given id does not belong to a boolean', () => {
        const instruction = CONDITIONAL_JUMP(1)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the given count overflows the instruction list', () => {
        const instruction = CONDITIONAL_JUMP(3)
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: [TRUE_ID], instructions: [instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('CALL', () => {

      it('should pop the arguments and receiver from the operand stack and create a new frame for the method body', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode
        const instruction = CALL('m', 2)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          1: { id: '1', parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          }, {
            1: { id: '1', parent: '', locals: {} },
            new_id_0: { id: 'new_id_0', parent: '3', locals: { p1: '2', p2: '1' } },
          })(
            Frame({
              id: 'new_id_0', context: 'new_id_0', instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                RETURN,
              ],
            }),
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should run method ignoring the receivers context if useReceiverContext is false', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode
        const instruction = CALL('m', 2, false)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          0: { id: '0', parent: '', locals: {} },
          1: { id: '1', parent: '0', locals: {} },
          2: { id: '2', parent: '0', locals: {} },
          3: { id: '3', parent: '0', locals: {} },
        })(
          Frame({ context: '0', operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          }, {
            0: { id: '0', parent: '', locals: {} },
            1: { id: '1', parent: '0', locals: {} },
            2: { id: '2', parent: '0', locals: {} },
            3: { id: '3', parent: '0', locals: {} },
            new_id_0: { id: 'new_id_0', parent: '0', locals: { p1: '2', p2: '1' } },
          })(
            Frame({
              id: 'new_id_0', context: 'new_id_0', instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                RETURN,
              ],
            }),
            Frame({ context: '0', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method has a varargs parameter, should group all trailing arguments as a single array argument', () => {
        const method = Method('m', {
          parameters: [
            Parameter('p1'),
            Parameter('p2', { isVarArg: true }),
          ],
        })(Return(Literal(5))) as MethodNode
        const instruction = CALL('m', 3)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        }, {
          1: { id: '1', parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
            new_id_0: RuntimeObject('new_id_0', 'wollok.lang.List', ['2', '1']),
          }, {
            1: { id: '1', parent: '', locals: {} },
            new_id_0: { id: 'new_id_0', parent: '1', locals: { self: 'new_id_0' } },
            new_id_1: { id: 'new_id_1', parent: '4', locals: { p1: '3', p2: 'new_id_0' } },
          })(
            Frame({
              id: 'new_id_1',
              context: 'new_id_1',
              instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                RETURN,
              ],
            }),
            Frame({ context: '1', operandStack: ['5'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method is not found, should still pop the arguments and receiver and use them to call messageNotUnderstood', () => {
        const messageNotUnderstood = Method('messageNotUnderstood', {
          parameters: [
            Parameter('name'),
            Parameter('parameters', { isVarArg: true }),
          ],
        })(Return(Literal(5))) as MethodNode
        const instruction = CALL('m', 2)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          1: { id: '1', parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = (
          name => name === 'messageNotUnderstood' ? messageNotUnderstood : undefined
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            '1': RuntimeObject('1', 'wollok.lang.Object'),
            '2': RuntimeObject('2', 'wollok.lang.Object'),
            '3': RuntimeObject('3', 'wollok.lang.Object'),
            'S!m': RuntimeObject('S!m', 'wollok.lang.String', 'm'),
            'new_id_1': RuntimeObject('new_id_1', 'wollok.lang.List', ['2', '1']),
          }, {
            '1': { id: '1', parent: '', locals: {} },
            'S!m': { id: 'S!m', parent: '1', locals: { self: 'S!m' } },
            'new_id_1': { id: 'new_id_1', parent: '1', locals: { self: 'new_id_1' } },
            'new_id_2': { id: 'new_id_2', parent: '3', locals: { name: 'S!m', parameters: 'new_id_1' } },
          })(
            Frame({
              id: 'new_id_2',
              context: 'new_id_2',
              instructions: compile(environment)(...messageNotUnderstood.body!.sentences),
            }),
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method is native, it should still pop the arguments and receiver and use them to call the native function', () => {
        const method = Method('m', {
          isNative: true, body: undefined, parameters: [
            Parameter('p1'), Parameter('p2'),
          ],
        })() as MethodNode

        const native: NativeFunction = (self, p1, p2) => e => { e.frameStack[0].operandStack.push(self.id + p1!.id + p2!.id) }

        const instruction = CALL('m', 2)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['4', '3', '2', '1'], instructions: [instruction] }),
        )

        method.parent = () => evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object') as any
        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method

        evaluation.should.be.stepped({ wollok: { lang: { Object: { m: native } } } }).into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['4', '321'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method is native and has varargs the arguments are spread on the native instead of grouped in an array', () => {
        const method = Method('m', {
          isNative: true, body: undefined, parameters: [
            Parameter('p1'), Parameter('p2', { isVarArg: true }),
          ],
        })() as MethodNode

        const native: NativeFunction = (self, p1, p2) => e => { e.frameStack[0].operandStack.push(self.id + p1!.id + p2!.id) }

        const instruction = CALL('m', 3)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        method.parent = () => evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object') as any
        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method


        evaluation.should.be.stepped({ wollok: { lang: { Object: { m: native } } } }).into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['5', '432'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack length is < arity + 1', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode

        const instruction = CALL('m', 2)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode

        const instruction = CALL('m', 2)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2', '2', '2'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the method is native but the native is missing', () => {
        const method = Method('m', { isNative: true, body: undefined })() as MethodNode

        const instruction = CALL('m', 0)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        evaluation.environment.getNodeByFQN<Module>('wollok.lang.Object').lookupMethod = () => method

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('INIT', () => {

      it('should pop the instance and arguments from the operand stack and create a new frame for the initialization', () => {
        const constructor = Constructor({
          parameters: [
            Parameter('p1'),
            Parameter('p2'),
          ],
          baseCall: { callsSuper: true, args: [] },
        })(Return()) as ConstructorNode
        const instruction = INIT(2, 'wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          1: { id: '1', parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        const object = environment.getNodeByFQN<ClassNode>('wollok.lang.Object')
        object.lookupConstructor = () => constructor
        constructor.parent = () => object

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          }, {
            1: { id: '1', parent: '', locals: {} },
            new_id_0: { id: 'new_id_0', parent: '1', locals: { p1: '3', p2: '2' } },
          })(
            Frame({
              id: 'new_id_0',
              context: 'new_id_0',
              instructions: [
                ...compile(environment)(...constructor.body.sentences),
                LOAD('self'),
                CALL('initialize', 0),
                LOAD('self'),
                RETURN,
              ],
            }),
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should prepends supercall to the constructor call', () => {
        const constructor = Constructor({ baseCall: { callsSuper: true, args: [] } })(Return()) as ConstructorNode
        const f1 = Field('f1', { value: Literal(5) }) as FieldNode
        const f2 = Field('f1', { value: Literal(7) }) as FieldNode
        const X = Class('X', { superclass: environment.getNodeByFQN('wollok.lang.Object') as any })(
          f1,
          f2
        ) as ClassNode
        X.superclassNode = () => environment.getNodeByFQN<ClassNode>('wollok.lang.Object')

        const instruction = INIT(0, 'X')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'X'),
        }, {
          0: { id: '0', parent: null, locals: {} },
        })(
          Frame({ id: '0', context: '0', operandStack: ['1'], instructions: [instruction] }),
        )

        const getNodeByFQNStub = stub(evaluation.environment, 'getNodeByFQN')
        getNodeByFQNStub.withArgs('X').returns(X)
        getNodeByFQNStub.callThrough()
        X.lookupConstructor = () => constructor
        constructor.parent = () => X

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'X'),
          }, {
            0: { id: '0', parent: null, locals: {} },
            new_id_0: { id: 'new_id_0', parent: '1', locals: {} },
          })(
            Frame({
              id: 'new_id_0',
              context: 'new_id_0',
              instructions: [
                LOAD('self'),
                INIT(0, 'wollok.lang.Object', true),
                ...compile(environment)(...constructor.body.sentences),
                LOAD('self'),
                CALL('initialize', 0),
                LOAD('self'),
                RETURN,
              ],
            }),
            Frame({ id: '0', context: '0', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if constructor has a varargs parameter, should group all trailing arguments as a single array argument', () => {
        const constructor = Constructor({
          parameters: [
            Parameter('p1'),
            Parameter('p2', { isVarArg: true }),
          ],
        })(Return()) as ConstructorNode

        const instruction = INIT(3, 'wollok.lang.Object')

        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        }, {
          0: { id: '0', parent: null, locals: {} },
          1: { id: '1', parent: '0', locals: {} },
          2: { id: '2', parent: '0', locals: {} },
          3: { id: '3', parent: '0', locals: {} },
          4: { id: '4', parent: '0', locals: {} },
          5: { id: '5', parent: '0', locals: {} },
        })(
          Frame({ id: '0', context: '0', operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        const object = environment.getNodeByFQN<ClassNode>('wollok.lang.Object')
        object.lookupConstructor = () => constructor
        constructor.parent = () => object


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
            new_id_0: RuntimeObject('new_id_0', 'wollok.lang.List', ['3', '2']),
          }, {
            0: { id: '0', parent: null, locals: {} },
            1: { id: '1', parent: '0', locals: {} },
            2: { id: '2', parent: '0', locals: {} },
            3: { id: '3', parent: '0', locals: {} },
            4: { id: '4', parent: '0', locals: {} },
            5: { id: '5', parent: '0', locals: {} },
            new_id_0: { id: 'new_id_0', parent: '0', locals: { self: 'new_id_0' } },
            new_id_1: { id: 'new_id_1', parent: '1', locals: { p1: '4', p2: 'new_id_0' } },
          })(
            Frame({
              id: 'new_id_1',
              context: 'new_id_1',
              instructions: [
                ...compile(environment)(...constructor.body.sentences),
                LOAD('self'),
                CALL('initialize', 0),
                LOAD('self'),
                RETURN,
              ],
            }),
            Frame({ id: '0', context: '0', operandStack: ['5'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the constructor is not found', () => {
        const instruction = INIT(2, 'wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1', '1'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => undefined

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack length is < arity + 1', () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as ConstructorNode

        const instruction = INIT(2, 'wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => constructor

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as ConstructorNode

        const instruction = INIT(2, 'wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1', '2'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => constructor

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('INIT_NAMED', () => {

      it('should pop the instance and arguments and initialize all fields', () => {
        const f1 = Field('f1', { value: Literal(5) }) as FieldNode
        const f2 = Field('f2', { value: Literal(null) }) as FieldNode
        const f3 = Field('f3', { value: Literal(7) }) as FieldNode
        const f4 = Field('f4', { value: Literal(null) }) as FieldNode
        const X = Class('X', { superclass: environment.getNodeByFQN('wollok.lang.Object') as any })(
          f1,
          f2,
          f3,
          f4,
        ) as ClassNode
        X.hierarchy = () => [X, environment.getNodeByFQN('wollok.lang.Object')]

        const instruction = INIT_NAMED(['f1', 'f2'])
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'X'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          0: { id: '0', parent: '', locals: {} },
          1: { id: '1', parent: '0', locals: {} },
        })(
          Frame({ context: '0', operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        const getNodeByFQNStub = stub(evaluation.environment, 'getNodeByFQN')
        getNodeByFQNStub.withArgs('X').returns(X)
        getNodeByFQNStub.callThrough()

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'X'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          }, {
            0: { id: '0', parent: '', locals: {} },
            1: { id: '1', parent: '0', locals: { f1: '3', f2: '2', f3: VOID_ID, f4: VOID_ID } },
          })(
            Frame({
              id: '1', context: '1', operandStack: [], instructions: [
                ...compile(environment)(f3.value),
                STORE('f3', true),
                ...compile(environment)(f4.value),
                STORE('f4', true),
                LOAD('self'),
                RETURN,
              ],
            }),
            Frame({ context: '0', operandStack: [], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if there is no instance with the given id', () => {
        const instruction = INIT_NAMED([])
        const evaluation = Evaluation(environment, {}, {
          0: { id: '0', parent: '', locals: {} },
        })(
          Frame({ context: '0', operandStack: ['1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('INTERRUPT', () => {

      const instruction = INTERRUPT

      it('should pop a value and push it on the first frame with a handler context, dropping the rest and jumping to handler', () => {
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        }, {
          3: { id: '3', parent: '4', locals: {} },
          4: { id: '4', parent: '5', locals: {} },
          5: { id: '5', parent: '6', locals: {}, exceptionHandlerIndex: 2 },
          6: { id: '6', parent: '', locals: {} },
          7: { id: '7', parent: '', locals: {} },
        })(
          Frame({ id: '3', context: '3', operandStack: ['1'], instructions: [instruction] }),
          Frame({ id: '4', context: '4' }),
          Frame({ id: '6', context: '5', instructions: [PUSH('1'), PUSH('2'), PUSH('3')] }),
          Frame({ id: '7', context: '7' }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
          }, {
            3: { id: '3', parent: '4', locals: {} },
            4: { id: '4', parent: '5', locals: {} },
            5: { id: '5', parent: '6', locals: {}, exceptionHandlerIndex: 2 },
            6: { id: '6', parent: '', locals: { '<exception>': '1' } },
            7: { id: '7', parent: '', locals: {} },
          })(
            Frame({ id: '6', context: '6', instructions: [PUSH('1'), PUSH('2'), PUSH('3')], nextInstruction: 2 }),
            Frame({ id: '7', context: '7' }),
          )
        )

      })

      it('should raise an error if the current operand stack is empty', () => {
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction] }),
          Frame({}),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no handler context', () => {
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        }, {
          3: { id: '3', parent: '4', locals: {} },
          4: { id: '4', parent: '', locals: {} },
        })(
          Frame({ id: '3', context: '3', operandStack: ['1'], instructions: [instruction] }),
          Frame({ id: '4', context: '4' }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

  })


  describe('RETURN', () => {

    const instruction = RETURN

    it('should drop the current frame and push the top of its operand stack to the next active frame', () => {
      const evaluation = Evaluation(environment, {
        1: RuntimeObject('1', 'wollok.lang.Object'),
        2: RuntimeObject('2', 'wollok.lang.Object'),
      }, {
        3: { id: '3', parent: '4', locals: {} },
        4: { id: '4', parent: '', locals: {} },
      })(
        Frame({ id: '3', context: '3', operandStack: ['1'], instructions: [instruction] }),
        Frame({ id: '4', context: '4', operandStack: ['2'] }),
      )

      evaluation.should.be.stepped().into(
        Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
        }, {
          3: { id: '3', parent: '4', locals: {} },
          4: { id: '4', parent: '', locals: {} },
        })(
          Frame({ id: '4', context: '4', operandStack: ['2', '1'] }),
        )
      )

    })

    it('should raise an error if the current operand stack is empty', () => {
      const evaluation = Evaluation(environment, {})(
        Frame({ instructions: [instruction] }),
        Frame({}),
      )

      expect(() => step({})(evaluation)).to.throw()
    })

    it('should raise an error if the frame stack length is < 2', () => {
      const evaluation = Evaluation(environment, {
        1: RuntimeObject('1', 'wollok.lang.Object'),
      })(
        Frame({ instructions: [instruction], operandStack: ['1'] }),
      )

      expect(() => step({})(evaluation)).to.throw()
    })

  })

})