import { v4 as uuid } from 'uuid'
import { divideOn, is, List } from './extensions'
import { BaseProblem, Entity, Environment, Field, Id, Import, Level, Module, Name, Node, Package, Parameter, ParameterizedType, Reference, Scope, Sentence, SourceMap, Variable } from './model'
const { assign } = Object


export const GLOBAL_PACKAGES = ['wollok.lang', 'wollok.lib', 'wollok.game']


export class LinkError implements BaseProblem {
  constructor(public code: Name) { }

  get level(): Level { return 'error' }
  get values(): List<string> { return [] }
  get sourceMap(): SourceMap | undefined { return undefined }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MERGING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const mergePackage = (members: List<Entity>, isolated: Entity): List<Entity> => {
  if (!isolated.is(Package)) return [...members.filter(({ name }) => name !== isolated.name), isolated]
  const existent = members.find((member: Entity): member is Package =>
    member.is(Package) && member.name === isolated.name && member.sourceFileName === isolated.sourceFileName)

  return existent
    ? [
      ...members.filter(member => member !== existent),
      existent.copy({
        members: [
          ...isolated.members
            .filter(is(Package))
            .reduce(mergePackage, existent.members.filter(is(Package))),
          ...isolated.members.filter(m => !m.is(Package)),
        ],
        problems: isolated.problems,
        imports: isolated.imports,
      }) as Package,
    ]
    : [...members, isolated]
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SCOPES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export class LocalScope implements Scope {
  protected contributions = new Map<Name, Node>()
  protected includedScopes: Scope[] = []

  constructor(public containerScope?: Scope, ...contributions: [Name, Node][]) {
    this.register(...contributions)
  }

  resolve<N extends Node>(qualifiedName: Name, allowLookup = true): N | undefined {
    const [start, rest] = divideOn('.')(qualifiedName)

    const step = !allowLookup
      ? this.contributions.get(start)
      : this.includedScopes.reduce((found, included) =>
        found ?? included.resolve(start, false)
      , this.contributions.get(start)) ?? this.containerScope?.resolve(start, allowLookup)

    return rest.length ? step?.scope?.resolve<N>(rest, false) : step as N
  }

  register(...contributions: [Name, Node][]): void {
    const shouldBeOverrided = (older: Node, newer: Node) => // Override wtest files with same name than wlk
      older.is(Package) && newer.is(Package) && older.isTestFile && !newer.isTestFile
    for (const [name, node] of contributions) {
      const alreadyRegistered = this.contributions.get(name)
      if (!alreadyRegistered || shouldBeOverrided(alreadyRegistered, node)) {
        this.contributions.set(name, node)
      }
    }
  }

  include(...others: Scope[]): void { this.includedScopes.push(...others) }

  localContributions(): [Name, Node][] { return [...this.contributions.entries()] }

  localEntities(): Node[] { return [...this.contributions.values()]}
}

export const scopeContribution = (contributor: Node): List<[Name, Node]> =>
  canBeReferenced(contributor) && contributor.name ? [[contributor.name, contributor]] : []

export const assignScopes = (root: Node): void => {
  root.forEach((node, parent) => {
    const containerScope = node.is(Import) || node.is(Reference) && parent!.is(ParameterizedType)
      ? parent?.parent.scope
      : parent?.scope
    assign(node, { scope: new LocalScope(containerScope) })

    parent?.scope?.register(...scopeContribution(node))
  })

  root.forEach((node, _parent) => {
    if (node.is(Environment)) {
      for (const globalName of GLOBAL_PACKAGES) {
        const globalPackage = root.scope.resolve<Package>(globalName)
        if (globalPackage) node.scope.register(...globalPackage.members.flatMap(scopeContribution))
      }
    }

    if (node.is(Package)) {
      for (const importNode of node.imports) {
        const entity = importNode.scope.resolve<Entity>(importNode.entity.name)
        if (!entity) break // If there is no entity with the name the validator will create the problem

        const contributions: [string, Node][] = importNode.isGeneric
          ? entity.is(Package) && entity.isImportable ? entity.scope.localContributions() : []
          : [[entity.name!, entity]]

        node.scope.include(new LocalScope(undefined, ...contributions))
      }
    }

    if (node.is(Module)) {
      node.scope.include(...node.hierarchy.slice(1).map(supertype => supertype.scope))
    }
  })
}

export const canBeReferenced = (node: Node): node is Entity | Field | Parameter => node.is(Entity) || node.is(Field) || node.is(Parameter) || node.is(Variable)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LINKER
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

export default (newPackages: List<Package>, baseEnvironment?: Environment): Environment => {
  const environment = new Environment({
    id: uuid(),
    scope: undefined,
    members: newPackages.reduce(mergePackage, baseEnvironment?.members ?? []) as List<Package>,
  }).transform(node => node.copy({ id: uuid() }))

  const nodeCache = new Map<Id, Node>()
  environment.forEach((node, parent) => {
    nodeCache.set(node.id, node)
    node.environment = environment
    // TODO: There is no need any more for this to be on the linker. Move parent assignment to constructors
    if (parent) node.parent = parent
  })

  assign(environment, { nodeCache })

  assignScopes(environment)

  return environment
}

export function linkSentenceInNode<S extends Sentence>(newSentence: S, context: Node): void {
  const { environment } = context
  const _nodeCache = environment.nodeCache as Map<Id, Node>

  newSentence.forEach((node, parent) => {
    const id = uuid()
    assign(node, { id })
    _nodeCache.set(id, node)
    node.environment = environment
    node.parent = parent ?? context
  })

  assignScopes(newSentence)
}