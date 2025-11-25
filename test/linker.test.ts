import { GAME_MODULE, OBJECT_MODULE, REPL } from '../src'
import { getPotentiallyUninitializedLazy } from '../src/decorators'
import link, { canBeReferenced, linkInNode } from '../src/linker'
import { Body, Class, Closure, Describe, Environment, Field, Import, Method, Mixin, NamedArgument, Node, Package, Parameter, ParameterizedType, Reference, Return, Sentence, Singleton, Test, Variable, Literal } from '../src/model'
import * as parse from '../src/parser'
import { environmentWithEntities, WREEnvironment } from './utils'
import { beforeEach, describe, expect, it } from 'vitest'

const MINIMAL_LANG = environmentWithEntities(OBJECT_MODULE, GAME_MODULE)

describe('Wollok linker', () => {
  describe('initial repl package', () => {
    it('an environment should always include the REPL package', () => {
      expect([]).linkedInto([
        new Package({ name: REPL }),
      ])
    })
  })

  describe('merge', () => {

    it('should merge independent packages into a single environment', () => {
      expect([
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
      ]).linkedInto([
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
      expect([
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
      ]).linkedInto([
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
      expect([
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
      ]).linkedInto([
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
      expect([
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
      ]).linkedInto([
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
      ], WREEnvironment)

      const nextEnvironment = link([
        new Package({
          name: 'p',
          members: [new Class({ name: 'Y' })],
        }),
      ], baseEnvironment)

      const p = nextEnvironment.getNodeByFQN<Package>('p')
      const Y = p.members[0]

      expect(p.members).toHaveLength(1)
      expect(nextEnvironment.getNodeByFQN('p')).toEqual(p)
      expect(nextEnvironment.getNodeByFQN('p.Y')).toEqual(Y)
    })

    it('should replace merged packages imports', () => {
      expect([
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
      ]).linkedInto([
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
      expect([
        new Package({
          name: 'A',
          problems: [{ code: 'ERROR', level: 'error', values: [] }],
        }),
        new Package({ name: 'A' }),
      ]).linkedInto([
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
    ], WREEnvironment)

    expect(environment).toHaveProperty('id')
    environment.descendants.forEach(node => expect(node).toHaveProperty('id'))
  })

  describe('scopes', () => {

    it('references should target their definitions', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: OBJECT_MODULE }) })],
              members: [
                new Field({ name: 'f', isConstant: true, value: new Reference({ name: 'C' }) }),
                new Field({ name: 'g', isConstant: true, value: new Reference({ name: 'p' }) }),
                new Field({ name: 'h', isConstant: true, value: new Reference({ name: 'f' }) }),
              ],
            }),
          ],
        }),
      ], WREEnvironment)

      const Object = environment.getNodeByFQN<Class>(OBJECT_MODULE)
      const p = environment.getNodeByFQN<Package>('p')
      const C = environment.getNodeByFQN<Class>('p.C')
      const f = C.fields[0]
      const g = C.fields[1]
      const h = C.fields[2]

      expect(C.supertypes[0].reference).target(Object)
      expect(f.value!).target(C)
      expect(g.value!).target(p)
      expect(h.value!).target(f)
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
                  reference: new Reference({ name: OBJECT_MODULE }),
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
      ], WREEnvironment)

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

      expect(S.supertypes[0].args[0].value!).target(f)
      expect(f.value!).target(f)
      expect(m1.sentences[0]).target(m1.parameters[0])
      expect(closureReturn.value!).target(closure.methods[0].parameters[0])
      expect(m2var.value!).target(m2var)
      expect(m2.sentences[1]).target(m2var)
      expect(m3.sentences[0]).target(f)
      expect(C.supertypes[0].reference).target(S)
      expect(m4.sentences[0]).target(S)
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
      ], WREEnvironment)

      const A = environment.getNodeByFQN<Class>('p.A')
      const M = environment.getNodeByFQN<Class>('p.M')
      const C = environment.getNodeByFQN<Class>('p.C')

      expect(C.methods[0].sentences[0]).target(A.fields[0])
      expect(C.methods[0].sentences[1]).target(M.fields[0])
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
      ], WREEnvironment)

      const C = environment.getNodeByFQN<Class>('p.C')

      expect(C.methods[0].sentences[0]).target(C.fields[0])
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
      ], WREEnvironment)

      const C = environment.getNodeByFQN<Class>('p.C')

      expect(C.methods[0].sentences[0]).target(C.fields[0])
    })

    it('should target references to members inherited from superclass in different packages', () => {
      const environment = link([
        new Package({
          name: 'aaa',
          imports: [
            new Import({ isGeneric: true, entity: new Reference({ name: 'bbb' }) }),
          ],
          members: [
            new Class({
              name: 'C',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'B' }) })],
              members: [
                new Method({
                  name: 'm2',
                  body: new Body({ sentences: [new Literal({ value: '2' })] }),
                }),
              ],
            }),
          ],
        }),
        new Package({
          name: 'bbb',
          imports: [
            new Import({ isGeneric: true, entity: new Reference({ name: 'zzz' }) }),
          ],
          members: [
            new Class({
              name: 'B',
              supertypes: [new ParameterizedType({ reference: new Reference({ name: 'A' }) })],
              members: [
                new Method({
                  name: 'm',
                  body: new Body({ sentences: [new Reference({ name: 'x' })] }),
                }),
              ],
            }),
          ],
        }),
        new Package({
          name: 'zzz',
          members: [
            new Class({
              name: 'A', members: [
                new Field({ name: 'x', isConstant: false }),
              ],
            }),
          ],
        }),
      ], WREEnvironment)

      const C = environment.getNodeByFQN<Class>('aaa.C')
      const B = environment.getNodeByFQN<Class>('bbb.B')
      const A = environment.getNodeByFQN<Class>('zzz.A')

      expect(C.supertypes[0].reference).target(B)
      expect(B.supertypes[0].reference).target(A)
      expect(B.methods[0].sentences[0]).target(A.fields[0])
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
      ], WREEnvironment)

      const M = environment.getNodeByFQN<Class>('p.M')
      const C = environment.getNodeByFQN<Class>('p.C')

      expect(C.methods[0].sentences[0]).target(M.fields[0])
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
      ], WREEnvironment)

      const M = environment.getNodeByFQN<Class>('p.M')
      const C = environment.getNodeByFQN<Class>('p.C')

      expect(C.methods[0].sentences[0]).target(M.fields[0])
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
      ], WREEnvironment)

      const B = environment.getNodeByFQN<Class>('p.B')
      const C = environment.getNodeByFQN<Class>('p.C')

      expect(C.methods[0].sentences[0]).target(B.fields[0])
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
      ], WREEnvironment)

      const C = environment.getNodeByFQN<Class>('p.C')
      const D = environment.getNodeByFQN<Class>('p.D')
      const S = environment.getNodeByFQN<Class>('q.S')
      const T = environment.getNodeByFQN<Class>('r.T')

      expect(C.supertypes[0].reference).target(S)
      expect(D.supertypes[0].reference).target(T)
    })

    it('should not mix imported references with same name at different level', () => {
      const environment = link([
        new Package({
          name: 'p',
          imports: [
            new Import({ entity: new Reference({ name: 'q' }), isGeneric: true }),
          ],
          members: [
            new Singleton({ name: 'o', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'q' }) })] }),
          ],
        }),
        new Package({
          name: 'q',
          members: [
            new Singleton({ name: 'q' }),
          ],
        }),
      ], WREEnvironment)

      const p = environment.getNodeByFQN<Package>('p')
      const o = environment.getNodeByFQN<Singleton>('p.o')
      const packageQ = environment.getNodeByFQN<Package>('q')
      const objQ = environment.getNodeByFQN<Singleton>('q.q')

      expect(p.imports[0].entity).target(packageQ)
      expect(o.supertypes[0].reference).target(objQ)
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
      ], WREEnvironment)

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
      ], WREEnvironment)

      expect(() => environment.getNodeByFQN('p.C')).to.throw()
    })

    it('entities with string names should not be referenceable without the quotes', () => {
      const environment = link([
        new Package({
          name: 'p',
          members: [
            new Describe({ name: '"G"' }),
            new Test({ name: '"T"', body: new Body() }),
          ],
        }),
      ], WREEnvironment)

      expect(() => environment.getNodeByFQN('p.G')).to.throw()
      expect(() => environment.getNodeByFQN('p."G"')).to.not.throw()

      expect(() => environment.getNodeByFQN('p.T')).to.throw()
      expect(() => environment.getNodeByFQN('p."T"')).to.not.throw()
    })

    it('global packages should not override package definition', () => {
      const env = link([
        new Package({ name: 'game', members: [new Package({ name: 'p' })] }),
      ], MINIMAL_LANG)
      expect(env.getNodeByFQN<Package>('game.p')).to.be.ok
    })

  })

  describe('error handling', () => {

    it('should not merge packages with same name but different fqn', () => {
      const env = link([
        new Package({ name: 'lang', members: [new Package({ name: 'p' })] }),
      ], MINIMAL_LANG)
      expect(env.getNodeByFQN<Package>('lang.p')).to.be.ok
      expect(env.getNodeByFQN<Package>(OBJECT_MODULE)).to.be.ok
    })

    it('should not merge package with different file name', () => {
      const env = link([
        new Package({
          name: 'g', members: [
            new Package({ fileName: 'p.wlk', name: 'p' }),
            new Package({ fileName: 'p.wtest', name: 'p' }),
          ],
        }),
      ], WREEnvironment)
      expect(env.getNodeByFQN<Package>('g').members).to.have.length(2)
    })

    it('should import wlk files on fqn collisions', () => {
      const env = link([
        new Package({ fileName: 'p.wtest', name: 'p' }), // First declare the test
        new Package({ fileName: 'p.wlk', name: 'p' }),
        new Package({
          name: 'g',
          imports: [new Import({ entity: new Reference({ name: 'p' }) })],
        }),
      ], MINIMAL_LANG)
      const entity = env.getNodeByFQN<Package>('p')
      expect(entity.fileName).to.be.eql('p.wlk')
      expect(env.getNodeByFQN<Package>('g').imports[0].entity).target(entity)
    })

    it('should not crash with missing reference in imports', () =>
      link([
        new Package({
          name: 'p',
          imports: [new Import({ entity: new Reference({ name: 'q.A' }) })],
        }),
      ], WREEnvironment)
    )

    it('should not crash with missing reference in superclass', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'S' }) })] }),
          ],
        }),
      ], WREEnvironment)
    )

    it('should not crash with missing reference in mixin', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Mixin({ name: 'M1', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'M2' }) })] }),
          ],
        }),
      ], WREEnvironment)
    )

    it('should not crash if a class inherits from itself', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Class({ name: 'C', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'C' }) })] }),
          ],
        }),
      ], WREEnvironment)
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
      ], WREEnvironment)
    )

    it('should not crash if a mixin includes itself', () =>
      link([
        new Package({
          name: 'p',
          members: [
            new Mixin({ name: 'M', supertypes: [new ParameterizedType({ reference: new Reference({ name: 'M' }) })] }),
          ],
        }),
      ], WREEnvironment)
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
      ], WREEnvironment)
    )

  })

})

describe('can be referenced', () => {

  it('things that can be referenced', () => {
    expect(canBeReferenced(new Class({ name: 'A' }))).to.be.true
    expect(canBeReferenced(new Field({ name: 'A', isConstant: true }))).to.be.true
    expect(canBeReferenced(new Parameter({ name: 'A' }))).to.be.true
  })

  it('things that cannot be referenced', () => {
    expect(canBeReferenced(new Body())).to.be.undefined
  })

})

describe('link sentence in node', () => {
  const replPackage = new Package({ name: 'repl' })
  let environment: Environment
  let repl: Node
  let newSentence: Sentence

  beforeEach(() => {
    environment = link([replPackage], WREEnvironment)
    repl = environment.getNodeByFQN('repl')
    newSentence = parse.Variable.tryParse('const a = 4')
  })

  it('should link new nodes', () => {
    expect(newSentence.id).to.be.undefined
    expect(getPotentiallyUninitializedLazy(newSentence, 'parent')).to.be.undefined
    expect(getPotentiallyUninitializedLazy(newSentence, 'environment')).to.be.undefined

    linkInNode(newSentence, repl)
    expect(newSentence.id).to.be.ok
    expect(newSentence.environment).to.be.eq(environment)
    expect(newSentence.parent).to.be.eq(repl)
    expect(newSentence.children[0].parent).to.be.eq(newSentence)
  })

  it('should add new contributions to context scope', () => {
    expect(repl.scope.localContributions()).to.be.empty

    linkInNode(newSentence, repl)
    const [variableName] = repl.scope.localContributions()[0]
    expect(variableName).to.be.equal('a')
  })

})

describe('resolve all', () => {
  let environment: Environment
  beforeEach(() => {
    environment = link([
      new Package({
        name: 'src',
        members: [
          new Package({
            name: 'a',
            members: [
              new Class({ name: 'Foo' }),
            ],
          }),
          new Package({
            name: 'b',
            members: [
              new Class({ name: 'Foo' }),
            ],
          }),
          new Package({
            name: 'c',
            members: [
              new Package({ name: 'd', members: [new Class({ name: 'Foo' })] }),
            ],
          }),
        ],
      }),
    ], WREEnvironment)
  })
  it('should resolve all possible entities to a qualified name', () => {
    const hits = environment.scope.resolveAll('Foo')
    expect(hits).toHaveLength(3)
    expect(hits).toContain(environment.getNodeByFQN('src.a.Foo'))
    expect(hits).toContain(environment.getNodeByFQN('src.b.Foo'))
    expect(hits).toContain(environment.getNodeByFQN('src.c.d.Foo'))
  })

  it('should resolve a qualified name that partially matches the node fqn', () => {
    const hits = environment.scope.resolveAll('d.Foo')
    expect(hits).toHaveLength(1)
    expect(hits).toContain(environment.getNodeByFQN('src.c.d.Foo'))
  })

  it('shouldnt repeat nodes when it is imported from another package', () => {
    environment = link([new Package({ name: 'e', imports: [new Import({ isGeneric: true, entity: new Reference({ name: 'src.a' }) })] })], environment)
    const hits = environment.scope.resolveAll('Foo')
    expect(hits).toHaveLength(3)
    expect(hits).toContain(environment.getNodeByFQN('src.a.Foo'))
    expect(hits).toContain(environment.getNodeByFQN('src.b.Foo'))
    expect(hits).toContain(environment.getNodeByFQN('src.c.d.Foo'))
  })
})