
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERNAL FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const convertToHumanReadable = (code: string, customMessages: Messages, language: LANGUAGES) => {
  if (!code) {
    return ''
  }
  const result = code.replace(
    /[A-Z0-9]+/g,
    (match) => ' ' + match.toLowerCase()
  )
  return (
    validationI18nized(customMessages, language)[FAILURE] +
    result.charAt(0).toUpperCase() +
    result.slice(1, result.length)
  )
}

const interpolateValidationMessage = (message: string, ...values: string[]) =>
  message.replace(/{\d*}/g, (match: string) => {
    const index = match.replace('{', '').replace('}', '')
    return values[+index] ?? ''
  })

const validationI18nized = (customMessages: Messages, language: LANGUAGES) => customMessages[language] as Message

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC INTERFACE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export enum LANGUAGES {
  SPANISH = 'es',
  ENGLISH = 'en',
}

export type Message = { [key: string]: string }

export type Messages = { [key in LANGUAGES]: Message }

export type ReportMessage = {
  message: string,
  values?: string[],
  language?: LANGUAGES,
  customMessages?: Messages,
}

export const getMessage = ({ message, values, language = LANGUAGES.ENGLISH, customMessages = messages }: ReportMessage): string =>
  interpolateValidationMessage(validationI18nized(customMessages, language)[message] || convertToHumanReadable(message, customMessages, language), ...values ?? [])

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATION MESSAGES DEFINITION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

import validationMessagesEn from './en.json'
import validationMessagesEs from './es.json'

const FAILURE = 'failure'

const messages: Messages = {
  [LANGUAGES.ENGLISH]: {
    ...validationMessagesEn,
    [FAILURE]: 'Rule failure: ',
  },
  [LANGUAGES.SPANISH]: {
    ...validationMessagesEs,
    [FAILURE]: 'La siguiente regla falló: ',
  },
}