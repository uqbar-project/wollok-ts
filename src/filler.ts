import { getter, setter } from './builders'
import { Node, Body, Catch, Class, Constructor, Field, Filled, If, Kind, Literal, Method, Mixin, Module, NodeOfKind, Raw, Reference, Singleton, Try, Variable } from './model'

const OBJECT_CLASS: Reference<Filled> = new Reference({ name: 'wollok.lang.Object' })

const EXCEPTION_CLASS: Reference<Filled> = new Reference({ name: 'wollok.lang.Exception' })

const NULL: Literal<Filled> = new Literal({ value: null })

const EMPTY_BODY: Body<Filled> = new Body({ sentences: [] })

const DEFAULT_CONSTRUCTOR: Constructor<Filled> = new Constructor({
  parameters: [],
  body: EMPTY_BODY,
  baseCall: { callsSuper: true, args: [] },
})


const filledPropertyAccessors = (node: Module<Filled>) => {
  const overridesGeter = (field: Field<Filled>) => node.methods()
    .some(method => method.name === field.name && method.parameters.length === 0)

  const overridesSeter = (field: Field<Filled>) => node.methods()
    .some(method => method.name === field.name && method.parameters.length === 1)

  const propertyFields = node.fields().filter(field => field.isProperty)

  const propertyGetters = propertyFields
    .filter(field => !overridesGeter(field))
    .map((field: Field<Filled>) => getter(field.name) as Method<Filled>)

  const propertySetters = propertyFields
    .filter(field => !field.isReadOnly && !overridesSeter(field))
    .map((field: Field<Filled>) => setter(field.name) as Method<Filled>)

  return [...propertyGetters, ...propertySetters]
}

export default <K extends Kind>(rawNode: NodeOfKind<K, Raw>): NodeOfKind<K, Filled> => {
  const result = rawNode.transform<Filled>(filledNode => filledNode.match<Node<Filled>>({
    Class: node => new Class({
      ...node,
      superclass: node.name === 'Object' ? null : node.superclass ?? OBJECT_CLASS,
      members: [
        ...node.name === 'Object' ? [DEFAULT_CONSTRUCTOR] : [],
        ...node.members,
        ...filledPropertyAccessors(node),
      ],
    }),

    Mixin: node => new Mixin({
      ...node,
      members: [...node.members, ...filledPropertyAccessors(node)],
    }),

    Singleton: node => new Singleton({
      ...node,
      superCall: node.superCall ?? {
        superclass: OBJECT_CLASS,
        args: [],
      },
      members: [...node.members, ...filledPropertyAccessors(node)],
    }),

    Field: node => new Field({
      ...node,
      value: node.value ?? NULL,
    }),

    Variable: node => new Variable({
      ...node,
      value: node.value ?? NULL,
    }),

    If: node => new If({
      ...node,
      elseBody: node.elseBody ?? EMPTY_BODY,
    }),

    Try: node => new Try<Filled>({
      ...node,
      always: node.always ?? EMPTY_BODY,
    }),

    Catch: node => new Catch({
      ...node,
      parameterType: node.parameterType ?? EXCEPTION_CLASS,
    }),

    Constructor: node => new Constructor({
      ...node,
      baseCall: node.baseCall ?? DEFAULT_CONSTRUCTOR.baseCall,
    }),

    Node: node => node,
  })  )

  return result as NodeOfKind<K, Filled>
}