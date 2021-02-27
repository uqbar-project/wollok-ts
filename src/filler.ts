import { getter, setter } from './builders'
import { Node, Body, Catch, Class, Constructor, Field, If, Kind, Literal, Method, Mixin, Module, NodeOfKind, Reference, Singleton, Try, Variable } from './model'

const OBJECT_CLASS: Reference<'Class'> = new Reference({ name: 'wollok.lang.Object' })

const EXCEPTION_CLASS: Reference<'Class'> = new Reference({ name: 'wollok.lang.Exception' })

const NULL: Literal = new Literal({ value: null })

const EMPTY_BODY: Body = new Body({ sentences: [] })

const DEFAULT_CONSTRUCTOR: Constructor = new Constructor({
  parameters: [],
  body: EMPTY_BODY,
  baseCall: { callsSuper: true, args: [] },
})


const filledPropertyAccessors = (node: Module) => {
  const overridesGeter = (field: Field) => node.methods()
    .some(method => method.name === field.name && method.parameters.length === 0)

  const overridesSeter = (field: Field) => node.methods()
    .some(method => method.name === field.name && method.parameters.length === 1)

  const propertyFields = node.fields().filter(field => field.isProperty)

  const propertyGetters = propertyFields
    .filter(field => !overridesGeter(field))
    .map((field: Field) => getter(field.name) as Method)

  const propertySetters = propertyFields
    .filter(field => !field.isReadOnly && !overridesSeter(field))
    .map((field: Field) => setter(field.name) as Method)

  return [...propertyGetters, ...propertySetters]
}

// TODO: So... Here's an idea: How about we make a type for the "transitioning" states so
// the non-node fields would be on S-1, but the children would be on S+1 ?

export default <K extends Kind>(rawNode: NodeOfKind<K>): NodeOfKind<K> => {
  const result = rawNode.transform(filledNode => filledNode.match<Node>({
    Class: node => new Class({
      ...node,
      superclassRef: node.name === 'Object' ? null : node.superclassRef ?? OBJECT_CLASS,
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
      superclassRef: node.superclassRef ?? OBJECT_CLASS,
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

    Try: node => new Try({
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
  }))

  return result as NodeOfKind<K>
}