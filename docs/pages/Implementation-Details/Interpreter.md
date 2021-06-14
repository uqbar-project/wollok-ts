# Interpreter

The **Interpreter** provides a set of tools to execute and debug Wollok code. It can be used to execute a *Program*, run a *Test* or evaluate any *Sentence*, either atomically or step-by-step.

The current implementation of the *Interpreter* is a Direct AST Interpreter, which means that the Nodes of the AST are interpreted directly, without first compiling them to any other intermediate representation (such as *bytecode*).

The current *Interpreter* is also effect-based, so every computation updates the current evaluation state in a destructive way. This might not be as fancy as a pure stateless implementation but it's proven to be much faster.

Following is a summary of the main abstractions and concepts involved in the interpretation process.

## Main Abstractions

### Evaluation

An *Evaluation State* (or just `Evaluation`) for short)represents an isolated *runtime environment*. It is the main data structure used by the *Interpreter* to represent the complete state of an execution at any given moment. It contains the [Frame Stack](#Frame-Stack) and references to all the [Runtime Objects](#Runtime-Objects) along with an interface that allows it to instantiate new objects and trigger the execution of AST Nodes.

The *Evaluation* is built from an **Environment** that provides it with all the static definitions and a set of [natives](#Native-Functions) that implement any *native methods* used.

Due to performance reasons, the evaluation and many of its sub-structures, are **stateful mutable objects** and most operations on it are destructive, so special care should be taken of making a copy of any instance which state is meant to be preserved.

### Frame Stack
The *Frame Stack* consist of a stack of [Contexts](#Contexts). Its main purpose is to keep track of the diferent lexical scopes during nested method calls.

[Evaluations](#Evaluation) initialize their *Frame Stack* with a **Root Context** cointaining all global definitions.

### Contexts
**Contexts** are hierarchical structures that represent the current stored named references in an evaluation scope. You can think of *Contexts* as Maps that relate each locally accessible reference name to the [Runtime Object](#Runtime-Objects) that is its current value.

Every Node is executed within a *Context* that provides values for *References*. When a Node needs to be executed in a separate lexical scope a new *Context* is created to allow it to maintain it's own namespace.

Every *Context* except the **Root Context** has a parent Context. When a *Context* can't find a reference it delegates the search in its parent.

### Runtime Objects

**Runtime Objects** are special [Contexts](#Contexts) that, as their name implies, act as the runtime representation of Wollok objects. An Evaluation contains one RuntimeObject for every *Singleton* and *Class instance* used during an execution. These have an unique **Id**, its associated **Module** and, sometimes, an **Inner Value** used to store primitive data (such as *TypeScript Numbers* for instances of `wollok.lang.Number`).

The instance's fields and `self` reference are stored as part of its *Context* mapping allowing *Runtime Objects* to be lexical scopes themselves.

Although most RuntimeObjects are generated as result of the explicit instantiation of a *Class*, some others need to be created as part of the [Evaluation](#Evaluation) initialization (such as the named Singleton instances and special objects like `null`) and many are built on demand (like numbers, strings and other literals).


## Executions as Typescript Generators

One of the Wollok Interpreter's main goals is to provide an adequate support for *Debugging* and *Inspection Tools*. This implies that it should be possible to interrupt an execution at any point (for example, by placing a breakpoint) and resume it at will. Luckily for us this can be easily done using [*TypeScript*'s Generator Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*).

For the purpose of our implementation, you can think of a *Generator Function* like a regular function that can *yield* other values before returning a result. Each time the function yields the control is returned to the caller, who can choose to resume the function if he chooses to.

We define the execution of a *Node* as a *Generator Function* that yields each *Node* it visits and ends up returning the result of the *Node*'s execution (usually a [Runtime Object](#Runtime-Objects)). So, every time we want to execute something we can just ask the execution function to keep yielding nodes until either it yields a *Node* at which we should stop or it returns the final result. 

This implementation has some drawbacks, but it allow us to define the execution of each type of *Node* in a very clean way, with little boilerplate and nearly no execution overhead. The main difficulty that arises from this approach is the need to keep asking the generator for results and detecting when a final state has been reached. To do this we modeled one more abstraction: The **Execution Director**

### Execution Directors
If an `Execution` is the iterable result of a *Generator Function*, an `ExecutionDirector` is an utility object that allow us to easily iterate the *Execution*.

It's interface contains methods to set **breakpoints**, take different kinds of **steps** or keep executing until the *Execution* is over.

In most cases, a tool that wishes to run a Wollok expression should:

  1. Compile the code to obtain the static **Environment**.
  2. Create an **Evaluation** to contain the runtime entities.
  3. Find the desired **Node** in the environment and use one of the **Evaluation** methods such as `exec` to create an **Execution**.
  4. Provide the **Execution** to an **Execution Director** and either set a breakpoint and `continue` until it's reached or `finish` the execution to obtain the final result. 


## Natives
Wollok methods defined as `native` require primitive implementations written in the host language. These implementations need to be provided to the interpreter in order to successfully evaluate most code.

In Wollok-TS, native implementations are modeled as [Generator Functions](#Execution-Directors) that execute in the context of an Evaluation and have the following type:

```ts
export type NativeFunction = (this: Evaluation, self: RuntimeObject, ...args: RuntimeObject[]) => Execution<RuntimeValue>
```

These functions are expected to be provided within a TS object replicating the package structure of the owner. So, for example, a native method `m` for the class `package.subpackage.C` should be represented as the following structure:

```ts
{
  package: {
    subpackage: {
      C: {
        m: <place m primitive here>
      }
    }
  }
}
```

When a native method is called, the corresponding *Native Function* is evaluated with the receiver and argument objects. The *Native Function* is expected to return a generator that performs any transformation required satisfy the native behavior.

Native implementations for the *Wollok Runtime Environment*'s can be found in the `/wre` folder of the project sources.