import { Entity, Environment, Expression, Method, Module, Name, Node } from '../model'
import { Evaluation, Execution, ExecutionDefinition, Natives, RuntimeObject, RuntimeValue, WollokException } from './runtimeModel'


export default (environment: Environment, natives: Natives): Interpreter => new Interpreter(Evaluation.build(environment, natives))


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


  exec(node: Expression): InterpreterResult<this, RuntimeObject>
  exec(node: Node): InterpreterResult<this, void>
  exec(node: Node): InterpreterResult<this, RuntimeObject | void> {
    return this.do(function*() { return yield* this.exec(node) })
  }

  run(programOrTestFQN: Name): InterpreterResult<this, void> {
    return this.exec(this.evaluation.environment.getNodeByFQN<Entity>(programOrTestFQN))
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


export class DirectedInterpreter extends AbstractInterpreter {
  constructor(evaluation: Evaluation) { super(evaluation) }

  fork(): this {
    return new DirectedInterpreter(this.evaluation.copy()) as this
  }

  override do<T>(executionDefinition: ExecutionDefinition<T>): ExecutionDirector<T> {
    return new ExecutionDirector(this.evaluation, executionDefinition) as InterpreterResult<this, T>
  }
}

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