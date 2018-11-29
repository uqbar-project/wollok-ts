
import { Class, Environment, Import, Method, Mixin, Package, Reference, Try, Variable } from './model'
import { error, warning } from './validator'

import { parentOf } from '../src/utils'

export default (environment: Environment) => ({

  nameIsPascalCase: warning<Mixin | Class>(node =>
    /^[A-Z]$/.test(node.name[0])
  ),

  onlyLastParameterIsVarArg: error<Method>(node =>
    node.parameters.findIndex(p => p.isVarArg) + 1 === (node.parameters.length)
  ),

  nameIsNotKeyword: error<Reference | Method | Variable>(reference => !['.', ',', '(', ')', ';', '_', '{', '}',
    'import', 'package', 'program', 'test', 'mixed with', 'class', 'inherits', 'object', 'mixin',
    'var', 'const', '=', 'override', 'method', 'native', 'constructor',
    'self', 'super', 'new', 'if', 'else', 'return', 'throw', 'try', 'then always', 'catch', ':', '+',
    'null', 'false', 'true', '=>'].includes(reference.name)),

  hasCatchOrAlways: error<Try>(t => t.catches.length !== 0 && t.body.sentences.length !== 0),

  singletonIsNotUnnamed: error<Package>(pack => pack.members.some(
    element => element.kind === 'Singleton' && element.name !== undefined
  )),

  importHasNotLocalReference:

    error<Import>(node => (parentOf(environment)(node) as Package).members.every(({ name }) => name !== node.reference.name)),


})

