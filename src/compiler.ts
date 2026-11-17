import { LIST_MODULE, SET_MODULE } from './constants'
import { excludeNullish, match, notEmpty, otherwise, raise, when } from './extensions'
import {
  assertArgumentNotVoid,
  assertNewArgumentNotVoid,
  assertReceiverNotVoid,
  getUninitializedAttributesForInstantiation,
  isInsideGlobalVariable,
  loopInAssignment,
  shortCircuits,
  targetName,
} from './helpers'
import { Execution, ExecutionDefinition, NativeFunction, RuntimeObject, RuntimeValue } from './interpreter/runtimeModel'
import { Class, Expression, Field, Literal, Method, Name, New, Node, Reference, Return, Send } from './model'

export const compile = (method: Method): NativeFunction | undefined => {
  if (method.fromProperty) return compilePropertyMethod(method)
  const literal = constantLiteralReturnedBy(method)
  if (literal) return compileConstantLiteralMethod(literal)
  const expression = returnedExpression(method)
  if (expression) return compileExpression(expression)
  return undefined
}

export const compilePropertyMethod = (method: Method): NativeFunction => {
  const message = method.name
  return method.parameters.length == 0
    ? compileGetter(message)
    : compileSetter(message)
}

const compileGetter = (message: string): NativeFunction => function* (self: RuntimeObject): Execution<RuntimeValue> {
  return self.get(message)
}

const compileSetter = (message: string): NativeFunction => function* (self: RuntimeObject, value: RuntimeObject): Execution<void> {
  self.set(message, value)
}

export type ConstantLiteral = Literal<number | string | boolean | null>

const isConstantLiteral = (node: Expression): node is ConstantLiteral => node.is(Literal) && !node.isCollection()

const returnedExpression = (method: Method): Expression | undefined => {
  if (method.sentences.length !== 1) return undefined
  const [sentence] = method.sentences
  return sentence.is(Return) ? sentence.value : undefined
}

export const constantLiteralReturnedBy = (method: Method): ConstantLiteral | undefined => {
  const returnedValue = returnedExpression(method)
  return returnedValue && isConstantLiteral(returnedValue) ? returnedValue : undefined
}

type CompiledExpression = ExecutionDefinition<RuntimeObject>

export const compileConstantLiteralMethod = (literal: ConstantLiteral): CompiledExpression => function* () {
  this.currentFrame.currentNode = literal
  return yield* this.reify(literal.value)
}

const compileExpression = (node: Expression): CompiledExpression | undefined => match(node)(
  when(New)(compileNew),
  when(Send)(compileSend),
  otherwise(compileOperand),
)

const compileOperand = (node: Expression): CompiledExpression | undefined => {
  if (node.is(Reference)) return compileReference(node)
  return isConstantLiteral(node) ? compileConstantLiteralMethod(node) : undefined
}

const resolveTarget = <N extends Node>(reference: Reference<N>): N | undefined => reference.scope?.resolve<N>(reference.name)

const compileReference = (node: Reference<Node>): CompiledExpression | undefined => {
  const target = resolveTarget(node)
  if (!target || target.is(Field) && loopInAssignment(target.value, target.name)) return undefined

  const name = targetName(target, node.name)
  return function* () {
    this.currentFrame.currentNode = node
    return this.currentFrame.get(name) ?? raise(new Error(`Could not resolve reference to ${node.name}`))
  }
}

const compileSend = (node: Send): CompiledExpression | undefined => {
  const receiver = compileOperand(node.receiver)
  const args = excludeNullish(node.args.map(compileOperand))
  if (!receiver || args.length !== node.args.length) return undefined

  return function* () {
    const receiverValue = yield* receiver.call(this)

    if (shortCircuits(node.message, receiverValue)) return receiverValue

    assertReceiverNotVoid(node, receiverValue)

    const values: RuntimeObject[] = []
    for (const [i, arg] of args.entries()) {
      const value = yield* arg.call(this)
      assertArgumentNotVoid(node, receiverValue, value, i)
      values.push(value)
    }

    return (yield* this.send(node.message, receiverValue, ...values)) ?? (yield* this.reifyVoid())
  }
}

const compileNew = (node: New): CompiledExpression | undefined => {
  const target = resolveTarget(node.instantiated)
  if (!target?.is(Class) || target.isAbstract || [LIST_MODULE, SET_MODULE].includes(target.fullyQualifiedName)) return undefined
  if (isInsideGlobalVariable(node) || notEmpty(getUninitializedAttributesForInstantiation(node))) return undefined

  const values = excludeNullish(node.args.map(arg => compileNewArgument(arg.value)))
  if (values.length !== node.args.length) return undefined

  return function* () {
    const args: Record<Name, RuntimeObject> = {}
    for (const [i, arg] of node.args.entries()) {
      const value = yield* values[i].call(this)
      assertNewArgumentNotVoid(node, arg.name, value)
      args[arg.name] = value
    }

    this.currentFrame.currentNode = node
    return yield* this.instantiate(target, args)
  }
}

const compileNewArgument = (node: Expression): CompiledExpression | undefined => {
  if (!node.is(Send)) return compileOperand(node)
  return compileSend(node) && function* () {
    return yield* this.execNewArgument(node)
  }
}