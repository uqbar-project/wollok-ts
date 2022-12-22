import { should } from 'chai'
import { buildEnvironment } from '../src'
import { getType, infer, typeVariableFor } from '../src/typeSystem'
import { Program, Singleton } from './../src/model'


should()

describe('Wollok Type System', () => {
    const files = [{
        name: 'Literals',
        content: `program p { 2 'hola' true null }`
    }, {
        name: 'Variables',
        content: `program p { const x = 2 ; const y = x }`
    }, {
        name: 'Expressions',
        content: `program p { const x = 1 + 2 ; const y = x * 3 }`
    }, {
        name: 'Objects',
        content: `
        object o { 
            const x = true

            @Type(returnType="wollok.lang.Number") 
            method m1() native 

            method m2() = self.m1()

            method m3() = if (x) 1 else 2

            method m4() = if (x) 1 else 'a'

            method m5(p) = p.blah()

            method m6(p) = p.asd()
        }
        
        object o2 { 
            method blah() = true 
            method asd() = true 
        }
        object o3 { 
            method asd() = 1
        }
        `
    },
    ]

    const environment = buildEnvironment(files)

    infer(environment)

    it('Literals inference', () => {
        const sentences = environment.getNodeByFQN<Program>('Literals.p').sentences()
        getType(sentences[0]).should.be.eq('Number')
        getType(sentences[1]).should.be.eq('String')
        getType(sentences[2]).should.be.eq('Boolean')
        getType(sentences[3]).should.be.eq('ANY')//('Null')
    })

    it('Variables inference', () => {
        const sentences = environment.getNodeByFQN<Program>('Variables.p').sentences()
        getType(sentences[0]).should.be.eq('Number')
        getType(sentences[1]).should.be.eq('Number')
    })

    it('Simple expressions inference', () => {
        const sentences = environment.getNodeByFQN<Program>('Expressions.p').sentences()
        getType(sentences[0]).should.be.eq('Number')
        getType(sentences[1]).should.be.eq('Number')
    })

    it('Annotated method types', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').lookupMethod('m1', 0)!
        getType(method).should.be.eq('Number')
    })
    
    it('Method return inference', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').lookupMethod('m2', 0)!
        getType(method).should.be.eq('Number')
    })

    it('Method return if inference', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').lookupMethod('m3', 0)!
        getType(method).should.be.eq('Number')
    })

    it('Method union type inference', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').lookupMethod('m4', 0)!
        getType(method).should.be.eq('(Number | String)')
    })

    it('Max type inference', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').lookupMethod('m5', 1)!
        getType(method.parameters[0]).should.be.eq('o2')
        getType(method).should.be.eq('Boolean')
    })

    it('Max union type inference', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').lookupMethod('m6', 1)!
        getType(method.parameters[0]).should.be.eq('(o2 | o3)')
        getType(method).should.be.eq('(Boolean | Number)')
    })
})