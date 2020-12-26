import { formatError, Parser } from 'parsimmon'
import { ImportMock } from 'ts-mock-imports'
import uuid from 'uuid'
import { Environment } from '../src/builders'
import link from '../src/linker'
import { Name, Linked, Node, Package, Reference, List, Environment as EnvironmentType, Id, Expression } from '../src/model'
import { Validation } from '../src/validator'
import { ParseError } from '../src/parser'
import globby from 'globby'
import { readFileSync } from 'fs'
import { buildEnvironment as buildEnv, Evaluation, Natives } from '../src'
import { join } from 'path'
import validate from '../src/validator'
import { Frame, RuntimeObject, Instruction } from '../src/interpreter'
import { mapObject, last } from '../src/extensions'

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
      onCurrentFrame: Assertion
      onInstance(instance: InstanceDescription): Assertion
      whenStepped(): Assertion
      pushFrames(...frames: FrameDescription[]): Assertion
      popOperands(count: number): Assertion
      pushOperands(...operands: (InstanceDescription|undefined)[]): Assertion
      setLocal(name: Name, value?: InstanceDescription): Assertion
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

  Assertion.addProperty('onCurrentFrame', function () {
    const evaluation: Evaluation = this._obj
    flag(this, 'targetFrameIndex', [...evaluation.frameStack].indexOf(evaluation.frameStack.top!))
  })

  Assertion.addMethod('onInstance', function (instance: InstanceDescription) {
    flag(this, 'targetInstanceId', instance.id)
  })

  Assertion.addMethod('pushFrames', function (...frameDescriptions: FrameDescription[]) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []

    deltas.push((metric: EvaluationMetrics) => {
      metric.frames.push(...frameDescriptions.map(({ operands = [], locals = {}, instructions = [] }) => ({
        instructions,
        operands: operands.map(operand => operand?.id),
        locals: mapObject(value => value?.id, locals),
        nextInstruction: 0,
      })))
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('pushOperands', function (...operandDescriptions: (InstanceDescription|undefined)[]) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number = flag(this, 'targetFrameIndex')
    const operands = operandDescriptions.map(instance => instance?.id)

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

  Assertion.addMethod('setLocal', function (name: Name, operandDescription?: InstanceDescription) {
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []
    const frameIndex: number | undefined = flag(this, 'targetFrameIndex')
    const instanceId: Id = flag(this, 'targetInstanceId')

    deltas.push((metric: EvaluationMetrics) => {
      const locals = frameIndex !== undefined
        ? metric.frames[frameIndex].locals
        : metric.instances.find(instance => instance.id === instanceId)!.locals
      locals[name] = operandDescription?.id
    })

    flag(this, 'deltas', deltas)
  })

  Assertion.addMethod('whenStepped', function () {
    const evaluation: Evaluation = this._obj
    const deltas: MetricsDelta[] = flag(this, 'deltas') ?? []

    const before = evaluationMetrics(evaluation)

    evaluation.step()

    const after = evaluationMetrics(evaluation)

    last(before.frames)!.nextInstruction += 1
    deltas.forEach(delta => delta(before))

    new Assertion(after, 'Step produced unexpected differences').to.deep.equal(before)
  })
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// METRICS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface EvaluationMetrics {
  instances: InstanceMetrics[]
  frames: FrameMetrics[]
}

interface InstanceMetrics {
  id: Id
  locals: Record<Name, Id | undefined>
  lazyInitializer?: Expression
}

interface FrameMetrics {
  instructions: List<Instruction>
  operands: (Id | undefined)[]
  locals: Record<Name, Id | undefined>
  nextInstruction: number
}

type MetricsDelta = (metric: EvaluationMetrics) => void

const evaluationMetrics = (target: Evaluation): EvaluationMetrics => ({
  instances: target.instances.map(instance => instanceMetrics(instance)),
  frames: [...target.frameStack].map(frameMetrics),
})

const  instanceMetrics = (target: RuntimeObject): InstanceMetrics => ({
  id: target.id,
  locals: [...target.locals.entries()].reduce((acum, [key, value]) => ({ ...acum, [key]: value?.id }), {}),
  lazyInitializer: target.lazyInitializer,
})

const  frameMetrics = (target: Frame): FrameMetrics => ({
  instructions: target.instructions,
  operands: [...target.operandStack].map(operand => operand && operand.id),
  locals: [...target.context.locals.entries()].reduce((acum, [key, value]) => ({ ...acum, [key]: value?.id }), {}),
  nextInstruction: target.nextInstructionIndex,
})

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// DESCRIPTIONS
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface EvaluationDescription {
  instances?: InstanceDescription[]
  frames?: FrameDescription[]
  natives?: Natives
}

interface InstanceDescription {
  id: Id
  locals?: Record<Name, InstanceDescription | undefined>
  lazyInitializer?: Expression
}

interface FrameDescription {
  instructions?: Instruction[]
  locals?: Record<Name, InstanceDescription | undefined>
  operands?: (InstanceDescription | undefined)[]
  parentContext?: InstanceDescription
}

export const obj = (literals: TemplateStringsArray): InstanceDescription & { (args: Partial<InstanceDescription>): InstanceDescription } => {
  const id = literals.join()
  const f = ({ locals = {}, lazyInitializer }: Partial<InstanceDescription>) => ({ id, locals, lazyInitializer })
  f.id = id
  return f
}

export const testEvaluation = (environment: EnvironmentType) => ({ instances: instanceDescriptions = [], frames:frameDescriptions = [], natives = {} }: EvaluationDescription): Evaluation => {
  const extraInstances = [obj`__xi1__`, obj`__xi2__`]

  const evaluation = Evaluation.create(environment, natives, false);

  [...instanceDescriptions, ...extraInstances].forEach(({ id, locals = {}, lazyInitializer }) => {
    const stub = ImportMock.mockFunction(uuid, 'v4').callsFake(() => id)
    try {
      if(lazyInitializer) RuntimeObject.lazy(evaluation, lazyInitializer)
      else RuntimeObject.object(evaluation, 'wollok.lang.Object', mapObject(instance => instance && evaluation.instance(instance.id), locals))
    }
    finally { stub.restore() }
  })

  const frames = frameDescriptions.map(({ instructions = [], locals = {}, operands = [], parentContext }) => {
    const frame = new Frame(
      parentContext ? evaluation.instance(parentContext.id) : evaluation.rootContext,
      instructions,
      new Map(keys(locals).map(key => [key, locals[key] === undefined ? undefined : evaluation.instance(locals[key]!.id)])),
    )

    frame.operandStack.push(...operands.map(operand => operand && evaluation.instance(operand.id)).reverse())

    return frame
  })

  evaluation.frameStack.push(...frames.reverse())

  evaluation.instances.forEach(instance => {
    instance.set('__xr1__', evaluation.instance('__xi1__'))
    instance.set('__xr2__', evaluation.instance('__xi2__'))
  })

  frames.forEach(frame => {
    frame.context.set('__xr1__', evaluation.instance('__xi1__'))
    frame.context.set('__xr2__', evaluation.instance('__xi2__'))
    frame.operandStack.unshift(evaluation.instance('__xi1__'))
    frame.operandStack.unshift(evaluation.instance('__xi2__'))
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