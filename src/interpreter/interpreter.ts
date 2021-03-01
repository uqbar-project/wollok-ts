import { Evaluation, Context, RuntimeObject, Frame, LazyInitializer, WollokUnrecoverableError, WollokError } from './runtimeModel'
import { Id, List, Field, Describe } from '../model'
import compile, { STORE, LOAD, RETURN, CALL } from './compiler'


export default function (evaluation: Evaluation): void {
  const { environment } = evaluation

  const currentFrame = evaluation.currentFrame
  if (!currentFrame) throw new Error('Reached end of frame stack')

  const instruction = currentFrame.takeNextInstruction()

  try {
    switch (instruction.kind) {

      case 'LOAD': return (() => {
        const { name } = instruction
        currentFrame.pushOperand(currentFrame.context.get(name))
      })()


      case 'STORE': return (() => {
        const { name, lookup } = instruction
        const value = currentFrame.popOperand()

        const currentContext = currentFrame.context
        let context: Context | undefined = currentContext
        if (lookup) {
          while (context && !context.locals.has(name)) {
            context = context.parentContext
          }
        }

        (context ?? currentContext).set(name, value)
      })()


      case 'PUSH': return (() => {
        const { id } = instruction
        currentFrame.pushOperand(id ? evaluation.instance(id) : undefined)
      })()


      case 'POP': return (() => {
        currentFrame.popOperand()
      })()


      case 'PUSH_CONTEXT': return (() => {
        const { exceptionHandlerIndexDelta } = instruction
        currentFrame.pushContext(exceptionHandlerIndexDelta
          ? currentFrame.nextInstructionIndex + exceptionHandlerIndexDelta
          : undefined
        )
      })()


      case 'POP_CONTEXT': return (() => {
        currentFrame.popContext()
      })()


      case 'SWAP': return (() => {
        const { distance } = instruction
        const a = currentFrame.popOperand()
        const others = new Array(distance).fill(null).map(() => currentFrame.popOperand()).reverse()
        const b = currentFrame.popOperand()

        currentFrame.pushOperand(a)
        others.forEach(operand => currentFrame.pushOperand(operand))
        currentFrame.pushOperand(b)
      })()

      case 'DUP': return (() => {
        const operand = currentFrame.popOperand()
        currentFrame.pushOperand(operand)
        currentFrame.pushOperand(operand)
      })()

      case 'INSTANTIATE': return (() => {
        const { moduleFQN, innerValue } = instruction
        const instance =
            moduleFQN === 'wollok.lang.String' ? RuntimeObject.string(evaluation, `${innerValue}`) :
            moduleFQN === 'wollok.lang.Number' ? RuntimeObject.number(evaluation, Number(innerValue)) :
            moduleFQN === 'wollok.lang.List' ? RuntimeObject.list(evaluation, innerValue as Id[]) :
            moduleFQN === 'wollok.lang.Set' ? RuntimeObject.set(evaluation, innerValue as Id[]) :
            RuntimeObject.object(evaluation, moduleFQN)

        currentFrame.pushOperand(instance)
      })()

      case 'INHERITS': return (() => {
        const { moduleFQN } = instruction
        const self = currentFrame.popOperand()!
        const inherits = self.module.inherits(environment.getNodeByFQN(moduleFQN))
        currentFrame.pushOperand(RuntimeObject.boolean(evaluation, inherits))
      })()

      case 'JUMP': return (() => {
        const { count } = instruction
        currentFrame.jump(count)
      })()

      case 'CONDITIONAL_JUMP': return (() => {
        const { count } = instruction
        const check = currentFrame.popOperand()

        if (check === RuntimeObject.boolean(evaluation, true)) return currentFrame.jump(count)
        if (check !== RuntimeObject.boolean(evaluation, false)) throw new Error(`Non-boolean check ${check}`)
      })()


      case 'CALL': return (() => {
        const { message, arity, lookupStartFQN } = instruction
        const args = Array.from({ length: arity }, () => currentFrame.popOperand()!).reverse()
        const self = currentFrame.popOperand()!
        const method = self.module.lookupMethod(message, arity, lookupStartFQN)

        if (method) evaluation.invoke(method, self, ...args)
        else {
          evaluation.log.warn('Method not found:', lookupStartFQN ?? self.module.fullyQualifiedName(), '>>', message, '/', arity)
          evaluation.invoke(
            'messageNotUnderstood',
            self,
            RuntimeObject.string(evaluation, message),
            RuntimeObject.list(evaluation, args.map(({ id }) => id)),
          )
        }
      })()


      case 'INIT': return (() => {
        const { argumentNames } = instruction
        const self = currentFrame.popOperand()!

        // TODO: Describe is module?
        if(self.module.is('Describe')) {
          const describe = self.module as Describe
          for (const variable of describe.variables()) self.set(variable.name, undefined)

          return evaluation.pushFrame(new Frame(self, [
            ...describe.variables().flatMap(field => [
              ...compile(field.value),
              STORE(field.name, true),
            ]),
            LOAD('self'),
            CALL('initialize', 0),
            LOAD('self'),
            RETURN,
          ]))
        }

        // TODO: add method to do this in the model?
        const fields: List<Field> = self.module.hierarchy().flatMap(module => module.fields())

        for (const field of fields)
          self.set(field.name, undefined)

        for (const name of [...argumentNames].reverse()) {
          if(!fields.some(field => field.name === name))
            throw new Error(`${name} is not a field of ${self.module.fullyQualifiedName}`)
          self.set(name, currentFrame.popOperand())
        }

        if(self.module.is('Singleton')) {

          if(!self.module.name) return evaluation.pushFrame(new Frame(self, [
            ...fields.filter(field => !argumentNames.includes(field.name)).flatMap(field => [
              ...compile(field.value),
              STORE(field.name, true),
            ]),
            LOAD('self'),
            RETURN,
          ]))

          for(const field of fields) {
            const defaultValue = self.module.supertypes.flatMap(supertype => supertype.args).find(arg => arg.name === field.name)
            self.set(field.name, new LazyInitializer(evaluation, self, field.name, compile(defaultValue?.value ?? field.value)))
          }
        } else {
          for(const field of fields)
            if(!argumentNames.includes(field.name))
              self.set(field.name, new LazyInitializer(evaluation, self, field.name, compile(field.value)))
        }

        evaluation.pushFrame(new Frame(self, [
          LOAD('self'),
          CALL('initialize', 0),
          LOAD('self'),
          RETURN,
        ]))
      })()


      case 'INTERRUPT': return (() => {
        const exception = currentFrame.popOperand()!
        evaluation.raise(exception)
      })()


      case 'RETURN': return (() => {
        const value = currentFrame.popOperand()
        evaluation.popFrame()

        const next = evaluation.currentFrame
        if (!next) throw new Error('Returning from last frame')

        next.pushOperand(value)
      })()

    }
  } catch (error) {
    evaluation.log.error(error)

    if(error instanceof WollokUnrecoverableError) throw error

    const exceptionType = error instanceof WollokError ? error.moduleFQN : 'wollok.lang.EvaluationError'
    const message = error.message ? RuntimeObject.string(evaluation, error.message) : undefined
    evaluation.raise(RuntimeObject.object(evaluation, exceptionType, { message }))
  }

}