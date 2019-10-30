import { expect, should, use } from 'chai'
import { restore, stub } from 'sinon'
import { Class, Constructor, Evaluation, Field, Frame, Literal, Method, Package, Parameter, Reference, Return, RuntimeObject } from '../src/builders'
import { CALL, compile, CONDITIONAL_JUMP, DUP, FALSE_ID, GET, IF_THEN_ELSE, INHERITS, INIT, INSTANTIATE, Instruction, INTERRUPT, LOAD, NativeFunction, PUSH, RESUME_INTERRUPTION, SET, step, STORE, SWAP, TRUE_ID, TRY_CATCH_ALWAYS, VOID_ID } from '../src/interpreter'
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
  )
) as unknown as PackageNode<Filled>

const environment = link([WRE])

// TODO: Some mocking is quite ugly. Either properly link the mock classes or use sinon for cleaner definitions.
afterEach(() => {
  restore()
})

describe('Wollok Interpreter', () => {

  describe('evaluation of Instructions', () => {

    describe('LOAD', () => {

      it('should push the local with the given name from the current locals into the current operand stack', async () => {
        const instruction = LOAD('x')
        const evaluation = Evaluation(environment, {}, { 1: { parent: '', locals: { x: '1' } } })(
          Frame({ context: '1', operandStack: ['2'], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, { 1: { parent: '', locals: { x: '1' } } })(
            Frame({ context: '1', operandStack: ['2', '1'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame, it should search it through the frame stack', async () => {
        const instruction = LOAD('x')
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
          2: { parent: '1', locals: { x: '2' } },
          3: { parent: '2', locals: { x: '1' } },
          4: { parent: '3', locals: {} },
        })(
          Frame({ context: '4', instructions: [instruction] }),
          Frame({ context: '3' }),
          Frame({ context: '2' }),
          Frame({ context: '1' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: {} },
            2: { parent: '1', locals: { x: '2' } },
            3: { parent: '2', locals: { x: '1' } },
            4: { parent: '3', locals: {} },
          })(
            Frame({ context: '4', operandStack: ['1'], instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '3' }),
            Frame({ context: '2' }),
            Frame({ context: '1' }),
          )
        )
      })

      it('should raise an error if the local is not in scope', async () => {
        const instruction = LOAD('x')
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('STORE', () => {

      it('should save the current operand stack to the given local name in the current locals', async () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
          2: { parent: '1', locals: {} },

        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
          Frame({ context: '2' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: { x: '1' } },
            2: { parent: '1', locals: {} },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '2' }),
          )
        )
      })

      it('should override the current local value', async () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: { x: '2' } },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: { x: '1' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should override the current local value', async () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: { x: '2' } },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: { x: '1' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is active, it should search it through the frame stack', async () => {
        const instruction = STORE('x', true)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: { x: '2' } },
          2: { parent: '1', locals: { x: '2' } },
          3: { parent: '2', locals: {} },
        })(
          Frame({ context: '3', operandStack: ['1'], instructions: [instruction] }),
          Frame({ context: '2' }),
          Frame({ context: '1' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: { x: '2' } },
            2: { parent: '1', locals: { x: '1' } },
            3: { parent: '2', locals: {} },
          })(
            Frame({ context: '3', instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '2' }),
            Frame({ context: '1' }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is not active, it should add it to the current frame', async () => {
        const instruction = STORE('x', false)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
          2: { parent: '1', locals: { x: '2' } },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
          Frame({ context: '2' }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: { x: '1' } },
            2: { parent: '1', locals: { x: '2' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
            Frame({ context: '2' }),
          )
        )
      })

      it('if the local is not in scope, it should add it to the current frame', async () => {
        const instruction = STORE('x', true)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: { x: '1' } },
          })(
            Frame({ context: '1', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = STORE('x', true)
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })
    })


    describe('PUSH', () => {

      it('should push the given id to the current operand stack', async () => {
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


    describe('GET', () => {

      it('should pop an object id from the current stack operand and push back the value of the given field', async () => {
        const instruction = GET('x')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
        }, {
          0: { parent: '', locals: {} },
          1: { parent: '0', locals: { x: '2' } },
        })(
          Frame({ context: '0', operandStack: ['3', '1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
          }, {
            0: { parent: '', locals: {} },
            1: { parent: '0', locals: { x: '2' } },
          })(
            Frame({ context: '0', operandStack: ['3', '2'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const instruction = GET('x')
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const instruction = GET('x')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('SET', () => {
      it('should pop a value and an object id from the current stack operand and set its field of the given name', async () => {
        const instruction = SET('x')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        }, {
          0: { parent: '', locals: {} },
          1: { parent: '0', locals: {} },
        })(
          Frame({ context: '0', operandStack: ['1', '2'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
          }, {
            0: { parent: '', locals: {} },
            1: { parent: '0', locals: { x: '2' } },
          })(
            Frame({ context: '0', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should override the current field value', async () => {
        const instruction = SET('x')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        }, {
          0: { parent: '', locals: {} },
          1: { parent: '0', locals: { x: '4' } },
        })(
          Frame({ context: '0', operandStack: ['1', '2'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
          }, {
            0: { parent: '', locals: {} },
            1: { parent: '0', locals: { x: '2' } },
          })(
            Frame({ context: '0', instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack has length < 2', async () => {
        const instruction = SET('x')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {

        const instruction = SET('x')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2', '2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })
    })

    describe('SWAP', () => {

      it('should swap the top two operands of the stack', async () => {
        const instruction = SWAP
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {})(
            Frame({ operandStack: ['3', '1', '2'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack has length < 2', async () => {

        const instruction = SWAP
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

    describe('DUP', () => {

      it('should duplicate the top operand of the stack', async () => {
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

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = DUP
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: [], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

    describe('INSTANTIATE', () => {

      it('should create a new instance from the given module and push it to the operand stack', async () => {
        const instruction = INSTANTIATE('wollok.lang.Object')
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            new_id_0: RuntimeObject('new_id_0', 'wollok.lang.Object'),
          }, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: { self: 'new_id_0' } },
          })(
            Frame({ context: '1', operandStack: ['new_id_0'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

    })


    describe('INHERITS', () => {

      it('should pop an object id from the operand stack and push true if it inherits the given module', async () => {
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

      it('should pop an object id from the operand stack and push false if it does not inherit the given module', async () => {
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

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {

        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('CONDITIONAL_JUMP', () => {

      it('should pop a boolean from the operand stack and increment the Next Instruction the given ammount if it is false', async () => {
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
              nextInstruction: 3,
              instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
            }),
          )
        )
      })

      it('should pop a boolean from the operand stack and do nothing if it is true', async () => {
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
              instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
              nextInstruction: 1,
            }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = CONDITIONAL_JUMP(1)
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the given id does not belong to a boolean', async () => {

        const instruction = CONDITIONAL_JUMP(1)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the given count overflows the instruction list', async () => {

        const instruction = CONDITIONAL_JUMP(3)
        const evaluation = Evaluation(environment, {})(
          Frame({ operandStack: [TRUE_ID], instructions: [instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('CALL', () => {

      it('should pop the arguments and receiver from the operand stack and create a new frame for the method body', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode
        const instruction = CALL('m', 2)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          1: { parent: '', locals: {} },
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
            1: { parent: '', locals: {} },
            new_id_0: { parent: '3', locals: { p1: '2', p2: '1' } },
          })(
            Frame({
              context: 'new_id_0', instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                INTERRUPT('return'),
              ],
            }),
            Frame({ context: '1', resume: ['return'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method has a varargs parameter, should group all trailing arguments as a single array argument', async () => {
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
          1: { parent: '', locals: {} },
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
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: { self: 'new_id_0' } },
            new_id_1: { parent: '4', locals: { p1: '3', p2: 'new_id_0' } },
          })(
            Frame({
              context: 'new_id_1',
              instructions: [
                ...compile(environment)(...method.body!.sentences),
                PUSH(VOID_ID),
                INTERRUPT('return'),
              ],
            }),
            Frame({ context: '1', operandStack: ['5'], resume: ['return'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method is not found, should still pop the arguments and receiver and use them to call messageNotUnderstood', async () => {
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
          1: { parent: '', locals: {} },
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
            'new_id_0': RuntimeObject('new_id_0', 'wollok.lang.List', ['2', '1']),
          }, {
            '1': { parent: '', locals: {} },
            'S!m': { parent: '1', locals: { self: 'S!m' } },
            'new_id_0': { parent: '1', locals: { self: 'new_id_0' } },
            'new_id_1': { parent: '3', locals: { name: 'S!m', parameters: 'new_id_0' } },
          })(
            Frame({
              context: 'new_id_1',
              instructions: compile(environment)(...messageNotUnderstood.body!.sentences),
            }),
            Frame({ context: '1', resume: ['return'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if method is native, it should still pop the arguments and receiver and use them to call the native function', async () => {
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

      it('if method is native and has varargs the arguments are spread on the native instead of grouped in an array', async () => {
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

      it('should raise an error if the current operand stack length is < arity + 1', async () => {
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

      it('should raise an error if there is no instance with the given id', async () => {
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

      it('should raise an error if the method is native but the native is missing', async () => {
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

      it('should pop the instance and arguments from the operand stack and create a new frame for the initialization', async () => {
        const constructor = Constructor({
          parameters: [
            Parameter('p1'),
            Parameter('p2'),
          ],
          baseCall: { callsSuper: true, args: [] },
        })(Return()) as ConstructorNode
        const instruction = INIT(2, 'wollok.lang.Object', false)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        }, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => constructor

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          }, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: { p1: '3', p2: '2' } },
          })(
            Frame({
              context: 'new_id_0',
              instructions: [
                ...compile(environment)(...constructor.body.sentences),
                LOAD('self'),
                INTERRUPT('return'),
              ],
            }),
            Frame({ context: '1', resume: ['return'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('prepends supercall and, if initFields is set to true, the initialization of fields to the constructor call', async () => {
        const constructor = Constructor({ baseCall: { callsSuper: true, args: [] } })(Return()) as ConstructorNode
        const f1 = Field('f1', { value: Literal(5) }) as FieldNode
        const f2 = Field('f1', { value: Literal(7) }) as FieldNode
        const X = Class('X', { superclass: environment.getNodeByFQN('wollok.lang.Object') as any })(
          f1,
          f2
        ) as ClassNode
        X.superclassNode = () => environment.getNodeByFQN<ClassNode>('wollok.lang.Object')
        X.hierarchy = () => [X, environment.getNodeByFQN('wollok.lang.Object')]

        const instruction = INIT(0, 'X', true)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'X'),
        }, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['1'], instructions: [instruction] }),
        )

        const getNodeByFQNStub = stub(evaluation.environment, 'getNodeByFQN')
        getNodeByFQNStub.withArgs('X').returns(X)
        getNodeByFQNStub.callThrough()
        X.lookupConstructor = () => constructor

        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'X'),
          }, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: {} },
          })(
            Frame({
              context: 'new_id_0',
              instructions: [
                LOAD('self'),
                ...compile(environment)(f1.value),
                SET(f1.name),
                LOAD('self'),
                ...compile(environment)(f2.value),
                SET(f2.name),
                LOAD('self'),
                INIT(0, 'wollok.lang.Object', false),
                ...compile(environment)(...constructor.body.sentences),
                LOAD('self'),
                INTERRUPT('return'),
              ],
            }),
            Frame({ context: '1', resume: ['return'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('if constructor has a varargs parameter, should group all trailing arguments as a single array argument', async () => {
        const constructor = Constructor({
          parameters: [
            Parameter('p1'),
            Parameter('p2', { isVarArg: true }),
          ],
          baseCall: { callsSuper: true, args: [] },
        })(Return()) as ConstructorNode

        const instruction = INIT(3, 'wollok.lang.Object', false)

        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        }, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => constructor


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
            new_id_0: RuntimeObject('new_id_0', 'wollok.lang.List', ['3', '2']),
          }, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: { self: 'new_id_0' } },
            new_id_1: { parent: '1', locals: { p1: '4', p2: 'new_id_0' } },
          })(
            Frame({
              context: 'new_id_1',
              instructions: [
                ...compile(environment)(...constructor.body.sentences),
                LOAD('self'),
                INTERRUPT('return'),
              ],
            }),
            Frame({ context: '1', operandStack: ['5'], resume: ['return'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the constructor is not found', async () => {
        const instruction = INIT(2, 'wollok.lang.Object', true)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1', '1'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => undefined

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack length is < arity + 1', async () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as ConstructorNode

        const instruction = INIT(2, 'wollok.lang.Object', true)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => constructor

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as ConstructorNode

        const instruction = INIT(2, 'wollok.lang.Object', true)
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1', '2'], instructions: [instruction] }),
        )

        environment.getNodeByFQN<ClassNode>('wollok.lang.Object').lookupConstructor = () => constructor

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('IF_THEN_ELSE', () => {

      it('should pop a boolean from the operand stack and push a frame to evaluate the then clause if it is true', async () => {
        const instruction = IF_THEN_ELSE([PUSH('5')], [PUSH('7')]) as Extract<Instruction, { kind: 'IF_THEN_ELSE' }>
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: [TRUE_ID], instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: {} },
          })(
            Frame({ context: 'new_id_0', instructions: [PUSH(VOID_ID), ...instruction.thenHandler, INTERRUPT('result')] }),
            Frame({ context: '1', resume: ['result'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should pop a boolean from the operand stack and push a frame to evaluate the else clause if it is false', async () => {
        const instruction = IF_THEN_ELSE([PUSH('5')], [PUSH('7')]) as Extract<Instruction, { kind: 'IF_THEN_ELSE' }>
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', operandStack: [FALSE_ID], instructions: [instruction] }),
        )

        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: {} },
          })(
            Frame({ context: 'new_id_0', instructions: [PUSH(VOID_ID), ...instruction.elseHandler, INTERRUPT('result')] }),
            Frame({ context: '1', resume: ['result'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })

      it('should raise an error if the given id does not belong to a boolean', async () => {

        const instruction = IF_THEN_ELSE([], [])
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = IF_THEN_ELSE([], [])
        const evaluation = Evaluation(environment, {})(
          Frame({ instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

    describe('TRY_CATCH_ALWAYS', () => {

      it('should create three nested frames to handle the given try, catch and always instruction sequences', async () => {
        const instruction = TRY_CATCH_ALWAYS([PUSH('5')], [PUSH('7')], [PUSH('9')]) as Extract<Instruction, { kind: 'TRY_CATCH_ALWAYS' }>
        const evaluation = Evaluation(environment, {}, {
          1: { parent: '', locals: {} },
        })(
          Frame({ context: '1', instructions: [instruction] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {}, {
            1: { parent: '', locals: {} },
            new_id_0: { parent: '1', locals: {} },
            new_id_1: { parent: 'new_id_0', locals: {} },
            new_id_2: { parent: 'new_id_1', locals: {} },
          })(
            Frame({
              context: 'new_id_2',
              instructions: [
                PUSH(VOID_ID),
                ...instruction.body,
                INTERRUPT('result'),
              ],
            }),
            Frame({
              context: 'new_id_1',
              resume: ['exception'],
              instructions: [
                STORE('<exception>', false),
                ...instruction.catchHandler,
                LOAD('<exception>'),
                INTERRUPT('exception'),
              ],
            }),
            Frame({
              context: 'new_id_0',
              resume: ['exception', 'return', 'result'],
              instructions: [
                STORE('<previous_interruption>', false),
                ...instruction.alwaysHandler,
                LOAD('<previous_interruption>'),
                RESUME_INTERRUPTION,
              ],
            }),
            Frame({ context: '1', resume: ['result'], instructions: [instruction], nextInstruction: 1 }),
          )
        )
      })
    })


    describe('INTERRUPT', () => {

      it('should pop a value and push it on the first frame that resumes the given interruption, dropping the rest', async () => {
        const instruction = INTERRUPT('return')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
          Frame({}),
          Frame({ resume: ['result'] }),
          Frame({ resume: ['return'], operandStack: ['2'] }),
          Frame({ resume: ['return', 'exception'] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2', '1'] }),
            Frame({ resume: ['return', 'exception'] }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = INTERRUPT('result')
        const evaluation = Evaluation(environment, {})(
          Frame({}),
          Frame({ resume: ['result'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if no frame resumes the interruption', async () => {

        const instruction = INTERRUPT('result')
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
          Frame({ resume: ['exception'] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('RESUME_INTERRUPTION', () => {

      it('should pop a value and restart the interruption resumed by the current frame, inferred by the lack of resume flag', async () => {
        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ resume: ['result', 'exception'], operandStack: ['1'], instructions: [instruction] }),
          Frame({}),
          Frame({ resume: ['result'] }),
          Frame({ resume: ['return'], operandStack: ['2'] }),
          Frame({ resume: ['return', 'exception'] }),
        )


        evaluation.should.be.stepped().into(
          Evaluation(environment, {
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2', '1'] }),
            Frame({ resume: ['return', 'exception'] }),
          )
        )
      })

      it('should raise an error if the interruption to resume cannot be inferred on the current frame', async () => {

        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ resume: ['result'], operandStack: ['1'], instructions: [instruction] }),
          Frame({ resume: ['return'] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack is empty', async () => {

        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation(environment, {})(
          Frame({ resume: ['return', 'exception'], instructions: [instruction] }),
          Frame({ resume: ['result'] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if no frame resumes the interruption', async () => {

        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation(environment, {
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ resume: ['return', 'exception'], operandStack: ['1'], instructions: [instruction] }),
          Frame({ resume: ['return'] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

  })

})