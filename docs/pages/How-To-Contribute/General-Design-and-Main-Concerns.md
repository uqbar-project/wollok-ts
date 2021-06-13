# Design Guidelines

Here are some of our main concerns for this project. We base most big decisions with these guidelines in mind. Please take a moment to read them before contributing.

## Focused on Modularity

  We try to keep each step of the language flow as independent and decoupled from each other as posible.
  This should allow us to freely alter or replace one of them without compromising the others.
  It should also make it easier to make concept proofs with new technologies or alternative implementations as well as gradual migrations.


## Favoring Simplicity

  Compilers can be very complex. They rely heavily in academic theory but also often require some obscure optimizations tricks. This makes them hard to approach by not-so-experienced developers, specially in small, comunity-driven projects with few resources.

  Having this in mind, we try to orient our design towards the simpler alternative whenever possible, trying to provide a smooth learning curve for newcomers.

  This is of course not easily achieved, since we often struggle with the temptation of over-design and keep pushing the typesystem to its limits, but here are some rules we try to follow:

  - Try to minimize accidental complexity when possible.
  - Keep large external dependencies (and thus, the need to learn them) to the very minimum needed.
  - Favor declarative definitions above procedural algorithms.
  - Avoid really-cool-yet-hard-to-understand implementations wherever possible.
  - Try to keep types simple and sound-enough.
  - In general lines, try to write your code for a good student (and not a computer-science doctor) to understand it.

## Internet Oriented & Debug Friendly

  The general idea for this project is to allow Wollok to run in a browser/server, so every data structure should be easily serializable and debugable so web interactions become easy.
  
## Focused on Design, But Keeping an Eye on Performance

  At the end of the day, the language needs to run fast.

  This doesn't mean we have to turn the codebase in an algorithmic wasteland to gain a few CPU cycles, but we do want to avoid conceptually beautiful yet unusable implementations.

  While we often favor a pure and inmutable approach our host language sadly does not (at least as efficiently as we need it to), so we have, when necessary, recurred to more procedural implementations, although always trying to keep side-effects clean and well compartmentalized.

## Explicitly Typed, Exhaustively Tested and Well Documented

  I know, I know... Nobody likes writing these, but in our experience its worth it.
  
  Regardless of *Typescript* inferring capabilities, try to explicitly type any major function so when we can rely on the typesistem. Try to keep all interfaces as clean and cohesive as possible, and put effort in easing discoverability.

  Be sure to test all use cases. Write each test with the smallest setup code possible, but avoid re-utilizing scenarios between tests, and use clear name and descriptions.

  Also, try to keep this documentation page up-to-date whenever a significant change in the code design occurs.


## Written in English

  We try to be inclusive. It is hard.
  
  Although most of our current developers are Spanish speakers we want to keep the project open to as many people as possible and, at the moment, that means writting in English.
  
  Try to keep pull requests, documentation and specially code comments and identifiers in English so we can easily share it around.