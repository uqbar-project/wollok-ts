# Design Guidelines

Here are some of our main concerns for this project. We base most big decisions with these guidelines in mind. Please take a moment to read them before contributing.

- **Focused on Modularity**

  We try to keep each step of the language flow as independent and decoupled from each other as posible.
  This should allow us to freely alter or replace one of them without compromising the others.
  It should also make it easier to make concept proofs with new technologies or alternative implementations as well as gradual migrations.


- **Internet Oriented & Debug Friendly**

  We believe there is much to gain in keeping the intermediate artifacts yielded and consumed by each flow step as plain and small as possible, so most of the project's data structures are represented as *strings* and *JSON* objects. This implies the structures have no cycles or hard-to-serialize types, such as functions.

  In many aspects this is rather unpleasant from the *OOP* perspective, since having dumb data-objects as our main abstractions is quite limiting but it allows us to easily generate and send them across different services as well as easily iterate them without having to worry about infinite recursion.
Also, since *JSON* is very spread and a native representation for *TypeScript* objects, it is an extremely convenient format for manipulating and reconstructing entities and there are a lot of tools to analyze, format and print them, allowing us to remain as technology agnostic as possible and to easily rewire the flow steps or connect them to external services.

  For these reasons we have implemented a *Functional Oriented* approach,building all logic as composible, effect-free operations that work on immutable data. This forward favors our modular approach making it easier to test and debug.


- **Favoring Simplicity**

  Compilers' code can be very hostile.
  It tends to require a lot of theory and often recurs to obscure tech tricks for optimizations and tweaks.
  This makes it hard to approach for new developers, specially for small, free open source projects like ours.
  With this in mind, we try to orient our design towards simplicity whenever possible, and taking care of provide a smooth learning curve for newcomers.
  This is of course not easily achieved, since a language has some inherently complex parts, but here are some rules we try to follow:
  - Keep complex external dependencies (and thus, the need to learn them) to the very minimum.
  - Favor declarative definitions above algorithms.
  - Avoid really-cool-yet-hard-to-understand implementations wherever possible.
  - In general lines, try to write your code for a good student (and not a doctor) to understand it.


- **Explicitly Typed, Exhaustively Tested and Well Documented**

  I know, I know... Nobody likes writing these, but in our experience its worth it.
  Regardless of *Typescript* inferring capabilities, try to explicitly type any major function so when we can be sure it's not all broken whenever change the code.

  Be sure to test all use cases. Write each test with the smallest setup code possible, but avoid re-utilizing scenarios between tests, and use clear name and descriptions.

  Also, try to keep this wiki up-to-date whenever a significant change in the code design occurs.


# [[TODO]]


folder structure

environment and utils
synthetic nodes

- So... Why is this all written in english?
  We try to be inclusive. It is hard. Most of our current developers are Spanish speakers but we try to keep the project open to as many people as possible and, today, that implies english. Also I trust the automatic translating tools we currently have to make a much better work translating to english than from it.

- Why are nodes connected through References instead of directly referencing other nodes?

- If Expressions are Sentences that return a value, why is Throw considered an Expression and Return a Sentence?
  The right way to put it might be that Expression are nodes that can be used in places where a value is expected, while Sentences only have meaning as part of an effect-causing algorithm. Disregarding it's name, Return is used as a way to interrupt the execution of a body and exit it eagerly, so it doesn't really provide a value to it's context, thus it makes no sense to use it outside of a body. On the other hand, Throw might be very well considered a Sentence to all effects but, since it stops it's context execution, it can also be modeled as an Expression to allow its use in single line definitions.

- types instead of interfaces?
  At the time of writing this, interfaces with generics are not being treated as completely structural estructures. That causes some missbehaviour like `Self<'Raw'> !: Self<'Complete'>