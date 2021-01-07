import { formatError, Parser } from 'parsimmon'
import { stub } from 'sinon'
import uuid from 'uuid'
import { Environment } from '../src/builders'
import link from '../src/linker'
import { Name, Linked, Node, Package, Reference, List, Environment as EnvironmentType, Id } from '../src/model'
import { Validation } from '../src/validator'
import { ParseError } from '../src/parser'
import globby from 'globby'
import { readFileSync } from 'fs'
import { buildEnvironment as buildEnv, Evaluation, Natives } from '../src'
import { join } from 'path'
import validate from '../src/validator'
import { Frame, RuntimeObject, Instruction, InnerValue, LazyInitializer } from '../src/interpreter'
import { mapObject, last } from '../src/extensions'
import { Logger, nullLogger } from '../src/log'

const { keys } = Object

declare global {
  export namespace Chai {
    interface Assertion {
      also: Assertion
      parsedBy(parser: Parser<any>): Assertion
      into(expected: any): Assertion
      tracedTo(start: number, end: number): Assertion
      recoveringFrom(code: Name, start: number, end: number): Assertion
      linkedInto(expected: List<Package>): Assertion
      filledInto(expected: any): Assertion
      target(node: Node): Assertion
      pass<N extends Node>(validation: Validation<N>): Assertion
      throwException: Assertion
      onCurrentFrame: Assertion
      onBaseFrame: Assertion
      onInstance(instance: InstanceDescription): Assertion
      whenStepped(): Assertion
      pushFrame(frame: FrameDescription): Assertion
      popFrames(count: number): Assertion
      popOperands(count: number): Assertion
      pushOperands(...operands: (InstanceDescription|undefined)[]): Assertion
      popContexts(count: number): Assertion
      pushContexts(...contexts: ContextDescription[]): Assertion
      setLocal(name: Name, value?: InstanceDescription | LazyInitializerDescription): Assertion
      jumpTo(position: number): Assertion
      createInstance(instance: InstanceDescription): Assertion
    }

    interface ArrayAssertion {
      be: Assertion
    }
  }
}

// TODO: Implement this without calling JSON?
const dropKeys = (...keys: string[]) => (obj: any) =>
  JSON.parse(JSON.stringify(obj, (k, v) => keys.includes(k) ? undefined : v))

// TODO: Implement this without calling JSON?
const dropMethods = (target: any) =>
  JSON.parse(JSON.stringify(target, (_, value) => typeof value === 'function' ? '<function>' : value))


// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ALSO
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const also: Chai.ChaiPlugin = ({ Assertion }, { flag }) => {

  Assertion.overwriteMethod('property', base => function (this: Chai.AssertionStatic, ...args: any[]) {
    if (!flag(this, 'objectBeforePropertyChain')) flag(this, 'objectBeforePropertyChain', this._obj)

    base.apply(this, args)
  })


  Assertion.addProperty('also', function () {
    this._obj = flag(this, 'objectBeforePropertyChain')
  })

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PARSER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const parserAssertions: Chai.ChaiPlugin = (chai, utils) => {
  const { Assertion } = chai
  const { flag } = utils

  also(chai, utils)
  chai.config.truncateThreshold = 0

  chai.use(function (_chai, utils) {
    utils.objDisplay = function (obj) { return '!!!' + obj + '!!!' }
  })

  Assertion.addMethod('parsedBy', function (parser: Parser<any>) {
    const result = parser.parse(this._obj)

    this.assert(
      result.status,
      () => formatError(this._obj, result),
      'Expected parser to fail for input #{this}',
      true,
      result.status,
    )

    if (result.status) this._obj = result.value
  })


  Assertion.addMethod('into', function (this: Chai.AssertionStatic, expected: any) {
    const plucked = dropKeys('source', 'problems')
    const expectedProblems = flag(this, 'expectedProblems') ?? []
    const actualProblems = this._obj.problems?.map(({ code, source: { start, end } }: ParseError) => ({ code, start: start.offset, end: end.offset })) ?? []

    new Assertion(expectedProblems).to.deep.contain.all.members(actualProblems, 'Unexpected problem found')
    new Assertion(actualProblems).to.deep.contain.all.members(expectedProblems, 'Expected problem not found')

    new Assertion(plucked(this._obj)).to.deep.equal(plucked(expected))
  })


  Assertion.addMethod('tracedTo', function (start: number, end: number) {
    new Assertion(this._obj)
      .to.have.nested.property('source.start.offset', start).and.also
      .to.have.nested.property('source.end.offset', end)
  })


  Assertion.addMethod('recoveringFrom', function (this: Chai.AssertionStatic, code: Name, start: number, end: number) {
    flag(this, 'expectedProblems', [...flag(this, 'expectedProblems') ?? [], { code, start, end }])
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILLER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const fillerAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('filledInto', function (expected: any) {
    new Assertion(dropMethods(this._obj)).to.deep.equal(dropMethods(expected))
  })

}
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const linkerAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('linkedInto', function (expected: List<Package>) {
    const dropLinkedFields = dropKeys('id', 'scope')
    const actualEnvironment = link(this._obj)
    const expectedEnvironment = Environment(...expected)

    new Assertion(dropLinkedFields(actualEnvironment)).to.deep.equal(dropLinkedFields(expectedEnvironment))
  })


  Assertion.addMethod('target', function (node: Node<Linked>) {
    const reference: Reference<any, Linked> = this._obj

    new Assertion(reference.is('Reference'), `can't check "target" of ${reference.kind} node`).to.be.true
    new Assertion(this._obj.target().id).to.equal(node.id)
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATOR ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const validatorAssertions: Chai.ChaiPlugin = ({ Assertion }) => {

  Assertion.addMethod('pass', function (validation: Validation<Node<Linked>>) {
    const result = validation(this._obj, '')

    this.assert(
      result === null,
      `Expected ${this._obj.kind} to pass validation, but got #{act} instead`,
      `Expected ${this._obj.kind} to not pass validation`,
      null,
      result
    )
  })

}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERPRETER ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const interpreterAssertions: Chai.ChaiPlugin = (chai, utils) => {
  const { Assertion } = chai
  const { flag } = utils

  Assertion.addProperty('throwException', function () {
    flag(this, 'expectedException', true)
  })

  Assertion.addProperty('onCurrentFrame', function () {
    const evaluation: Evaluation = this._obj
    flag(this, 'targetFrameIndex', evaluation.frameStack.depth - 1)
  })

  Assertion.addProperty('onBaseFrame', function () {
    flag(this, 'targetFrameIndex', 0)
  })

  Assertion.addMethod('onInstance', function (instance: InstanceDescription) {
    flag(this, 'targetInstanceId', instance.id)
  })

  Assertion.addMethod('pushFrame', function ({ operands = [], contexts: contextDescriptions, instructions = [] }: FrameDescription) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []

    deltas.push((metric: EvaluationMetrics) => {
      const contexts = contextDescriptions ?? [{ id: `_frame_${metric.frames.length}_ctx_` }]
      metric.frames.push({
        baseContext: last(contexts)!.id,
        currentContext: contexts[0].id,
        instructions,
        operands: operands.map(operand => operand?.id),
        nextInstruction: 0,
      })

      contexts.forEach(({ id, parent, locals = {}, exceptionHandlerIndex }, index) => {
        metric.contexts[id] = {
          id,
          parent: parent?.id ?? (index < contexts.length - 1 ? contexts[index + 1].id : metric.rootContext),
          locals: mapObject(value =>
            isLazy(value)
              ? { instructions: value.instructions, context: value.context.id, local: value.local }
              : value?.id
          , locals),
          exceptionHandlerIndex,
        }
      })
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('popFrames', function (count: number) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []

    deltas.push((metric: EvaluationMetrics) =>  {
      for(let n = 0; n < count; n++) {
        const { currentContext, baseContext } = metric.frames.pop()!
        const contexts = [currentContext]
        while (contexts[0] !== baseContext) {
          contexts.unshift(metric.contexts[contexts[0]].parent)
        }
        contexts.forEach(context => { delete metric.contexts[context] })
      }
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('pushOperands', function (...operandDescriptions: (InstanceDescription|undefined)[]) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number = flag(this, 'targetFrameIndex')
    const operands = operandDescriptions.map(instance => instance?.id).reverse()

    deltas.push((metric: EvaluationMetrics) => {
      metric.frames[frameIndex].operands.push(...operands)
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('popOperands', function (count: number) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number = flag(this, 'targetFrameIndex')

    deltas.push((metric: EvaluationMetrics) => {
      for(let n = 0; n < count; n++) metric.frames[frameIndex].operands.pop()
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('pushContexts', function (...contextDescriptions: ContextDescription[]) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number = flag(this, 'targetFrameIndex')

    deltas.push((metric: EvaluationMetrics) => {
      const currentFrame = metric.frames[frameIndex]
      for(const { id, exceptionHandlerIndex, locals = {}, parent } of contextDescriptions) {
        metric.contexts[id] = {
          id,
          parent: parent?.id ?? currentFrame.currentContext,
          locals: mapObject(value => isLazy(value)
            ? { instructions: value.instructions, context: value.context.id, local: value.local }
            : value?.id
          , locals),
          exceptionHandlerIndex,
        }
        currentFrame.currentContext = id
      }
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('popContexts', function (count: number) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number = flag(this, 'targetFrameIndex')

    deltas.push((metric: EvaluationMetrics) => {
      const currentFrame = metric.frames[frameIndex]

      for(let n = 0; n < count; n++) {
        const currentContext = metric.contexts[currentFrame.currentContext]
        if(!keys(metric.instances).some(id => metric.contexts[id].parent === currentFrame.currentContext))
          delete metric.contexts[currentFrame.currentContext]
        currentFrame.currentContext = currentContext.parent
      }
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('jumpTo', function (position: number) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number = flag(this, 'targetFrameIndex')

    deltas.push((metric: EvaluationMetrics) => {
      metric.frames[frameIndex].nextInstruction = position
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('setLocal', function (name: Name, value?: InstanceDescription | LazyInitializerDescription) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number | undefined = flag(this, 'targetFrameIndex')
    const instanceId: Id = flag(this, 'targetInstanceId')

    deltas.push((metric: EvaluationMetrics) => {
      const contextId = frameIndex !== undefined ? metric.frames[frameIndex].currentContext : instanceId
      metric.contexts[contextId].locals[name] = isLazy(value)
        ? { instructions: value.instructions, context: value.context.id, local: value.local }
        : value?.id
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('createInstance', function ({ id, locals = {}, moduleFQN = 'wollok.lang.Object', innerValue, exceptionHandlerIndex, parent }: InstanceDescription) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []

    deltas.push((metric: EvaluationMetrics) => {
      metric.instances[id] = { id, moduleFQN, innerValue }
      metric.contexts[id] = {
        id,
        parent: parent?.id ?? metric.rootContext,
        locals: mapObject(value => isLazy(value)
          ? { instructions: value.instructions, context: value.context.id, local: value.local }
          : value?.id
        , locals),
        exceptionHandlerIndex,
      }
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('whenStepped', function () {
    const evaluation: Evaluation = this._obj
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []

    if(flag(this, 'expectedException')) new Assertion(() => {
      evaluation.stepInto()
    }).to.throw()

    else {
      const before = evaluationMetrics(evaluation)

      let nextId = 1
      const mock = stub(uuid, 'v4').callsFake(() => `_new_${nextId++}_`)
      try { evaluation.stepInto() }
      finally { mock.restore() }

      const after = evaluationMetrics(evaluation)

      last(before.frames)!.nextInstruction += 1
      deltas.forEach(delta => delta(before))

      new Assertion(after, 'Step produced unexpected differences').to.deep.equal(before)
    }

  })
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// TODO: Have a method that actually converts to JSON in the model

interface EvaluationMetrics {
  instances: Record<Id, {
    id: Id
    moduleFQN: Name
    innerValue?: InnerValue
  }>
  contexts: Record<Id, {
    id: Id,
    parent: Id,
    locals: Record<Name, Id | {local: Name, context: Id, instructions: Instruction[]} | undefined>
    exceptionHandlerIndex?: number
  }>
  rootContext: Id
  frames: {
    baseContext: Id
    currentContext: Id
    instructions: List<Instruction>
    nextInstruction: number
    operands: (Id | undefined)[]
  }[]
}

type MetricsDelta = (metric: EvaluationMetrics) => void


const evaluationMetrics = ({ frameStack, instances, rootContext }: Evaluation): EvaluationMetrics => ({
  frames: [...frameStack].map(({ instructions, operandStack, nextInstructionIndex, baseContext, context }) => ({
    instructions,
    operands: [...operandStack].map(operand => operand && operand.id),
    nextInstruction: nextInstructionIndex,
    baseContext: baseContext.id,
    currentContext: context.id,
  })),
  instances: instances.reduce((instancesById, { id, module, innerValue }) => ({
    ...instancesById, [id]:{
      id,
      innerValue,
      moduleFQN: module?.fullyQualifiedName(),
    },
  }), {}),
  rootContext: rootContext.id,
  contexts: [
    ...instances.flatMap(instance => instance.contextHierarchy()),
    ...[...frameStack].flatMap(frame => frame.context.contextHierarchy()),
  ].reduce((others, { id, locals, parentContext, exceptionHandlerIndex }) => ({
    ...others, [id]: {
      id,
      exceptionHandlerIndex,
      locals: [...locals.entries()].reduce((acum, [key, value]) => ({
        ...acum,
        [key]: value instanceof LazyInitializer
          ? { instructions: value.instructions, context: value.context.id, local: value.local }
          : value?.id,
      }), {}),
      parent: parentContext?.id,
    },
  }), {}),
})

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// DESCRIPTIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface EvaluationDescription {
  environment: EnvironmentType,
  rootContext?: ContextDescription,
  instances?: InstanceDescription[]
  frames?: FrameDescription[]
  natives?: Natives
  log?: Logger
}

interface ContextDescription {
  id: Id
  locals?: Record<Name, InstanceDescription | LazyInitializerDescription | undefined>
  parent?: ContextDescription
  exceptionHandlerIndex?: number
}

interface InstanceDescription extends ContextDescription {
  moduleFQN?: Name
  innerValue?: InnerValue
}

interface LazyInitializerDescription {
  local: Name
  context: ContextDescription
  instructions: Instruction[]
}

interface FrameDescription {
  instructions?: Instruction[]
  nextInstructionIndex?: number
  operands?: (InstanceDescription | undefined)[]
  contexts?: ContextDescription[]
}

const isLazy = (target: any): target is LazyInitializerDescription => !!target?.instructions

export const ctx = (literals: TemplateStringsArray): ContextDescription & { (description: Partial<ContextDescription>): ContextDescription } => {
  const id = literals.join()
  const f = (description: Partial<InstanceDescription>): InstanceDescription => ({ id, ...description })
  f.id = id
  return f
}

export const lazy = (literals: TemplateStringsArray) => (context: ContextDescription, instructions: Instruction[]): LazyInitializerDescription => ({
  local: literals.join(),
  context,
  instructions,
})

export const obj = (literals: TemplateStringsArray): InstanceDescription & { (description: Partial<InstanceDescription>): InstanceDescription } => {
  const id = literals.join()
  const f = (description : Partial<InstanceDescription>): InstanceDescription => ({ id, ...description })
  f.id = id
  return f
}

export const evaluation = ({ environment, rootContext, instances: instanceDescriptions = [], frames:frameDescriptions = [], natives = {}, log = nullLogger }: EvaluationDescription): Evaluation => {
  let evaluation: Evaluation
  const mock = stub(uuid, 'v4').onFirstCall().returns(rootContext?.id ?? 'root')
  try {
    evaluation = Evaluation.create(environment, natives, false)
  } finally { mock.restore() }
  evaluation.popFrame()

  evaluation.log = log

  instanceDescriptions.forEach(({ id, locals = {}, moduleFQN, innerValue }) => {
    const mock = stub(uuid, 'v4').returns(id)
    try {
      if (moduleFQN === 'wollok.lang.Number') RuntimeObject.number(evaluation, innerValue as number)
      else if (moduleFQN === 'wollok.lang.String') RuntimeObject.string(evaluation, innerValue as string)
      else if (moduleFQN === 'wollok.lang.List') RuntimeObject.list(evaluation, innerValue as Id[])
      else {
        const instance = RuntimeObject.object(
          evaluation,
          moduleFQN ?? 'wollok.lang.Object',
          mapObject(value => isLazy(value) ? undefined : value && evaluation.instance(value.id), locals)
        )
        for (const name in locals) {
          const value = locals[name]
          if(isLazy(value)) instance.set(name, new LazyInitializer(evaluation, instance, name, value.instructions))
        }
      }
    }
    finally { mock.restore() }
  });

  [...frameDescriptions].reverse().forEach(({ instructions = [], operands = [], nextInstructionIndex, contexts }, index) => {
    const [baseContext, ...otherContexts] = contexts?.reverse() ?? [{ id: `_frame_${index}_ctx_` }]
    const locals = baseContext.locals ?? {}
    const parentContext = baseContext.parent
      ? [...evaluation.frameStack]
        .flatMap(frame => frame.context.contextHierarchy())
        .find(({ id }) => baseContext.parent!.id === id)
        ?? evaluation.instance(baseContext.parent.id)
      : evaluation.rootContext

    let frame: Frame
    const mock = stub(uuid, 'v4').callsFake(() => baseContext.id)
    try {
      frame = new Frame(
        parentContext,
        instructions,
        new Map(keys(locals).map(key => [key, locals[key] && evaluation.instance((locals[key] as InstanceDescription).id)])),
      )
    }
    finally { mock.restore() }

    if(nextInstructionIndex !== undefined) {
      frame.jumpTo(nextInstructionIndex)
    }

    [...operands].reverse().forEach(operand =>
      frame.pushOperand(operand && evaluation.instance(operand.id))
    )

    for (const { id, exceptionHandlerIndex, locals = {} } of otherContexts) {
      const mock = stub(uuid, 'v4').callsFake(() => id)
      try { frame.pushContext(exceptionHandlerIndex) }
      finally { mock.restore() }

      for (const key of keys(locals)) frame.context.set(key, evaluation.instance((locals[key] as InstanceDescription).id))
    }

    evaluation.pushFrame(frame)
  })

  return evaluation
}


// TODO: check if needed
export const buildEnvironment = (pattern: string, cwd: string): EnvironmentType => {
  const { time, timeEnd, log } = console

  time('Parsing files')
  const files = globby.sync(pattern, { cwd }).map(name => ({ name, content: readFileSync(join(cwd, name), 'utf8') }))
  timeEnd('Parsing files')


  time('Building environment')
  const environment = buildEnv(files)
  timeEnd('Building environment')

  const problems = validate(environment)
  if (problems.length) throw new Error(`Found ${problems.length} problems building the environment!: ${problems.map(({ code, node }) => JSON.stringify({ code, source: node.source })).join('\n')}`)
  else log('No problems found building the environment!')

  return environment
}