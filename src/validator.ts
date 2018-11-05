// No unnamed singleton at top level
// Name capitalization
// Only one (the last) parameter can be vararg
// No members with the same selector
// No imports of local references
// No asignation of fully qualified references
// No references named as keywords
// No try without catch or always
import { Node, Parameter, reduce } from './model'


// agrego el enum porque no me reconocía el level cuando lo ponía como 'Warning'  | 'Error
export const enum level { warning, error }
const isUpperCase = (s: string) => /^[A-Z]$/.test(s)
const findFirstVararg = (parameter: Parameter) => parameter.isVarArg

export interface Problem {
  readonly code: string
  readonly level: level
  readonly node: Node
}

export default (node: Node): ReadonlyArray<Problem> =>

  // tslint:disable-next-line:no-shadowed-variable
  reduce<Problem[]>((problems, node) => {
    switch (node.kind) {
      case 'Class':
        const isNonUpperCase = isUpperCase(node.name[0]) ? [] : [{
          code: 'notUppercase',
          level: level.warning,
          node,
        }]
        return [...problems, ...isNonUpperCase]

      case 'Method':
        // tslint:disable-next-line:triple-equals
        const lastParameterVararg = node.parameters.findIndex(findFirstVararg) + 1 == (node.parameters.length) ? [] : [{
          code: 'notVarargAsLastParameter',
          level: level.error,
          node,
        }]
        return [...problems, ...lastParameterVararg]

      default:
        return problems
    }
  })([], node)