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
        content: `object o { 
            @Type(returnType="wollok.lang.Number") 
            method m1() = 0 

            method m2() = self.m1()
        }`
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
        const method = environment.getNodeByFQN<Singleton>('Objects.o').methods()[0]
        getType(method).should.be.eq('Number')
    })
    
    it('Method return inference', () => {
        const method = environment.getNodeByFQN<Singleton>('Objects.o').methods()[1]
        getType(method).should.be.eq('Number')
    })
})