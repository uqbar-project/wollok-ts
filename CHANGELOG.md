# Changelog

## v3.0.0
- Removed Constructors
- Removed instantiation with unnamed arguments


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