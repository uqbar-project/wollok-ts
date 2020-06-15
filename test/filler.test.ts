import { should, use } from 'chai'
import { Catch, Class, Constructor, Field, If, Literal, Parameter, Reference, Singleton, Try, Variable, getter, setter } from '../src/builders'
import fill from '../src/filler'
import { fillerAssertions } from './assertions'


should()
use(fillerAssertions)

describe('Wollok filler', () => {

  it('fills in wollok.lang.Object as default superclass for Classes', () => {
    fill(Class('C')()).superclassRef!.should.be.filledInto(Reference('wollok.lang.Object'))

    const superclassRef = Reference('foo')
    fill(Class('C', { superclassRef })()).superclassRef!.should.be.filledInto(superclassRef)
  })

  it('fills non overrided accessors for properties', () => {
    fill(Class('C')(Field('p', { isProperty: true }))).methods().should.be.filledInto([
      getter('p'),
      setter('p'),
    ])

    const constructor = Constructor({ baseCall: { args: [], callsSuper: false } })()
    fill(Class('C')(constructor)).members.should.be.filledInto([constructor])
  })

  it('fills in wollok.lang.Object as default superclass for Singletons', () => {
    fill(Singleton('S')()).superCall.should.be.filledInto({ superclassRef: Reference('wollok.lang.Object'), args: [] })

    const superCall = { superclassRef: Reference('foo'), args: [] }
    fill(Singleton('S', { superCall })()).superCall.should.be.filledInto(superCall)
  })

  it('fills in null as default initial value for Fields', () => {
    fill(Field('f')).value.should.be.filledInto(Literal(null))

    const value = Literal(5)
    fill(Field('f', { value })).value.should.be.filledInto(value)
  })

  it('fills in default base call for Constructors', () => {
    fill(Constructor()()).baseCall!.should.be.filledInto({ callsSuper: true, args: [] })

    const baseCall = { callsSuper: false, args: [] }
    fill(Constructor({ baseCall })()).baseCall!.should.be.filledInto(baseCall)
  })

  it('fills in null as default initial value for Variables', () => {
    fill(Variable('f')).value.should.be.filledInto(Literal(null))

    const value = Literal(5)
    fill(Variable('f', { value })).value.should.be.filledInto(value)
  })

  it('fills in missing else clause for Ifs', () => {
    fill(If(Literal(true), [Literal(true)])).elseBody.sentences.should.be.filledInto([])

    const elseBody = [Literal(false)]
    fill(If(Literal(true), [Literal(true)], elseBody)).elseBody.sentences.should.be.filledInto(elseBody)
  })

  it('fills in missing always clause for Trys', () => {
    fill(Try([Literal(true)], {})).always.sentences.should.be.filledInto([])

    const always = [Literal(false)]
    fill(Try([Literal(true)], { always })).always.sentences.should.be.filledInto(always)
  })

  it('fills in missing parameter type for Catches', () => {
    fill(Catch(Parameter('e'))()).parameterType.should.be.filledInto(Reference('wollok.lang.Exception'))

    const parameterType = Reference('foo')
    fill(Catch(Parameter('e'), { parameterType })()).parameterType.should.be.filledInto(parameterType)
  })

})