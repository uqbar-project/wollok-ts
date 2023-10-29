import { Name } from './model'

export const WOLLOK_EXTRA_STACK_TRACE_HEADER = 'Derived from TypeScript stack'

export const WOLLOK_BASE_PACKAGE = 'wollok.'

export const PREFIX_OPERATORS: Record<Name, Name> = {
  '!': 'negate',
  '-': 'invert',
  '+': 'plus',
  'not': 'negate',
}

export const ASSIGNATION_OPERATORS = ['=', '||=', '/=', '-=', '+=', '*=', '&&=', '%=']

export const INFIX_OPERATORS = [
  ['||', 'or'],
  ['&&', 'and'],
  ['===', '==', '!==', '!='],
  ['>=', '>', '<=', '<'],
  ['?:', '>>>', '>>', '>..', '<>', '<=>', '<<<', '<<', '..<', '..', '->'],
  ['-', '+'],
  ['/', '*'],
  ['**', '%'],
]

export const LIST_MODULE= 'wollok.lang.List'
export const SET_MODULE= 'wollok.lang.Set'
export const OBJECT_MODULE= 'wollok.lang.Object'

export const KEYWORDS = {
  IF: 'if',
  ELSE: 'else',
  NEW: 'new',
  SELF: 'self',
  SUPER: 'super',
  NULL: 'null',
  METHOD: 'method',
  VAR: 'var',
  PROPERTY: 'property',
  CONST: 'const',
  OVERRIDE: 'override',
  NATIVE: 'native',
  RETURN: 'return',
  IMPORT: 'import',
  SUITE: 'describe',
  TEST: 'test',
  MIXIN: 'mixin',
  CLASS: 'class',
  INHERITS: 'inherits',
  DERIVED: 'derived',
  MIXED_AND: 'and',
  WKO: 'object',
  FIXTURE: 'fixture',
  PROGRAM: 'program',
  PACKAGE: 'package',

} as const