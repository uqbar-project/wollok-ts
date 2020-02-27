import { getter, setter } from './builders'
import { Body, Catch, Class, Constructor, Field, Filled, If, Kind, Literal, Method, Mixin, Module, NodeOfKind, Raw, Reference, Singleton, Try, Variable } from './model'

const OBJECT_CLASS: Reference<Filled> = new Reference({ name: 'wollok.lang.Object' })

const EXCEPTION_CLASS: Reference<Filled> = new Reference({ name: 'wollok.lang.Exception' })

const NULL: Literal<Filled> = new Literal({ value: null })

const EMPTY_BODY: Body<Filled> = new Body({ sentences: [] })

const DEFAULT_CONSTRUCTOR: Constructor<Filled> = new Constructor({
  parameters: [],
  body: EMPTY_BODY,
  baseCall: { callsSuper: true, args: [] },
})


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

export default <K extends Kind>(rawNode: NodeOfKind<K, Raw>): NodeOfKind<K, Filled> => rawNode.transform<K, Filled>({
  Class: (transformed) => new Class({
    ...transformed,
    superclass: transformed.name === 'Object' ? null : transformed.superclass ?? OBJECT_CLASS,
    members: [
      ...transformed.name === 'Object' ? [DEFAULT_CONSTRUCTOR] : [],
      ...transformed.members,
      ...filledPropertyAccessors(transformed),
    ],
  }),

  Mixin: (transformed) => new Mixin({
    ...transformed,
    members: [...transformed.members, ...filledPropertyAccessors(transformed)],
  }),

  Singleton: (transformed) => new Singleton({
    ...transformed,
    superCall: transformed.superCall ?? {
      superclass: OBJECT_CLASS,
      args: [],
    },
    members: [...transformed.members, ...filledPropertyAccessors(transformed)],
  }),

  Field: (transformed) => new Field({
    ...transformed,
    value: transformed.value ?? NULL,
  }),

  Variable: (transformed) => new Variable({
    ...transformed,
    value: transformed.value ?? NULL,
  }),

  If: (transformed) => new If({
    ...transformed,
    elseBody: transformed.elseBody ?? EMPTY_BODY,
  }),

  Try: (transformed) => new Try<Filled>({
    ...transformed,
    always: transformed.always ?? EMPTY_BODY,
  }),

  Catch: (transformed) => new Catch({
    ...transformed,
    parameterType: transformed.parameterType ?? EXCEPTION_CLASS,
  }),

  Constructor: (transformed) => new Constructor({
    ...transformed,
    baseCall: transformed.baseCall ?? DEFAULT_CONSTRUCTOR.baseCall,
  }),

})