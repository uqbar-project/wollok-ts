import { IDoc, align, append, choice, enclose, intersperse, lineBreak, lineBreaks, hang as nativeHang, indent as nativeIndent, nest as nativeNest, parens, prepend, render, softBreak, softLine } from 'prettier-printer'
import { KEYWORDS, LIST_MODULE, PREFIX_OPERATORS, SET_MODULE } from '../constants'
import { List, isEmpty, match, notEmpty, when } from '../extensions'
import { Assignment, Body, Catch, Class, Describe, Expression, Field, If, Import, Literal, Method, Mixin, Name, NamedArgument, New, Node, Package, Parameter, ParameterizedType, Program, Reference, Return, Self, Send, Sentence, Singleton, Super, Test, Throw, Try, Variable } from '../model'
import { DocTransformer, WS, body, enclosedList, infixOperators, listEnclosers, listed, setEnclosers, stringify } from './utils'

type PrintSettings = {
  maxWidth: number,
  indentation: {
    useSpaces: boolean,
    size: number,
  },
  /**
   * @example `x += 1` abbreviated to `x = x + 1`
   */
  abbreviateAssignments: boolean
}

type PrintContext = {
  indent: DocTransformer,
  nest: DocTransformer,
  hang: DocTransformer,
  abbreviateAssignments: boolean,
}

export default print


function print(node: Node, { maxWidth, indentation, abbreviateAssignments }: PrintSettings): string {
  const indentationCharacters = (indentation.useSpaces ? ' ' : '\t').repeat(indentation.size)
  return render(
    maxWidth,
    format({
      indent: nativeIndent(indentationCharacters),
      nest: nativeNest(indentationCharacters),
      hang: nativeHang(indentationCharacters),
      abbreviateAssignments,
    })(node))
}

// -----------------------
// ----NODE FORMATTERS----
// -----------------------

type Formatter<T extends Node> = (node: T) => IDoc
type FormatterWithContext<T extends Node> = (context: PrintContext) => Formatter<T>
const format: FormatterWithContext<Node> = context => node => {
  return match(node)(
    when(Package)(formatPackage(context)),
    when(Program)(formatProgram(context)),
    when(Assignment)(formatAssignment(context)),
    when(Singleton)(formatSingleton(context)),
    when(Class)(formatClass(context)),
    when(Mixin)(formatMixin(context)),
    when(Method)(formatMethod(context)),
    when(Field)(formatField(context)),
    when(Variable)(formatVariable(context)),
    when(Describe)(formatDescribe(context)),
    when(Test)(formatTest(context)),
    when(Parameter)(formatParameter),
    when(Literal)(formatLiteral(context)),
    when(Body)(formatBody(context)),
    when(Send)(formatSend(context)),
    when(If)(formatIf(context)),
    when(New)(formatNew(context)),
    when(ParameterizedType)(formatParameterizedType(context)),
    when(NamedArgument)(formatNamedArgument(context)),
    when(Return)(formatReturn(context)),
    when(Try)(formatTry(context)),
    when(Catch)(formatCatch(context)),
    when(Throw)(formatThrow(context)),
    when(Reference)(formatReference),
    when(Self)(formatSelf),
    when(Import)(formatImport),
    when(Super)(formatSuper(context)),
  )
}

const formatPackage: FormatterWithContext<Package> = context => node => {
  return [notEmpty(node.imports) ? [intersperse(lineBreak, node.imports.map(format(context))), lineBreaks] : [], intersperse(
    lineBreaks,
    node.members.map(format(context))
  )]
}

const formatImport: Formatter<Import> = node => {
  const wildcard = node.entity.target?.is(Package) ? '.*' : ''

  return [KEYWORDS.IMPORT, WS, node.entity.name, wildcard]
}

const formatProgram: FormatterWithContext<Program> = context => node => intersperse(WS, [KEYWORDS.PROGRAM, node.name, format(context)(node.body)])

const formatMethod: FormatterWithContext<Method> = context => node => {
  const formatWithContext = format(context)
  const signature = [
    node.isOverride ? [KEYWORDS.OVERRIDE, WS] : [],
    KEYWORDS.METHOD,
    WS,
    node.name,
    enclosedList(context.nest)(parens, node.parameters.map(formatWithContext)),
  ]

  if(node.isNative()){
    return [signature, WS, KEYWORDS.NATIVE]
  } else if (node.isAbstract()){
    return signature
  } else if(node.isConcrete()) {
    if(
      node.body.sentences.length === 1 &&
      node.body.sentences[0].is(Return) &&
      node.body.sentences[0].value
    ) {
      return intersperse(WS, [signature, '=', formatWithContext(node.body!.sentences[0].value)])
    }
    else {
      return [signature, WS, formatWithContext(node.body as Body)]
    }
  } else {
    throw Error('Malformed method')
  }
}

const formatBody: (context: PrintContext) => Formatter<Body> = context => node => body(context.nest)(formatSentences(context)(node.sentences))

const formatReturn: FormatterWithContext<Return> = context => node => node.value ?
  [KEYWORDS.RETURN, WS,  format(context)(node.value)]
  : KEYWORDS.RETURN

const formatReference = (node: Reference<Node>) => node.name

const formatField: FormatterWithContext<Field> = context => node => {
  let modifiers: IDoc = [node.isConstant ? KEYWORDS.CONST : KEYWORDS.VAR]
  if(node.isProperty){
    modifiers = append([WS, KEYWORDS.PROPERTY], modifiers)
  }
  return [
    modifiers,
    WS,
    formatAssign(context, true)(node.name, node.value),
  ]
}

const formatVariable: FormatterWithContext<Variable> = context => node => {
  return [
    node.isConstant ? KEYWORDS.CONST : KEYWORDS.VAR,
    WS,
    formatAssign(context)(node.name, node.value),
  ]
}

const formatParameter: Formatter<Parameter> = node => node.name

const formatTest: FormatterWithContext<Test> = context => node => {
  return intersperse(WS, [
    KEYWORDS.TEST,
    node.name,
    body(context.nest)(formatSentences(context)(node.body.sentences)),
  ])
}

const formatDescribe: FormatterWithContext<Describe> = context => node => intersperse(
  WS,
  [KEYWORDS.SUITE, node.name, formatModuleMembers(context)(node.members)]
)


const formatAssignment: FormatterWithContext<Assignment>= context => node =>
  canBeAbbreviated(node) && context.abbreviateAssignments ?
    formatAssign(context)(node.variable.name, node.value.args[0], assignmentOperationByMessage[node.value.message]) :
    formatAssign(context)(node.variable.name, node.value)

const formatSuper: FormatterWithContext<Super> = context => node =>
  [KEYWORDS.SUPER, formatArguments(context)(node.args)]

const formatIf: FormatterWithContext<If> = context => node => {
  const condition = [KEYWORDS.IF, WS, enclose(parens, format(context)(node.condition))]

  if(isInlineBody(node.thenBody) && (node.elseBody.isSynthetic || isInlineBody(node.elseBody))){
    return formatInlineIf(condition)(context)(node)
  }

  const thenBody = body(context.nest)(formatSentences(context)(node.thenBody.sentences))
  const elseBody = !(isEmpty(node.elseBody.sentences) || node.elseBody.isSynthetic) ? body(context.nest)(formatSentences(context)(node.elseBody.sentences)) : undefined
  return [
    condition,
    WS,
    thenBody,
    elseBody ? [WS, KEYWORDS.ELSE, WS, elseBody] : [],
  ]
}

const formatInlineIf: (condition: IDoc) => FormatterWithContext<If> = condition => context => node => choice(
  [
    condition,
    WS,
    format(context)(node.thenBody.sentences[0]),
    notEmpty(node.elseBody.sentences) ? [WS, KEYWORDS.ELSE, WS, format(context)(node.elseBody.sentences[0])] : [],
  ],
  [
    align([
      context.hang([
        condition,
        softLine,
        format(context)(node.thenBody.sentences[0]),
      ]),
      notEmpty(node.elseBody.sentences) ? [
        lineBreak,
        context.hang([KEYWORDS.ELSE, softLine, format(context)(node.elseBody.sentences[0])]),
      ] : [],
    ]),
  ]
)

function isInlineBody(aBody: Body): aBody is Body & { sentences: [Expression] } {
  return aBody.sentences.length === 1 && [Send, Literal, Reference].some(kind => aBody.sentences[0].is(kind))
}

const formatNew: FormatterWithContext<New> = context => node => {
  const args =
    enclosedList(context.nest)(parens, node.args.map(format(context)))
  return [
    KEYWORDS.NEW,
    WS,
    node.instantiated.name,
    args,
  ]
}

const formatThrow: FormatterWithContext<Throw> = context => node => [
  KEYWORDS.THROW,
  WS,
  format(context)(node.exception),
]

const formatTry: FormatterWithContext<Try> = context => node => {
  const formatter = format(context)
  const always = notEmpty(node.always.sentences) ?
    prepend(WS, intersperse(WS, [KEYWORDS.THEN, KEYWORDS.ALWAYS, formatter(node.always)]))
    : []

  return [
    KEYWORDS.TRY,
    WS,
    formatter(node.body),
    node.catches ? [WS, intersperse(WS, node.catches.map(formatter))] : [],
    always,
  ]
}

const formatCatch: FormatterWithContext<Catch> = context => node => {
  const type = prepend(WS, intersperse(WS, [node.parameter.name, ':', format(context)(node.parameterType)]))
  return [
    KEYWORDS.CATCH,
    type,
    WS,
    format(context)(node.body),
  ]
}

const formatLiteral: FormatterWithContext<Literal> = context => node => {
  if(node.isBoolean()){
    return `${node.value}`
  } else if(node.isNumeric()) {
    return node.value.toString() //ToDo presition
  } else if(node.isNull()){
    return KEYWORDS.NULL
  } else if(node.isString()){
    return stringify(`${node.value}`)
  } else if(node.isCollection()){
    const [{ name: moduleName }, elements] = node.value as any
    switch(moduleName){
      case LIST_MODULE:
        return formatCollection(context)(elements as Expression[], listEnclosers)
      case SET_MODULE:
        return formatCollection(context)(elements as Expression[], setEnclosers)
      default:
        throw new Error('Unknown collection type')
    }
  } else {
    throw new Error('Unknown literal type')
  }
}

const formatSelf: Formatter<Self> = (_: Self) => KEYWORDS.SELF

const formatClass: FormatterWithContext<Class> = context => node => {
  let header: IDoc = [
    KEYWORDS.CLASS,
    node.name,
  ]

  if(inherits(node)){
    header = [...header, formatInheritance(context)(node)]
  }

  return intersperse(WS, [...header, formatModuleMembers(context)(node.members)])
}

const formatMixin: FormatterWithContext<Mixin> =context => node => {
  const declaration = [
    KEYWORDS.MIXIN,
    WS,
    node.name,
    notEmpty(node.supertypes) ? [WS, KEYWORDS.INHERITS, WS, intersperse([WS, KEYWORDS.MIXED_AND, WS], node.supertypes.map(format(context)))] : [],
  ]

  return [declaration, WS, formatModuleMembers(context)(node.members)]
}

const formatParameterizedType: FormatterWithContext<ParameterizedType> =
  context => node => [
    node.reference.name,
    notEmpty(node.args) ?
      [WS, enclosedList(context.nest)(parens, node.args.map(format(context)))] :
      [],
  ]

const formatNamedArgument: FormatterWithContext<NamedArgument> =
  context => node => intersperse(WS, [node.name, '=', format(context)(node.value)])

// SINGLETON FORMATTERS

const formatSingleton: FormatterWithContext<Singleton> = context => (node: Singleton) => {
  const formatter = node.isClosure() ?  formatClosure : formatWKO
  return formatter(context)(node)
}

const formatClosure: FormatterWithContext<Singleton> = context => node => {
  const applyMethod = node.members[0] as Method
  const parameters = notEmpty(applyMethod.parameters) ?
    [listed(applyMethod.parameters.map(format(context))), WS, '=>']
    : []

  const sentences = (applyMethod.body! as Body).sentences

  if(sentences.length === 1) {
    // remove 'return' if it's the only sentence
    const sentence = format(context)(sentences[0].is(Return) && sentences[0].value ? sentences[0].value : sentences[0])
    return enclose([['{', WS], [WS, '}']], context.nest([parameters, softLine, sentence]))
  } else {
    return enclose([['{', WS], '}'], [parameters, lineBreak, context.indent(formatSentences(context)(sentences)), lineBreak])
  }
}

const formatWKO: FormatterWithContext<Singleton> = context => node => {
  const members = formatModuleMembers(context)(node.members)
  let formatted: IDoc = [KEYWORDS.WKO]

  if(node.name){
    formatted = [...formatted, node.name]
  }

  if(inherits(node)){
    formatted = [...formatted, formatInheritance(context)(node)]
  }

  return intersperse(WS, [...formatted, members])
}

const inherits = (node: Singleton | Class) => notEmpty(node.supertypes)

const formatInheritance: FormatterWithContext<Singleton | Class> = (context: PrintContext) => node => {
  return intersperse(WS, [
    KEYWORDS.INHERITS,
    listed(node.supertypes.map(format(context))),
  ])
}


// SEND FORMATTERS

const formatSend: FormatterWithContext<Send> = context => node => {
  let formatter: FormatterWithContext<Send>

  if(isInfixOperator(node)) {
    formatter = formatInfixSend
  } else if(
    isPrefixOperator(node)
  ) {
    formatter = formatPrefixSend
  } else {
    formatter = formatDotSend
  }

  return formatter(context)(node)
}

const formatDotSend: FormatterWithContext<Send> = context => node => [
  addParenthesisIfNeeded(context, node.receiver),
  '.',
  node.message,
  formatArguments(context)(node.args),
]

const formatInfixSend: FormatterWithContext<Send> = context => node => {
  return intersperse(WS, [
    addParenthesisIfNeeded(context, node.receiver),
    node.message,
    addParenthesisIfNeeded(context, node.args[0]),
  ])
}

const formatPrefixSend: FormatterWithContext<Send> = context => node => {
  return [prefixOperatorByMessage[node.message], addParenthesisIfNeeded(context, node.receiver)]
}

function addParenthesisIfNeeded(context: PrintContext, expression: Expression): IDoc {
  // ToDo: add more cases where parenthesis aren't needed
  const formatted = format(context)(expression)
  return expression.is(Send) && (isInfixOperator(expression) || isPrefixOperator(expression)) ?
    enclose(parens, formatted) :
    formatted
}


// AUXILIARY FORMATTERS

const formatSentences = (context: PrintContext) => (sentences: List<Sentence>, simplifyLastReturn = false) => sentences.reduce<IDoc>((formatted, sentence, i, sentences) => {
  const shouldShortenReturn = i === sentences.length - 1 && sentence.is(Return) && sentence.value && simplifyLastReturn
  const previousSentence = sentences[i-1]
  return [formatted, formatSentenceInBody(context)(!shouldShortenReturn ? sentence : sentence.value,  previousSentence)]
}, [])

const formatArguments = (context: PrintContext) => (args: List<Expression>): IDoc => enclosedList(context.nest)(parens, args.map(format(context)))

const formatSentenceInBody = (context: PrintContext) => (sentence: Sentence, previousSentence: Sentence | undefined): IDoc => {
  const distanceFromLastSentence = (sentence.sourceMap && (!previousSentence || previousSentence.sourceMap) ?
    previousSentence  ?
      sentence.sourceMap!.start.line - previousSentence.sourceMap!.end.line //difference
      : -1 // first sentence
    : 0 // defaults to 1 line diff
  ) + 1
  return [Array(distanceFromLastSentence).fill(lineBreak), format(context)(sentence)]
}

const formatAssign = (context: PrintContext, ignoreNull = false) => (name: string, value: Expression, assignmentOperator = '=') => [
  name,
  ignoreNull && value.is(Literal) && value.isNull() && value.isSynthetic ?
    [] :
    [
      WS,
      assignmentOperator,
      [softBreak, choice(WS, context.indent([]))],
      format(context)(value),
    ],
]

const formatCollection = (context: PrintContext) => (values: Expression[], enclosers: [IDoc, IDoc]) => {
  return enclosedList(context.nest)(enclosers, values.map(format(context)))
}

const formatModuleMembers = (context: PrintContext) => (members: List<Field | Method | Test>): IDoc => {
  const formatter = format(context)
  const concreteMembers = members.filter(member => !member.isSynthetic)
  const fields = concreteMembers.filter(member => member.is(Field)).map(formatter)
  const others = concreteMembers.filter(member => !member.is(Field)).map(formatter)
  return body(context.nest)([fields.length > 0 ? [intersperse(lineBreak, fields), others.length > 0 ? lineBreaks : []] : [], intersperse(lineBreaks, others)])
}

// assignment operations
const canBeAbbreviated = (node: Assignment): node is Assignment & {value: Send & {message: keyof typeof assignmentOperationByMessage}} => node.value.is(Send) && node.value.receiver.is(Reference) && node.value.receiver.name === node.variable.name && node.value.message in assignmentOperationByMessage

const assignmentOperationByMessage = { '||':'||=', '/':'/=', '-':'-=', '+':'+=', '*':'*=', '&&':'&&=', '%':'%=' } as const

// send utils

/*
 * ToDo: safe way of telling if this is a parser-generated message or a user-defined one
 *  e.g. x.negate() shouldnt be formatted to !x
 */
const isPrefixOperator = (node: Send): boolean =>
  Object.values(PREFIX_OPERATORS).includes(node.message) &&
  isEmpty(node.args)

const isInfixOperator = (node: Send): boolean =>
  infixOperators.includes(node.message) &&
  node.args.length === 1

//ToDo: missing 'not'
const prefixOperatorByMessage: Record<Name, Name> = {
  'negate': '!',
  'invert': '-',
  'plus': '+',
}