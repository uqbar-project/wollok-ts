import { expect, should, use } from 'chai'
import { divideOn } from '../src/extensions'
import { fromJSON } from '../src/jsonUtils'
import link from '../src/linker'
import { Body, Class, Closure, Describe, Environment, Field, Import, Method, Mixin, NamedArgument, Package, Parameter, ParameterizedType, Reference, Return, Singleton, Test, Variable } from '../src/model'
import wre from '../src/wre/wre.json'
import { linkerAssertions } from './assertions'


should()
use(linkerAssertions)


// TODO: Split uber-tests into smaller tests with clearer descriptions (??)
// TODO: How about creting FQN for more nodes? Like p.q.C.m(0) ? YES!
const WRE: Environment = fromJSON(wre)

const MINIMAL_LANG = link([newPackageWith(WRE, 'wollok.lang.Object')])

describe('Wollok linker', () => {

  describe('merge', () => {

    it('should merge independent packages into a single environment', () => {
      [
        ...MINIMAL_LANG.members,
        new Package({
          name: 'A',
          members: [
            new Package({ name: 'B' }),
          ],
        }),
        new Package({ name: 'B' }),
        new Package({
          name: 'C',
          members: [
            new Class({ name: 'B' }),
          ],
        }),
      ].should.be.linkedInto([
        ...MINIMAL_LANG.members,
        new Package({
          name: 'A',
          members: [
            new Package({ name: 'B' }),
          ],
        }),
        new Package({ name: 'B' }),
        new Package({
          name: 'C',
          members: [
            new Class({ name: 'B' }),
          ],
        }),
      ])
    })

    it('should merge same name packages into a single package', () => {
      [
        ...MINIMAL_LANG.members,
        new Package({
          name: 'A',
          members: [
            new Class({ name: 'X' }),
          ],
        }),
        new Package({
          name: 'A',
          members: [
            new Class({ name: 'Y' }),
          ],
        }),
        new Package({
          name: 'B',
          members: [
            new Class({ name: 'X' }),
          ],
        }),
      ].should.be.linkedInto([
        ...MINIMAL_LANG.members,
        new Package({
          name: 'A',
          members: [
            new Class({ name: 'Y' }),
          ],
        }),
        new Package({
          name: 'B',
          members: [
            new Class({ name: 'X' }),
          ],
        }),
      ])
    })

    it('should recursively override same name packages with new package', () => {
      [
        new Package({
          name: 'A',
          members: [
            new Package({
              name: 'B',
              members: [
                new Class({ name: 'X' }),
              ],
            }),
            new Package({ name: 'C' }),
          ],
        }),
        new Package({
          name: 'A',
          members: [
            new Package({
              name: 'B',
              members: [
                new Class({ name: 'Y' }),
              ],
            }),
          ],
        }),
        ...MINIMAL_LANG.members,
      ].should.be.linkedInto([
        new Package({
          name: 'A',
          members: [
            new Package({ name: 'C' }),
            new Package({
              name: 'B',
              members: [
                new Class({ name: 'Y' }),
              ],
            }),
          ],
        }),
        ...MINIMAL_LANG.members,
      ])
    })

    it('should replace old entities prioritizing right to left', () => {
      [
        ...MINIMAL_LANG.members,
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'X', members: [new Field({ name: 'x', isConstant: true })] }),
          ],
        }),
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'X', members: [new Field({ name: 'y', isConstant: true })] }),
          ],
        }),
      ].should.be.linkedInto([
        ...MINIMAL_LANG.members,
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'X', members: [new Field({ name: 'y', isConstant: true })] }),
          ],
        }),
      ])
    })

    it('should re-scope merged packages to find new elements', () => {
      const baseEnvironment = link([
        new Package({
          name: 'p',
          members: [new Class({ name: 'X' })],
        }),
      ], WRE)

      const nextEnvironment = link([
        new Package({
          name: 'p',
          members: [new Class({ name: 'Y' })],
        }),
      ], baseEnvironment)

      const p = nextEnvironment.members[1]
      const Y = p.members[0]

      p.members.should.have.lengthOf(1)
      nextEnvironment.getNodeByFQN('p').should.equal(p)
      nextEnvironment.getNodeByFQN('p.Y').should.equal(Y)
    })

    it('should replace merged packages imports', () => {
      [
        new Package({
          name: 'A',
          imports: [
            new Import({ isGeneric: true, entity: new Reference({ name: 'B' }) }),
            new Import({ isGeneric: true, entity: new Reference({ name: 'C' }) }),
          ],
        }),
        new Package({
          name: 'A',
          imports: [
            new Import({ isGeneric: true, entity: new Reference({ name: 'B' }) }),
            new Import({ isGeneric: true, entity: new Reference({ name: 'D' }) }),
          ],
        }),
        new Package({ name: 'B' }),
        new Package({ name: 'C' }),
        new Package({ name: 'D' }),
      ].should.be.linkedInto([
        new Package({
          name: 'A',
          imports: [
            new Import({ isGeneric: true, entity: new Reference({ name: 'B' }) }),
            new Import({ isGeneric: true, entity: new Reference({ name: 'D' }) }),
          ],
        }),
        new Package({ name: 'B' }),
        new Package({ name: 'C' }),
        new Package({ name: 'D' }),
      ])
    })

    it('should replace merged packages problems', () => {
      [
        new Package({
          name: 'A',
          problems: [{ code: 'ERROR', level: 'error', values: [] }],
        }),
        new Package({ name: 'A' }),
      ].should.be.linkedInto([
        new Package({ name: 'A' }),
      ])
    })

  })


  it('should assign an id to all nodes', () => {
    const environment = link([
      new Package({
        name: 'p',
        members: [
          new Class({ name: 'C' }),
          new Package({
            name: 'q',
            members: [new Mixin({ name: 'X' })],
          }),
        ],
      }),
    ], WRE)

    environment.should.have.property('id')
    environment.descendants.forEach(node => node.should.have.property('id'))
  })

  describe('scopes', () => {

    it('references should target their definitions', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'wollok.lang.Object' }) })],
              members: [
                new Field({ name: 'f', isConstant: true, value: new Reference({ name: 'C' }) }),
                new Field({ name: 'g', isConstant: true, value: new Reference({ name: 'p' }) }),
                new Field({ name: 'h', isConstant: true, value: new Reference({ name: 'f' }) }),
              ],
            }),
          ],
        }),
      ], WRE)

      const Object = environment.getNodeByFQN<Class>('wollok.lang.Object')
      const p = environment.getNodeByFQN<Package>('p')
      const C = environment.getNodeByFQN<Class>('p.C')
      const f = C.fields[0]
      const g = C.fields[1]
      const h = C.fields[2]

      C.supertypes[0].reference.should.target(Object)
      f.value!.should.target(C)
      g.value!.should.target(p)
      h.value!.should.target(f)
    })

    it('should override targets according to scope level', () => {
      const environment = link([
        new Package({
          name: 'x',
          members: [
            new Singleton({
              name: 'x',
              supertypes: [
                new ParameterizedType({
                  reference: new Reference({ name: 'wollok.lang.Object' }),
                  args: [new NamedArgument({ name: 'x', value: new Reference({ name: 'x' }) })],
                }),
              ],
              members: [
                new Field({ name: 'x', isConstant: false, value: new Reference({ name: 'x' }) }),
                new Method({
                  name: 'm1',
                  parameters: [new Parameter({ name: 'x' })],
                  body: new Body({
                    sentences: [
                      new Reference({ name: 'x' }),
                      Closure({
                        parameters: [new Parameter({ name: 'x' })],
                        sentences: [
                          new Return({ value: new Reference({ name: 'x' }) }),
                        ],
                      }),
                    ],
                  }),
                }),
                new Method({
                  name: 'm2',
                  body: new Body({
                    sentences: [
                      new Variable({ name: 'x', isConstant: false, value: new Reference({ name: 'x' }) }),
                      new Reference({ name: 'x' }),
                    ],
                  }),
                }),
                new Method({
                  name: 'm3',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'x' }) })] }),
            new Class({
              name: 'D', members: [
                new Method({ name: 'm4', body: new Body({ sentences: [new Reference({ name: 'x' })] }) }),
              ],
            }),
          ],
        }),
      ], WRE)

      const S = environment.getNodeByFQN<Singleton>('x.x')
      const C = environment.getNodeByFQN<Class>('x.C')
      const D = environment.getNodeByFQN<Class>('x.D')
      const f = S.fields[0]
      const m1 = S.methods[0]
      const closure = m1.sentences[1] as Singleton
      const closureReturn = closure.methods[0].sentences[0] as Return
      const m2 = S.methods[1]
      const m2var = m2.sentences[0] as Variable
      const m3 = S.methods[2]
      const m4 = D.methods[0]

      S.supertypes[0].args[0].value!.should.target(f)
      f.value!.should.target(f)
      m1.sentences[0].should.target(m1.parameters[0])
      closureReturn.value!.should.target(closure.methods[0].parameters[0])
      m2var.value!.should.target(m2var)
      m2.sentences[1].should.target(m2var)
      m3.sentences[0].should.target(f)
      C.supertypes[0].reference.should.target(S)
      m4.sentences[0].should.target(S)
    })

    it('should target inherited members', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Mixin({
              name: 'M', members: [
                new Field({ name: 'y', isConstant: false }),
              ],
            }),
            new Class({
              name: 'A', members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Class({ name: 'B', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A' }) })] }),
            new Class({
              name: 'C',
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                new ParameterizedType({ reference: new Reference({ name: 'B' }) }),
              ],
              members: [
                new Method({
                  name: 'm',
                  body: new Body({
                    sentences: [
                      new Reference({ name: 'x' }),
                      new Reference({ name: 'y' }),
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const A = environment.getNodeByFQN<Class>('p.A')
      const M = environment.getNodeByFQN<Class>('p.M')
      const C = environment.getNodeByFQN<Class>('p.C')

      C.methods[0].sentences[0].should.target(A.fields[0])
      C.methods[0].sentences[1].should.target(M.fields[0])
    })

    it('should target local overriden references to members inherited from mixins', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Mixin({
              name: 'M', members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'M' }) })],
              members: [
                new Field({ name: 'x', isConstant: false }),
                new Method({
                  name: 'm',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const C = environment.getNodeByFQN<Class>('p.C')

      C.methods[0].sentences[0].should.target(C.fields[0])
    })

    it('should target local overriden references to members inherited from superclass', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Class({
              name: 'A', members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Class({ name: 'B', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A' }) })] }),
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'B' }) })],
              members: [
                new Field({ name: 'x', isConstant: false }),
                new Method({
                  name: 'm',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const C = environment.getNodeByFQN<Class>('p.C')

      C.methods[0].sentences[0].should.target(C.fields[0])
    })

    it('should target references overriden on mixins to members inherited from superclass', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Mixin({
              name: 'M', members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Class({
              name: 'A', members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Class({
              name: 'C',
              supertypes: [
                new ParameterizedType({ reference: new Reference({ name: 'M' }) }),
                new ParameterizedType({ reference: new Reference({ name: 'A' }) }),
              ],
              members: [
                new Method({
                  name: 'm',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const M = environment.getNodeByFQN<Class>('p.M')
      const C = environment.getNodeByFQN<Class>('p.C')

      C.methods[0].sentences[0].should.target(M.fields[0])
    })

    it('should target references overriden on mixins to members inherited from other mixins', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Mixin({
              name: 'M',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'N' }) })],
              members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Mixin({
              name: 'N',
              members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'M' }) })],
              members: [
                new Method({
                  name: 'm',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const M = environment.getNodeByFQN<Class>('p.M')
      const C = environment.getNodeByFQN<Class>('p.C')

      C.methods[0].sentences[0].should.target(M.fields[0])
    })

    it('should target references overriden on superclass to members inherited from further superclass', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Class({
              name: 'A',
              members: [new Field({ name: 'x', isConstant: false })],
            }),
            new Class({
              name: 'B',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A' }) })],
              members: [new Field({ name: 'x', isConstant: false })],
            }),
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'B' }) })],
              members: [
                new Method({
                  name: 'm',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
          ],
        }),
      ], WRE)

      const B = environment.getNodeByFQN<Class>('p.B')
      const C = environment.getNodeByFQN<Class>('p.C')

      C.methods[0].sentences[0].should.target(B.fields[0])
    })

    it('should target imported references', () => {
      const environment = link([
        new Package({
          name: 'p',
          imports: [
            new Import({ entity: new Reference({ name: 'q' }), isGeneric: true }),
            new Import({ entity: new Reference({ name: 'r.T' }) }),
          ],
          members: [
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'S' }) })] }),
            new Class({ name: 'D', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'T' }) })] }),
          ],
        }),
        new Package({
          name: 'q',
          members: [
            new Class({ name: 'S' }),
          ],
        }),
        new Package({
          name: 'r',
          members: [
            new Class({ name: 'T' }),
          ],
        }),
      ], WRE)

      const C = environment.getNodeByFQN<Class>('p.C')
      const D = environment.getNodeByFQN<Class>('p.D')
      const S = environment.getNodeByFQN<Class>('q.S')
      const T = environment.getNodeByFQN<Class>('r.T')

      C.supertypes[0].reference.should.target(S)
      D.supertypes[0].reference.should.target(T)
    })

    it('qualified references should not consider parent scopes for non-root steps', () => {
      const environment = link([
        new Package({
          name: 'p',
          imports: [new Import({ entity: new Reference({ name: 'r.C' }) })],
          members: [
            new Package({ name: 'q' }),
            new Singleton({ name: 's' }),
          ],
        }),
        new Package({
          name: 'r',
          members: [
            new Class({ name: 'C' }),
          ],
        }),
      ], WRE)

      expect(() => environment.getNodeByFQN('p.q.s')).to.throw()
    })

    it('packages should not make imported members referenceable from outside', () => {
      const environment = link([
        new Package({
          name: 'p',
          imports: [new Import({ entity: new Reference({ name: 'r.C' }) })],
        }),
        new Package({
          name: 'r',
          members: [
            new Class({ name: 'C' }),
          ],
        }),
      ], WRE)

      expect(() => environment.getNodeByFQN('p.C')).to.throw()
    })

    it('Entities with string names should not be referenceable without the quotes', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Describe({ name: '"G"' }),
            new Test({ name: '"T"', body: new Body() }),
          ],
        }),
      ], WRE)

      expect(() => environment.getNodeByFQN('p.G')).to.throw()
      expect(() => environment.getNodeByFQN('p."G"')).to.not.throw()

      expect(() => environment.getNodeByFQN('p.T')).to.throw()
      expect(() => environment.getNodeByFQN('p."T"')).to.not.throw()
    })

  })

  describe('error handling', () => {

    it('should not merge packages with same name but different fqn', () => {
      const env = link([
        new Package({ name: 'lang', members: [new Package({ name: 'p' })] }),
      ], MINIMAL_LANG)
      env.getNodeByFQN<Package>('lang.p').should.be.ok
      env.getNodeByFQN<Package>('wollok.lang.Object').should.be.ok
    })

    it('should not merge package with different file name', () => {
      const env = link([
        new Package({
          name: 'g', members: [
            new Package({ fileName: 'p.wlk', name: 'p' }),
            new Package({ fileName: 'p.wtest', name: 'p' }),
          ],
        }),
      ], WRE)
      env.getNodeByFQN<Package>('g').members.should.have.length(2)
    })

    it('should not crash with missing reference in imports', () =>
      link([
        new Package({
          name: 'p',
          imports: [new Import({ entity: new Reference({ name: 'q.A' }) })],
        }),
      ], WRE)
    )

    it('should not crash with missing reference in superclass', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'S' }) })] }),
          ],
        }),
      ], WRE)
    )

    it('should not crash with missing reference in mixin', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Mixin({ name: 'M1', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'M2' }) })] }),
          ],
        }),
      ], WRE)
    )

    it('should not crash if a class inherits from itself', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'C' }) })] }),
          ],
        }),
      ], WRE)
    )

    it('should not crash if there is an inheritance cycle', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'A', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'C' }) })] }),
            new Class({ name: 'B', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A' }) })] }),
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'B' }) })] }),
          ],
        }),
      ], WRE)
    )

    it('should not crash if a mixin includes itself', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Mixin({ name: 'M', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'M' }) })] }),
          ],
        }),
      ], WRE)
    )

    it('should not crash if there is a mixin linearization cycle', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Mixin({ name: 'A', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'C' }) })] }),
            new Mixin({ name: 'B', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A' }) })] }),
            new Mixin({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'B' }) })] }),
          ],
        }),
      ], WRE)
    )

  })

})

function newPackageWith(env: Environment, fullFQN: string) {

  const buildNewPackages = (_fqn: string): Package => {
    const [start, rest] = divideOn('.')(_fqn)

    return rest.length
      ? new Package({ name: start, members: [buildNewPackages(rest)] })
      : link([], env).getNodeByFQN(fullFQN) // Finish with the real node
  }

  return buildNewPackages(fullFQN)
}