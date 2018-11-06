// No unnamed singleton outside Literals
// Name capitalization
// Only one (the last) parameter can be vararg
// No members with the same selector
// No imports of local references
// No asignation of fully qualified references
// No references named as keywords
// No try without catch or always
import { isNil, keys, reject } from 'ramda'
import { Class, Method, Mixin, Node, NodeKind, NodeOfKind, reduce } from './model'

type Code = string
type Level = 'Warning' | 'Error'

export interface Problem {
  readonly code: Code
  readonly level: Level
  readonly node: Node
}

const problem = (level: Level) => <N extends Node>(condition: (node: N) => boolean) => (node: N, code: Code): Problem | null =>
  !condition(node) ? {
    level,
    code,
    node,
  } : null
const warning = problem('Warning')
const error = problem('Error')


const camelcaseName = warning<Mixin | Class>(node =>
  /^[A-Z]$/.test(node.name[0])
)

const onlyLastParameterIsVarArg = error<Method>(node =>
  node.parameters.findIndex(p => p.isVarArg) + 1 === (node.parameters.length)
)

const problemsByKind: { [K in NodeKind]: { [code: string]: (n: NodeOfKind<K>, c: Code) => Problem | null } } = {
  Parameter: {},
  Import: {},
  Body: {},
  Catch: {},
  Package: {},
  Program: {},
  Test: {},
  Class: { camelcaseName },
  Singleton: {},
  Mixin: { camelcaseName },
  Constructor: {},
  Field: {},
  Method: { onlyLastParameterIsVarArg },
  Variable: {},
  Return: {},
  Assignment: {},
  Reference: {},
  Self: {},
  New: {},
  Literal: {},
  Send: {},
  Super: {},
  If: {},
  Throw: {},
  Try: {},
  Environment: {},
}

export default (target: Node): ReadonlyArray<Problem> =>
  reduce<Problem[]>((found, node) => {
    const checks = problemsByKind[node.kind]
    return [
      ...found,
      ...reject(isNil)(keys(checks).map(code =>
        (checks[code] as (n: Node, c: Code) => Problem | null)(node, code))
      ),
    ]
  })([], target)