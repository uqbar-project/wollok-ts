import { should } from 'chai'
import { Catch, Class, Constructor, Field, If, Literal, Parameter, Reference, Singleton, Try, Variable } from '../src/builders'
import fill from '../src/filler'

should()

describe('Wollok filler', () => {

  it('fills in wollok.lang.Object as default superclass for Classes', () => {
    fill(Class('C')()).superclass!.should.deep.equal(
      Reference('wollok.lang.Object')
    )

    const superclass = Reference('foo')
    fill(Class('C', { superclass })()).superclass!.should.deep.equal(superclass)
  })

  it('fills in default constructor for classes with no constructor', () => {
    fill(Class('C')()).members[0].should.deep.equal(
      Constructor({ baseCall: { args: [], callsSuper: true } })()
    )

    const constructor = Constructor({ baseCall: { args: [], callsSuper: false } })()
    fill(Class('C')(constructor)).members.should.deep.equal([constructor])
  })

  it('fills in wollok.lang.Object as default superclass for Singletons', () => {
    fill(Singleton('S')()).superCall.should.deep.equal(
      { superclass: Reference('wollok.lang.Object'), args: [] }
    )

    const superCall = { superclass: Reference('foo'), args: [] }
    fill(Singleton('S', { superCall })()).superCall.should.deep.equal(superCall)
  })

  it('fills in null as default initial value for Fields', () => {
    fill(Field('f')).value.should.deep.equal(Literal(null))

    const value = Literal(5)
    fill(Field('f', { value })).value.should.deep.equal(value)
  })

  it('fills in default base call for Constructors', () => {
    fill(Constructor()()).baseCall.should.deep.equal(
      { callsSuper: true, args: [] }
    )

    const baseCall = { callsSuper: false, args: [] }
    fill(Constructor({ baseCall })()).baseCall.should.deep.equal(baseCall)
  })

  it('fills in null as default initial value for Variables', () => {
    fill(Variable('f')).value.should.deep.equal(Literal(null))

    const value = Literal(5)
    fill(Variable('f', { value })).value.should.deep.equal(value)
  })

  it('fills in missing else clause for Ifs', () => {
    fill(If(Literal(true), [Literal(true)])).elseBody.sentences.should.deep.equal([])

    const elseBody = [Literal(false)]
    fill(If(Literal(true), [Literal(true)], elseBody)).elseBody.sentences.should.deep.equal(elseBody)
  })

  it('fills in missing always clause for Trys', () => {
    fill(Try([Literal(true)], {})).always.sentences.should.deep.equal([])

    const always = [Literal(false)]
    fill(Try([Literal(true)], { always })).always.sentences.should.deep.equal(always)
  })

  it('fills in missing parameter type for Catches', () => {
    fill(Catch(Parameter('e'))()).parameterType.should.deep.equal(Reference('wollok.lang.Exception'))

    const parameterType = Reference('foo')
    fill(Catch(Parameter('e'), { parameterType })()).parameterType.should.deep.equal(parameterType)
  })

})