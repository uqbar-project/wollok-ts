import { IDoc, braces, brackets, choice, dquotes, enclose, intersperse, lineBreak, softLine } from 'prettier-printer'
import { INFIX_OPERATORS } from '../constants'

export type Indent = (doc: IDoc) => IDoc

export const infixOperators = INFIX_OPERATORS.flat()


type Encloser = [IDoc, IDoc]
export const listEnclosers: Encloser = brackets
export const setEnclosers: Encloser = ['#{', '}']

export const WS: IDoc = ' '

export const body = (indent: Indent) => (content: IDoc): IDoc => enclose(braces, [lineBreak, indent([content]), lineBreak])

/**
 * Formats list of strings to "string1, string2, string3" spreading it over multiple lines when needed
 */
export const listed = (contents: IDoc[], separator: IDoc = ','): IDoc => intersperse([separator, softLine], contents)

export const enclosedList = (indent: Indent) => (enclosers: [IDoc, IDoc], content: IDoc[], separator: IDoc = ','): IDoc => {
  return enclose(enclosers)(
    choice(
      listed(content, separator),
      content.length > 0 ? [lineBreak, indent(listed(content, separator)), lineBreak] : []
    )
  )
}

export const stringify = enclose(dquotes)