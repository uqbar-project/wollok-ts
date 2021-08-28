# Changelog

## v3.0.7
- Annotations.
- Lazy operators are now handled in runtime instead of being filled in the parser.
- Anonymous Singleton expressions are no longer container within a Literal node.
- Fixed bug where imports would resolve on local definitions.

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