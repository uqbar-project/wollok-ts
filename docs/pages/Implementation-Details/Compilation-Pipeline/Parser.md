# Parser

> ### 🛠️ Work In Progress!
> This section is a stub. [Help to expand it!](/wollok-ts/pages/How-To-Contribute)


## Parser Combinators
> ### 🛠️ Work In Progress!
> This section is a stub. [Help to expand it!](/wollok-ts/pages/How-To-Contribute)

## Specially Interesting Parsers
> ### 🛠️ Work In Progress!
> This section is a stub. [Help to expand it!](/wollok-ts/pages/How-To-Contribute)

- node
- sourced
- Operation
- fail proof

## General tips
> ### 🛠️ Work In Progress!
> This section is a stub. [Help to expand it!](/wollok-ts/pages/How-To-Contribute)

- mind the spaces (_)

## Testing
> ### 🛠️ Work In Progress!
> This section is a stub. [Help to expand it!](/wollok-ts/pages/How-To-Contribute)

- custom asserts


## FAQ

* **I've never created a parser before... What do I need to know? Where can I start reading?**
> ### 🛠️ Work In Progress!
> This section is a stub. [Help to expand it!](/wollok-ts/pages/How-To-Contribute)


* **Why [Parsimon](https://github.com/jneen/parsimmon)? Why not <your favorite parser library>?**

  *Parsimon* accommodates greatly to our syntax needs and is, as far a we know, the library that provides the best balance between performance and expressiveness without recurring to heavy dependencies or hard-to-debug DSLs.

  If you believe you know of a better alternative, let us know!

* **Why aren't you using Parsimmon's [`createLanguage`](https://github.com/jneen/parsimmon/blob/master/API.md#parsimmoncreatelanguageparsers) function?**

  The `createLanguage` method is great and would make some parts of our code way cleaner but, sadly, it does not work so well with typechecking. When any part of the configuration fails to type, the whole language gets painted red by the IDE, making it so much harder to find and correct any problems.

  If this improves in the future wi will surely consider it, though!

* **Why do all parsers have explicit types? Can't TypeScript just infer it?**

  Yes, but we find that it's best to explicit the types to avoid having to deduce them from the (sometimes quite long) code.

  Also, we tend to preffer explicitly typing any exported functions, so we can be sure we don't accidentally change it's type and cause a regression.