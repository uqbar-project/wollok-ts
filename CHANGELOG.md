# Changelog
## v4.1.2
**Wollok Version: `3.2.4`**
- 👾 Refactors for wollok game
  - Tests for errors on game events
  - onCollide performance
- 🚧 Parser fixes for comments and whitespaces

## v4.1.1
**Wollok Version: `3.2.3`**

- 🚧 Fix `import` on collisions between `.wlk` and `.wtest` files
- 🔤 Add validation for _special characters_ in file names
- 🧰 Add a lot of util functions (see [`extensions`](./src/extensions.ts) [`helpers`](./src/helpers.ts))
- ✍️ Support `only` keyword on printer
- 👁️‍🗨️ Fix _unused variable_ and _uninitialized attributes for wko_ validations
- 👾 Fix Wollok Game performance issues


## v4.1.0
**Wollok Version: `3.2.2`**

- 🚧 Refactor: Revamp the API
    - 🛠 export utils used on Validations 
    - 📚 more utilities for Model & Linker 

## v4.0.9
**Wollok Version: `3.2.1`**

- 🐛 Fix Type System with empty `if`
- 🐞 Fix some Validations
- 🚧 Error handling for recursive attribute initialization

## v4.0.8
**Wollok Version: `3.2.0`**

- 🐛 Fix Type System in order to ignore Wollok internal code
- 🐞 Fix Formatter for Prefix operators
- 🚧 Error handling for print
- 🛠 Fix for imports with duplicate names (now you can import an object pepita inside a file pepita)

## v4.0.7
**Wollok Version: `3.2.0`**

- New Type System 🎉 - based on the Xtext's implementation.
- Fixed instantiation of `List` and `Set` classes using `new`.
- Some validations changed:
  - Take care about the `SourceMap` for reporting.
  - Avoid tests with the same name.
  - Avoid override validation at `initialize()` method.

## v4.0.6
**Wollok Version: `3.1.9`**

- New Formatter / Printer 🎉
- Validate concrete class on instantiation.
- Validate uninitialized consts.

## v4.0.5
**Wollok Version: `3.1.9`**

- Update Wollok version.
- Fixed #159 and #164 - Singleton abstract methods validation
- Fixed #172 - Filtering wollok base frames from stack trace & adding constants


## v4.0.4
**Wollok Version: `3.1.8`**

- Update Wollok version.
- Fixed validation `shouldNotDuplicateEntities` for programs and globals. https://github.com/uqbar-project/wollok-ts/pull/157
- Fixed `malformedSentence` error for return methods. https://github.com/uqbar-project/wollok-ts/pull/162
- Split validation `shouldInitializeAllAttributes` in two. https://github.com/uqbar-project/wollok-ts/pull/161


## v4.0.3
**Wollok Version: `3.1.7`**

- Update Wollok version.
- Fixed linking packages with the same name.

## v4.0.2
**Wollok Version: `3.1.6`**

- Update Wollok version.
- Fixed buggy validations over incomplete AST.

## v4.0.1
**Wollok Version: `3.1.3`**

- Adding mechanism to get possibly uninitialized lazy values without raising.
- Cleaned up uses of lazy fields to handle the posibility of the field not being there when reasonable (such as `parent` in `fullyQualifiedName`)
- Improving type exclussion for models with the same structural definition.

## v4.0.0
**Wollok Version: `3.1.3`**

- Updated TypeScript version to `4.9`
- String-based Kinds and Categories were replaced with TypeScript classes and mixins (class constructor functions). All related methods were updated accordingly.
- `match` method in Nodes replaced in favor of generic `match` function.
- Several non-breakable, no-argument methods where replaced with computed properties.
- Dropped `isNode` function in favor of `instanceof Node` notation.
- `cached` decorator now supports properties as well as methods.
- Dropped exposed `Node` methods that asumed a sibling order.
- Added methods in `Literal` node to check value type.
- Dropped `defaultFieldValues` in favor of the cleaner `defaultValueFor` method.
- Renamed `Variable.isGlobal` to the more accurate `isAtPackageLevel`.

## v3.1.5
- Recover from malformed sentence on parse.

## v3.1.4
- Fixed some validations:
  - Reassign constant values
  - Missing references
- Changed `kindName` primitive method implementation.
- Fixed re-link Envirionment algorithm.

## v3.1.2
- Moved local game code to language project.

## v3.1.1
- Fixed bug where closures where unable to retain self reference when nested inside other closures.

## v3.1.0
- Updated to official Wollok Language 3.1.1 version.
- Fully qualified references to singletons are now valid expressions.

## v3.0.13
- Linker now has a new operation to link a stand-alone sentence.

## v3.0.12
- Added error recovery to File parser.
- General improvement to error recovery patterns.
- Package constructor now accepts fully qualified names and build the whole hierarchy.

## v3.0.11
- Added `getNodeOrUndefinedByFQN` and ``getNodeOrUndefinedByQN` methods for retrieving nodes by name without raising an error if not found.
- Fixed linking error where imports where lost after merge.

## v3.0.10
- Fixed `shouldHaveAssertInTest` validation bug

## v3.0.9
- Fixed bug where validator would skip nested linker and parser errors

## v3.0.8
- Fixed broken import in index

## v3.0.7
- Annotations.
- Lazy operators are now handled in runtime instead of being filled in the parser.
- Anonymous Singleton expressions are no longer container within a Literal node.
- Fixed bug where imports would resolve on local definitions.
- Fixed bug where methods with bodies would return the last expression, even without a `return` clause.
- Fixed linearization to properly avoid repetitions in hierarchy.
- Added options parameter to lookupMethod (allow abstract method to be included, lookup start FQN module moved into this parameter).
- Added validation functions based on @Expect annotation.
- SourceMaps are now custom classes with better string conversion logic.
- Better string conversion logic for nodes (short and verbose labels).
- Changed Node's `environment` and `parent` to be fields instead of methods.
- Linker no longer relies on the standard cache.
- Added `@lazy` decorator for readonly node fields that are eventually initialized during the pipeline.
- Cache is now decoupled from nodes.

## v3.0.6
- Updated to official Wollok Language 3.0.3 version. 

## v3.0.5
- Updated to official Wollok Language 3.0.2 version. 

## v3.0.4
- Executions now admit to have `void` return type, to avoid forcing unnecesary return of `undefined`.
- Evaluation `list` and `set` methods now have varargs.
- Evaluation `invoke` method is now split into `invoke` for methods and `send` for messages.
- *RuntimeObjects* now have a series of messages to retrieve their inner values by type
- New *Interpreter* interface
- Evaluation can now retrieve WKO with the `object` message.
- Frames are now contexts themselves and contain more debugging info.
- Exceptions now delegate on inner Wollok Exception instances to get the stack trace.

## v3.0.3
- Updated to official Wollok Language 3.0.0 version.

## v3.0.2
- Only anonymous object literals and closures will be bound to their original context from now on.
- Number and String uniqueness will be maintained with weak references from now on.
- Dropped float number uniqueness.

## v3.0.1
- Methods now have `isConcrete` and `isNative` methods.

## v3.0.0
- Implemented Wollok 3.0.0 support
    - Removed Constructors
    - Removed instantiation with unnamed arguments
    - Removed anonymous class instantiation in favor of unnamed object literals
    - Removed Fixtures
    - New homogeneous linearization syntax
- Describes are now Modules and have Fields instead of Variables
- Fields and Variables' attribute `isReadOnly` has been renamed to `isConstant`
- Replaced bytecode compiler with (a little slower, but easier to maintain) pure AST interpreter
- Fixed filenames in node's source: Now is the whole filename, with extension and dirs
- The source's file is now defined as a `fileName` property in Package so it doesn't need to be saved in each node
- New `isSynthetic` method for all nodes

## v2.3.0
- Fixing building process in bad release

## v2.3.0
- Removed Stages from model so TypeScript stops crashing :(
- Replaced model builders with better constructors
- Discarded unnecesary Filler pipeline stage (filling is now handled in the constructors)

## v2.2.0

- Masive reification. Most concepts previously represented by Ids are now reified into instances.
    - *Operand Stacks* are now filled with *Runtime Objects* instead of ids.
    - `createInstance` now returns RuntimeObjects.
    - *Runtime Objects* are now their own context.
    - *Contexts* now have a rich interface and their parents are now *Contexts* themselves instead of ids.
    - Reified *Stacks* into a class with rich interface.
    - *Context Table* is no more.

- Refactored the *Interpreter* abstractions to make them more cohesive and improve discoverability.
    - Cleaner exported interface for *Interpreter* module.
    - Cleaner interface for *Evaluation*.
    - Cleaner *Frames*.
    - *RuntimeObject* now has factory methods to retrieve/create them.
    - *Numbers*, *Strings*, and *Booleans* are now retrieved instead of created.
    - Replaced `Evaluation.sendMessage` with the more useful `Evaluation.invoke`.
    - Dropped `runTest` and `runProgram` functions from the *Interpreter*. The plan is to create a nicer, separate facade for end users to perform this sort of single-time operations, that can hide the complexities (we will do this eventually).

- Plenty of improvements in interpreter algorithm.
    - Cleaner lazy initialization.
    - Cleaner raise of exceptions.
    - Waaay faster.

- Some quality of life changes.
    - *Evaluation* receives the root context as argument.
    - Automatically stepping initialization on Evaluation creation.
    - Added `log` as an attribute of *Evaluation* to allow non-global configuration.
    - Added `natives` as an attribute of *Evaluation* to avoid passing them as parameters all the time.
    - *Evaluations* can now safely deep-copy themself.

- Complete test overhaul.
    - Cleaner descriptions, easier to maintain that are based on describing the expected deltas instead of the before/after scenarios.
    - New assertions and cleaner mocks.


## < v2.2.0
- Here be dragons.
