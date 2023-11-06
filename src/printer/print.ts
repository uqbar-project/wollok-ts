import { IDoc, append, braces, choice, enclose, intersperse, lineBreak, lineBreaks, indent as nativeIndent, nest as nativeNest, parens, render, softBreak } from 'prettier-printer'
import { KEYWORDS, LIST_MODULE, SET_MODULE } from '../constants'
import { List, match, when } from '../extensions'
import { Assignment, Body, Class, Describe, Expression, Field, If, Import, Literal, Method, Mixin, NamedArgument, New, Node, Package, Parameter, ParameterizedType, Program, Reference, Return, Self, Send, Sentence, Singleton, Test, Variable } from '../model'
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
    when(Reference)(formatReference),
    when(Self)(formatSelf),
    when(Import)(formatImport),
  )
}

const formatPackage: FormatterWithContext<Package> = context => node => {
  return intersperse(lineBreaks, node.children.map(format(context)))
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


const formatIf: FormatterWithContext<If> = context => node => {
  const condition = [KEYWORDS.IF, WS, enclose(parens, format(context)(node.condition))]
  const thenBody = body(context.nest)(formatSentences(context)(node.thenBody.sentences))
  const elseBody = node.elseBody.sentences.length > 0 ? body(context.nest)(formatSentences(context)(node.elseBody.sentences)) : undefined
  return [
    condition,
    WS,
    thenBody,
    elseBody ? [WS, KEYWORDS.ELSE, WS, elseBody] : [],
  ]
}

const formatNew: FormatterWithContext<New> = context => node => {
  const args =
    enclosedList(context.nest)(parens, node.args.map(arg => intersperse(WS, [arg.name, '=', format(context)(arg.value)])))
  return [
    KEYWORDS.NEW,
    WS,
    node.instantiated.name,
    args,
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
    node.supertypes.length > 0 ? [WS, KEYWORDS.INHERITS, WS, intersperse([WS, KEYWORDS.MIXED_AND, WS], node.supertypes.map(format(context)))] : [],
  ]

  return [declaration, WS, formatModuleMembers(context)(node.members)]
}

const formatParameterizedType: FormatterWithContext<ParameterizedType> =
  context => node => [
    node.reference.name,
    node.args.length > 0 ?
      enclosedList(context.nest)(parens, node.args.map(format(context))) :
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
  const parameters = applyMethod.parameters.length > 0 ?
    [WS, listed(applyMethod.parameters.map(format(context))), WS, '=>']
    : []

  const sentences = (applyMethod.body! as Body).sentences

  return sentences.length === 1 ?
    enclose(braces, append(WS, [parameters, WS, format(context)(sentences[0])]))
    : enclose(braces, [parameters, lineBreak, context.indent(formatSentences(context)((applyMethod.body! as Body).sentences)), lineBreak])
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

const inherits = (node: Singleton | Class) => node.supertypes.length > 0

const formatInheritance: FormatterWithContext<Singleton | Class> = (context: PrintContext) => node => {
  return intersperse(WS, [
    KEYWORDS.INHERITS,
    listed(node.supertypes.map(format(context))),
  ])
}


// SEND FORMATTERS

const formatSend: FormatterWithContext<Send> = context => node => {
  return infixOperators.includes(node.message) ?
    formatInfixSend(context)(node)
    : formatDotSend(context)(node)
}

const formatDotSend: FormatterWithContext<Send> = context => node => [
  format(context)(node.receiver),
  '.',
  node.message,
  enclosedList(context.nest)(parens, node.args.map(format(context))),
]

const formatInfixSend: FormatterWithContext<Send> = context => node => {
  function addParenthesisIfNeeded(expression: Expression): IDoc {
    // ToDo: add more cases where parenthesis aren't needed
    const formatted = format(context)(expression)
    return expression.is(Send) && infixOperators.includes(expression.message) ? enclose(parens, formatted) : formatted
  }

  return intersperse(WS, [
    addParenthesisIfNeeded(node.receiver),
    node.message,
    addParenthesisIfNeeded(node.args[0]),
  ])
}

// AUXILIARY FORMATTERS

const formatSentences = (context: PrintContext) => (sentences: List<Sentence>, simplifyLastReturn = false) => sentences.reduce<IDoc>((formatted, sentence, i, sentences) => {
  const shouldShortenReturn = i === sentences.length - 1 && sentence.is(Return) && sentence.value && simplifyLastReturn
  const previousSentence = sentences[i-1]
  return [formatted, formatSentenceInBody(context)(!shouldShortenReturn ? sentence : sentence.value,  previousSentence)]
}, [])

const formatSentenceInBody = (context: PrintContext) => (sentence: Sentence, previousSentence: Sentence | undefined): IDoc => {
  const distanceFromLastSentence = previousSentence ? sentence.sourceMap!.start.line - previousSentence.sourceMap!.end.line : -1
  return [Array(distanceFromLastSentence + 1).fill(lineBreak), format(context)(sentence)]
}

const formatAssign = (context: PrintContext, ignoreNull = false) => (name: string, value: Expression, assignmentOperator = '=') => [
  name,
  // ToDo: diffentiate `var x` from `var x = null`
  ignoreNull && value.is(Literal) && value.isNull() ?
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