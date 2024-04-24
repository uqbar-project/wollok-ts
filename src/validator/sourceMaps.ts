// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// VALIDATION MESSAGES & SOURCE MAPS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { KEYWORDS } from '../constants'
import { List, isEmpty, last, match, when } from '../extensions'
import { CodeContainer, Entity, Field, If, Method, NamedArgument, Node, Parameter, Reference, Return, Send, Sentence, Singleton, SourceIndex, SourceMap, Test, Variable } from '../model'
import { isBooleanLiteral } from '../helpers'

export const buildSourceMap = (node: Node, initialOffset: number, finalOffset: number): SourceMap | undefined =>
  node.sourceMap && new SourceMap({
    start: new SourceIndex({
      ...node.sourceMap.start,
      offset: node.sourceMap.start.offset + initialOffset,
    }),
    end: new SourceIndex({
      ...node.sourceMap.end,
      offset: node.sourceMap.start.offset + finalOffset + initialOffset,
    }),
  })

export const sourceMapForNodeName = (node: Node & { name?: string }): SourceMap | undefined => {
  if (!node.sourceMap) return undefined
  const initialOffset = getOffsetForName(node)
  const finalOffset = node.name?.length ?? 0
  return buildSourceMap(node, initialOffset, finalOffset)
}

export const sourceMapForNodeNameOrFullNode = (node: Node & { name?: string }): SourceMap | undefined =>
  node.name ? sourceMapForNodeName(node) : node.sourceMap

export const sourceMapForOnlyTest = (node: Test): SourceMap | undefined => buildSourceMap(node, 0, KEYWORDS.ONLY.length)

export const sourceMapForOverrideMethod = (node: Method): SourceMap | undefined => buildSourceMap(node, 0, KEYWORDS.OVERRIDE.length)

export const sourceMapForConditionInIf = (node: If): SourceMap | undefined => node.condition.sourceMap

export const sourceMapForSentence = (sentence: Sentence): SourceMap | undefined =>
  sentence.is(Return) ? sentence.value?.sourceMap : sentence.sourceMap

export const sourceMapForSentences = (sentences: List<Sentence>): SourceMap => new SourceMap({
  start: sourceMapForSentence(sentences[0])!.start,
  end: sourceMapForSentence(last(sentences)!)!.end,
})

// const sourceMapForReturnValue = (node: Method) => {
//   if (!node.body || node.body === KEYWORDS.NATIVE || isEmpty(node.body.sentences)) return node.sourceMap
//   const lastSentence = last(node.body.sentences)!
//   if (!lastSentence.is(Return)) return lastSentence.sourceMap
//   return lastSentence.value!.sourceMap
// }

export const sourceMapForBody = (node: CodeContainer): SourceMap | undefined => {
  if (!node.body || node.body === KEYWORDS.NATIVE || isEmpty(node.body.sentences)) return node.sourceMap
  return sourceMapForSentences(node.body.sentences)
}

export const sourceMapForUnreachableCode = (node: If | Send): SourceMap =>
  match(node)(
    when(If)(node => {
      const whichBody = isBooleanLiteral(node.condition, true) ? node.elseBody : node.thenBody
      return sourceMapForSentences(whichBody.sentences)
    }),
    when(Send)(node => new SourceMap({
      start: node.args[0].sourceMap!.start,
      end: node.sourceMap!.end,
    })),
  )

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const getVariableOffset = (node: Variable | Field) => (node.isConstant ? KEYWORDS.CONST.length : KEYWORDS.VAR.length) + 1

const getOffsetForName = (node: Node): number => match(node)(
  when(Parameter)(() => 0),
  when(NamedArgument)(() => 0),
  when(Variable)(node => getVariableOffset(node)),
  when(Field)(node => getVariableOffset(node) + (node.isProperty ? KEYWORDS.PROPERTY.length + 1 : 0)),
  when(Method)(node => (node.isOverride ? KEYWORDS.OVERRIDE.length + 1 : 0) + node.kind.length + 1),
  when(Reference)(node => node.name.length + 1),
  when(Entity)(node => node.is(Singleton) ? KEYWORDS.WKO.length + 1 : node.kind.length + 1),
)