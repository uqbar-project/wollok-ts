import { expect, should } from 'chai'
import rewiremock from 'rewiremock'
import { Evaluation, FALSE_ID, Frame, Instruction, Native, TRUE_ID, VOID_ID } from '../src/interpreter'
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

    let nextIds = mocked.ids || []
    mock(() => import('uuid'))
      .with({
        v4: () => {
          const [next, ...rest] = nextIds
          nextIds = rest
          return next as any
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
        const instruction: Instruction = { kind: 'LOAD', name: 'x' }

        const next = step({})(
          Evaluation({})(
            Frame({ locals: { x: '1' }, operandStack: ['2'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, operandStack: ['2', '1'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame, it should search it through the frame stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'LOAD', name: 'x' }

        const next = step({})(
          Evaluation({})(
            Frame({ pending: [instruction] }),
            Frame({}),
            Frame({ locals: { x: '1' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ operandStack: ['1'], pending: [instruction], pc: 1 }),
            Frame({}),
            Frame({ locals: { x: '1' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('should raise an error if the local is not in scope', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'LOAD', name: 'x' }

        expect(() => step({})(
          Evaluation({})(
            Frame({ pending: [instruction] }),
          )
        )).to.throw()
      })

    })


    describe('STORE', () => {

      it('should save the current operand stack to the given local name in the current locals', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: false }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: ['1'], pending: [instruction] }),
            Frame({ locals: { x: '2' } }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, pending: [instruction], pc: 1 }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('should override the current local value', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: false }

        const next = step({})(
          Evaluation({})(
            Frame({ locals: { x: '2' }, operandStack: ['1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should override the current local value', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: false }

        const next = step({})(
          Evaluation({})(
            Frame({ locals: { x: '2' }, operandStack: ['1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, pending: [instruction], pc: 1 }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is active, it should search it through the frame stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: true }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: ['1'], pending: [instruction] }),
            Frame({ locals: { x: '2' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ pending: [instruction], pc: 1 }),
            Frame({ locals: { x: '1' } }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('if the local is missing in the current frame and lookup is not active, it should add it to the current frame', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: false }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: ['1'], pending: [instruction] }),
            Frame({ locals: { x: '2' } }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, pending: [instruction], pc: 1 }),
            Frame({ locals: { x: '2' } }),
          )
        )
      })

      it('if the local is not in scope, it should add it to the current frame', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: true }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: ['1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ locals: { x: '1' }, pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'STORE', name: 'x', lookup: true }

        expect(() => step({})(
          Evaluation({})(
            Frame({ pending: [instruction] }),
          )
        )).to.throw()
      })
    })


    describe('PUSH', () => {

      it('should push the given id to the current operand stack', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'PUSH', id: '1' }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: ['2'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ operandStack: ['2', '1'], pending: [instruction], pc: 1 }),
          )
        )
      })

    })


    describe('GET', () => {

      it('should pop an object id from the current stack operand and push back the value of the given field', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'GET', name: 'x' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ operandStack: ['3', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ operandStack: ['3', '2'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'GET', name: 'x' }

        expect(() => step({})(
          Evaluation({})(
            Frame({ pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'GET', name: 'x' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2'], pending: [instruction] }),
          )
        )).to.throw()
      })

    })


    describe('SET', () => {

      it('should pop a value and an object id from the current stack operand and set its field of the given name', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'SET', name: 'x' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1', '2'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should override the current field value', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'SET', name: 'x' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '4' }),
          })(
            Frame({ operandStack: ['1', '2'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object', { x: '2' }),
          })(
            Frame({ pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack has length < 2', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'SET', name: 'x' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'SET', name: 'x' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2', '2'], pending: [instruction] }),
          )
        )).to.throw()
      })
    })


    describe('INSTANTIATE', () => {

      it('should create a new instance from the given module and push it to the operand stack', async () => {
        const { step } = await mockInterpreterDependencies({ ids: ['1'] })
        const instruction: Instruction = { kind: 'INSTANTIATE', module: 'wollok.lang.Object' }

        const next = step({})(
          Evaluation({
          })(
            Frame({ pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction], pc: 1 }),
          )
        )
      })

    })


    describe('INHERITS', () => {

      it('should pop an object id from the operand stack and push true if it inherits the given module', async () => {
        const { step } = await mockInterpreterDependencies({ ids: ['1'] })
        const instruction: Instruction = { kind: 'INHERITS', module: 'wollok.lang.Object' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Closure'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Closure'),
          })(
            Frame({ operandStack: [TRUE_ID], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should pop an object id from the operand stack and push false if it does not inherit the given module', async () => {
        const { step } = await mockInterpreterDependencies({ ids: ['1'] })
        const instruction: Instruction = { kind: 'INHERITS', module: 'wollok.lang.Closure' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: [FALSE_ID], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'INHERITS', module: 'wollok.lang.Object' }

        expect(() => step({})(
          Evaluation({})(
            Frame({ pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'INHERITS', module: 'wollok.lang.Object' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2'], pending: [instruction] }),
          )
        )).to.throw()
      })

    })


    describe('CONDITIONAL_JUMP', () => {

      it('should pop a boolean from the operand stack and increment the PC the given ammount if it is false', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'CONDITIONAL_JUMP', count: 2 }

        const next = step({})(
          Evaluation({})(
            Frame({
              operandStack: [FALSE_ID],
              pending: [instruction, { kind: 'LOAD', name: 'a' }, { kind: 'LOAD', name: 'b' }, { kind: 'LOAD', name: 'c' }],
            }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({
              pc: 3,
              pending: [instruction, { kind: 'LOAD', name: 'a' }, { kind: 'LOAD', name: 'b' }, { kind: 'LOAD', name: 'c' }],
            }),
          )
        )
      })

      it('should pop a boolean from the operand stack and do nothing if it is true', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'CONDITIONAL_JUMP', count: 2 }

        const next = step({})(
          Evaluation({})(
            Frame({
              operandStack: [TRUE_ID],
              pending: [instruction, { kind: 'LOAD', name: 'a' }, { kind: 'LOAD', name: 'b' }, { kind: 'LOAD', name: 'c' }],
            }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({
              pending: [instruction, { kind: 'LOAD', name: 'a' }, { kind: 'LOAD', name: 'b' }, { kind: 'LOAD', name: 'c' }],
              pc: 1,
            }),
          )
        )
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'CONDITIONAL_JUMP', count: 1 }

        expect(() => step({})(
          Evaluation({})(
            Frame({ pending: [instruction, instruction, instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if the given id does not belong to a boolean', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'CONDITIONAL_JUMP', count: 1 }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction, instruction, instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if the given count overflows the pendings', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'CONDITIONAL_JUMP', count: 3 }

        expect(() => step({})(
          Evaluation({})(
            Frame({ operandStack: [TRUE_ID], pending: [instruction, instruction] }),
          )
        )).to.throw()
      })

    })


    describe('CALL', () => {

      it('should pop the arguments and receiver from the operand stack and create a new frame for the method body', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step, compile } = await mockInterpreterDependencies({ methodLookup: () => method })
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 2 }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({
              locals: { self: '3', p1: '2', p2: '1' }, pending: [
                ...compile(environment)(method.body!),
                { kind: 'PUSH', id: VOID_ID },
                { kind: 'INTERRUPT', interruption: 'return' },
              ],
            }),
            Frame({ resume: ['return'], pending: [instruction], pc: 1 }),
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
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 3 }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['5', '4', '3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
            6: RuntimeObject('6', 'wollok.lang.List', {}, ['2', '1']),
          })(
            Frame({
              locals: { self: '4', p1: '3', p2: '6' }, pending: [
                ...compile(environment)(method.body!),
                { kind: 'PUSH', id: VOID_ID },
                { kind: 'INTERRUPT', interruption: 'return' },
              ],
            }),
            Frame({ operandStack: ['5'], resume: ['return'], pending: [instruction], pc: 1 }),
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
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 2 }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.String', {}, messageNotUnderstood.name),
            5: RuntimeObject('5', 'wollok.lang.List', {}, ['2', '1']),
          })(
            Frame({ locals: { self: '3', name: '4', parameters: '5' }, pending: compile(environment)(messageNotUnderstood.body!) }),
            Frame({ resume: ['return'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('if method is native, it should still pop the arguments and receiver and use them to call the native function', async () => {
        const method = Method('m', {
          isNative: true, body: undefined, parameters: [
            Parameter('p1'), Parameter('p2'),
          ],
        })() as MethodNode<'Linked'>

        const native: Native = (self, p1, p2) => evaluation => {
          evaluation.frameStack[0].operandStack.push(self.id + p1.id + p2.id)
        }

        const { step } = await mockInterpreterDependencies({ methodLookup: () => method, nativeLookup: () => native })
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 2 }

        const next = step({ wollok: { lang: { Object: { m: native } } } })(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['4', '3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['4', '321'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('if method is native and has varargs the arguments are spread on the native instead of grouped in an array', async () => {
        const method = Method('m', {
          isNative: true, body: undefined, parameters: [
            Parameter('p1'), Parameter('p2', { isVarArg: true }),
          ],
        })() as MethodNode<'Linked'>

        const native: Native = (self, p1, p2) => evaluation => {
          evaluation.frameStack[0].operandStack.push(self.id + p1.id + p2.id)
        }

        const { step } = await mockInterpreterDependencies({ methodLookup: () => method, nativeLookup: () => native })
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 3 }

        const next = step({ wollok: { lang: { Object: { m: native } } } })(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['5', '4', '3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['5', '432'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the current operand stack length is < arity + 1', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step } = await mockInterpreterDependencies({ methodLookup: () => method })

        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 2 }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1', '1'], pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const method = Method('m', { parameters: [Parameter('p1'), Parameter('p2')] })(Return(Literal(5))) as MethodNode<'Linked'>
        const { step } = await mockInterpreterDependencies({ methodLookup: () => method })
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 2 }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['2', '2', '2'], pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if the method is native but the native is missing', async () => {
        const method = Method('m', { isNative: true, body: undefined })() as MethodNode<'Linked'>
        const { step } = await mockInterpreterDependencies({ methodLookup: () => method, nativeLookup: () => { throw new Error('') } })
        const instruction: Instruction = { kind: 'CALL', message: 'm', arity: 0 }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
          )
        )).to.throw()
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
        const instruction: Instruction = { kind: 'INIT', arity: 2, lookupStart: 'wollok.lang.Object', initFields: false }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
          })(
            Frame({
              locals: { self: '1', p1: '3', p2: '2' },
              pending: [
                ...compile(environment)(constructor.body),
                { kind: 'LOAD', name: 'self' },
                { kind: 'INTERRUPT', interruption: 'return' },
              ],
            }),
            Frame({ resume: ['return'], pending: [instruction], pc: 1 }),
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

        const instruction: Instruction = { kind: 'INIT', arity: 0, lookupStart: 'X', initFields: true }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'X'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({
            1: RuntimeObject('1', 'X'),
          })(
            Frame({
              locals: { self: '1' },
              pending: [
                { kind: 'LOAD', name: 'self' },
                ...compile(environment)(f1.value),
                { kind: 'SET', name: f1.name },
                { kind: 'LOAD', name: 'self' },
                ...compile(environment)(f2.value),
                { kind: 'SET', name: f2.name },
                { kind: 'LOAD', name: 'self' },
                { arity: 0, initFields: false, kind: 'INIT', lookupStart: 'wollok.lang.Object' },
                ...compile(environment)(constructor.body),
                { kind: 'LOAD', name: 'self' },
                { kind: 'INTERRUPT', interruption: 'return' },
              ],
            }),
            Frame({ resume: ['return'], pending: [instruction], pc: 1 }),
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
        const instruction: Instruction = { kind: 'INIT', arity: 3, lookupStart: 'wollok.lang.Object', initFields: false }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
            2: RuntimeObject('2', 'wollok.lang.Object'),
            3: RuntimeObject('3', 'wollok.lang.Object'),
            4: RuntimeObject('4', 'wollok.lang.Object'),
            5: RuntimeObject('5', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['5', '4', '3', '2', '1'], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
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
              pending: [
                { kind: 'LOAD', name: 'self' },
                ...compile(environment)(constructor.body),
                { kind: 'INTERRUPT', interruption: 'return' },
              ],
            }),
            Frame({ operandStack: ['5'], resume: ['return'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the constructor is not found', async () => {
        const instruction: Instruction = { kind: 'INIT', arity: 2, lookupStart: 'wollok.lang.Object', initFields: true }
        const { step } = await mockInterpreterDependencies({ constructorLookup: () => undefined })

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1', '1', '1'], pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if the current operand stack length is < arity + 1', async () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as any
        const { step } = await mockInterpreterDependencies({ constructorLookup: () => constructor })
        const instruction: Instruction = { kind: 'INIT', arity: 2, lookupStart: 'wollok.lang.Object', initFields: true }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1', '1'], pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if there is no instance with the given id', async () => {
        const constructor = Constructor({ parameters: [Parameter('p1'), Parameter('p2')] })() as any
        const { step } = await mockInterpreterDependencies({ constructorLookup: () => constructor })
        const instruction: Instruction = { kind: 'INIT', arity: 2, lookupStart: 'wollok.lang.Object', initFields: true }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1', '1', '2'], pending: [instruction] }),
          )
        )).to.throw()
      })

    })


    describe('IF_THEN_ELSE', () => {

      it('should pop a boolean from the operand stack and push a frame to evaluate the then clause if it is true', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'IF_THEN_ELSE', then: [{ kind: 'PUSH', id: '5' }], else: [{ kind: 'PUSH', id: '7' }] }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: [TRUE_ID], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ pending: [{ kind: 'PUSH', id: VOID_ID }, ...instruction.then, { kind: 'INTERRUPT', interruption: 'result' }] }),
            Frame({ resume: ['result'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should pop a boolean from the operand stack and push a frame to evaluate the else clause if it is false', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'IF_THEN_ELSE', then: [{ kind: 'PUSH', id: '5' }], else: [{ kind: 'PUSH', id: '7' }] }

        const next = step({})(
          Evaluation({})(
            Frame({ operandStack: [FALSE_ID], pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({ pending: [{ kind: 'PUSH', id: VOID_ID }, ...instruction.else, { kind: 'INTERRUPT', interruption: 'result' }] }),
            Frame({ resume: ['result'], pending: [instruction], pc: 1 }),
          )
        )
      })

      it('should raise an error if the given id does not belong to a boolean', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'IF_THEN_ELSE', then: [], else: [] }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction, instruction, instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'IF_THEN_ELSE', then: [], else: [] }

        expect(() => step({})(
          Evaluation({})(
            Frame({ pending: [instruction, instruction, instruction] }),
          )
        )).to.throw()
      })

    })

    describe('TRY_CATCH_ALWAYS', () => {

      it('should create three nested frames to handle the given try, catch and always instruction sequences', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = {
          kind: 'TRY_CATCH_ALWAYS',
          try: [{ kind: 'PUSH', id: '5' }],
          catch: [{ kind: 'PUSH', id: '7' }],
          always: [{ kind: 'PUSH', id: '9' }],
        }

        const next = step({})(
          Evaluation({})(
            Frame({ pending: [instruction] }),
          )
        )
        next.should.deep.equal(
          Evaluation({})(
            Frame({
              pending: [
                { kind: 'PUSH', id: VOID_ID },
                ...instruction.try,
                { kind: 'INTERRUPT', interruption: 'result' },
              ],
            }),
            Frame({
              resume: ['exception'],
              pending: [
                { kind: 'STORE', name: '<exception>' } as Instruction,
                ...instruction.catch,
                { kind: 'LOAD', name: '<exception>' },
                { kind: 'INTERRUPT', interruption: 'exception' },
              ],
            }),
            Frame({
              resume: ['result', 'return', 'exception'],
              pending: [
                { kind: 'STORE', name: '<previous_interruption>' } as Instruction,
                ...instruction.always,
                { kind: 'LOAD', name: '<previous_interruption>' },
                { kind: 'RESUME_INTERRUPTION' },
              ],
            }),
            Frame({ resume: ['result'], pending: [instruction], pc: 1 }),
          )
        )
      })
    })


    describe('INTERRUPT', () => {

      it('should pop a value and push it on the first frame that resumes the given interruption, dropping the rest', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'INTERRUPT', interruption: 'return' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
            Frame({}),
            Frame({ resume: ['result'] }),
            Frame({ resume: ['return'], operandStack: ['2'] }),
            Frame({ resume: ['return', 'exception'] }),
          )
        )
        next.should.deep.equal(
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
        const instruction: Instruction = { kind: 'INTERRUPT', interruption: 'result' }

        expect(() => step({})(
          Evaluation({})(
            Frame({}),
            Frame({ resume: ['result'], pending: [instruction] }),
          )
        )).to.throw()
      })

      it('should raise an error if no frame resumes the interruption', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'INTERRUPT', interruption: 'result' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ operandStack: ['1'], pending: [instruction] }),
            Frame({ resume: ['exception'] }),
          )
        )).to.throw()
      })

    })


    describe('RESUME_INTERRUPTION', () => {

      it('should pop a value and restart the interruption resumed by the current frame, inferred by the lack of resume flag', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'RESUME_INTERRUPTION' }

        const next = step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ resume: ['result', 'exception'], operandStack: ['1'], pending: [instruction] }),
            Frame({}),
            Frame({ resume: ['result'] }),
            Frame({ resume: ['return'], operandStack: ['2'] }),
            Frame({ resume: ['return', 'exception'] }),
          )
        )
        next.should.deep.equal(
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
        const instruction: Instruction = { kind: 'RESUME_INTERRUPTION' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ resume: ['result'], operandStack: ['1'], pending: [instruction] }),
            Frame({ resume: ['return'] }),
          )
        )).to.throw()
      })

      it('should raise an error if the current operand stack is empty', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'RESUME_INTERRUPTION' }

        expect(() => step({})(
          Evaluation({})(
            Frame({ resume: ['return', 'exception'], pending: [instruction] }),
            Frame({ resume: ['result'] }),
          )
        )).to.throw()
      })

      it('should raise an error if no frame resumes the interruption', async () => {
        const { step } = await mockInterpreterDependencies({})
        const instruction: Instruction = { kind: 'RESUME_INTERRUPTION' }

        expect(() => step({})(
          Evaluation({
            1: RuntimeObject('1', 'wollok.lang.Object'),
          })(
            Frame({ resume: ['return', 'exception'], operandStack: ['1'], pending: [instruction] }),
            Frame({ resume: ['return'] }),
          )
        )).to.throw()
      })

    })

  })

})