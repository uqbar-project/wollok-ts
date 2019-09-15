import { v4 as uuid } from 'uuid'
import { getOrUpdate, NODE_CACHE, PARENT_CACHE, update } from './cache'
import { flatMap, last, mapObject } from './extensions'
import { DECIMAL_PRECISION, Evaluation as EvaluationType, Frame as FrameType, Interruption, RuntimeObject } from './interpreter'
import { Class, Constructor, Describe, Entity, Environment, Filled as FilledStage, Id, isEntity, isModule, isNode, Kind, Linked as LinkedStage, List, Method, Module, Name, Node, Raw as RawStage, Reference, Singleton, Stage } from './model'

const { isArray } = Array
const { values, assign, keys } = Object

// TODO: Test all behaviors

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RAW
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function Raw<N extends Node<RawStage>>(obj: Partial<N>): N {
  const node = { ...obj } as N

  assign(node, {

    is<K extends Kind>(this: Node<RawStage>, kind: K): boolean {
      return isNode(this) && this.kind === kind
    },

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

    // TODO: do this without creating all the intermediate lists
    descendants(this: Node<RawStage>, kind?: Kind): List<Node<RawStage>> {
      const directDescendants = this.children<Node<RawStage>>()
      const indirectDescendants = flatMap<Node<RawStage>>(child => child.descendants(kind))(directDescendants)
      const descendants = [...directDescendants, ...indirectDescendants]
      return kind ? descendants.filter(descendant => descendant.is(kind)) : descendants as any
    },

    transform<R extends Stage>(
      this: Node<RawStage>,
      tx: ((node: Node<RawStage>) => Node<R>) | { [K in Kind]?: (node: Node<RawStage>) => Node<R> }
    ): Node<R> {
      const applyTransform = (value: any): any => {
        if (typeof value === 'function') return value
        if (isArray(value)) return value.map(applyTransform)
        if (isNode<RawStage>(value)) return typeof tx === 'function'
          ? mapObject(applyTransform, tx(value))
          : (tx[value.kind] as any || ((n: any) => n))(mapObject(applyTransform, value as any))
        if (value instanceof Object) return mapObject(applyTransform, value)
        return value
      }

      return applyTransform(this)
    },

    reduce<T>(this: Node<RawStage>, tx: (acum: T, node: Node<RawStage>) => T, initial: T): T {
      return this.children().reduce((acum, child) => child.reduce(tx, acum), tx(initial, node))
    },

  })

  if (isModule(node)) assign(node, {
    methods(this: Module<RawStage>) { return this.members.filter(member => member.is('Method')) },
    fields(this: Module<RawStage>) { return this.members.filter(member => member.is('Field')) },
  })

  if (node.is('Class')) assign(node, {
    constructors(this: Class<RawStage>) { return this.members.filter(member => member.is('Constructor')) },
  })

  if (node.is('Describe')) assign(node, {
    tests(this: Describe<RawStage>) { return this.members.filter(member => member.is('Test')) },
  })

  return node
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// FILLED
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function Filled<N extends Node<FilledStage>>(obj: Partial<N>): N {
  const node = Raw(obj) as N

  return node
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKED
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function Linked(environmentData: Partial<Environment>) {
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


    closestAncestor<N extends Node<LinkedStage>, K extends Kind>(this: Node<LinkedStage>, kind: K): N | undefined {
      let parent: Node<LinkedStage>
      try {
        parent = this.parent()
      } catch (_) { return undefined }

      return parent.is(kind) ? parent : parent.closestAncestor(kind) as any
    },
  }

  return assign(environment, baseBehavior, {
    members: environment.transform<LinkedStage, Environment>(n => {

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

      if (node.is('Class')) assign(node, {
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

      if (node.is('Singleton')) assign(node, {
        superclassNode(this: Singleton<LinkedStage>): Class<LinkedStage> {
          return this.superCall.superclass.target<Class<LinkedStage>>()
        },
      })

      if (node.is('Reference')) assign(node, {
        target<N extends Node<LinkedStage>>(this: Reference<LinkedStage>): N {
          return this.environment().getNodeById(this.targetId)
        },
      })

      return node

    }).members,
  })
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RUNTIME
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export const Evaluation = (obj: Partial<EvaluationType>) => {
  const evaluation = obj as EvaluationType

  assign(evaluation, {

    currentFrame(this: EvaluationType): FrameType {
      return last(this.frameStack)!
    },

    instance(this: EvaluationType, id: Id): RuntimeObject {
      const response = this.instances[id]
      if (!response) throw new RangeError(`Access to undefined instance "${id}"`)
      return response
    },

    createInstance(this: EvaluationType, module: Name, baseInnerValue?: any): Id {
      let id: Id
      let innerValue = baseInnerValue

      switch (module) {
        case 'wollok.lang.Number':
          const stringValue = innerValue.toFixed(DECIMAL_PRECISION)
          id = 'N!' + stringValue
          innerValue = Number(stringValue)
          break

        case 'wollok.lang.String':
          id = 'S!' + innerValue
          break

        default:
          id = uuid()
      }

      this.instances[id] = { id, module, fields: {}, innerValue }
      return id
    },

    interrupt(this: EvaluationType, interruption: Interruption, valueId: Id) {
      let nextFrame
      do {
        this.frameStack.pop()
        nextFrame = last(this.frameStack)
      } while (nextFrame && !nextFrame.resume.includes(interruption))

      if (!nextFrame) {
        const value = this.instance(valueId)
        const message = interruption === 'exception'
          ? `${value.module}: ${value.fields.message && this.instance(value.fields.message).innerValue || value.innerValue}`
          : ''

        throw new Error(`Unhandled "${interruption}" interruption: [${valueId}] ${message}`)
      }

      nextFrame.resume = nextFrame.resume.filter(elem => elem !== interruption)
      nextFrame.pushOperand(valueId)
    },

    copy(this: EvaluationType): EvaluationType {
      return {
        ...this,
        instances: keys(this.instances).reduce((instanceClones, name) => ({
          ...instanceClones,
          [name]: { ...this.instance(name), fields: { ...this.instance(name).fields } },
        }), {}),
        frameStack: this.frameStack.map(frame => ({
          ...frame,
          locals: { ...frame.locals },
          operandStack: [...frame.operandStack],
          resume: [...frame.resume],
        })),
      }
    },

  })

  return evaluation
}

export const Frame = (obj: Partial<FrameType>): FrameType => {
  const frame = { ...obj } as FrameType

  assign(frame, {

    popOperand(this: FrameType): Id {
      const response = this.operandStack.pop()
      if (!response) throw new RangeError('Popped empty operand stack')
      return response
    },

    pushOperand(this: FrameType, id: Id) {
      this.operandStack.push(id)
    },

  })

  return frame
}