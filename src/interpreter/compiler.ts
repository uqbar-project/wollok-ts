import { is, Node, Body, Expression, Id, List, Name, NamedArgument } from '../model'
import { InnerValue } from './runtimeModel'

export const NULL_ID = 'null'
export const TRUE_ID = 'true'
export const FALSE_ID = 'false'

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INSTRUCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export type Instruction
  = { kind: 'LOAD', name: Name }
  | { kind: 'STORE', name: Name, lookup: boolean }
  | { kind: 'PUSH', id?: Id }
  | { kind: 'POP' }
  | { kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta?: number }
  | { kind: 'POP_CONTEXT' }
  | { kind: 'SWAP', distance: number }
  | { kind: 'DUP' }
  | { kind: 'INSTANTIATE', moduleFQN: Name, innerValue?: InnerValue }
  | { kind: 'INHERITS', moduleFQN: Name }
  | { kind: 'JUMP', count: number }
  | { kind: 'CONDITIONAL_JUMP', count: number }
  | { kind: 'CALL', message: Name, arity: number, lookupStartFQN?: Name }
  | { kind: 'INIT', argumentNames: List<Name> }
  | { kind: 'INTERRUPT' }
  | { kind: 'RETURN' }

export const LOAD = (name: Name): Instruction => ({ kind: 'LOAD', name })
export const STORE = (name: Name, lookup: boolean): Instruction => ({ kind: 'STORE', name, lookup })
export const PUSH = (id?: Id): Instruction => ({ kind: 'PUSH', id })
export const POP: Instruction = { kind: 'POP' }
export const PUSH_CONTEXT = (exceptionHandlerIndexDelta?: number): Instruction => ({ kind: 'PUSH_CONTEXT', exceptionHandlerIndexDelta })
export const POP_CONTEXT: Instruction = { kind: 'POP_CONTEXT' }
export const SWAP = (distance = 0): Instruction => ({ kind: 'SWAP', distance })
export const DUP: Instruction = { kind: 'DUP' }
export const INSTANTIATE = (module: Name, innerValue?: InnerValue): Instruction => ({ kind: 'INSTANTIATE', moduleFQN: module, innerValue })
export const INHERITS = (module: Name): Instruction => ({ kind: 'INHERITS', moduleFQN: module })
export const JUMP = (count: number): Instruction => ({ kind: 'JUMP', count })
export const CONDITIONAL_JUMP = (count: number): Instruction => ({ kind: 'CONDITIONAL_JUMP', count })
export const CALL = (message: Name, arity: number, lookupStartFQN?: Name): Instruction => ({ kind: 'CALL', message, arity, lookupStartFQN })
export const INIT = (argumentNames: List<Name>): Instruction => ({ kind: 'INIT', argumentNames })
export const INTERRUPT: Instruction = { kind: 'INTERRUPT' }
export const RETURN: Instruction = { kind: 'RETURN' }

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMPILER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const compile = (node: Node): List<Instruction> => {

  const compileExpressionClause = ({ sentences }: Body): List<Instruction> =>
    sentences.length ? sentences.flatMap((sentence, index) => [
      ...compile(sentence),
      ...index < sentences.length - 1 ? [POP] : [],
    ]) : [PUSH()]

  return node.match({

    Variable: node => [
      ...compile(node.value),
      STORE(node.name, false),
      PUSH(),
    ],


    Return: node => [
      ...node.value
        ? compile(node.value)
        : [PUSH()],
      RETURN,
    ],


    Assignment: node => node.variable.target()?.isReadOnly
      ? [
        INSTANTIATE('wollok.lang.EvaluationError'),
        INIT([]),
        INTERRUPT,
      ]
      : [
        ...compile(node.value),
        STORE(node.variable.name, true),
        PUSH(),
      ],

    Self: () => [
      LOAD('self'),
    ],


    Reference: node => {
      const target = node.target()!

      return [
        LOAD(target.is('Module') || target.is('Variable') && target.parent().is('Package')
          ? target.fullyQualifiedName()
          : node.name
        ),
      ]
    },


    Literal: node => {
      if (node.value === null) return [
        PUSH(NULL_ID),
      ]

      if (typeof node.value === 'boolean') return [
        PUSH(node.value ? TRUE_ID : FALSE_ID),
      ]

      if (typeof node.value === 'number') return [
        INSTANTIATE('wollok.lang.Number', node.value),
      ]

      if (typeof node.value === 'string') return [
        INSTANTIATE('wollok.lang.String', node.value),
      ]

      if (node.value.is('Singleton')) {
        if (node.value.supercallArgs.some(is('NamedArgument'))) {
          const supercallArgs = node.value.supercallArgs as List<NamedArgument>
          return [
            ...supercallArgs.flatMap(({ value }) => compile(value)),
            INSTANTIATE(node.value.fullyQualifiedName()),
            INIT(supercallArgs.map(({ name }) => name)),
          ]
        } else {
          const supercallArgs = node.value.supercallArgs as List<Expression>
          return [
            ...supercallArgs.flatMap(arg => compile(arg)),
            INSTANTIATE(node.value.fullyQualifiedName()),
            INIT([]),
          ]
        }
      }

      const args = node.value.args as List<Expression>
      return [
        INSTANTIATE(node.value.instantiated.name, []),
        INIT([]),
        ...args.flatMap(arg => [
          DUP,
          ...compile(arg),
          CALL('add', 1),
          POP,
        ]),
      ]
    },


    Send: node => [
      ...compile(node.receiver),
      ...node.args.flatMap(arg => compile(arg)),
      CALL(node.message, node.args.length),
    ],


    Super: node => {
      const currentMethod = node.ancestors().find(is('Method'))!
      return [
        LOAD('self'),
        ...node.args.flatMap(arg => compile(arg)),
        CALL(currentMethod.name, node.args.length, currentMethod.parent().fullyQualifiedName()),
      ]
    },


    New: node => {
      const fqn = node.instantiated.target()!.fullyQualifiedName()

      if ((node.args as any[]).some(arg => arg.is('NamedArgument'))) {
        const args = node.args as List<NamedArgument>

        return [
          ...args.flatMap(({ value }) => compile(value)),
          INSTANTIATE(fqn),
          INIT(args.map(({ name }) => name)),
        ]
      } else {
        return [
          ...(node.args as List<Expression>).flatMap(arg => compile(arg)),
          INSTANTIATE(fqn),
          INIT([]),
        ]
      }
    },


    If: node => {
      const thenClause = compileExpressionClause(node.thenBody)
      const elseClause = compileExpressionClause(node.elseBody)
      return [
        ...compile(node.condition),
        PUSH_CONTEXT(),
        CONDITIONAL_JUMP(elseClause.length + 1),
        ...elseClause,
        JUMP(thenClause.length),
        ...thenClause,
        POP_CONTEXT,
      ]
    },


    Throw: node => [
      ...compile(node.exception),
      INTERRUPT,
    ],


    Try: node => {
      const clause = compileExpressionClause(node.body)

      const always = [
        ...compileExpressionClause(node.always),
        POP,
      ]

      const catches = node.catches.flatMap(({ parameter, parameterType, body }) => {
        const handler = compileExpressionClause(body)
        return [
          LOAD('<exception>'),
          INHERITS(parameterType.target()!.fullyQualifiedName()),
          CALL('negate', 0),
          CONDITIONAL_JUMP(handler.length + 5),
          LOAD('<exception>'),
          STORE(parameter.name, false),
          ...handler,
          STORE('<result>', true),
          PUSH(FALSE_ID),
          STORE('<exception>', true),
        ]
      })

      return [
        PUSH_CONTEXT(),
        PUSH(FALSE_ID),
        STORE('<exception>', false),
        PUSH(),
        STORE('<result>', false),

        PUSH_CONTEXT(clause.length + 3),
        ...clause,
        STORE('<result>', true),
        POP_CONTEXT,
        JUMP(catches.length + 3),

        STORE('<exception>', false),
        PUSH_CONTEXT(catches.length + 1),
        ...catches,
        POP_CONTEXT,

        PUSH_CONTEXT(),
        ...always,
        POP_CONTEXT,
        LOAD('<exception>'),
        INHERITS('wollok.lang.Exception'),
        CALL('negate', 0),
        CONDITIONAL_JUMP(2),
        LOAD('<exception>'),
        INTERRUPT,
        LOAD('<result>'),

        POP_CONTEXT,
      ]
    },


    Method: node => {
      if (!node.body) throw new Error(`Can't compile abstract method ${node.name}`)
      if (node.body === 'native') throw new Error(`Can't compile native method ${node.name}`)
      return [
        ...compile(node.body),
        PUSH(),
        RETURN,
      ]
    },

    Program: node => compile(node.body),

    Test: node => compile(node.body),

    Fixture: node => compile(node.body),

    Body: node => node.sentences.flatMap(compile),

    Node: () => { throw new Error(`Can't compile ${node.kind} node`) },
  })
}

export default compile