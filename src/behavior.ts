import { getOrUpdate, NODE_CACHE, PARENT_CACHE, update } from './cache'
import { flatMap, mapObject } from './extensions'
import { Class, Constructor, Describe, Entity, Environment, Filled as FilledStage, Id, is, isEntity, isModule, isNode, Kind, Linked as LinkedStage, List, Method, Module, Name, Node, Raw as RawStage, Reference, Singleton, Stage } from './model'

const { isArray } = Array
const { values, assign } = Object

// TODO: Test all behaviors

export const Raw = <N extends Node<RawStage>>(obj: Partial<N>): N => {
  const node = { ...obj } as N

  assign(node, {

    children<T extends Node<RawStage>>(this: Node<RawStage>): List<T> {
      const extractChildren = (owner: any): List<T> => {
        if (isNode(owner)) return [owner as T]
        if (isArray(owner)) return flatMap(extractChildren)(owner)
        if (owner instanceof Object) return flatMap(extractChildren)(values(owner))
        return []
      }

      const extractedChildren = flatMap(extractChildren)(values(this))
      extractedChildren.forEach(child => child.id && update(PARENT_CACHE, child.id!, this.id))
      return extractedChildren
    },

    descendants<T extends Node<RawStage>>(this: Node<RawStage>, filter?: (node: Node<RawStage>) => node is T): List<T> {
      const directDescendants = this.children<Node<RawStage>>()
      const indirectDescendants = flatMap<Node<RawStage>>(child => child.descendants(filter))(directDescendants)
      const descendants = [...directDescendants, ...indirectDescendants]
      return filter ? descendants.filter(filter) : descendants as any
    },

    transform<R extends Stage>(this: Node<RawStage>, tx: (node: Node<RawStage>) => Node<RawStage>): Node<R> {
      const applyTransform = (value: any): any =>
        typeof value === 'function' ? value :
          isNode<RawStage>(value) ? mapObject(applyTransform, tx(value) as any) :
            isArray(value) ? value.map(applyTransform) :
              value instanceof Object ? mapObject(applyTransform, value) :
                value

      return applyTransform(this)
    },

    // TODO: Extract applyTransform into single propagate function
    // TODO: Or join transform and transformByKind in the same method
    transformByKind<R extends Stage>(
      this: Node<RawStage>,
      tx: { [K in Kind]?: (afterChildPropagation: Node<R>, beforeChildPropagation: Node<RawStage>) => Node<R> },
    ): Node<R> {
      const applyTransform = (value: any): any =>
        typeof value === 'function' ? value :
          isNode<RawStage>(value) ? (tx[value.kind] || ((n: any) => n) as any)(mapObject(applyTransform, value as any), value) :
            isArray(value) ? value.map(applyTransform) :
              value instanceof Object ? mapObject(applyTransform, value) :
                value

      return applyTransform(this)
    },

    reduce<T>(this: Node<RawStage>, tx: (acum: T, node: Node<RawStage>) => T, initial: T): T {
      return this.children().reduce((acum, child) => child.reduce(tx, acum), tx(initial, node))
    },

  })

  if (isModule(node)) assign(node, {
    methods(this: Module<RawStage>) { return this.members.filter(is('Method')) },
    fields(this: Module<RawStage>) { return this.members.filter(is('Field')) },
  })

  if (is('Class')(node)) assign(node, {
    constructors(this: Class<RawStage>) { return this.members.filter(is('Constructor')) },
  })

  if (is('Describe')(node)) assign(node, {
    tests(this: Describe<RawStage>) { return this.members.filter(is('Test')) },
  })

  return node
}

export const Filled = <N extends Node<FilledStage>>(obj: Partial<N>): N => {
  const node = Raw(obj) as N

  return node
}

export const Linked = (environmentData: Partial<Environment>) => {
  const environment: Environment = assign(Filled(environmentData as any), {

    getNodeById<T extends Node<LinkedStage>>(this: Environment, id: Id): T {
      return getOrUpdate(NODE_CACHE, id)(() => {
        const search = (obj: any): Node<LinkedStage> | undefined => {
          if (isArray(obj)) {
            for (const value of obj) {
              const found = search(value)
              if (found) return found
            }
          } else if (obj instanceof Object) {
            if (isNode<LinkedStage>(obj) && obj.id === id) return obj
            return search(values(obj))
          }
          return undefined
        }

        const response = search(environment)
        if (!response) throw new Error(`Missing node ${id}`)
        return response
      }) as T
    },

    getNodeByFQN<N extends Entity<LinkedStage>>(fullyQualifiedName: string): N {
      return fullyQualifiedName.startsWith('#') // TODO: It would be nice to make this the superclass FQN # id
        ? environment.getNodeById(fullyQualifiedName.slice(1))
        : fullyQualifiedName.split('.').reduce((current: Entity<LinkedStage> | Environment, step) => {
          const children = current.children()
          const next = children.find((child): child is Entity<LinkedStage> => isEntity(child) && child.name === step)
          if (!next) throw new Error(
            `Could not resolve reference to ${fullyQualifiedName}: Missing child ${step} among ${children.map((c: any) => c.name)}`
          )
          return next
        }, environment) as N
    },

  }) as any


  const baseBehavior = {
    environment(this: Node<LinkedStage>) { return environment },

    parent<T extends Node<LinkedStage>>(this: Node<LinkedStage>): T {
      return this.environment().getNodeById(getOrUpdate(PARENT_CACHE, this.id)(() => {
        const parent = [this.environment(), ...this.environment().descendants()].find(descendant =>
          descendant.children().some(({ id }) => id === this.id)
        )
        if (!parent) throw new Error(`Node ${JSON.stringify(this)} is not part of the environment`)

        return parent.id
      }))
    },


    closestAncestor<N extends Node<LinkedStage>>(this: Node<LinkedStage>, filter: (obj: any) => obj is N): N | undefined {
      let parent: Node<LinkedStage>
      try {
        parent = this.parent()
      } catch (_) { return undefined }

      return filter(parent) ? parent : parent.closestAncestor(filter)
    },
  }

  return assign(environment, baseBehavior, {
    members: environment.transform(n => {

      const node: Node<LinkedStage> = assign(Filled(n as any), baseBehavior) as any

      if (isEntity(node)) assign(node, {
        fullyQualifiedName(this: Entity<LinkedStage>): Name {
          const parent = this.parent()
          return isEntity(parent)
            ? `${parent.fullyQualifiedName()}.${this.name}`
            : this.name || `#${this.id}`
        },
      })

      if (isModule(node)) assign(node, {

        hierarchy(this: Module<LinkedStage>): List<Module<LinkedStage>> {
          const hierarchyExcluding = (module: Module<LinkedStage>, exclude: List<Id> = []): List<Module<LinkedStage>> => {
            if (exclude.includes(module.id)) return []
            return [
              ...module.mixins.map(mixin => mixin.target<Module<LinkedStage>>()),
              ...module.kind === 'Mixin' ? [] : module.superclassNode() ? [module.superclassNode()!] : [],
            ].reduce(({ mods, exs }, mod) => (
              { mods: [...mods, ...hierarchyExcluding(mod, exs)], exs: [mod.id, ...exs] }
            ), { mods: [module], exs: [module.id, ...exclude] }).mods
          }

          return hierarchyExcluding(this)
        },

        inherits(this: Module<LinkedStage>, other: Module<LinkedStage>): boolean {
          return this.hierarchy().some(({ id }) => other.id === id)
        },

        lookupMethod(this: Module<LinkedStage>, name: Name, arity: number): Method<LinkedStage> | undefined {
          for (const module of this.hierarchy()) {
            const found = module.methods().find(member =>
              (!!member.body || member.isNative) && member.name === name && (
                member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
                member.parameters.length === arity
              )
            )
            if (found) return found
          }
          return undefined
        },

      })

      if (is('Class')(node)) assign(node, {
        superclassNode(this: Class<LinkedStage>): Class<LinkedStage> | null {
          return this.superclass ? this.superclass.target<Class<LinkedStage>>() : null
        },

        lookupConstructor(this: Class<LinkedStage>, arity: number): Constructor<LinkedStage> | undefined {
          return this.constructors().find(member =>
            // TODO: extract method matches(name, arity) or something like that for constructors and methods
            member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
            member.parameters.length === arity
          )
        },
      })

      if (is('Singleton')(node)) assign(node, {
        superclassNode(this: Singleton<LinkedStage>): Class<LinkedStage> {
          return this.superCall.superclass.target<Class<LinkedStage>>()
        },
      })

      if (is('Reference')(node)) assign(node, {
        target<N extends Node<LinkedStage>>(this: Reference<LinkedStage>): N {
          return this.environment().getNodeById(this.targetId)
        },
      })

      return node

    }).members,
  })
}