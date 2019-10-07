import { v4 as uuid } from 'uuid'
import { divideOn, last, mapObject } from './extensions'
import { DECIMAL_PRECISION, Evaluation as EvaluationType, Frame as FrameType, Interruption, RuntimeObject } from './interpreter'
import { Category, Class, Constructor, Describe, Entity, Environment, Filled as FilledStage, Id, Kind, Linked as LinkedStage, List, Method, Module, Name, Node, Package, Raw as RawStage, Reference, Singleton, Stage } from './model'

const { isArray } = Array
const { values, assign, keys } = Object

const isNode = <S extends Stage>(obj: any): obj is Node<S> => !!(obj && obj.kind)


const NODE_CACHE = new Map<Id, Node<LinkedStage>>()
const PARENT_CACHE = new Map<Id, Node<LinkedStage>>()

function cached<N extends { id?: Id }, R>(f: (this: N, ...args: any[]) => R, cache: Map<Id, R> = new Map()) {
  return function (this: N, ...args: any[]): R {
    if (!this.id) return f.bind(this)(...args)

    const key = `${this.id}${args}`
    const cachedValue = cache.get(key)
    if (cachedValue) return cachedValue

    const response = f.bind(this)(...args)
    cache.set(key, response)
    return response
  }
}

// TODO: Test all behaviors

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// RAW
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export function Raw<N extends Node<RawStage>>(obj: Partial<N>): N {
  const node = { ...obj } as N

  assign(node, {

    is(this: Node<RawStage>, kind: Kind | Category): boolean {
      if (kind === 'Entity') return ['Package', 'Class', 'Singleton', 'Mixin', 'Program', 'Describe', 'Test'].includes(this.kind)
      if (kind === 'Module') return ['Singleton', 'Mixin', 'Class'].includes(this.kind)
      if (kind === 'Expression') return ['Reference', 'Self', 'Literal', 'Send', 'Super', 'New', 'If', 'Throw', 'Try'].includes(this.kind)
      if (kind === 'Sentence') return ['Variable', 'Return', 'Assignment'].includes(this.kind)
      return this.kind === kind
    },

    children: cached(function (this: Node<RawStage>): List<Node<RawStage>> {
      const extractChildren = (owner: any): List<Node<RawStage>> => {
        if (isNode<RawStage>(owner)) return [owner]
        if (isArray(owner)) return owner.flatMap(extractChildren)
        if (owner instanceof Object) return values(owner).flatMap(extractChildren)
        return []
      }

      return values(this).flatMap(extractChildren)
    }),

    descendants(this: Node<RawStage>, kind?: Kind): List<Node<RawStage>> {
      const pending: Node<RawStage>[] = []
      const response: Node<RawStage>[] = []
      let next: Node<RawStage> | undefined = this
      do {
        const children = next!.children()
        response.push(...kind ? children.filter(child => child.is(kind)) : children)
        pending.push(...children)
        next = pending.shift()
      } while (next)
      return response
    },

    forEach(
      this: Node<RawStage>,
      tx: ((node: Node<RawStage>, parent?: Node<RawStage>) => void) | { [K in Kind]?: (node: Node<RawStage>) => void },
      parent?: Node<RawStage>,
    ) {
      if (typeof tx === 'function')
        tx(this, parent)
      else (tx[this.kind] || (_ => _))(this)
      this.children().forEach(child => child.forEach(tx, this))
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
      return this.children().reduce((acum, child) => child.reduce(tx, acum), tx(initial, this))
    },

  })

  if (node.is('Module')) assign(node, {
    methods(this: Module<RawStage>) { return this.members.filter(member => member.is('Method')) },
    fields(this: Module<RawStage>) { return this.members.filter(member => member.is('Field')) },
  })

  if (node.is('Class')) assign(node, {
    constructors(this: Class<RawStage>) { return this.members.filter(member => member.is('Constructor')) },
  })

  if (node.is('Describe')) assign(node, {
    tests(this: Describe<RawStage>) { return this.members.filter(member => member.is('Test')) },
    methods(this: Describe<RawStage>) { return this.members.filter(member => member.is('Method')) },
    variables(this: Describe<RawStage>) { return this.members.filter(member => member.is('Variable')) },
    fixture(this: Describe<RawStage>) { return this.members.find(member => member.is('Fixture')) },
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
  const environment: Environment<LinkedStage> = Filled(environmentData as any).transform(node => Filled(node as any)) as any

  environment.forEach((node, parentNode) => {

    assign(node, {
      environment(this: Node<LinkedStage>) { return environment },

      parent: cached(function (this: Node<LinkedStage>): Node<LinkedStage> {
        throw new Error(`Missing parent in cache for node ${this.id}`)
      }, PARENT_CACHE),

      closestAncestor<N extends Node<LinkedStage>, K extends Kind>(this: Node<LinkedStage>, kind: K): N | undefined {
        let parent: Node<LinkedStage>
        try {
          parent = this.parent()
        } catch (_) { return undefined }

        return parent.is(kind) ? parent : parent.closestAncestor(kind) as any
      },
    })

    if (node.is('Environment')) assign(node, {
      getNodeById: cached(function (this: Environment<LinkedStage>, id: Id): Node<LinkedStage> {
        throw new Error(`Missing node in node cache with id ${id}`)
      }, NODE_CACHE),

      getNodeByFQN: cached(function (this: Environment<LinkedStage>, fullyQualifiedName: string): Node<LinkedStage> {
        const [start, rest] = divideOn('.')(fullyQualifiedName)
        const root = this.children<Package<LinkedStage>>().find(child => child.name === start)
        if (!root) throw new Error(`Could not resolve reference to ${fullyQualifiedName}`)
        return rest ? root.getNodeByQN(rest) : root
      }),
    })

    if (node.is('Entity')) assign(node, {
      fullyQualifiedName(this: Entity<LinkedStage>): Name {
        const parent = this.parent()
        const label = this.is('Singleton')
          ? this.name || `${this.superCall.superclass.target<Module>().fullyQualifiedName()}#${this.id}`
          : this.name.replace(/\.#/g, '')

        return parent.is('Package')
          ? `${parent.fullyQualifiedName()}.${label}`
          : label
      },
    })

    if (node.is('Package')) assign(node, {
      getNodeByQN: cached(function (this: Package<LinkedStage>, qualifiedName: Name): Node<LinkedStage> {
        const [, id] = qualifiedName.split('#')
        if (id) return this.environment().getNodeById(id)
        return qualifiedName.split('.').reduce((current: Node<LinkedStage>, step) => {
          const next = current.children<Node<LinkedStage>>().find(child => child.is('Entity') && child.name === step)
          if (!next) throw new Error(`Could not resolve reference to ${qualifiedName} from ${this.name}`)
          return next
        }, this)
      }),
    })

    if (node.is('Module')) assign(node, {
      hierarchy: cached(function (this: Module<LinkedStage>): List<Module<LinkedStage>> {
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
      }),

      inherits(this: Module<LinkedStage>, other: Module<LinkedStage>): boolean {
        return this.hierarchy().some(({ id }) => other.id === id)
      },

      lookupMethod: cached(function (this: Module<LinkedStage>, name: Name, arity: number): Method<LinkedStage> | undefined {
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
      }),

    })

    if (node.is('Class')) assign(node, {
      superclassNode(this: Class<LinkedStage>): Class<LinkedStage> | null {
        return this.superclass ? this.superclass.target<Class<LinkedStage>>() : null
      },

      lookupConstructor: cached(function (this: Class<LinkedStage>, arity: number): Constructor<LinkedStage> | undefined {
        return this.constructors().find(member =>
          // TODO: extract method matches(name, arity) or something like that for constructors and methods
          member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
          member.parameters.length === arity
        ) ?? this.superclassNode() ?.lookupConstructor(arity)
      }),
    })

    if (node.is('Singleton')) assign(node, {
      superclassNode(this: Singleton<LinkedStage>): Class<LinkedStage> {
        return this.superCall.superclass.target<Class<LinkedStage>>()
      },
    })

    if (node.is('Describe')) assign(node, {
      lookupMethod: cached(function (this: Describe<LinkedStage>, name: Name, arity: number): Method<LinkedStage> | undefined {
        return this.methods().find(member =>
          (!!member.body || member.isNative) && member.name === name && (
            member.parameters.some(({ isVarArg }) => isVarArg) && member.parameters.length - 1 <= arity ||
            member.parameters.length === arity
          )
        )
      }),
    })

    if (node.is('Reference')) assign(node, {
      target: cached(function (this: Reference<LinkedStage>): Node<LinkedStage> {
        const [start, rest] = divideOn('.')(this.name)
        const root = this.environment().getNodeById<Package<LinkedStage>>(this.scope[start])
        return rest.length ? root.getNodeByQN(rest) : root
      }),
    })

    if (environment.id && node.id) NODE_CACHE.set(`${environment.id}${node.id}`, node)
    if (node.id && parentNode?.id) PARENT_CACHE.set(`${node.id}`, parentNode)
  })

  return environment
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