import { should, use } from 'chai'
import link from '../src/linker'
import { Class as ClassNode, descendants, Environment, Mixin as MixinNode, Package as PackageNode, Scope } from '../src/model'
import { also } from './assertions'

import { Class, Field, Mixin, Package } from './builders'

use(also)
should()

const WRE = Package('wollok')(Class('Object')())
const WREScope = (environment: Environment): Scope => {
  const wollokPackage = environment.members.filter(m => m.name === 'wollok')[0]
  return wollokPackage.members.reduce((scope, entity) => ({...scope, [entity.name || '']: entity.id }), {wollok: wollokPackage.id})
}

describe('Wollok linker', () => {

  const dropLinkedFields = (env: Environment) => JSON.parse(JSON.stringify(env, (k, v) => ['scope', 'id'].includes(k) ? undefined : v))

  it('should merge independent packages into a single environment', () => {
    dropLinkedFields(link([
      WRE,
      Package('A')(
        Package('B')(),
      ),
      Package('B')(),
      Package('C')(
        Class('B')(),
      ),
    ])).should.deep.equal(
      {
        kind: 'Environment',
        members: [
          WRE,
          Package('A')(
            Package('B')(),
          ),
          Package('B')(),
          Package('C')(
            Class('B')(),
          ),
        ],
      }
    )
  })

  it('should merge same name packages into a single package', () => {

    dropLinkedFields(link([
      WRE,
      Package('A')(
        Class('X')()
      ),
      Package('A')(
        Class('Y')()
      ),
      Package('B')(
        Class('X')()
      ),
    ])).should.deep.equal(
      {
        kind: 'Environment',
        members: [
          WRE,
          Package('A')(
            Class('X')(),
            Class('Y')(),
          ),
          Package('B')(
            Class('X')(),
          ),
        ],
      },
    )
  })

  it('should recursively merge same name packages into a single package', () => {

    dropLinkedFields(link([
      WRE,
      Package('A')(
        Package('B')(
          Class('X')(
            Field('u')
          ),
        ),
      ),
      Package('A')(
        Package('B')(
          Class('Y')(
            Field('v')
          ),
        ),
      ),
    ])).should.deep.equal(
      {
        kind: 'Environment',
        members: [
          WRE,
          Package('A')(
            Package('B')(
              Class('X')(
                Field('u')
              ),
              Class('Y')(
                Field('v')
              ),
            ),
          ),
        ],
      }
    )

  })

  it('should assign an id to all nodes', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('C')(),
        Package('q')(
          Mixin('M')()
        ),
      ),
    ])

    const nodes = [environment, ...descendants(environment)]
    nodes.forEach(node => {
      node.should.have.property('id')
    })
  })

  it('should link each node with the proper scope', () => {
    const environment = link([
      WRE,
      Package('p')(
        Class('C')(),
        Package('q')(
          Mixin('M')()
        )
      ),
    ])

    const p = environment.members[1] as PackageNode
    const C = p.members[0] as ClassNode
    const q = p.members[1] as PackageNode
    const M = q.members[0] as MixinNode

    p.should.have.property('scope').deep.equal({... WREScope(environment), p: p.id})
    C.should.have.property('scope').deep.equal({... WREScope(environment), p: p.id, C: C.id, q: q.id})
    q.should.have.property('scope').deep.equal({... WREScope(environment), p: p.id, C: C.id, q: q.id})
    M.should.have.property('scope').deep.equal({... WREScope(environment), p: p.id, C: C.id, q: q.id, M: M.id})
  })

})


// "parent" in {
//   val m = Method("m")
//   val c = Class("C", members = m :: Nil)
//   val q = Package("q", members = c :: Nil)
//   val p = Package("p", members = q :: Nil)
//   implicit val environment = Linker(p)

//   environment.parent should be(None)
//   p.parent should be(Some(environment))
//   q.parent should be(Some(p))
//   c.parent should be(Some(q))
//   m.parent should be(Some(c))
// }

// val objectClass = Class("Object")
// val wre = Package("wollok", members= Seq(objectClass))

// "scope" - {


//   "non-visible definitions should not be included on scope" in {
//     val m = Mixin("M")
//     val c = Class("C")
//     val r = Package("r", members = m :: Nil)
//     val q = Package("q", members = c :: Nil)
//     val p = Package("p", members = q :: r :: Nil)
//     implicit val environment = Linker(wre, p)

//     p.scope should equal (Map("wollok" -> wre, "Object" -> objectClass,"p" -> p))
//     q.scope should be(Map("wollok" -> wre, "Object" -> objectClass,"p" -> p, "q" -> q, "r" -> r))
//     r.scope should be(Map("wollok" -> wre, "Object" -> objectClass,"p" -> p, "q" -> q, "r" -> r))
//     c.scope should be(Map("wollok" -> wre, "Object" -> objectClass,"p" -> p, "q" -> q, "r" -> r, "C" -> c))
//     m.scope should be(Map("wollok" -> wre, "Object" -> objectClass,"p" -> p, "q" -> q, "r" -> r, "M" -> m))
//   }

//   "outer scope entries should be overrided by inner ones" in {
//     val m1cr = LocalReference("x")
//     val m1cp = Parameter("x")
//     val m1c = Closure(m1cp :: Nil, m1cr :: Nil)
//     val m1p = Parameter("x")
//     val m1 = Method("m1", parameters = m1p :: Nil, body = Some(m1c :: Nil))
//     val m2r = LocalReference("x")
//     val m2v = Variable("x", false)
//     val m2 = Method("m2", body = Some(m2v :: m2r :: Nil))
//     val f = Field("x", false)
//     val s = Singleton("x", members = f :: m1 :: m2 :: Nil)
//     val p = Package("x", members = s :: Nil)
//     implicit val environment = Linker(wre, p)

//     p.scope.apply("x") should be (p)
//     s.scope.apply("x") should be (s)
//     f.scope.apply("x") should be (f)
//     m1.scope.apply("x") should be (f)
//     m1p.scope.apply("x") should be (m1p)
//     m1c.scope.apply("x") should be (m1p)
//     m1cp.scope.apply("x") should be (m1cp)
//     m1cr.scope.apply("x") should be (m1cp)
//     m2.scope.apply("x") should be (f)
//     m2v.scope.apply("x") should be (m2v)
//     m2r.scope.apply("x") should be (m2v)
//   }

// }

// "target" - {

//   "local references should target the scope element they reference" in {
//     val r = LocalReference("a")
//     val p = Parameter("a")
//     val m = Method("m", parameters = p :: Nil, body = Some(r :: Nil))
//     val c = Class("C", members = m :: Nil)
//     val q = Package("q", members = c :: Nil)
//     implicit val environment = Linker(wre, q)

//     r.target should be(p)
//   }

//   "fully qualified references should target the global element they reference" in {
//     val r = FullyQualifiedReference("q" :: "S" :: Nil)
//     val m = Method("m", body = Some(r :: Nil))
//     val s = Singleton("S", members = m :: Nil)
//     val q = Package("q", members = s :: Nil)
//     implicit val environment = Linker(wre, q)

//     r.scope.get("q") should be(Some(q))
//     //r.target should be(s)
//   }

//   "fully qualified references should target the relative element they reference" in {
//     val r = FullyQualifiedReference("S" :: Nil)
//     val m = Method("m", body = Some(r :: Nil))
//     val s = Singleton("S", members = m :: Nil)
//     val q = Package("q", members = s :: Nil)
//     implicit val environment = Linker(wre, q)

//     r.target should be(s)
//   }

// }

// "ancestors" - {

//   "singleton literals should have ancestors" in {
//     val singletonLiteral = Singleton("")
//     implicit val environment = Linker(wre, Package("p", members = Seq(
//       Singleton("S", members=Seq(
//         Field("f", isReadOnly = false, Some(Literal(singletonLiteral)))
//       ))
//     )))

//     singletonLiteral.ancestors should be(singletonLiteral :: environment[Class]("wollok.Object") :: Nil)
//   }

// }

// }