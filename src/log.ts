import chalk from 'chalk'
import { last } from './extensions'
import { Evaluation, Instruction, VOID_ID } from './interpreter'
import { Id, Name } from './model'

const columns = (process.stdout && process.stdout.columns) || 80
const { clear, log: writeLine } = console
const { assign, keys } = Object
const { yellow, redBright, blueBright, cyan, greenBright, magenta, italic, bold } = chalk

export enum LogLevel {
  NONE,
  DEBUG,
  INFO,
  SUCCESS,
  WARN,
  ERROR,
}

type Log = (...args: any[]) => void
type Logger = {
  info: Log,
  warn: Log,
  error: Log,
  debug: Log,
  success: Log,
  start: (title: string) => void,
  done: (title: string) => void,
  separator: (title?: string) => void,
  step: (evaluation: Evaluation) => void,
  resetStep: () => void,
  clear: () => void,
}

const timers: { [title: string]: [number, number] } = {}
let stepCount = 0

const logger: Logger = {
  info: () => { },
  warn: () => { },
  error: () => { },
  debug: () => { },
  success: () => { },
  start: () => { },
  done: () => { },
  separator: () => { },
  step: () => { },
  resetStep: () => { },
  clear: () => { },
}

const hr = (size: number = columns) => '─'.repeat(size)

const stringifyId = (evaluation: Evaluation) => (id: Id): string => {
  const instance = id === VOID_ID ? undefined : evaluation.instance(id)
  const module = instance ? stringifyModule(evaluation)(instance.module.fullyQualifiedName()) : ''
  const valueDescription = () => {
    const val = instance && instance.innerValue
    if (val === undefined) return ''
    if (['string', 'boolean', 'number', 'null'].includes(typeof val)) return `(${val})`
    if (val instanceof Array) return `(${val.map(e => typeof e === 'string' ? stringifyId(evaluation)(e) : '?').join(', ')})`
    return ''
  }
  return magenta(id && id.includes('-') ? `${module}#${id.slice(24)}${valueDescription()}` : id)
}

const stringifyModule = (evaluation: Evaluation) => (name: Name): string => {
  const shortName = last(name.split('.'))!
  return shortName.includes('#')
    ? shortName.split('#')[0] + stringifyId(evaluation)(shortName.split('#')[1])
    : shortName
}

const stringifyInstruction = (evaluation: Evaluation) => (instruction: Instruction): string => {
  const args = keys(instruction)
    .filter(key => key !== 'kind')
    .map(key => {
      const value = (instruction as any)[key]
      if (key === 'id') return stringifyId(evaluation)(value)
      if (key === 'module' || key === 'lookupStart') return value ? stringifyModule(evaluation)(value) : '-'
      if (key === 'body' || key.endsWith('Handler')) return '...'
      return `${value}`
    })
    .map(value => italic(value))
  return `${instruction.kind}(${args.join(', ')})`
}

const consoleLogger: Logger = {
  info: (...args) => writeLine(blueBright.bold('[INFO]: '), ...args),

  warn: (...args) => writeLine(yellow.bold('[WARN]: '), ...args),

  error: (...args) => writeLine(redBright.bold('[ERROR]:'), ...args),

  debug: (...args) => writeLine(cyan.bold('[DEBUG]:'), ...args),

  success: (...args) => writeLine(greenBright.bold('[GOOD]: '), ...args),

  separator: title => writeLine(greenBright(title
    ? bold(`${hr()}\n ${title}\n${hr()}`)
    : `${hr()}`)),

  step: evaluation => {
    const { instructions, nextInstruction, operandStack } = evaluation.currentFrame()!
    const instruction = instructions[nextInstruction]

    const stepTabulation = evaluation.stackDepth() - 1

    const tabulationReturn = 0
    // TODO: fix
    // if (instruction.kind === 'INTERRUPT') {
    //   const returns = [...evaluation.frameStack].reverse().findIndex(({ resume }) => resume.includes(instruction.interruption))
    //   tabulationReturn = returns === -1 ? stepTabulation : returns
    // }

    // eslint-disable-next-line no-constant-condition
    const tabulation = false && instruction.kind === 'INTERRUPT'
      ? '│'.repeat(stepTabulation - tabulationReturn) + '└' + '─'.repeat(tabulationReturn - 1)
      : '│'.repeat(stepTabulation)

    consoleLogger.debug(
      `${('0000' + stepCount++).slice(-4)}<${evaluation.currentFrame()?.context?.id.slice(24) || '-'.repeat(12)}>: ${tabulation}${stringifyInstruction(evaluation)(instruction)}`,
      `[${operandStack.map(operand => stringifyId(evaluation)(operand?.id ?? VOID_ID)).join(', ')}]`
    )

  },

  resetStep: () => {
    stepCount = 0
  },

  start: title => {
    consoleLogger.info(`${title}...`)
    timers[title] = process.hrtime()
  },

  done: title => {
    const delta = process.hrtime(timers[title])
    delete timers[title]
    consoleLogger.info(`Done ${title}. (${(delta[0] * 1e3 + delta[1] / 1e6).toFixed(4)}ms)`)
  },

  clear,
}

export const enableLogs = (level: LogLevel = LogLevel.DEBUG): void => {
  if (level === LogLevel.NONE) return

  assign(logger, consoleLogger)

  if (level > LogLevel.DEBUG) assign(logger, { debug: () => { }, step: () => { } })
  if (level > LogLevel.INFO) assign(logger, { info: () => { }, start: () => { }, done: () => { } })
  if (level > LogLevel.SUCCESS) assign(logger, { success: () => { } })
  if (level > LogLevel.WARN) assign(logger, { warn: () => { } })
  if (level > LogLevel.ERROR) assign(logger, { error: () => { } })
}

export default logger