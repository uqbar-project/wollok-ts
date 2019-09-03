import { getOrUpdate, PARENT_CACHE, update } from './cache'
import { flatMap } from './extensions'
import { Class, Describe, Environment, Filled as FilledStage, is, isModule, isNode, Linked as LinkedStage, List, Module, Node, Raw as RawStage, Singleton } from './model'
import tools, { transform } from './tools'

const { isArray } = Array
const { values, assign } = Object

// TODO: Test all behaviors

export type Methods<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T]

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
  const environment: Environment = Filled(environmentData as any) as any

  const linkedBehavior = {

    environment(this: Node<LinkedStage>) { return environment },

    parent<T extends Node<LinkedStage>>(this: Node<LinkedStage>): T {
      const { getNodeById } = tools(this.environment())
      return getNodeById(getOrUpdate(PARENT_CACHE, this.id)(() => {
        const parent = [this.environment(), ...this.environment().descendants()].find(descendant =>
          descendant.children().some(({ id }) => id === this.id)
        )
        if (!parent) throw new Error(`Node ${JSON.stringify(this)} is not part of the environment`)

        return parent.id
      }))
    },

  }

  return assign(environment, linkedBehavior, {
    members: environment.members.map(
      transform((n: Node<FilledStage>) => {
        const node = Filled(n) as Node<LinkedStage>

        assign(node, linkedBehavior)
        if (is('Singleton')(node) || is('Class')(node)) assign(node, {
          superclassNode(this: Class<LinkedStage> | Singleton<LinkedStage>): Class<LinkedStage> | null {
            const { resolveTarget } = tools(this.environment())
            switch (this.kind) {
              case 'Class': return this.superclass ? resolveTarget<Class<LinkedStage>>(this.superclass!) : null
              case 'Singleton': return resolveTarget<Class<LinkedStage>>(this.superCall.superclass)
            }
          },
        })

        return node
      })
    ),
  })
}