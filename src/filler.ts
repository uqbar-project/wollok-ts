import { Filled as FilledBehavior } from './behavior'
import { getter, setter } from './builders'
import { Body, Constructor, Field, Filled, KindOf, Literal, Method, Module, Node, NodeOfKind, Raw, Reference } from './model'
import { transformByKind } from './tools'

const OBJECT_CLASS: Reference<Filled> = {
  kind: 'Reference',
  name: 'wollok.lang.Object',
}

const EXCEPTION_CLASS: Reference<Filled> = {
  kind: 'Reference',
  name: 'wollok.lang.Exception',
}

const NULL: Literal<Filled> = {
  kind: 'Literal',
  value: null,
}

const EMPTY_BODY: Body<Filled> = {
  kind: 'Body',
  sentences: [],
}

const DEFAULT_CONSTRUCTOR: Constructor<Filled> = {
  kind: 'Constructor',
  parameters: [],
  baseCall: { callsSuper: true, args: [] },
  body: EMPTY_BODY,
}


const filledPropertyAccessors = (transformed: Module<Filled>) => {
  const overridesGeter = (field: Field<Filled>) => transformed.methods()
    .some(method => method.name === field.name && method.parameters.length === 0)

  const overridesSeter = (field: Field<Filled>) => transformed.methods()
    .some(method => method.name === field.name && method.parameters.length === 1)

  const propertyFields = transformed.fields().filter(field => field.isProperty)

  const propertyGetters = propertyFields
    .filter(field => !overridesGeter(field))
    .map((field: Field<Filled>) => getter(field.name) as Method<Filled>)

  const propertySetters = propertyFields
    .filter(field => !field.isReadOnly && !overridesSeter(field))
    .map((field: Field<Filled>) => setter(field.name) as Method<Filled>)

  return [...propertyGetters, ...propertySetters]
}

export default <N extends Node<Raw>>(rawNode: N) => FilledBehavior<NodeOfKind<KindOf<N>, Filled>>(
  transformByKind<Raw, Filled>({
    Class: (transformed, node) => ({
      ...transformed,
      superclass: node.name === 'Object' ? null : node.superclass ? transformed.superclass : OBJECT_CLASS,
      members: [
        ...transformed.members.some(member => member.kind === 'Constructor') ? [] : [DEFAULT_CONSTRUCTOR],
        ...transformed.members,
        ...filledPropertyAccessors(transformed),
      ],
    }),

    Mixin: (transformed) => ({
      ...transformed,
      members: [...transformed.members, ...filledPropertyAccessors(transformed)],
    }),

    Singleton: (transformed, node) => ({
      ...transformed,
      superCall: node.superCall ? transformed.superCall : {
        superclass: OBJECT_CLASS,
        args: [],
      },
      members: [...transformed.members, ...filledPropertyAccessors(transformed)],
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
  })(rawNode))