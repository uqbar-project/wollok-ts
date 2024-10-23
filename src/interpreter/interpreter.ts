import { linkSentenceInNode } from '../linker'
import { Entity, Environment, Import, Method, Module, Name, Node, Reference, Sentence } from '../model'
import WRENatives from '../wre/wre.natives'
import { Evaluation, Execution, ExecutionDefinition, Natives, RuntimeObject, RuntimeValue, WollokException } from './runtimeModel'
import * as parse from '../parser'
import { notEmpty } from '../extensions'
import { WOLLOK_EXTRA_STACK_TRACE_HEADER } from '../constants'

export const interpret = (environment: Environment, natives: Natives): Interpreter => new Interpreter(Evaluation.build(environment, natives))


// TODO: Replace this with Higher Kinded Types if TS ever implements it...
type InterpreterResult<This, T> = This extends Interpreter ? T : ExecutionDirector<T>


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
    return this.do(function*() { return yield* this.exec(node) })
  }

  run(programOrTestFQN: Name): InterpreterResult<this, void> {
    return this.exec(this.evaluation.environment.getNodeByFQN<Entity>(programOrTestFQN)) as any // TODO: avoid cast
  }

  send(message: Name, receiver: RuntimeObject, ...args: RuntimeObject[]): InterpreterResult<this, RuntimeValue> {
    return this.do(function*() { return yield* this.send(message, receiver, ...args) })
  }

  invoke(method: Method, receiver: RuntimeObject, ...args: RuntimeObject[]): InterpreterResult<this, RuntimeValue> {
    return this.do(function*() { return yield* this.invoke(method, receiver, ...args) })
  }

  reify(value: boolean | number | string | null): InterpreterResult<this, RuntimeObject> {
    return this.do(function*() { return yield* this.reify(value) })
  }

  list(...value: RuntimeObject[]): InterpreterResult<this, RuntimeObject> {
    return this.do(function*() { return yield* this.list(...value) })
  }

  set(...value: RuntimeObject[]): InterpreterResult<this, RuntimeObject> {
    return this.do(function*() { return yield* this.set(...value) })
  }

  error(moduleOrFQN: Module | Name, locals?: Record<Name, RuntimeObject>, error?: Error): InterpreterResult<this, RuntimeObject> {
    return this.do(function*() { return yield* this.error(moduleOrFQN, locals, error) })
  }

  instantiate(moduleOrFQN: Module | Name, locals: Record<Name, RuntimeObject> = {}): InterpreterResult<this, RuntimeObject> {
    return this.do(function*() { return yield* this.instantiate(moduleOrFQN, locals) })
  }

}

export type ExecutionResult = {
  result: string;
  error?: Error;
  errored: boolean;
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
    while(!next.done) next = execution.next()
    return next.value as InterpreterResult<this, T>
  }

}

export function interprete(interpreter: Interpreter, line: string): ExecutionResult {
  try {
    const sentenceOrImport = parse.Import.or(parse.Variable).or(parse.Assignment).or(parse.Expression).tryParse(line)
    const error = [sentenceOrImport, ...sentenceOrImport.descendants].flatMap(_ => _.problems ?? []).find(_ => _.level === 'error')
    if (error) throw error

    if (sentenceOrImport.is(Sentence)) {
      const environment = interpreter.evaluation.environment
      linkSentenceInNode(sentenceOrImport, environment.replNode())
      const unlinkedNode = [sentenceOrImport, ...sentenceOrImport.descendants].find(_ => _.is(Reference) && !_.target)

      if (unlinkedNode) {
        if (unlinkedNode.is(Reference)) {
          if (!interpreter.evaluation.currentFrame.get(unlinkedNode.name))
            return failureResult(`Unknown reference ${unlinkedNode.name}`)
        } else return failureResult(`Unknown reference at ${unlinkedNode.sourceInfo}`)
      }

      const result = interpreter.exec(sentenceOrImport)
      const stringResult = result
        ? result.showShortValue(interpreter)
        : ''
      return successResult(stringResult)
    }

    if (sentenceOrImport.is(Import)) {
      const environment = interpreter.evaluation.environment
      if (!environment.getNodeOrUndefinedByFQN(sentenceOrImport.entity.name)) {
        throw new Error(
          `Unknown reference ${sentenceOrImport.entity.name}`
        )
      }

      environment.newImportFor(sentenceOrImport)
      return successResult('')
    }

    return successResult('')
  } catch (error: any) {
    return (
      error.type === 'ParsimmonError' ? failureResult(`Syntax error:\n${error.message.split('\n').filter(notEmpty).slice(1).join('\n')}`) :
      error instanceof WollokException ? failureResult('Evaluation Error!', error) :
      error instanceof parse.ParseError ? failureResult(`Syntax Error at offset ${error.sourceMap.start.offset}: ${line.slice(error.sourceMap.start.offset, error.sourceMap.end.offset)}`) :
      failureResult('Uh-oh... Unexpected TypeScript Error!', error)
    )
  }
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

export const executionFor = (environment: Environment): DirectedInterpreter =>
  new DirectedInterpreter(Evaluation.build(environment, WRENatives))

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

  finish(): ExecutionState<T> & {done: true} {
    let result = this.resume()
    while(!result.done) result = this.resume()
    return result
  }

  resume(shouldHalt: (next: Node, evaluation: Evaluation) => boolean = () => false): ExecutionState<T> {
    try {
      let next = this.execution.next()
      while(!next.done) {
        if(this.breakpoints.includes(next.value) || shouldHalt(next.value, this.evaluation))
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