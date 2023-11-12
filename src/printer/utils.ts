import { IDoc, IDocArray, append, braces, brackets, choice, dquotes, enclose, intersperse, lineBreak, prepend, softLine } from 'prettier-printer'
import { INFIX_OPERATORS } from '../constants'

export type DocTransformer = (doc: IDoc) => IDoc

export const infixOperators = INFIX_OPERATORS.flat()


type Encloser = [IDoc, IDoc]
export const listEnclosers: Encloser = brackets
export const setEnclosers: Encloser = ['#{', '}']

export const WS = ' ' as IDoc

export const body = (nest: DocTransformer) => (content: IDoc): IDoc => encloseIndented(braces, content, nest)

/**
 * Formats a list of documents to "doc1, doc2, doc3" spreading it over multiple lines when needed
 */
export const listed = (contents: IDoc[], separator: IDoc = ','): IDoc => intersperse([separator, softLine], contents)

export const enclosedList = (nest: DocTransformer) => (enclosers: [IDoc, IDoc], content: IDoc[], forceSpread = false, separator: IDoc = ','): IDoc => {
  if(content.length === 0) return enclose(enclosers, '')
  const narrowFormat = encloseIndented(['', ''], intersperse([separator, lineBreak], content), nest)
  return enclose(
    enclosers,
    forceSpread ? narrowFormat : choice(
      intersperse([separator, WS], content),
      narrowFormat
    )
  )
}

export const encloseIndented = (enclosers: [IDoc, IDoc], content: IDoc, nest: DocTransformer): IDoc =>
  enclose(enclosers, append(lineBreak, nest([lineBreak, content])))

export const stringify = enclose(dquotes)

export const defaultToEmpty = (condition: boolean, doc: IDoc): IDoc => condition ? doc : []

export const prefixIfNotEmpty = (prefix: IDoc) => (docs: IDocArray): IDoc =>
  docs.length === 0 ? prepend(prefix, docs) : docs

export const spaceIfNotEmpty = prefixIfNotEmpty(WS)