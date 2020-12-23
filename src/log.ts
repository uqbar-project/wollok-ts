import chalk from 'chalk'
import { last } from './extensions'
import { Evaluation, Instruction, RuntimeObject } from './interpreter'
import { Id, Name } from './model'

const columns = (process.stdout && process.stdout.columns) || 80
const { clear: consoleClear, log: consoleLog } = console
const { keys, values } = Object
const { max } = Math
const { yellow, redBright, blueBright, cyan, greenBright, magenta, italic, bold } = chalk

export enum LogLevel {
  NONE,
  ERROR,
  WARN,
  SUCCESS,
  INFO,
  DEBUG,
}

export abstract class Logger {
  protected timers: Record<string, [number, number]> = {}
  protected stepCount = 0

  constructor(level: LogLevel) {
    const operationsByLevel: Record<LogLevel, (keyof Logger)[]> = {
      [LogLevel.NONE]: [],
      [LogLevel.DEBUG]: ['debug', 'step', 'resetStep'],
      [LogLevel.INFO]: ['info', 'start', 'done', 'separator'],
      [LogLevel.SUCCESS]: ['success'],
      [LogLevel.WARN]: ['warn'],
      [LogLevel.ERROR]: ['error', 'clear'],
    }

    for (const logLevel of values(LogLevel)) {
      if (level < Number(logLevel))
        for (const key of operationsByLevel[Number(logLevel) as LogLevel])
          this[key] = () => { }
    }
  }


  start(title: string) {
    this.info(`${title}...`)
    this.timers[title] = process.hrtime()
  }

  done(title: string) {
    const delta = process.hrtime(this.timers[title])
    delete this.timers[title]
    this.info(`Done ${title}. (${(delta[0] * 1e3 + delta[1] / 1e6).toFixed(4)}ms)`)
  }

  resetStep() {
    this.stepCount = 0
  }

  abstract info(...args: any[]): void
  abstract warn(...args: any[]): void
  abstract error(...args: any[]): void
  abstract debug(...args: any[]): void
  abstract success(...args: any[]): void
  abstract separator(title?: string): void
  abstract step(evaluation: Evaluation): void
  abstract clear(): void
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NULL LOGGER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class NullLogger extends Logger {
  constructor() { super(LogLevel.NONE) }

  info() { }
  warn() { }
  error() { }
  debug() { }
  success() { }
  separator() { }
  step() { }
  clear() { }
}

export const nullLogger = new NullLogger()

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONSOLE LOGGER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class ConsoleLogger extends Logger {
  info(...args: any[]) { consoleLog(blueBright.bold('[INFO]: '), ...args) }
  warn(...args: any[]) { consoleLog(yellow.bold('[WARN]: '), ...args) }
  error(...args: any[]) { consoleLog(redBright.bold('[ERROR]:'), ...args) }
  debug(...args: any[]) { consoleLog(cyan.bold('[DEBUG]:'), ...args) }
  success(...args: any[]) { consoleLog(greenBright.bold('[GOOD]: '), ...args) }

  separator(title?: string) {
    consoleLog(greenBright(
      title
        ? bold(`${hr()}\n ${title}\n${hr()}`)
        : `${hr()}`
    ))
  }

  step(evaluation: Evaluation) {
    const { instructions, nextInstructionIndex, operandStack } = evaluation.frameStack.top!
    const instruction = instructions[nextInstructionIndex]

    const stepTabulation = evaluation.frameStack.depth
    let tabulation = '│'.repeat(stepTabulation)

    this.debug(
      `${('0000' + this.stepCount++).slice(-4)}<${evaluation.frameStack.top?.context?.id.slice(24) || '-'.repeat(12)}>: ${tabulation}${stringifyInstruction(evaluation)(instruction)}`,
      `[${[...operandStack.map(operand => stringifyId(evaluation)(operand?.id ?? 'void'))].join(', ')}]`
    )
  }

  clear() { consoleClear() }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════


const hr = (size: number = columns) => '─'.repeat(size)

const stringifyId = (evaluation: Evaluation) => (id: Id): string => {
  let instance: RuntimeObject | undefined
  try {
    instance = evaluation.instance(id)
  } catch (e) {
    // Ignore
  }
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