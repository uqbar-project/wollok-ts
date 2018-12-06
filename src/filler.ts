import { BaseCall, Body, Catch, ClassMember, Constructor, Expression, List, Literal, Node, ObjectMember, Parameter, Reference, SuperCall } from './model'
import { transform } from './utils'

const OBJECT_CLASS: Reference<'Complete'> = {
  kind: 'Reference',
  id: undefined,
  name: 'wollok.lang.Object',
  target: undefined,
}

const EXCEPTION_CLASS: Reference<'Complete'> = {
  kind: 'Reference',
  id: undefined,
  name: 'wollok.lang.Exception',
  target: undefined,
}

const NULL: Literal<'Complete'> = {
  kind: 'Literal',
  id: undefined,
  value: null,
}

const EMPTY_BODY: Body<'Complete'> = {
  kind: 'Body',
  id: undefined,
  sentences: [],
}

const DEFAULT_CONSTRUCTOR: Constructor<'Complete'> = {
  kind: 'Constructor',
  id: undefined,
  parameters: [],
  baseCall: { callsSuper: true, args: [] },
  body: EMPTY_BODY,
}

export default transform((node: Node<'Raw'>): Node<'Complete'> => {

  switch (node.kind) {

    case 'Class': return {
      ...node,
      superclass: node.superclass || OBJECT_CLASS,
      members: node.members.some(member => member.kind === 'Constructor')
        ? node.members as List<ClassMember<'Complete'>>
        : [DEFAULT_CONSTRUCTOR, ...node.members as List<ClassMember<'Complete'>>],
    }

    case 'Singleton': return {
      ...node,
      superCall: node.superCall as unknown as SuperCall<'Complete'> || {
        superclass: OBJECT_CLASS,
        args: [],
      },
      members: node.members as List<ObjectMember<'Complete'>>,
    }

    case 'Field': return {
      ...node,
      value: node.value as Expression<'Complete'> || NULL,
    }

    case 'Constructor': return {
      ...node,
      baseCall: node.baseCall as unknown as BaseCall<'Complete'> || DEFAULT_CONSTRUCTOR.baseCall,
      parameters: node.parameters as List<Parameter<'Complete'>>,
      body: node.body as Body<'Complete'>,
    }

    case 'Variable': return {
      ...node,
      value: node.value as unknown as Expression<'Complete'> || NULL,
    }

    case 'If': return {
      ...node,
      elseBody: node.elseBody as Body<'Complete'> || EMPTY_BODY,
      condition: node.condition as Expression<'Complete'>,
      thenBody: node.thenBody as Body<'Complete'>,
    }

    case 'Try': return {
      ...node,
      body: node.body as Body<'Complete'>,
      catches: node.catches as List<Catch<'Complete'>>,
      always: node.always as Body<'Complete'> || EMPTY_BODY,
    }

    case 'Catch': return {
      ...node,
      parameterType: EXCEPTION_CLASS,
      body: node.body as Body<'Complete'>,
      parameter: node.parameter as Parameter<'Complete'>,
    }

    case 'Self': return node

    default: return node as Node<'Complete'>
  }
})