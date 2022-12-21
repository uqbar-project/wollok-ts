import { last } from "./extensions"
import { Assignment, Body, Environment, Field, If, is, Literal, Method, Module, Name, New, Node, Package, Program, Reference, Return, Self, Send, Super, Variable } from "./model"

type WollokType = WollokAtomicType | WollokModuleType | WollokUnionType
type AtomicType = typeof ANY | typeof VOID

class WollokAtomicType {
    id: AtomicType

    constructor(id: AtomicType) {
        this.id = id
    }

    lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
        throw "Atomic types has no methods"
    }

    contains(type: WollokType): boolean {
        return type instanceof WollokAtomicType && this.id === type.id
    }

    get name(): string {
        return this.id
    }
}


class WollokModuleType {
    module: Module

    constructor(module: Module) {
        this.module = module
    }

    lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
        return this.module.lookupMethod(name, arity, options)
    }

    contains(type: WollokType): boolean {
        return type instanceof WollokModuleType && this.module === type.module
    }

    get name(): string {
        return this.module.name!
    }

    toString() { return this.module.toString() }
}

class WollokUnionType {
    types: WollokType[]

    constructor(types: WollokType[]) {
        this.types = types
    }

    lookupMethod(name: Name, arity: number, options?: { lookupStartFQN?: Name, allowAbstractMethods?: boolean }) {
        throw "Halt"
    }

    contains(type: WollokType): boolean {
        if (type instanceof WollokUnionType) throw "Halt"
        return this.types.some(_ => _.contains(type))
    }

    get name(): string {
        return `(${this.types.map(_ => _.name).join(' | ')})`
    }
}

const ANY = 'ANY'
const VOID = 'VOID'
const tVars = new Map<Node, TypeVariable>()
let environment: Environment
let globalChange: boolean

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTERFACE
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function infer(env: Environment) {
    environment = env
    createTypeVariables(env)
    globalChange = true
    while (globalChange) {
        globalChange = [propagateTypes, bindMessages].some(f => f())
    }
}

export function getType(node: Node) {
    const type = typeVariableFor(node).type()
    if (typeof type === 'object') return type.name!
    return type
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TYPE VARIABLES
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export function typeVariableFor(node: Node) {
    const tVar = tVars.get(node)
    if (!tVar) return newTVarFor(node)
    return tVar
}

function newTVarFor(node: Node) {
    const newTVar = new TypeVariable(node)
    tVars.set(node, newTVar)
    return newTVar
}

function createTypeVariables(node: Node) {
    return node.match<TypeVariable | void>({
        Environment: inferEnvironment,
        Package: inferPackage,
        Import: skip,
        Program: inferProgram,
        Body: inferBody,
        Module: inferModule,

        Send: inferSend,
        Method: inferMethod,
        Parameter: inferParameter,

        Return: inferReturn,
        If: inferIf, //TODO
        Assignment: inferAssignment,
        Throw: typeVariableFor, //TODO
        Try: typeVariableFor, //TODO

        New: inferNew,
        NamedArgument: typeVariableFor, //TODO

        Variable: inferVariable,
        Field: inferVariable,
        Reference: inferReference,

        Literal: inferLiteral,
        Self: inferSelf,
        Super: inferSelf,
    })
}

const inferEnvironment = (env: Environment) => {
    env.children().forEach(createTypeVariables)
}

const inferPackage = (p: Package) => {
    p.children().forEach(createTypeVariables)
}

const inferProgram = (p: Program) => {
    createTypeVariables(p.body)
}

const inferBody = (body: Body) => {
    body.sentences.forEach(createTypeVariables)
}

const inferModule = (m: Module) => {
    m.members.forEach(createTypeVariables)
    typeVariableFor(m)
}

const inferNew = (n: New) => {
    const args = n.args.map(createTypeVariables)
    const clazz = n.instantiated.target()!
    return typeVariableFor(n).setType(new WollokModuleType(clazz))
}

const inferMethod = (m: Method) => {
    const parameters = m.parameters.map(createTypeVariables)
    m.sentences().forEach(createTypeVariables)

    const method = typeVariableFor(m)
    const typeAnnotation = m.metadata.find(_ => _.name === 'Type')
    if (typeAnnotation) {
        const typeRef = typeAnnotation.args['returnType'] as string
        method.setType(new WollokModuleType(environment.getNodeByFQN<Module>(typeRef)))
    }
    return method
}

const inferSend = (send: Send) => {
    const receiver = createTypeVariables(send.receiver)!
    const args = send.args.map(createTypeVariables)
    receiver.addSend(send)
    return typeVariableFor(send)
}

const inferAssignment = (a: Assignment) => {
    const variable = createTypeVariables(a.variable)!
    const value = createTypeVariables(a.value)!
    variable.isSupertypeOf(value)
    return typeVariableFor(a).setType(new WollokAtomicType(VOID))
}

const inferVariable = (v: Variable | Field) => {
    const valueTVar = createTypeVariables(v.value)
    const varTVar = typeVariableFor(v)
    if (valueTVar) varTVar.isSupertypeOf(valueTVar)
    return varTVar
}

const inferParameter = (p: Node) => {
    return typeVariableFor(p) //TODO: Close min types?
}

const inferReturn = (r: Return) => {
    const method = r.ancestors().find(is('Method'))
    if (!method) throw 'Method for Return not found'
    if (r.value)
        typeVariableFor(method).isSupertypeOf(createTypeVariables(r.value)!)
    else
        typeVariableFor(method).setType(new WollokAtomicType(VOID))
    return typeVariableFor(r).setType(new WollokAtomicType(VOID))
}

const inferIf = (_if: If) => {
    createTypeVariables(_if.condition)!.hasType(new WollokModuleType(environment.booleanClass))
    createTypeVariables(_if.thenBody)
    createTypeVariables(_if.elseBody)
    return typeVariableFor(_if) // TODO: diferenciar if-expression? Cómo?
        .isSupertypeOf(typeVariableFor(last(_if.thenBody.sentences)!))
        .isSupertypeOf(typeVariableFor(last(_if.elseBody.sentences)!))
}

const inferReference = (r: Reference<Node>) => {
    const varTVar = typeVariableFor(r.target()!)! // Variable already visited
    const referenceTVar = typeVariableFor(r)
    referenceTVar.isSupertypeOf(varTVar)
    return referenceTVar
}

const inferSelf = (self: Self | Super) => {
    const module = self.ancestors()
        .find<Module>((node: Node): node is Module =>
            node.is('Module') && !node.fullyQualifiedName().startsWith('wollok.lang.Closure')) // Ignore closures
    if (!module) throw 'Module for Self not found'
    return typeVariableFor(self).setType(new WollokModuleType(module))
}

const inferLiteral = (l: Literal) => {
    const tVar = typeVariableFor(l)
    switch (typeof l.value) {
        case "number": return tVar.setType(new WollokModuleType(environment.numberClass))
        case "string": return tVar.setType(new WollokModuleType(environment.stringClass))
        case "boolean": return tVar.setType(new WollokModuleType(environment.booleanClass))
        case "object": return tVar; //tVar.setType('Null')
        default: throw "Literal type not found"
    }
}


const skip = (_: Node) => { }


class TypeVariable {
    typeInfo: TypeInfo = new TypeInfo()
    subtypes: TypeVariable[] = []
    supertypes: TypeVariable[] = []
    messages: Send[] = []
    node: Node

    constructor(node: Node) { this.node = node }


    type() { return this.typeInfo.type() }

    hasAnyType() { return this.type().contains(new WollokAtomicType(ANY)) }
    hasType(type: WollokType) { return this.allMinTypes().some(minType => minType.contains(type)) }

    setType(type: WollokType) {
        this.typeInfo.setType(type)
        return this
    }

    addMinType(type: WollokType) {
        this.typeInfo.addMinType(type)
    }

    addMaxType(type: WollokType) {
        this.typeInfo.addMaxType(type)
    }

    isSubtypeOf(tVar: TypeVariable) {
        this.addSupertype(tVar)
        tVar.addSubtype(this)
        return this
    }

    isSupertypeOf(tVar: TypeVariable) {
        this.addSubtype(tVar)
        tVar.addSupertype(this)
        return this
    }

    hasSubtype(tVar: TypeVariable) {
        return this.subtypes.includes(tVar)
    }

    hasSupertype(tVar: TypeVariable) {
        return this.supertypes.includes(tVar)
    }

    addSend(send: Send) {
        this.messages.push(send)
    }

    allMinTypes() {
        return this.typeInfo.minTypes
    }

    private addSubtype(tVar: TypeVariable) {
        this.subtypes.push(tVar)
    }

    private addSupertype(tVar: TypeVariable) {
        this.supertypes.push(tVar)
    }
}

class TypeInfo {
    minTypes: WollokType[] = []
    maxTypes: WollokType[] = []
    final: boolean = false

    type() {
        if (this.minTypes.length + this.minTypes.length == 0) return new WollokAtomicType(ANY)
        if (this.maxTypes.length == 1) return this.maxTypes[0]
        if (this.minTypes.length == 1) return this.minTypes[0]

        if (this.minTypes.length > 1) return new WollokUnionType(this.minTypes)
        throw "Halt"
    }

    setType(type: WollokType) {
        this.addMinType(type)
        this.final = true
    }

    addMinType(type: WollokType) {
        if (this.minTypes.some(minType => minType.contains(type))) return;
        if (this.final) throw "Variable inference finalized"
        this.minTypes.push(type)
    }

    addMaxType(type: WollokType) {
        if (this.final) throw "Variable inference finalized"
        this.maxTypes.push(type)
    }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROPAGATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function propagateTypes() {
    return [...tVars.values()].some(propagateMinTypes)
}

const propagateMinTypes = (tVar: TypeVariable) => {
    const types = tVar.allMinTypes()
    var changed = false
    types.forEach(type => {
        tVar.supertypes.forEach(superTVar => {
            if (!superTVar.hasType(type)) {
                superTVar.addMinType(type)
                console.log(`PROPAGATE MIN TYPE (${type}) FROM |${tVar.node}| TO |${superTVar.node}|`)
                changed = true
            }
        })
    })
    return changed
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// MESSAGE BINDING
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function bindMessages() {
    return [...tVars.values()].some(bindReceivedMessages)
}

const bindReceivedMessages = (tVar: TypeVariable) => {
    if (!tVar.messages.length) return false
    if (tVar.hasAnyType()) return false
    const type = tVar.type()
    var changed = false
    tVar.messages.forEach(send => {
        const method = type.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
        if (!method) throw `Method ${send.message}/${send.args.length} not found for type ${type}`

        if (!typeVariableFor(method).hasSupertype(typeVariableFor(send))) {
            typeVariableFor(method).isSubtypeOf(typeVariableFor(send)) // Return value
            console.log(`BIND MESSAGE |${send}| WITH METHOD |${method}|`)
            changed = true
        }
    })
    return changed
}