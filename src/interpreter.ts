import { Class, Environment, Id, Sentence, Singleton } from './model'

interface RuntimeObject {
  readonly id: Id,
  readonly module: Singleton | Class,
  readonly attributes: RuntimeScope,
}

interface RuntimeScope { readonly [name: string]: RuntimeObject }

interface Call {
  readonly scope: RuntimeScope,
  readonly pending: Sentence[],
  readonly referenceStack: ReadonlyArray<RuntimeObject>
}

export interface Evaluation {
  readonly status: 'error' | 'running' | 'success'
  readonly environment: Environment,
  readonly callStack: ReadonlyArray<Call>,
  readonly instances: Map<Id, RuntimeObject>
}

// const step = (evaluation: Evaluation): Evaluation => {
//   const { status, environment, callStack, instances } = evaluation

//   if (status !== 'running') return evaluation

//   const currentSentence = callStack[0].pending[0]


//   if (!callStack[0].pending[0])
// }