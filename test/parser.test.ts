import { should, use } from 'chai'
import Parse from '../src/parser'
import { parserAssertions } from './assertions'

use(parserAssertions)
should()

describe('Wollok parser', () => {

  describe('Literals', () => {
    const parser = Parse.Literal

    describe('Booleans', () => {

      it('should parse "true"', () => {
        'true'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: true,
        }).and.be.tracedTo(0, 4)
      })

      it('should parse "false"', () => {
        'false'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: false,
        }).and.be.tracedTo(0, 5)
      })

    })

    describe('Null', () => {

      it('should parse "null"', () => {
        'null'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: null,
        }).and.be.tracedTo(0, 4)
      })

    })

    describe('Numbers', () => {

      it('should parse "10"', () => {
        '10'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 10,
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "-1"', () => {
        '-1'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: -1,
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "1.5"', () => {
        '1.5'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: 1.5,
        }).and.be.tracedTo(0, 3)
      })

      it('should parse "-1.5"', () => {
        '-1.5'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: -1.5,
        }).and.be.tracedTo(0, 4)
      })

      it('should not parse "1."', () => {
        '1.'.should.not.be.parsedBy(parser)
      })

      it('should not parse ".5"', () => {
        '.5'.should.not.be.parsedBy(parser)
      })

    })

    describe('Strings', () => {

      it('should parse "foo"', () => {
        '"foo"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: "foo",
        }).and.be.tracedTo(0, 5)
      })

      it('should parse ""', () => {
        '""'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: "",
        }).and.be.tracedTo(0, 2)
      })
 
      it('should parse "foo\nbar"', () => {
        '"foo\nbar"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: "foo\nbar",
        }).and.be.tracedTo(0, 10)
      })

      it('should parse "foo\\nbar"', () => {
        '"foo\\nbar"'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: "foo\\nbar",
        }).and.be.tracedTo(0, 11)
      })

      it('should not parse "foo\xbar"', () => {
        '"foo\xbar"'.should.not.be.parsedBy(parser)
      })

    })

    describe('Collections', () => {
      
      it('should parse "[]"', () => {
        '[]'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
                  kind: 'Reference',
                  name: '',
                }],
            className: {
              kind: 'Reference',
              name: 'wollok.List',
            }
          },
        }).and.be.tracedTo(0, 2)
      })

      it('should parse "[1,2,3]"', () => {
        '[1,2,3]'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
              kind: 'Literal',
              value: 1,
              },{
              kind: 'Literal',
              value: 2,
              },{
              kind: 'Literal',
              value: 3,
              }
            ],
            className: {
              kind: 'Reference',
              name: 'wollok.List',
            }
          },
        }).and.be.tracedTo(0, 7)
      })

      it('should parse "#{}"', () => {
        '#{}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
                  kind: 'Reference',
                  name: '',
                }],
            className: {
              kind: 'Reference',
              name: 'wollok.Set',
            }
          },
        }).and.be.tracedTo(0, 3)
      })

      it('should parse "#{1,2,3}"', () => {
        '#{1,2,3}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'New',
            args: [{
              kind: 'Literal',
              value: 1,
              },{
              kind: 'Literal',
              value: 2,
              },{
              kind: 'Literal',
              value: 3,
              }
            ],
            className: {
              kind: 'Reference',
              name: 'wollok.Set',
            }
          },
        }).and.be.tracedTo(0, 8)
      })

    })

    /*
    describe('Objects', () => {
      it('should parse "object {}"', () => {
        'object {}'.should.be.parsedBy(parser).into({
          kind: 'Literal',
          value: {
            kind: 'Singleton',
          },
        }).and.be.tracedTo(0, 9)
      })
    })*/

    //   """object {}""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("")))
    //   """object { var v; method m(){} }""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("", members = Field("v", false) :: Method("m") :: Nil)))
    //   """object inherits D {}""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("", Some("D", Nil))))
    //   """object inherits D(5) {}""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("", Some("D", Literal(5) :: Nil))))
    //   """object inherits D mixed with M {}""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("", Some("D", Nil), "M" :: Nil)))
    //   """object inherits D mixed with M and N {}""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("", Some("D", Nil), ("N": FullyQualifiedReference) :: ("M": FullyQualifiedReference) :: Nil)))
    //   """object mixed with M and N {}""" should beParsedTo[Literal[Singleton], Expression] (Literal(Singleton("", None, ("N": FullyQualifiedReference) :: ("M": FullyQualifiedReference) :: Nil)))
    //   """object { constructor(){} }""" should not (beParsed())
    //   """object""" should not (beParsed())
    //   """object inherits D inherits E""" should not (beParsed())
    //   """object inherits {}""" should not (beParsed())
    //   """object inherits""" should not (beParsed())
    //   """object mixed with {}""" should not (beParsed())
    //   """object mixed with""" should not (beParsed())

    //   """{}""" should beParsedTo[Literal[Singleton], Expression] (Closure())
    //   """{ => }""" should beParsedTo[Literal[Singleton], Expression] (Closure())
    //   """{ a }""" should beParsedTo[Literal[Singleton], Expression] (Closure(Nil, LocalReference("a") :: Nil))
    //   """{ a => }""" should beParsedTo[Literal[Singleton], Expression] (Closure(Parameter("a") :: Nil))
    //   """{ a => a }""" should beParsedTo[Literal[Singleton], Expression] (Closure(Parameter("a") :: Nil, LocalReference("a") :: Nil))
    //   """{ a => a; b }""" should beParsedTo[Literal[Singleton], Expression] (Closure(Parameter("a") :: Nil, LocalReference("a") :: LocalReference("b") :: Nil))
    //   """{ a,b => a }""" should beParsedTo[Literal[Singleton], Expression] (Closure(Parameter("a") :: Parameter("b") :: Nil, LocalReference("a") :: Nil))
    //   """{ a,b... => a }""" should beParsedTo[Literal[Singleton], Expression] (Closure(Parameter("a") :: Parameter("b", true) :: Nil, LocalReference("a") :: Nil))
    //   """{ a, b c }""" should not (beParsed())

  })

})


// "Wollok parser" - {

//   //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//   // COMMON
//   //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

//   "comments" in {
//     implicit val parser = importStatement

//     """import /* some comment */ p""" should beParsedTo(Import("p", false))
//     "import //some comment \n p" should beParsedTo(Import("p", false))
//     "// import p \n //import p" should not (beParsed())
//     """/* import p */""" should not (beParsed())
//     """import p/* non closed comment""" should not (beParsed())
//   }

//   "name" in {
//     implicit val parser = name

//     """_foo123""" should beParsedTo ("_foo123")
//     """foo bar""" should not (beParsed())
//     """4foo""" should not (beParsed())
//     """==""" should not (beParsed())
//   }

//   "local reference" in {
//     implicit val parser = localReference

//     """_foo123""" should beParsedTo (LocalReference("_foo123"))
//     """foo bar""" should not (beParsed())
//     """4foo""" should not (beParsed())
//     """==""" should not (beParsed())
//   }

//   "fully qualified reference" in {
//     implicit val parser = fullyQualifiedReference

//     """C""" should beParsedTo(FullyQualifiedReference("C" :: Nil))
//     """p.q.C""" should beParsedTo(FullyQualifiedReference("p" :: "q" :: "C" :: Nil))
//     """p.q.""" should not (beParsed())
//     """.q.C""" should not (beParsed())
//     """.""" should not (beParsed())
//     """p.*""" should not (beParsed())
//   }

//   //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//   // TOP LEVEL
//   //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

//   "file" in {
//     implicit val parser = file

//     """""" should beParsedTo (Package(""))
//     """import p import q class C {}""" should beParsedTo (Package("", Import("p") :: Import("q") :: Nil, Class("C") :: Nil))
//   }

//   "import" in {
//     implicit val parser = importStatement

//     """import p""" should beParsedTo (Import("p"))
//     """import p.q.*""" should beParsedTo (Import("p.q", true))
//     """import p.*.q""" should not (beParsed())
//     """import *""" should not (beParsed())
//   }

//   "program" in {
//     implicit val parser = programDef

//     """program name { }""" should beParsedTo (Program("name"))
//     """program name { var x }""" should beParsedTo (Program("name", Variable("x", false) :: Nil))
//     """program { }""" should not (beParsed())
//     """program""" should not (beParsed())
//   }

//   "test" in {
//     implicit val parser = testDef

//     """test "name" { }""" should beParsedTo (Test(Literal("name")))
//     """test "name" { var x }""" should beParsedTo (Test(Literal("name"), Variable("x", false) :: Nil))
//     """test name { }""" should not (beParsed())
//     """test { }""" should not (beParsed())
//     """test""" should not (beParsed())
//   }

//   "package" in {
//     implicit val parser = packageDef

//     """package p {}""" should beParsedTo (Package("p"))
//     """package p { class C {} }""" should beParsedTo (Package("p", members = Class("C", None, Nil, Nil) :: Nil))
//     """package p { class C {} class D {} }""" should beParsedTo (Package("p", members = Class("C") :: Class("D") :: Nil))
//     """package p {}""" should beParsedTo (Package("p"))
//     """package p""" should not (beParsed())
//   }

//   "class" in {
//     implicit val parser = classDef

//     """class C {}""" should beParsedTo (Class("C"))
//     """class C { constructor() {} }""" should beParsedTo (Class("C", members = Constructor() :: Nil))
//     """class C { var v; method m(){} }""" should beParsedTo (Class("C", members = Field("v", false) :: Method("m") :: Nil))
//     """class C inherits D {}""" should beParsedTo (Class("C", Some("D")))
//     """class C inherits D mixed with M {}""" should beParsedTo (Class("C", Some("D"), "M" :: Nil))
//     """class C inherits D mixed with M and N {}""" should beParsedTo (Class("C", Some("D"), ("N": FullyQualifiedReference) :: ("M": FullyQualifiedReference) :: Nil))
//     """class C mixed with M and N {}""" should beParsedTo (Class("C", None, ("N": FullyQualifiedReference) :: ("M": FullyQualifiedReference) :: Nil))
//     """class""" should not (beParsed())
//     """class {}""" should not (beParsed())
//     """class C""" should not (beParsed())
//     """class C inherits D inherits E""" should not (beParsed())
//     """class C inherits {}""" should not (beParsed())
//     """class C inherits""" should not (beParsed())
//     """class C mixed with {}""" should not (beParsed())
//     """class C mixed with""" should not (beParsed())
//   }

//   "mixin" in {
//     implicit val parser = mixinDef

//     """mixin M {}""" should beParsedTo (Mixin("M"))
//     """mixin M { var v; method m(){} }""" should beParsedTo (Mixin("M", members = Field("v", false) :: Method("m") :: Nil))
//     """mixin M { constructor(){} }""" should not (beParsed())
//     """mixin""" should not (beParsed())
//     """mixin {}""" should not (beParsed())
//     """mixin M""" should not (beParsed())
//   }

//   "singleton" in {
//     implicit val parser = singletonDef(true)

//     """object O {}""" should beParsedTo (Singleton("O"))
//     """object O  { var v; method m(){} }""" should beParsedTo (Singleton("O", members = Field("v", false) :: Method("m") :: Nil))
//     """object O inherits D {}""" should beParsedTo (Singleton("O", Some("D", Nil)))
//     """object O inherits D(5) {}""" should beParsedTo (Singleton("O", Some("D", Literal(5) :: Nil)))
//     """object O inherits D mixed with M {}""" should beParsedTo (Singleton("O", Some("D", Nil), "M" :: Nil))
//     """object O inherits D mixed with M and N {}""" should beParsedTo (Singleton("O", Some("D", Nil), ("N": FullyQualifiedReference) :: ("M": FullyQualifiedReference) :: Nil))
//     """object O mixed with M and N {}""" should beParsedTo (Singleton("O", None, ("N": FullyQualifiedReference) :: ("M": FullyQualifiedReference) :: Nil))
//     """object O { constructor(){} }""" should not (beParsed())
//     """object""" should not (beParsed())
//     """object {}""" should not (beParsed())
//     """object O""" should not (beParsed())
//     """object O inherits D inherits E""" should not (beParsed())
//     """object O inherits {}""" should not (beParsed())
//     """object O inherits""" should not (beParsed())
//     """object O mixed with {}""" should not (beParsed())
//     """object O mixed with""" should not (beParsed())
//   }

// }

// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // MODULE MEMBERS
// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// "field" in {
//   implicit val parser = field

//   """var v""" should beParsedTo (Field("v", false))
//   """var v = 5""" should beParsedTo (Field("v", false, Some(Literal(5))))
//   """const v""" should beParsedTo (Field("v", true))
//   """const v = 5""" should beParsedTo (Field("v", true, Some(Literal(5))))
//   """var""" should not (beParsed())
//   """const""" should not (beParsed())
//   """var 5""" should not (beParsed())
//   """const 5""" should not (beParsed())
// }

// "method" in {
//   implicit val parser = method

//   """method m()""" should beParsedTo (Method("m", body = None))
//   """method ==()""" should beParsedTo (Method("==", body = None))
//   """method m() {}""" should beParsedTo (Method("m"))
//   """method m(p, q) {}""" should beParsedTo (Method("m", parameters = Parameter("p") :: Parameter("q") :: Nil))
//   """method m(p, q...) {}""" should beParsedTo (Method("m", parameters = Parameter("p") :: Parameter("q", true) :: Nil))
//   """method m() {var x}""" should beParsedTo (Method("m", body = Some(Variable("x", false) :: Nil)))
//   """method m() = 5""" should beParsedTo (Method("m", body = Some(Literal(5) :: Nil)))
//   """override method m() {}""" should beParsedTo (Method("m", isOverride = true))
//   """method m() native""" should beParsedTo (Method("m", isNative = true, body = None))
//   """method m() = { 5 }""" should beParsedTo (Method("m", body = Some(Closure(Nil, Literal(5) :: Nil) :: Nil)))
//   """method m(p,q) =""" should not (beParsed())
//   """method m(p,q) native = q""" should not (beParsed())
//   """method m(p,q) native { }""" should not (beParsed())
// }

// "constructor" in {
//   implicit val parser = constructor

//   """constructor()""" should beParsedTo (Constructor(body = None))
//   """constructor () { }""" should beParsedTo (Constructor())
//   """constructor(p, q) {}""" should beParsedTo (Constructor(parameters = Parameter("p") :: Parameter("q") :: Nil))
//   """constructor(p, q...) {}""" should beParsedTo (Constructor(parameters = Parameter("p") :: Parameter("q", true) :: Nil))
//   """constructor() {var x}""" should beParsedTo (Constructor(body = Some(Variable("x", false) :: Nil)))
//   """constructor() = self(5) {}""" should beParsedTo (Constructor(callsSuper = false, baseArguments = Literal(5) :: Nil))
//   """constructor() = self(5)""" should beParsedTo (Constructor(callsSuper = false, baseArguments = Literal(5) :: Nil, body = None))
//   """constructor() = super(5) {}""" should beParsedTo (Constructor(callsSuper = true, baseArguments = Literal(5) :: Nil))
//   """constructor() = super(5)""" should beParsedTo (Constructor(callsSuper = true, baseArguments = Literal(5) :: Nil, body = None))
//   """constructor""" should not (beParsed())
//   """constructor() = { }""" should not (beParsed())
//   """constructor() = self""" should not (beParsed())
//   """constructor() = super""" should not (beParsed())
// }

// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // SENTENCES
// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// "variable" in {
//   implicit val parser = variableStatement

//   """var v""" should beParsedTo (Variable("v", false))(parser)
//   """var v = 5""" should beParsedTo (Variable("v", false, Some(Literal(5))))
//   """const v""" should beParsedTo (Variable("v", true))
//   """const v = 5""" should beParsedTo (Variable("v", true, Some(Literal(5))))
//   """var""" should not (beParsed())
//   """const""" should not (beParsed())
//   """var 5""" should not (beParsed())
//   """const 5""" should not (beParsed())
// }

// "return" in {
//   implicit val parser = returnStatement

//   """return 5""" should beParsedTo (Return(Literal(5)))
//   """return""" should not (beParsed())
// }

// "assignment" in {
//   implicit val parser = assignmentStatement

//   """a = b""" should beParsedTo (Assignment(LocalReference("a"), LocalReference("b")))
//   """a += b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), "+", LocalReference("b") :: Nil)))
//   """a -= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), "-", LocalReference("b") :: Nil)))
//   """a *= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), "*", LocalReference("b") :: Nil)))
//   """a /= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), "/", LocalReference("b") :: Nil)))
//   """a %= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), "%", LocalReference("b") :: Nil)))
//   """a <<= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), "<<", LocalReference("b") :: Nil)))
//   """a >>= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), ">>", LocalReference("b") :: Nil)))
//   """a >>>= b""" should beParsedTo (Assignment(LocalReference("a"), Send(LocalReference("a"), ">>>", LocalReference("b") :: Nil)))
//   """a = b = c""" should not (beParsed())
//   """a = b += c""" should not (beParsed())
//   """a += b = c""" should not (beParsed())
// }

// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// // EXPRESSIONS
// //──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// "infix operation" in {
//   implicit val parser = infixOperation()

//   """a + b + c""" should beParsedTo[Send, Expression] (
//     Send(
//       Send(
//         LocalReference("a"),
//         "+",
//         LocalReference("b") :: Nil
//       ),
//       "+",
//       LocalReference("c") :: Nil
//     )
//   )

//   """a + (b + c)""" should beParsedTo[Send, Expression] (
//     Send(
//       LocalReference("a"),
//       "+",
//       Send(
//         LocalReference("b"),
//         "+",
//         LocalReference("c") :: Nil
//       ) :: Nil
//     )
//   )

//   """a > b || c && d + e == f""" should beParsedTo[Send, Expression] (
//     Send(
//       Send(
//         LocalReference("a"),
//         ">",
//         LocalReference("b") :: Nil
//       ),
//       "||",
//       Send(
//         LocalReference("c"),
//         "&&",
//         Send(
//           Send(
//             LocalReference("d"),
//             "+",
//             LocalReference("e") :: Nil
//           ),
//           "==",
//           LocalReference("f") :: Nil
//         ) :: Nil
//       ) :: Nil
//     )
//   )
// }

// "prefixOperation" in {
//   implicit val parser = prefixOperation

//   """!a""" should beParsedTo[Send, Expression] (Send(LocalReference("a"), "!", Nil))
//   """not!!a""" should beParsedTo[Send, Expression] (Send(Send(Send(LocalReference("a"), "!", Nil), "!", Nil), "not", Nil))
//   """-1""" should beParsedTo[Literal[Int], Expression] (Literal(-1))
// }

// "send" in {
//   implicit val parser = messageChain

//   """a.m()""" should beParsedTo[Send, Expression] (Send(LocalReference("a"), "m", Nil))
//   """a.m(5)""" should beParsedTo[Send, Expression] (Send(LocalReference("a"), "m", Literal(5) :: Nil))
//   """a.m(5,7)""" should beParsedTo[Send, Expression] (Send(LocalReference("a"), "m", Literal(5) :: Literal(7) :: Nil))
//   """a.m{p => p}""" should beParsedTo[Send, Expression] (Send(LocalReference("a"), "m", Closure(Parameter("p") :: Nil, LocalReference("p") :: Nil) :: Nil))
//   """a.m().n().o()""" should beParsedTo[Send, Expression] (Send(Send(Send(LocalReference("a"), "m", Nil), "n", Nil), "o", Nil))
//   """(a + 1).m(5)""" should beParsedTo[Send, Expression] (Send(Send(LocalReference("a"), "+", Literal(1) :: Nil), "m", Literal(5) :: Nil))
//   """1.5.m()""" should beParsedTo[Send, Expression] (Send(Literal(1.5), "m", Nil))
//   """a.m(p,)""" should not (beParsed())
//   """a.m(,q)""" should not (beParsed())
//   """a.m""" should not (beParsed())
//   """a.""" should not (beParsed())
//   """m(p,q)""" should not (beParsed())
//   """.m""" should not (beParsed())
// }

// "constructorCall" in {
//   implicit val parser = constructorCall

//   """new C()""" should beParsedTo (New("C"))
//   """new C(1,2)""" should beParsedTo (New("C", Literal(1) :: Literal(2) :: Nil))
//   """new C""" should not (beParsed())
//   """new""" should not (beParsed())
// }

// "superCall" in {
//   implicit val parser = superCall

//   """super()""" should beParsedTo (Super())
//   """super(1,2)""" should beParsedTo (Super(Literal(1) :: Literal(2) :: Nil))
//   """super""" should not (beParsed())
//   """super.m()""" should not (beParsed())
// }

// "if" in {
//   implicit val parser = ifExpression

//   """if(a) x""" should beParsedTo (If(LocalReference("a"), LocalReference("x") :: Nil))
//   """if(a){x}""" should beParsedTo (If(LocalReference("a"), LocalReference("x") :: Nil))
//   """if(a){x;y}""" should beParsedTo (If(LocalReference("a"), LocalReference("x") :: LocalReference("y") :: Nil))
//   """if(a) x else y""" should beParsedTo (If(LocalReference("a"), LocalReference("x") :: Nil, LocalReference("y") :: Nil))
//   """if(a){x}else{y}""" should beParsedTo (If(LocalReference("a"), LocalReference("x") :: Nil, LocalReference("y") :: Nil))
//   """if(a) if(b) x else y else z""" should beParsedTo (If(LocalReference("a"), If(LocalReference("b"), LocalReference("x") :: Nil, LocalReference("y") :: Nil) :: Nil, LocalReference("z") :: Nil))
//   """if(a) if(b) x else y""" should beParsedTo (If(LocalReference("a"), If(LocalReference("b"), LocalReference("x") :: Nil, LocalReference("y") :: Nil) :: Nil, Nil))
//   """if a x else y""" should not (beParsed())
//   """if(a) x else""" should not (beParsed())
//   """if(a)""" should not (beParsed())
// }

// "try" in {
//   implicit val parser = tryExpression

//   """try x""" should beParsedTo (Try(LocalReference("x") :: Nil))
//   """try{x}""" should beParsedTo (Try(LocalReference("x") :: Nil))
//   """try x catch e h""" should beParsedTo (Try(LocalReference("x") :: Nil, Catch(Parameter("e"), None, LocalReference("h") :: Nil) :: Nil))
//   """try x catch e{h}""" should beParsedTo (Try(LocalReference("x") :: Nil, Catch(Parameter("e"), None, LocalReference("h") :: Nil) :: Nil))
//   """try x catch e:E h""" should beParsedTo (Try(LocalReference("x") :: Nil, Catch(Parameter("e"), Some("E"), LocalReference("h") :: Nil) :: Nil))
//   """try x then always a""" should beParsedTo (Try(LocalReference("x") :: Nil, Nil, LocalReference("a") :: Nil))
//   """try x then always{a}""" should beParsedTo (Try(LocalReference("x") :: Nil, Nil, LocalReference("a") :: Nil))
//   """try x catch e h then always a""" should beParsedTo (Try(LocalReference("x") :: Nil, Catch(Parameter("e"), None, LocalReference("h") :: Nil) :: Nil, LocalReference("a") :: Nil))
//   """try x catch e h catch e i then always a""" should beParsedTo (Try(LocalReference("x") :: Nil, Catch(Parameter("e"), None, LocalReference("h") :: Nil) :: Catch(Parameter("e"), None, LocalReference("i") :: Nil) :: Nil, LocalReference("a") :: Nil))
//   """try x catch e h then always""" should not (beParsed())
//   """try x catch e""" should not (beParsed())
//   """try x catch{h}""" should not (beParsed())
//   """try""" should not (beParsed())
//   """catch e {}""" should not (beParsed())
// }

// "throwExpression" in {
//   implicit val parser = throwExpression

//   """throw e""" should beParsedTo (Throw(LocalReference("e")))
//   """throw""" should not (beParsed())
// }

// }
