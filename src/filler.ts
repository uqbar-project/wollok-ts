import { Body, Catch, Class, Constructor, Expression, If, Literal, Node, Reference, Singleton, Try } from './model'
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

    case 'Class':
      const transformedClass = node as Class<'Complete'>
      return {
        ...transformedClass,
        superclass: node.superclass || OBJECT_CLASS,
        members: node.members.some(member => member.kind === 'Constructor')
          ? transformedClass.members
          : [DEFAULT_CONSTRUCTOR, ...transformedClass.members],
      }

    case 'Singleton':
      const transformedSingleton = node as unknown as Singleton<'Complete'>
      return {
        ...transformedSingleton,
        superCall: node.superCall ? transformedSingleton.superCall : {
          superclass: OBJECT_CLASS,
          args: [],
        },
      }

    case 'Field': return {
      ...node,
      value: node.value as Expression<'Complete'> || NULL,
    }

    case 'Constructor':
      const transformedConstructor = node as unknown as Constructor<'Complete'>
      return {
        ...transformedConstructor,
        baseCall: node.baseCall ? transformedConstructor.baseCall : DEFAULT_CONSTRUCTOR.baseCall,
      }

    case 'Variable': return {
      ...node,
      value: node.value as unknown as Expression<'Complete'> || NULL,
    }

    case 'If':
      const transformedIf = node as unknown as If<'Complete'>
      return {
        ...transformedIf,
        elseBody: node.elseBody as Body<'Complete'> || EMPTY_BODY,
      }

    case 'Try':
      const transformedTry = node as unknown as Try<'Complete'>
      return {
        ...transformedTry,
        always: node.always as Body<'Complete'> || EMPTY_BODY,
      }

    case 'Catch':
      const transformedCatch = node as unknown as Catch<'Complete'>
      return {
        ...transformedCatch,
        parameterType: node.parameterType ? transformedCatch.parameterType : EXCEPTION_CLASS,
      }

    default: return node as Node<'Complete'>
  }
})