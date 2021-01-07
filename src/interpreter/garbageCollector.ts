import { Evaluation, LazyInitializer, RuntimeObject, Context } from './runtimeModel'
import { List, Id } from '../model'
import { Instruction } from './compiler'

const { isArray } = Array


// TODO: Add some unit tests.
export default function (evaluation: Evaluation): void {
  const extractIdsFromInstructions = (instructions: List<Instruction>): List<Id> => {
    return instructions.flatMap(instruction => {
      if (instruction.kind === 'PUSH') return instruction.id ? [] : [instruction.id!]
      return []
    })
  }

  const marked = new Set<Context>()
  const pending: (Context | LazyInitializer | undefined)[] = [
    evaluation.rootContext,
    ...[...evaluation.frameStack].flatMap(({ operandStack, context, instructions }) => [
      context,
      ...operandStack,
      ...extractIdsFromInstructions(instructions).map(id => evaluation.instance(id)),
    ]),
  ]

  while (pending.length) {
    const next = pending.shift()
    if (next && !(next instanceof LazyInitializer) && !marked.has(next)) {
      marked.add(next)

      pending.push(
        ...next.parentContext ? [next.parentContext] : [],
        ...next.locals.values(),
      )

      if (next instanceof RuntimeObject && isArray(next?.innerValue)) pending.push(...next!.innerValue.map(id => evaluation.instance(id)))
    }
  }

  for (const instance of evaluation.instances)
    if (!marked.has(instance)) {
      evaluation.freeInstance(instance.id)
    }
}