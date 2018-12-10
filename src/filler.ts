import { Body, Constructor, Literal, Reference } from './model'
import { transformByKind } from './utils'

const OBJECT_CLASS: Reference<'Filled'> = {
  kind: 'Reference',
  id: undefined,
  name: 'wollok.lang.Object',
  target: undefined,
}

const EXCEPTION_CLASS: Reference<'Filled'> = {
  kind: 'Reference',
  id: undefined,
  name: 'wollok.lang.Exception',
  target: undefined,
}

const NULL: Literal<'Filled'> = {
  kind: 'Literal',
  id: undefined,
  value: null,
}

const EMPTY_BODY: Body<'Filled'> = {
  kind: 'Body',
  id: undefined,
  sentences: [],
}

const DEFAULT_CONSTRUCTOR: Constructor<'Filled'> = {
  kind: 'Constructor',
  id: undefined,
  parameters: [],
  baseCall: { callsSuper: true, args: [] },
  body: EMPTY_BODY,
}

export default transformByKind<'Raw', 'Filled'>({
  Class: (transformed, node) => ({
    ...transformed,
    superclass: node.name === 'Object' ? node.superclass : node.superclass ? transformed.superclass : OBJECT_CLASS,
    members: transformed.members.some(member => member.kind === 'Constructor')
      ? transformed.members
      : [DEFAULT_CONSTRUCTOR, ...transformed.members],
  }),

  Singleton: (transformed, node) => ({
    ...transformed,
    superCall: node.superCall ? transformed.superCall : {
      superclass: OBJECT_CLASS,
      args: [],
    },
  }),

  Field: (transformed, node) => ({
    ...transformed,
    value: node.value ? transformed.value : NULL,
  }),

  Constructor: (transformed, node) => ({
    ...transformed,
    baseCall: node.baseCall ? transformed.baseCall : DEFAULT_CONSTRUCTOR.baseCall,
  }),

  Variable: (transformed, node) => ({
    ...transformed,
    value: node.value ? transformed.value : NULL,
  }),

  If: (transformed, node) => ({
    ...transformed,
    elseBody: node.elseBody ? transformed.elseBody : EMPTY_BODY,
  }),

  Try: (transformed, node) => ({
    ...transformed,
    always: node.always ? transformed.always : EMPTY_BODY,
  }),

  Catch: (transformed, node) => ({
    ...transformed,
    parameterType: node.parameterType ? transformed.parameterType : EXCEPTION_CLASS,
  }),
})