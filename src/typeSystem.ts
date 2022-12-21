import { Assignment } from "."
import { Environment, Field, is, Literal, Method, Module, New, Node, Package, Parameter, ParameterizedType, Program, Reference, Return, Self, Send, Super, Variable } from "./model"

type WollokType = Module | typeof ANY | typeof VOID

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
        Module: inferModule,

        Send: inferSend,
        Method: inferMethod,
        Parameter: inferParameter,

        Return: inferReturn,
        If: typeVariableFor, //TODO
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
    p.body.sentences.forEach(createTypeVariables)
}

const inferModule = (m: Module) => {
    m.members.forEach(createTypeVariables)
    typeVariableFor(m)
}

const inferNew = (n: New) => {
    const args = n.args.map(createTypeVariables)
    const clazz = n.instantiated.target()!
    return typeVariableFor(n).setType(clazz)
}

const inferMethod = (m: Method) => {
    const parameters = m.parameters.map(createTypeVariables)
    m.sentences().forEach(createTypeVariables)

    const method = typeVariableFor(m)
    const typeAnnotation = m.metadata.find(_ => _.name === 'Type')
    if (typeAnnotation) {
        const typeRef = typeAnnotation.args['returnType'] as string
        method.setType(environment.getNodeByFQN<Module>(typeRef))
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
    return typeVariableFor(a).setType(VOID)
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
        typeVariableFor(method).setType(VOID)
    return typeVariableFor(r).setType(VOID)
}

const inferReference = (r: Reference<Node>) => {
    const varTVar = typeVariableFor(r.target()!)! // Variable already visited
    const referenceTVar = typeVariableFor(r)
    referenceTVar.isSupertypeOf(varTVar)
    return referenceTVar
}

const inferSelf = (self: Self | Super) => {
    const module = self.ancestors().find<Module>((node: Node): node is Module => node.is('Module') && !node.fullyQualifiedName().startsWith('wollok.lang.Closure'))
    if (!module) throw 'Module for Self not found'
    return typeVariableFor(self).setType(module)
}

const inferLiteral = (l: Literal) => {
    const tVar = typeVariableFor(l)
    switch (typeof l.value) {
        case "number": return tVar.setType(environment.numberClass)
        case "string": return tVar.setType(environment.stringClass)
        case "boolean": return tVar.setType(environment.booleanClass)
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

    hasType() { return this.type() !== ANY }

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
    }

    isSupertypeOf(tVar: TypeVariable) {
        this.addSubtype(tVar)
        tVar.addSupertype(this)
    }

    addSend(send: Send) {
        this.messages.push(send)
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
        if (this.minTypes.length + this.minTypes.length == 0) return ANY
        if (this.maxTypes.length == 1) return this.maxTypes[0]
        if (this.minTypes.length == 1) return this.minTypes[0]
        throw "Halt"
    }

    setType(type: WollokType) {
        this.addMinType(type)
        this.final = true
    }

    addMinType(type: WollokType) {
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
    const type = tVar.type()
    if (type === ANY) return false

    var changed = false
    tVar.supertypes.forEach(superTVar => {
        if (!superTVar.hasType()) {
            superTVar.addMinType(type)
            console.log(`PROPAGATE MIN TYPE (${type}) from |${tVar.node}| to |${superTVar.node}|`)
            changed = true
        }
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

    const type = tVar.type()
    if (type === ANY) return false
    if (type === VOID) throw 'Message sent to Void'

    var changed = false
    tVar.messages
        .filter(send => !typeVariableFor(send).hasType())
        .forEach(send => {
            const method = type.lookupMethod(send.message, send.args.length, { allowAbstractMethods: true })
            if (!method) throw `Method ${send.message}/${send.args.length} not found for type ${type}`

            if (typeVariableFor(method).hasType()) {
                typeVariableFor(method).isSubtypeOf(typeVariableFor(send)) // Return value
                console.log(`BIND MESSAGE |${send}| WITH METHOD |${method}|`)
                changed = true
            }
        })
    return changed
}