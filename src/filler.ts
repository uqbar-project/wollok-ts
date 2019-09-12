import { Filled as FilledBehavior } from './behavior'
import { Body as buildBody, Constructor as buildConstructor, getter, Literal as buildLiteral, Reference as buildReference, setter } from './builders'
import { Body, Constructor, Field, Filled, KindOf, Literal, Method, Module, Node, NodeOfKind, Raw, Reference } from './model'

const OBJECT_CLASS: Reference<Filled> = buildReference('wollok.lang.Object') as Reference<Filled>

const EXCEPTION_CLASS: Reference<Filled> = buildReference('wollok.lang.Exception') as Reference<Filled>

const NULL: Literal<Filled> = buildLiteral(null) as Literal<Filled>

const EMPTY_BODY: Body<Filled> = buildBody() as Body<Filled>

const DEFAULT_CONSTRUCTOR: Constructor<Filled> = buildConstructor({
  baseCall: { callsSuper: true, args: [] },
})() as Constructor<Filled>


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
  rawNode.transformByKind<Filled>(
    {
      Class: (transformed) => ({
        ...transformed,
        superclass: transformed.name === 'Object' ? null : transformed.superclass ? transformed.superclass : OBJECT_CLASS,
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

      Singleton: (transformed) => ({
        ...transformed,
        superCall: transformed.superCall ? transformed.superCall : {
          superclass: OBJECT_CLASS,
          args: [],
        },
        members: [...transformed.members, ...filledPropertyAccessors(transformed)],
      }),

      Field: (transformed) => ({
        ...transformed,
        value: transformed.value ? transformed.value : NULL,
      }),

      Constructor: (transformed) => ({
        ...transformed,
        baseCall: transformed.baseCall ? transformed.baseCall : DEFAULT_CONSTRUCTOR.baseCall,
      }),

      Variable: (transformed) => ({
        ...transformed,
        value: transformed.value ? transformed.value : NULL,
      }),

      If: (transformed) => ({
        ...transformed,
        elseBody: transformed.elseBody ? transformed.elseBody : EMPTY_BODY,
      }),

      Try: (transformed) => ({
        ...transformed,
        always: transformed.always ? transformed.always : EMPTY_BODY,
      }),

      Catch: (transformed) => ({
        ...transformed,
        parameterType: transformed.parameterType ? transformed.parameterType : EXCEPTION_CLASS,
      }),

    }
  ) as any
)