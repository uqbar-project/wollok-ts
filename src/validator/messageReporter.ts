// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATION MESSAGES DEFINITION
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

import validationMessagesEn from '../../language/src/resources/validationMessagesEN.json'
import validationMessagesEs from '../../language/src/resources/validationMessagesES.json'

type Message = { [key: string]: string }

type Messages = { [key: string]: Message }

const FAILURE = 'failure'

const messages: Messages = {
  en: {
    ...validationMessagesEn,
    [FAILURE]: 'Rule failure: ',
  },
  es: {
    ...validationMessagesEs,
    [FAILURE]: 'La siguiente regla falló: ',
  },
}

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
    const index = match.replace('{', '').replace('}', '') as unknown as number
    return values[index] || ''
  })

const validationI18nized = (customMessages: Messages, lang: LANGUAGES) => customMessages[lang] as Message

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC INTERFACE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export enum LANGUAGES {
  SPANISH = 'es',
  ENGLISH = 'en',
}

export type ReportMessage = {
  message: string,
  values?: string[],
  language?: LANGUAGES,
  customMessages?: Messages,
}

export const getMessage = ({ message, values, language = LANGUAGES.ENGLISH, customMessages = messages }: ReportMessage): string =>
  interpolateValidationMessage(validationI18nized(customMessages, language)[message] || convertToHumanReadable(message, customMessages, language), ...values ?? [])