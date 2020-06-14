import { v4 as uuid } from 'uuid'
import * as build from './builders'
import { last, mapObject } from './extensions'
import { Context, DECIMAL_PRECISION, Evaluation as EvaluationType, Frame as FrameType, InnerValue, Instruction, Locals, ROOT_CONTEXT_ID, RuntimeObject as RuntimeObjectType, RuntimeObject } from './interpreter'
import { Id, List, Name } from './model'

const { assign } = Object

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNTIME
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const Frame = (obj: Partial<FrameType>): FrameType => {
  const frame = { ...obj } as FrameType

  assign(frame, {

    popOperand(this: FrameType): Id {
      const response = this.operandStack.pop()
      if (!response) throw new RangeError('Popped empty operand stack')
      return response
    },

    pushOperand(this: FrameType, id: Id) {
      this.operandStack.push(id)
    },

  })

  return frame
}

export const Evaluation = (obj: Partial<EvaluationType>): EvaluationType => {
  const evaluation = { ...obj } as EvaluationType

  assign(evaluation, {
    instances: obj.instances,
    frameStack: obj.frameStack!.map(Frame),

    currentFrame(this: EvaluationType): FrameType | undefined {
      return last(this.frameStack)
    },


    instance(this: EvaluationType, id: Id): RuntimeObjectType {
      const response = this.instances[id]
      if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
      return response
    },


    createInstance(this: EvaluationType, moduleFQN: Name, baseInnerValue?: InnerValue, defaultId: Id = uuid()): Id {
      let id: Id
      let innerValue = baseInnerValue

      switch (moduleFQN) {
      case 'wollok.lang.Number':
        if (typeof innerValue !== 'number') throw new TypeError(`Can't create a Number with innerValue ${innerValue}`)
        const stringValue = innerValue.toFixed(DECIMAL_PRECISION)
        id = 'N!' + stringValue
        innerValue = Number(stringValue)
        break

      case 'wollok.lang.String':
        if (typeof innerValue !== 'string') throw new TypeError(`Can't create a String with innerValue ${innerValue}`)
        id = 'S!' + innerValue
        break

      default:
        id = defaultId
      }

      if (!this.instances[id]) this.instances[id] = new RuntimeObject(this, moduleFQN, id, innerValue)

      if (!this.contexts[id]) this.createContext(this.currentFrame()?.context ?? ROOT_CONTEXT_ID, { self: id }, id)

      return id
    },


    context(this: EvaluationType, id: Id): Context {
      const response = this.contexts[id]
      if (!response) throw new RangeError(`Access to undefined context "${id}"`)
      return response
    },

    createContext(this: EvaluationType, parent: Id | null, locals: Locals = {}, id: Id = uuid(), exceptionHandlerIndex?: number): Id {
      this.contexts[id] = {
        id, parent, locals, exceptionHandlerIndex,
      }
      return id
    },


    pushFrame(this: EvaluationType, instructions: List<Instruction>, context: Id) {
      this.frameStack.push(build.Frame({ id: context, context, instructions }))
    },

    raise(this: EvaluationType, exceptionId: Id) {
      let currentContext = this.context(this.currentFrame()?.context ?? ROOT_CONTEXT_ID)
      const exception = this.instance(exceptionId)

      const visited = []

      while (currentContext.exceptionHandlerIndex === undefined) {
        const currentFrame = this.currentFrame()

        if (!currentFrame) throw new Error(`Reached end of stack with unhandled exception ${JSON.stringify(exception)}`)

        if (currentFrame.context === currentFrame.id) {
          this.frameStack.pop()
          if (!this.currentFrame()) throw new Error(`Reached end of stack with unhandled exception ${JSON.stringify(exception)}`)
        } else {
          if (!currentContext.parent) throw new Error(`Reached the root context ${JSON.stringify(currentContext)} before reaching the current frame ${currentFrame.id}. This should not happen!`)
          currentFrame.context = currentContext.parent
        }

        currentContext = this.context(this.currentFrame()!.context)
        visited.push(currentContext)
      }

      if (!currentContext.parent) throw new Error('Popped root context')
      if (!this.currentFrame()) throw new Error(`Reached end of stack with unhandled exception ${JSON.stringify(exception)}`)

      this.currentFrame()!.nextInstruction = currentContext.exceptionHandlerIndex!
      this.currentFrame()!.context = currentContext.parent
      this.context(this.currentFrame()!.context).locals['<exception>'] = exceptionId
    },

    copy(this: EvaluationType): EvaluationType {
      const evaluation = Evaluation({
        ...this,
        contexts: mapObject(context => ({ ...context, locals: { ...context.locals } }), this.contexts),
        frameStack: this.frameStack.map(frame => ({
          ...frame,
          operandStack: [...frame.operandStack],
        })),
      })

      evaluation.instances = mapObject(instance => instance.copy(evaluation), evaluation.instances)

      return evaluation
    },

  })

  return evaluation
}