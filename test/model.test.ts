import { expect, should } from 'chai'
import { Class, Field, Method, Body, Reference, ParameterizedType, Package, Environment, Import, Singleton, Parameter, Entity } from '../src/model'
import { getCache } from '../src/decorators'
import { restore, stub } from 'sinon'
import { Evaluation, Interpreter, WRENatives, fromJSON, link } from '../src'
import wre from '../src/wre/wre.json'

should()

describe('Wollok model', () => {

  // TODO: Move to a decorators.test.ts file
  describe('cache', () => {

    it('should be populated the first time the node is used', () => {
      const method = new Method({ name: 'm', body: 'native', isOverride: false, parameters: [] })
      const node = new Class({ name: 'C', supertypes: [], members: [method] })
      stub(node, 'hierarchy').value([node])

      getCache(node).size.should.equal(0)
      const response = node.lookupMethod(method.name, method.parameters.length)
      response!.should.equal(method)
      getCache(node).get(`lookupMethod(${method.name},${method.parameters.length})`).should.equal(response)
    })

    it('should prevent a second call to the same method', () => {
      const method = new Method({ name: 'm1', body: 'native', isOverride: false, parameters: [] })
      const otherMethod = new Method({ name: 'm2', body: 'native', isOverride: false, parameters: [] })
      const node = new Class({ name: 'C', supertypes: [], members: [method] })
      stub(node, 'hierarchy').value([node])

      node.lookupMethod(method.name, method.parameters.length)
      getCache(node).set(`lookupMethod(${method.name},${method.parameters.length})`, otherMethod)

      node.lookupMethod(method.name, method.parameters.length)!.should.equal(otherMethod)
    })

  })

  describe('Node', () => {
    it('parentPackage', () => {
      const env = link([new Package({
        name: 'src',
        members: [
          new Package({
            name: 'pepitaFile',
            members: [
              new Singleton({ name: 'pepita' }),
            ],
          }),
        ],
      })], fromJSON<Environment>(wre))

      const pepita: Singleton = (env.members[1].members[0] as Package).members[0] as Singleton
      pepita.parentPackage?.name.should.equal('pepitaFile')
    })


  })

  describe('Method', () => {

    describe('isAbstract', () => {
      it('should return true for methods with no body', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        m.isAbstract().should.be.true
      })

      it('should return false for native methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1',  body: 'native' })
        m.isAbstract().should.be.false
      })

      it('should return false for non-abstract non-native methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1',  body: new Body({ id: 'b1',  sentences: [] }) })
        m.isAbstract().should.be.false
      })
    })

    describe('siblings', () => {
      const method = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1' })
      const siblingMethod = new Method({ name: 'm2', parameters: [], isOverride: false, id: 'm2' })
      const clazz = new Class({ name: 'C', supertypes: [], members: [method, siblingMethod], id: 'c1' })
      method.parent = clazz
      siblingMethod.parent = clazz

      it('should return its siblings (omitting the same node)', () => {
        method.siblings().should.deep.equal([siblingMethod])
      })
    })

    describe('label', () => {

      const environment = link([new Package({
        name: 'src',
        members: [
          new Package({
            name: 'pepitaFile',
            members: [
              new Singleton({
                name: 'pepita',
                members: [
                  new Method({ name: 'eat', parameters: [], isOverride: false, id: 'm1',  body: 'native' }),
                  new Method({
                    name: 'fly', parameters: [
                      new Parameter({ name: 'minutes' }),
                      new Parameter({ name: 'round' }),
                    ], isOverride: false, id: 'm1',  body: 'native',
                  }),
                ],
              }),
            ],
          }),
        ],
      })], fromJSON<Environment>(wre))

      it('should return the label for a method with no parameters', () => {
        const pepitaWKO = environment.getNodeByFQN('src.pepitaFile.pepita') as Singleton
        const method = pepitaWKO.methods[0]
        method.label.should.equal('src.pepitaFile.pepita.eat/0')
      })

      it('should return the label for a method with several parameters', () => {
        const pepitaWKO = environment.getNodeByFQN('src.pepitaFile.pepita') as Singleton
        const method = pepitaWKO.methods[1]
        method.label.should.equal('src.pepitaFile.pepita.fly/2')
      })

    })

    describe('fullLabel', () => {

      it('should return the full label for a method with no parameters', () => {
        const method = new Method({ name: 'fly', parameters: [], isOverride: false, id: 'm1',  body: 'native' })
        method.fullLabel.should.equal('fly()')
      })

      it('should return the full label for a method with several parameters', () => {
        const method = new Method({
          name: 'fly', parameters: [
            new Parameter({ name: 'minutes' }),
            new Parameter({ name: 'round' }),
          ], isOverride: false, id: 'm1',  body: 'native',
        })
        method.fullLabel.should.equal('fly(minutes, round)')
      })

    })
  })

  describe('Class', () => {

    describe('isAbstract', () => {

      afterEach(restore)

      it('should return true for classes with abstract methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        const c = new Class({ name: 'C', supertypes: [], members: [m], id: 'c1'  })
        stub(c, 'fullyQualifiedName').value('C')
        stub(c, 'hierarchy').value([c])

        c.isAbstract.should.be.true
      })

      it('should return true for classes with non-overriten inherited abstract methods', () => {
        const m = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        const b = new Class({ name: 'B', supertypes: [], members: [m], id: 'c1'  })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r'  })
        const c = new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: bRef })], id: 'c1' })
        stub(bRef, 'target').returns(b)
        stub(b, 'fullyQualifiedName').value('B')
        stub(c, 'fullyQualifiedName').value('C')
        stub(c, 'hierarchy').value([c, b])

        c.isAbstract.should.be.true
      })

      it('should return correct fields for subclasses', () => {
        const constB1 = new Field({ name: 'b1', isConstant: true  })
        const b = new Class({ name: 'B', supertypes: [], members: [constB1], id: 'c1'  })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r'  })
        const varC1 = new Field({ name: 'c1', isConstant: true  })
        const c = new Class({ name: 'C', members: [varC1], supertypes: [new ParameterizedType({ reference: bRef })], id: 'c1' })
        stub(bRef, 'target').returns(b)
        stub(b, 'fullyQualifiedName').value('B')
        stub(c, 'fullyQualifiedName').value('C')
        stub(c, 'hierarchy').value([c, b])

        c.lookupField('d1')?.should.be.not.ok
        c.lookupField('c1')?.should.be.ok
        c.lookupField('b1')?.should.be.ok
      })

      it('should return false for classes with no abstract methods', () => {
        const c = new Class({ name: 'C', id: 'c1' })
        stub(c, 'hierarchy').value([c])

        c.isAbstract.should.be.false
      })

      it('should return false for classes with implemented inherited abstract methods', () => {
        const m1 = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm1'  })
        const m2 = new Method({ name: 'm', parameters: [], isOverride: false, id: 'm2',  body: 'native' })
        const b = new Class({ name: 'B', supertypes: [], members: [m1], id: 'c1' })
        const bRef = new Reference<Class>({ name: 'B', id: 'b1r' })
        const c = new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: bRef })], members: [m2], id: 'c1' })

        stub(bRef, 'target').returns(b)
        stub(c, 'hierarchy').value([c])

        c.isAbstract.should.be.false
      })

    })

  })

  describe('Package', () => {
    const WRE: Environment = fromJSON(wre)
    const environment = link([new Package({
      name: 'pajaros',
      imports: [
        new Import({ isGeneric: false, entity: new Reference({ name: 'entrenador.tito' }) }),
        new Import({ isGeneric: true, entity: new Reference({ name: 'animales' }) }),
      ],
      members: [
        new Class({ name: 'Ave', members: [new Field({ name: 'amigues', isProperty: false, isConstant: true }), new Field({ name: 'energia', isProperty: false, isConstant: false }), new Method({ name: 'volar', body: new Body() })] }),
      ],
    }),
    new Package({
      name: 'entrenador',
      members: [
        new Singleton({ name: 'tito' }),
      ],
    }),
    new Package({
      name: 'animales',
      members: [
        new Singleton({ name: 'cabra' }),
        new Singleton({ name: 'cebra' }),
      ],
    })], WRE)
    new Interpreter(Evaluation.build(environment, WRENatives))
    const wollokPackage = environment.getNodeByFQN('pajaros') as Package

    describe('getNodeByQN', () => {

      it('should return an existing node filtering by QN', () => {
        const numberClass = wollokPackage.getNodeByQN('pajaros.Ave')
        numberClass.should.not.be.empty
      })

      it('should throw an error if node filtering by QN is not found', () => {
        expect(() => wollokPackage.getNodeByQN('pajaros.Map')).to.throw('Could not resolve reference to pajaros.Map from pajaros')
      })

    })

    describe('isConstant', () => {

      it('should return true if field is constant', () => {
        wollokPackage.isConstant('pajaros.Ave.amigues').should.be.true
      })

      it('should return false if field is variable', () => {
        wollokPackage.isConstant('pajaros.Ave.energia').should.be.false
      })

      it('should return false if field does not exist', () => {
        wollokPackage.isConstant('pajaros.Ave.edad').should.be.false
      })

    })

    describe('allScopedEntities', () => {

      it('should return all local and imported entities', () => {
        wollokPackage.allScopedEntities().map(entity => (entity as Entity).fullyQualifiedName).should.deep.equal([
          'pajaros.Ave',
          'entrenador.tito',
          'animales.cabra',
          'animales.cebra',
        ])
      })
    })

  })
})