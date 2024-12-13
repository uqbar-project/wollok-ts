import { Name } from './model'

// Packages
export const WOLLOK_BASE_PACKAGE = 'wollok.'

// Extensions
export const TEST_FILE_EXTENSION = 'wtest'
export const PROGRAM_FILE_EXTENSION = 'wpgm'
export const WOLLOK_FILE_EXTENSION = 'wlk'

// Module constants
export const COLLECTION_MODULE = 'wollok.lang.Collection'
export const LIST_MODULE = 'wollok.lang.List'
export const SET_MODULE = 'wollok.lang.Set'
export const BOOLEAN_MODULE = 'wollok.lang.Boolean'
export const NUMBER_MODULE = 'wollok.lang.Number'
export const STRING_MODULE = 'wollok.lang.String'
export const DATE_MODULE = 'wollok.lang.Date'
export const PAIR_MODULE = 'wollok.lang.Pair'
export const RANGE_MODULE = 'wollok.lang.Range'
export const DICTIONARY_MODULE = 'wollok.lang.Dictionary'
export const OBJECT_MODULE = 'wollok.lang.Object'
export const EXCEPTION_MODULE = 'wollok.lang.Exception'
export const CLOSURE_MODULE = 'wollok.lang.Closure'
export const VOID_WKO = 'wollok.lang.void'

export const GAME_MODULE = 'wollok.game.game'

// Special methods
export const INITIALIZE_METHOD = 'initialize'
export const TO_STRING_METHOD = 'toString'
export const APPLY_METHOD = 'apply'

// Constants for Closures
export const CLOSURE_EVALUATE_METHOD = '<apply>'
export const CLOSURE_TO_STRING_METHOD = '<toString>'

// Operators
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

// Keywords
export const KEYWORDS = {
  IF: 'if',
  ELSE: 'else',
  NEW: 'new',
  SELF: 'self',
  SUPER: 'super',
  NULL: 'null',
  METHOD: 'method',
  VAR: 'var',
  THROW: 'throw',
  TRY: 'try',
  CATCH: 'catch',
  THEN: 'then',
  ALWAYS: 'always',
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
  ONLY: 'only',
} as const

export const REPL = 'REPL'

export const WOLLOK_EXTRA_STACK_TRACE_HEADER = 'Derived from TypeScript stack'