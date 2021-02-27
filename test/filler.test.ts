import { should, use } from 'chai'
import { Catch, Class, Constructor, Field, If, Literal, Parameter, Reference, Singleton, Try, Variable, getter, setter } from '../src/builders'
import fill from '../src/filler'
import { fillerAssertions } from './assertions'


should()
use(fillerAssertions)

describe('Wollok filler', () => {

  it('fills non overrided accessors for properties', () => {
    fill(Class('C')(Field('p', { isProperty: true }))).methods().should.be.filledInto([
      getter('p'),
      setter('p'),
    ])

    const constructor = Constructor({ baseCall: { args: [], callsSuper: false } })()
    fill(Class('C')(constructor)).members.should.be.filledInto([constructor])
  })

  it('fills in wollok.lang.Object as default superclass for Singletons', () => {
    fill(Singleton('S')()).superclassRef.should.be.filledInto(Reference('wollok.lang.Object'))

    const superclassRef = Reference<'Class'>('foo')
    fill(Singleton('S', { superclassRef })()).superclassRef.should.be.filledInto(superclassRef)
  })

})