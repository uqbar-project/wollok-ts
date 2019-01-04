import { expect, should } from 'chai'
import rewiremock from 'rewiremock'
import { CALL, CONDITIONAL_JUMP, Evaluation, FALSE_ID, Frame, GET, IF_THEN_ELSE, INHERITS, INIT, INSTANTIATE, Instruction, INTERRUPT, LOAD, Native, PUSH, RESUME_INTERRUPTION, SET, STORE, TRUE_ID, TRY_CATCH_ALWAYS, VOID_ID } from '../src/interpreter'
import link from '../src/linker'
import { Class as ClassNode, Constructor as ConstructorNode, Environment, Field as FieldNode, Id, List, Method as MethodNode, Module, Name, Package as PackageNode, Sentence, Singleton } from '../src/model'
import utils from '../src/utils'
import { Class, Constructor, evaluationBuilders, Field, Literal, Method, Package, Parameter, Reference, Return } from './builders'

should()

const mockInterpreterDependencies = async (mocked: {
  targets?: { [name: string]: any },
  ids?: Id<'Linked'>[],
  hierarchy?: (m: Module<'Linked'>) => List<Module<'Linked'>>,
  superclass?: (module: ClassNode<'Linked'> | Singleton<'Linked'>) => ClassNode<'Linked'> | null,
  compile?: (environment: Environment<'Linked'>) => (node: Sentence<'Linked'>) => List<Instruction>,
  methodLookup?: (name: Name, arity: number, start: Module<'Linked'>) => MethodNode<'Linked'> | undefined,
  constructorLookup?: (arity: number, owner: ClassNode<'Linked'>) => ConstructorNode<'Linked'> | undefined,
  nativeLookup?: (natives: {}, method: MethodNode<'Linked'>) => Native,
}) => rewiremock.around(
  () => import('../src/interpreter'),
  mock => {
    mock(() => import('../src/utils'))
      .withDefault(env => ({
        ...utils(env),
        resolveTarget: reference => mocked.targets![reference.name],
        resolve: fqn => (mocked.targets || {})[fqn] || utils(env).resolve(fqn),
        hierarchy: module => mocked.hierarchy ? mocked.hierarchy(module) : utils(env).hierarchy(module),
        superclass: module => mocked.superclass ? mocked.superclass(module) : utils(env).superclass(module),
        methodLookup: mocked.methodLookup!,
        constructorLookup: mocked.constructorLookup!,
        nativeLookup: mocked.nativeLookup!,
      }))

    let evaluationIds = mocked.ids || []
    mock(() => import('uuid'))
      .with({
        v4: () => {
          const [evaluation, ...rest] = evaluationIds
          evaluationIds = rest
          return evaluation as any
        },
      })
  }
)

const WRE = Package('wollok')(
  Package('lang')(
    Class('Object')(),
    Class('Closure', { superclass: Reference('wollok.lang.Object') })(),
    Class('String', { superclass: Reference('wollok.lang.Object') })(),
    Class('List', { superclass: Reference('wollok.lang.Object') })()
  )
) as unknown as PackageNode<'Filled'>

const environment = link([WRE])
const { Evaluation, Frame, RuntimeObject } = evaluationBuilders(environment)

describe('Wollok Interpreter', () => {

  describe('evaluation of Instructions', () => {

    describe('LOAD', () => {

      it('should push the local with the given name from the current locals into the current operand stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = LOAD('x')
        const evaluation = Evaluation({})(
          Frame({ locals: { x: '1' }, operandStack: ['2'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, operandStack: ['2', '1'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame, it should search it through the frame stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = LOAD('x')
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
          Frame({}),
          Frame({ locals: { x: '1' } }),
          Frame({ locals: { x: '2' } }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ operandStack: ['1'], instructions: [instruction], pc: 1 }),
            Frame({}),
            Frame({ locals: { x: '1' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('should raise an error if the local is not in scope', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = LOAD('x')
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('STORE', () => {

      it('should save the current operand stack to the given local name in the current locals', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', false)
        const evaluation = Evaluation({})(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
          Frame({ locals: { x: '2' } }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, instructions: [instruction], pc: 1 }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('should override the current local value', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', false)
        const evaluation = Evaluation({})(
          Frame({ locals: { x: '2' }, operandStack: ['1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should override the current local value', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', false)
        const evaluation = Evaluation({})(
          Frame({ locals: { x: '2' }, operandStack: ['1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is active, it should search it through the frame stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', true)
        const evaluation = Evaluation({})(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
          Frame({ locals: { x: '2' } }),
          Frame({ locals: { x: '2' } }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ instructions: [instruction], pc: 1 }),
            Frame({ locals: { x: '1' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is not active, it should add it to the current frame', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', false)
        const evaluation = Evaluation({})(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
          Frame({ locals: { x: '2' } }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, instructions: [instruction], pc: 1 }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('if the local is not in scope, it should add it to the current frame', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', true)
        const evaluation = Evaluation({})(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = STORE('x', true)
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })
    })


    describe('PUSH', () => {

      it('should push the given id to the current operand stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = PUSH('1')
        const evaluation = Evaluation({})(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ operandStack: ['2', '1'], instructions: [instruction], pc: 1 }),
          )
        )
      })

    })


    describe('GET', () => {

      it('should pop an object id from the current stack operand and push back the value of the given field', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = GET('x')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
        })(
          Frame({ operandStack: ['3', '1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ operandStack: ['3', '2'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = GET('x')
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = GET('x')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('SET', () => {

      it('should pop a value and an object id from the current stack operand and set its field of the given name', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = SET('x')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '2'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should override the current field value', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = SET('x')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object', { x: '4' }),
        })(
          Frame({ operandStack: ['1', '2'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack has length < 2', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = SET('x')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = SET('x')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2', '2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })
    })


    describe('INSTANTIATE', () => {

      it('should create a new instance from the given module and push it to the operand stack', async () => {
        const { step } = await mockInterpreterDependencies({ ids: ['1'] })
        const instruction = INSTANTIATE('wollok.lang.Object')
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], instructions: [instruction], pc: 1 }),
          )
        )
      })

    })


    describe('INHERITS', () => {

      it('should pop an object id from the operand stack and push true if it inherits the given module', async () => {
        const { step } = await mockInterpreterDependencies({ ids: ['1'] })
        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Closure'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Closure'),
          })(
            Frame({ operandStack: [TRUE_ID], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should pop an object id from the operand stack and push false if it does not inherit the given module', async () => {
        const { step } = await mockInterpreterDependencies({ ids: ['1'] })
        const instruction = INHERITS('wollok.lang.Closure')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: [FALSE_ID], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = INHERITS('wollok.lang.Object')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('CONDITIONAL_JUMP', () => {

      it('should pop a boolean from the operand stack and increment the PC the given ammount if it is false', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = CONDITIONAL_JUMP(2)
        const evaluation = Evaluation({})(
          Frame({
            operandStack: [FALSE_ID],
            instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
          }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({
              pc: 3,
              instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
            }),
          )
        )
      })

      it('should pop a boolean from the operand stack and do nothing if it is true', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = CONDITIONAL_JUMP(2)

        const evaluation = Evaluation({})(
          Frame({
            operandStack: [TRUE_ID],
            instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
          }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({
              instructions: [instruction, LOAD('a'), LOAD('b'), LOAD('c')],
              pc: 1,
            }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = CONDITIONAL_JUMP(1)
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the given id does not belong to a boolean', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = CONDITIONAL_JUMP(1)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the given count overflows the instruction list', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = CONDITIONAL_JUMP(3)
        const evaluation = Evaluation({})(
          Frame({ operandStack: [TRUE_ID], instructions: [instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('CALL', () => {

      it('should pop the arguments and receiver from the operand stack and create a new frame for the method body', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step, compile } = await mockInterpreterDependencies({ methodLookup: () => method })
        const instruction = CALL('m', 2)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({
              locals: { self: '3', p1: '2', p2: '1' }, instructions: [
                ...compile(environment)(method.body!),
                PUSH(VOID_ID),
                INTERRUPT('return'),
              ],
            }),
            Frame({ resume: ['return'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('if method has a varargs parameter, should group all trailing arguments as a single array argument', async () => {
        const method = Method('m', {
          parameters: [
            Parameter('p1'),
            Parameter('p2', { isVarArg: true }),
          ],
        })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step, compile } = await mockInterpreterDependencies({ methodLookup: () => method, ids: ['6'] })
        const instruction = CALL('m', 3)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
            6: RuntimeObject('6', 'wollok.lang.List', {}, ['2', '1']),
          })(
            Frame({
              locals: { self: '4', p1: '3', p2: '6' }, instructions: [
                ...compile(environment)(method.body!),
                PUSH(VOID_ID),
                INTERRUPT('return'),
              ],
            }),
            Frame({ operandStack: ['5'], resume: ['return'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('if method is not found, should still pop the arguments and receiver and use them to call messageNotUnderstood', async () => {
        const messageNotUnderstood = Method('messageNotUnderstood', {
          parameters: [
            Parameter('name'),
            Parameter('parameters', { isVarArg: true }),
          ],
        })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step, compile } = await mockInterpreterDependencies({
          ids: ['4', '5'],
          methodLookup: name => name === 'messageNotUnderstood' ? messageNotUnderstood : undefined,
        })
        const instruction = CALL('m', 2)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.String', {}, messageNotUnderstood.name),
            5: RuntimeObject('5', 'wollok.lang.List', {}, ['2', '1']),
          })(
            Frame({ locals: { self: '3', name: '4', parameters: '5' }, instructions: compile(environment)(messageNotUnderstood.body!) }),
            Frame({ resume: ['return'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('if method is native, it should still pop the arguments and receiver and use them to call the native function', async () => {
        const method = Method('m', {
          isNative: true, body: undefined, parameters: [
            Parameter('p1'), Parameter('p2'),
          ],
        })() as MethodNode<'Linked'>

        const native: Native = (self, p1, p2) => e => { e.frameStack[0].operandStack.push(self.id + p1.id + p2.id) }

        const { step } = await mockInterpreterDependencies({ methodLookup: () => method, nativeLookup: () => native })
        const instruction = CALL('m', 2)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['4', '3', '2', '1'], instructions: [instruction] }),
        )

        step({ wollok: { lang: { Object: { m: native } } } })(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['4', '321'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('if method is native and has varargs the arguments are spread on the native instead of grouped in an array', async () => {
        const method = Method('m', {
          isNative: true, body: undefined, parameters: [
            Parameter('p1'), Parameter('p2', { isVarArg: true }),
          ],
        })() as MethodNode<'Linked'>

        const native: Native = (self, p1, p2) => e => { e.frameStack[0].operandStack.push(self.id + p1.id + p2.id) }

        const { step } = await mockInterpreterDependencies({ methodLookup: () => method, nativeLookup: () => native })
        const instruction = CALL('m', 3)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        step({ wollok: { lang: { Object: { m: native } } } })(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['5', '432'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack length is < arity + 1', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step } = await mockInterpreterDependencies({ methodLookup: () => method })
        const instruction = CALL('m', 2)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step } = await mockInterpreterDependencies({ methodLookup: () => method })
        const instruction = CALL('m', 2)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['2', '2', '2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the method is native but the native is missing', async () => {
        const method = Method('m', { isNative: true, body: undefined })() as MethodNode<'Linked'>
        const { step } = await mockInterpreterDependencies({ methodLookup: () => method, nativeLookup: () => { throw new Error('') } })
        const instruction = CALL('m', 0)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

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
        })(Return()) as any
        const { step, compile } = await mockInterpreterDependencies({ constructorLookup: () => constructor })
        const instruction = INIT(2, 'wollok.lang.Object', false)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['3', '2', '1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({
              locals: { self: '1', p1: '3', p2: '2' },
              instructions: [
                ...compile(environment)(constructor.body),
                LOAD('self'),
                INTERRUPT('return'),
              ],
            }),
            Frame({ resume: ['return'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('prepends supercall and, if initFields is set to true, the initialization of fields to the constructor call', async () => {
        const constructor = Constructor({ baseCall: { callsSuper: true, args: [] } })(Return()) as any
        const f1 = Field('f1', { value: Literal(5) }) as FieldNode<'Linked'>
        const f2 = Field('f1', { value: Literal(7) }) as FieldNode<'Linked'>
        const X = Class('X', { superclass: utils(environment).resolve('wollok.lang.Object') as any })(
          f1 as any,
          f2 as any
        ) as ClassNode<'Linked'>

        const { step, compile } = await mockInterpreterDependencies({
          constructorLookup: () => constructor,
          targets: { X },
          superclass: module => module.name === 'X' ? utils(environment).resolve('wollok.lang.Object') as any : undefined,
          hierarchy: module => module.name === 'X' ? [X, utils(environment).resolve('wollok.lang.Object')] : [],
        })

        const instruction = INIT(0, 'X', true)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'X'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'X'),
          })(
            Frame({
              locals: { self: '1' },
              instructions: [
                LOAD('self'),
                ...compile(environment)(f1.value),
                SET(f1.name),
                LOAD('self'),
                ...compile(environment)(f2.value),
                SET(f2.name),
                LOAD('self'),
                INIT(0, 'wollok.lang.Object', false),
                ...compile(environment)(constructor.body),
                LOAD('self'),
                INTERRUPT('return'),
              ],
            }),
            Frame({ resume: ['return'], instructions: [instruction], pc: 1 }),
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
        })(Return()) as any
        const { step, compile } = await mockInterpreterDependencies({
          constructorLookup: () => constructor,
          ids: ['6'],
        })
        const instruction = INIT(3, 'wollok.lang.Object', false)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
          2: RuntimeObject('2', 'wollok.lang.Object'),
          3: RuntimeObject('3', 'wollok.lang.Object'),
          4: RuntimeObject('4', 'wollok.lang.Object'),
          5: RuntimeObject('5', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['5', '4', '3', '2', '1'], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
            6: RuntimeObject('6', 'wollok.lang.List', {}, ['3', '2']),
          })(
            Frame({
              locals: { self: '1', p1: '4', p2: '6' },
              instructions: [
                LOAD('self'),
                ...compile(environment)(constructor.body),
                INTERRUPT('return'),
              ],
            }),
            Frame({ operandStack: ['5'], resume: ['return'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the constructor is not found', async () => {
        const instruction = INIT(2, 'wollok.lang.Object', true)
        const { step } = await mockInterpreterDependencies({ constructorLookup: () => undefined })
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1', '1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack length is < arity + 1', async () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as any
        const { step } = await mockInterpreterDependencies({ constructorLookup: () => constructor })
        const instruction = INIT(2, 'wollok.lang.Object', true)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as any
        const { step } = await mockInterpreterDependencies({ constructorLookup: () => constructor })
        const instruction = INIT(2, 'wollok.lang.Object', true)
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1', '1', '2'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })


    describe('IF_THEN_ELSE', () => {

      it('should pop a boolean from the operand stack and push a frame to evaluate the then clause if it is true', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = IF_THEN_ELSE([PUSH('5')], [PUSH('7')]) as Extract<Instruction, { kind: 'IF_THEN_ELSE' }>
        const evaluation = Evaluation({})(
          Frame({ operandStack: [TRUE_ID], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ instructions: [PUSH(VOID_ID), ...instruction.thenHandler, INTERRUPT('result')] }),
            Frame({ resume: ['result'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should pop a boolean from the operand stack and push a frame to evaluate the else clause if it is false', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = IF_THEN_ELSE([PUSH('5')], [PUSH('7')]) as Extract<Instruction, { kind: 'IF_THEN_ELSE' }>

        const evaluation = Evaluation({})(
          Frame({ operandStack: [FALSE_ID], instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({ instructions: [PUSH(VOID_ID), ...instruction.elseHandler, INTERRUPT('result')] }),
            Frame({ resume: ['result'], instructions: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the given id does not belong to a boolean', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = IF_THEN_ELSE([], [])
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = IF_THEN_ELSE([], [])
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction, instruction, instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

    })

    describe('TRY_CATCH_ALWAYS', () => {

      it('should create three nested frames to handle the given try, catch and always instruction sequences', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = TRY_CATCH_ALWAYS([PUSH('5')], [PUSH('7')], [PUSH('9')]) as Extract<Instruction, { kind: 'TRY_CATCH_ALWAYS' }>
        const evaluation = Evaluation({})(
          Frame({ instructions: [instruction] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({})(
            Frame({
              instructions: [
                PUSH(VOID_ID),
                ...instruction.body,
                INTERRUPT('result'),
              ],
            }),
            Frame({
              resume: ['exception'],
              instructions: [
                STORE('<exception>', false),
                ...instruction.catchHandler,
                LOAD('<exception>'),
                INTERRUPT('exception'),
              ],
            }),
            Frame({
              resume: ['result', 'return', 'exception'],
              instructions: [
                STORE('<previous_interruption>', false),
                ...instruction.alwaysHandler,
                LOAD('<previous_interruption>'),
                RESUME_INTERRUPTION,
              ],
            }),
            Frame({ resume: ['result'], instructions: [instruction], pc: 1 }),
          )
        )
      })
    })


    describe('INTERRUPT', () => {

      it('should pop a value and push it on the first frame that resumes the given interruption, dropping the rest', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = INTERRUPT('return')
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ operandStack: ['1'], instructions: [instruction] }),
          Frame({}),
          Frame({ resume: ['result'] }),
          Frame({ resume: ['return'], operandStack: ['2'] }),
          Frame({ resume: ['return', 'exception'] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2', '1'] }),
            Frame({ resume: ['return', 'exception'] }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = INTERRUPT('result')
        const evaluation = Evaluation({})(
          Frame({}),
          Frame({ resume: ['result'], instructions: [instruction] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if no frame resumes the interruption', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = INTERRUPT('result')
        const evaluation = Evaluation({
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
        const { step } = await mockInterpreterDependencies({})
        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ resume: ['result', 'exception'], operandStack: ['1'], instructions: [instruction] }),
          Frame({}),
          Frame({ resume: ['result'] }),
          Frame({ resume: ['return'], operandStack: ['2'] }),
          Frame({ resume: ['return', 'exception'] }),
        )

        step({})(evaluation)

        evaluation.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2', '1'] }),
            Frame({ resume: ['return', 'exception'] }),
          )
        )
      })

      it('should raise an error if the interruption to resume cannot be inferred on the current frame', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation({
          1: RuntimeObject('1', 'wollok.lang.Object'),
        })(
          Frame({ resume: ['result'], operandStack: ['1'], instructions: [instruction] }),
          Frame({ resume: ['return'] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation({})(
          Frame({ resume: ['return', 'exception'], instructions: [instruction] }),
          Frame({ resume: ['result'] }),
        )

        expect(() => step({})(evaluation)).to.throw()
      })

      it('should raise an error if no frame resumes the interruption', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction = RESUME_INTERRUPTION
        const evaluation = Evaluation({
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