import { REPL, WOLLOK_EXTRA_STACK_TRACE_HEADER } from '../constants'
import { isEmpty, last, notEmpty } from '../extensions'
import { isVoid } from '../helpers'
import { linkInNode } from '../linker'
import { Assignment, Class, Entity, Environment, Import, Method, Mixin, Module, Name, Node, Reference, Sentence, Singleton, Variable } from '../model'
import * as parse from '../parser'
import WRENatives from '../wre/wre.natives'
import { Evaluation, Execution, ExecutionDefinition, Frame, Natives, RuntimeObject, RuntimeValue, WollokException } from './runtimeModel'

export const interpret = (environment: Environment, natives: Natives): Interpreter => new Interpreter(Evaluation.build(environment, natives))


// TODO: Replace this with Higher Kinded Types if TS ever implements it...
type InterpreterResult<This, T> = This extends Interpreter ? T : ExecutionDirector<T>


type REPLExpression = Import | Sentence | Singleton | Class | Mixin | Variable | Assignment

abstract class AbstractInterpreter {
  readonly evaluation: Evaluation

  constructor(evaluation: Evaluation) {
    this.evaluation = evaluation
  }

  abstract fork(): this
  abstract do<T>(executionDefinition: ExecutionDefinition<T>): any


  object(fullyQualifiedName: Name): RuntimeObject {
    return this.evaluation.object(fullyQualifiedName)
  }


  exec(node: Sentence): InterpreterResult<this, RuntimeValue>
  exec(node: Node): InterpreterResult<this, void>
  exec(node: Node): InterpreterResult<this, RuntimeValue | void> {
    return this.do(function* () { return yield* this.exec(node) })
  }

  run(programOrTestFQN: Name): InterpreterResult<this, void> {
    return this.exec(this.evaluation.environment.getNodeByFQN<Entity>(programOrTestFQN)) as any // TODO: avoid cast
  }

  send(message: Name, receiver: RuntimeObject, ...args: RuntimeObject[]): InterpreterResult<this, RuntimeValue> {
    return this.do(function* () { return yield* this.send(message, receiver, ...args) })
  }

  invoke(method: Method, receiver: RuntimeObject, ...args: RuntimeObject[]): InterpreterResult<this, RuntimeValue> {
    return this.do(function* () { return yield* this.invoke(method, receiver, ...args) })
  }

  reify(value: boolean | number | string | null): InterpreterResult<this, RuntimeObject> {
    return this.do(function* () { return yield* this.reify(value) })
  }

  list(...value: RuntimeObject[]): InterpreterResult<this, RuntimeObject> {
    return this.do(function* () { return yield* this.list(...value) })
  }

  set(...value: RuntimeObject[]): InterpreterResult<this, RuntimeObject> {
    return this.do(function* () { return yield* this.set(...value) })
  }

  error(moduleOrFQN: Module | Name, locals?: Record<Name, RuntimeObject>, error?: Error): InterpreterResult<this, RuntimeObject> {
    return this.do(function* () { return yield* this.error(moduleOrFQN, locals, error) })
  }

  instantiate(moduleOrFQN: Module | Name, locals: Record<Name, RuntimeObject> = {}): InterpreterResult<this, RuntimeObject> {
    return this.do(function* () { return yield* this.instantiate(moduleOrFQN, locals) })
  }

}

export type ExecutionResult = {
  result: string
  error?: Error
  errored: boolean
}

const failureResult = (message: string, error?: Error): ExecutionResult => ({
  result: message,
  error,
  errored: true,
})

const successResult = (result: string): ExecutionResult => ({
  result,
  errored: false,
})

export const getStackTraceSanitized = (e?: Error): string[] => {
  const indexOfTsStack = e?.stack?.indexOf(WOLLOK_EXTRA_STACK_TRACE_HEADER)
  const fullStack = e?.stack?.slice(0, indexOfTsStack ?? -1) ?? ''

  return fullStack
    .replaceAll('\r', '')
    .replaceAll('\t', '  ')
    .replaceAll('     ', '  ')
    .replaceAll('    ', '  ')
    .split('\n')
    .filter(stackTraceElement => stackTraceElement.trim())
}

export class Interpreter extends AbstractInterpreter {
  constructor(evaluation: Evaluation) { super(evaluation) }

  fork(): this {
    return new Interpreter(this.evaluation.copy()) as this
  }

  override do<T>(executionDefinition: ExecutionDefinition<T>): T {
    const execution = executionDefinition.call(this.evaluation)
    let next = execution.next()
    while (!next.done) next = execution.next()
    return next.value as InterpreterResult<this, T>
  }

}

const addDefinitionToREPL = (newDefinition: Class | Singleton | Mixin, interpreter: Interpreter) => {
  const environment = interpreter.evaluation.environment
  environment.scope.register([REPL, newDefinition])
  if (newDefinition.is(Singleton)) interpreter.evaluation.instantiateSingleton(newDefinition)
}


export function interprete(interpreter: AbstractInterpreter, line: string, frame?: Frame, allowDefinitions = false): ExecutionResult {
  try {
    const parsedLine = parse.MultilineSentence(allowDefinitions).tryParse(line)
    return isEmpty(parsedLine) ? successResult('') : last(parsedLine.map(expression => interpreteExpression(expression as unknown as REPLExpression, interpreter, frame, allowDefinitions)))!
  } catch (error: any) {
    return (
      error.type === 'ParsimmonError' ? failureResult(`Syntax error:\n${error.message.split('\n').filter(notEmpty).slice(1).join('\n')}`) :
      error instanceof WollokException ? failureResult('Evaluation Error!', error) :
      error instanceof parse.ParseError ? failureResult(`Syntax Error at offset ${error.sourceMap.start.offset}: ${line.slice(error.sourceMap.start.offset, error.sourceMap.end.offset)}`) :
      failureResult('Uh-oh... Unexpected TypeScript Error!', error)
    )
  }
}

function interpreteExpression(expression: REPLExpression, interpreter: AbstractInterpreter, frame: Frame | undefined, allowDefinitions = false): ExecutionResult {
  const error = [expression, ...expression.descendants].flatMap(_ => _.problems ?? []).find(_ => _.level === 'error')
  if (error) throw error

  if (expression.is(Import)) {
    const environment = interpreter.evaluation.environment
    if (!environment.getNodeOrUndefinedByFQN(expression.entity.name)) {
      return failureResult(`Unknown reference ${expression.entity.name}`)
    }

    environment.newImportFor(expression)
    return successResult('')
  }

  linkInNode(expression, frame ? frame.node.parentPackage! : interpreter.evaluation.environment.replNode())
  const unlinkedNode = [expression, ...expression.descendants].find(_ => _.is(Reference) && !_.target)

  if (unlinkedNode) {
    if (unlinkedNode.is(Reference)) {
      if (!(frame ?? interpreter.evaluation.currentFrame).get(unlinkedNode.name))
        return failureResult(`Unknown reference ${unlinkedNode.name}`)
    } else return failureResult(`Unknown reference at ${unlinkedNode.sourceInfo}`)
  }

  const result = allowDefinitions && expression.is(Class) || expression.is(Mixin) || expression.is(Singleton) && !expression.isClosure() ?
    addDefinitionToREPL(expression, interpreter) :
    frame ?
      interpreter.do(function () { return interpreter.evaluation.exec(expression, frame) }) :
      interpreter.exec(expression)

  const stringResult = !result || isVoid(result)
    ? ''
    : result.showShortValue(interpreter)
  return successResult(stringResult)
}

export class DirectedInterpreter extends AbstractInterpreter {
  constructor(evaluation: Evaluation) { super(evaluation) }

  fork(): this {
    return new DirectedInterpreter(this.evaluation.copy()) as this
  }

  override do<T>(executionDefinition: ExecutionDefinition<T>): ExecutionDirector<T> {
    return new ExecutionDirector(this.evaluation, executionDefinition) as InterpreterResult<this, T>
  }
}

export const executionFor = (environment: Environment, natives: Natives = WRENatives): DirectedInterpreter =>
  new DirectedInterpreter(Evaluation.build(environment, natives))

// TODO:
// - track history
// - conditional breakpoints?
// - break on exception

export class ExecutionDirector<T> {
  protected readonly evaluation: Evaluation
  protected readonly execution: Execution<T>
  readonly breakpoints: Node[] = []

  constructor(evaluation: Evaluation, execution: ExecutionDefinition<T>) {
    this.evaluation = evaluation
    this.execution = execution.call(evaluation)
  }

  addBreakpoint(breakpoint: Node): void {
    this.breakpoints.push(breakpoint)
  }

  removeBreakpoint(breakpoint: Node): void {
    const nextBreakpoints = this.breakpoints.filter(node => node !== breakpoint)
    this.breakpoints.splice(0, this.breakpoints.length)
    this.breakpoints.push(...nextBreakpoints)
  }

  finish(): ExecutionState<T> & { done: true } {
    let result = this.resume()
    while (!result.done) result = this.resume()
    return result
  }

  resume(shouldHalt: (next: Node, evaluation: Evaluation) => boolean = () => false): ExecutionState<T> {
    try {
      let next = this.execution.next()
      while (!next.done) {
        if (this.breakpoints.includes(next.value) || shouldHalt(next.value, this.evaluation))
          return { done: false, next: next.value }

        next = this.execution.next()
      }
      return { done: true, result: next.value }
    } catch (error) {
      if (error instanceof WollokException) return { done: true, error }
      throw error
    }
  }

  stepIn(): ExecutionState<T> {
    return this.resume(() => true)
  }

  stepOut(): ExecutionState<T> {
    const currentHeight = this.evaluation.frameStack.length
    return this.resume((_, evaluation) => evaluation.frameStack.length < currentHeight)
  }

  stepOver(): ExecutionState<T> {
    const currentHeight = this.evaluation.frameStack.length
    return this.resume((_, evaluation) => evaluation.frameStack.length <= currentHeight)
  }

  stepThrough(): ExecutionState<T> {
    const currentHeight = this.evaluation.frameStack.length
    const currentContext = this.evaluation.currentFrame
    return this.resume((_, evaluation) =>
      evaluation.frameStack.length <= currentHeight ||
      evaluation.currentFrame.contextHierarchy().includes(currentContext)
    )
  }

}

export type ExecutionState<T> = Readonly<
  { done: false, next: Node, error?: undefined } |
  { done: true, error: WollokException } |
  { done: true, result: T, error?: undefined }
>