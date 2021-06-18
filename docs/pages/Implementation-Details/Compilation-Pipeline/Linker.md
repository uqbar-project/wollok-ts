# Linker

The **Linking** phase of the [Compilation Pipeline](index) takes place after all nodes have been parsed and combines them to form a single **[Environment](#Environment)**, where all nodes are uniquely identified and all [References](../model-overview#reference) are traceable to their target *Nodes*.

![linker](https://drive.google.com/uc?authuser=0&id=1HHoVx2HYtlWZPTCHclYUaL8cm5WsuNtZ&export=download)

## Objectives

Up to the *Linking* phase, the *Compilation Pipeline* throughput might consist of many independent *AST*s with [Package](../model-overview#package) nodes as roots, either obtained from [parsing](Parser) sourcefiles or generated manually. As in any tree, the *Nodes* in these "fragments" of *AST*s are only connected to their direct children, which makes them hard to navigate and limits their behavior. They might also contain duplicated or redundant elements that need to be consolidated, or reused *Node* instances that have to be splitted in order to work in their different contexts. Some *Nodes* can also be hard to distiguish from each other, making them nearly impossible to trace.

The *Linker*'s main purpose consist in joining these independent *AST* branches into a single intertwined structure that is consistent and can be easily navigated.

## The Linking Process

The complete linking process can be summarized in the following general steps:

### Package Merging

All the isolated [Package](../model-overview#package) need to be combined into a single unified *AST*. To do this the *Linker* synthesizes an [Environment](../model-overview#environment) node to act as the unifying *Root*. All the received *Package* structures are recursively combined and set as children of the *Environment*. Any two packages that would end having the same **Fully Qualified Name** are combined into a single one containing the union of the other two.

If two merged packages contain [Entities](../model-overview#entity) with the same names, the former **will be replaced** by the later. This allows us to extend *Packages* from different file sources and substitute any unwanted definitions at linking time.

![package merging](https://drive.google.com/uc?authuser=0&id=1bhNRyBA7GNCk0QDsj2Ahouv7xYPsxM9N&export=download)

> :bulb: The *Linker* can, optionally, receive one "base" *Environment* as parameter. All the contents of this Environment will be included at the very start of the merging process, allowing its content to be easily replaced by the given *Packages*. This is useful when you need to [extend or change an already linked *AST*](#updating-an-environment).

### Identifier Assignation

The linking process assigns each node an [UUID(v4)](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) on their `id` attribute. These ids are meant to be **unique identifiers** for the nodes and **can't be shared, even by nodes on different Environments**.

If a previous *Environment* is provided to the Linker to re-link, a deep copy with new ids is made to use during the process.

> ⚠️ Once a *Node* is assigned an *id*, its methods are susceptible of being cached, so **copying a linked node without changing it's id is ill-advised**.

### Cross-Connection

To optimize times and facilitate navigation, each *Node* is provided with a soft reference to its **parent** and **environment**. The *Node* is also stored in an id-indexed cache on the *Environment* for fast id-based queries.

### Scoping

The **Scope** of a node is a record of all possible referenceable **names** available for that node, associated to the *Nodes* those names target. This information is used primarily to identify the target of [References](../model-overview#reference) and make navigation on the *Environment* smother, but might also be used as metadata to understand a *Node*'s Lexical Scope.

Constructing the scopes is, by far, the most complex and time-consuming process of the linking phase, and should be approached with caution. Here are some key aspects to understand it:

- Since scopes are naturally hierarchical, each node's scope is defined mainly by where on the AST it is placed.
- The building of scopes takes place in two main steps:
  - First, a partial scope that doesn't contain inheritable members is assigned to all [Entities](../model-overview#entity). This is done so [Imports](../model-overview#import) get resolved and all [Modules](../model-overview#module) can identify their complete hierarchy.
  - After that, a second iteration is made, fully assigning the complete scope to each node.
- The scope for a node is defined as its parent's scope, plus any contributions that its parent and siblings make. Most named scopes contribute themselves, so any sibling can reference them, but some other nodes (e.g. [Imports](../model-overview#import)) might also contribute names from other branches.

### Erroring

After *Scopes* are assigned, every [Reference](../model-overview#reference) node in the *Environment* should be able to unmistakably identify the *Node* it targets. However, some *References* might be unable to do. There are many reasons why this could happen: from a typo in the *Reference*'s name to a missing import statement. Whatever the cause, the Reference is considered **broken** and a new entry is registered in it's `problems` attribute.

> ⚠️ Notice that **a *Broken Reference* does not stop the *Compilation Pipeline***. This is done intentionally, to allow the creation of partially broken *Environments* that might be debugged and even executed. In order to ensure the resulting *Environment* is error-free it needs to be [validated](Validator).

## Updating an Environment

After the linking phase is finished the Linker outputs an *Environment* tree, which is considered to be in the **Linked** stage of the pipeline. From this point on, the *AST* **should be considered frozen** and no Nodes should be copied or modified in any way. If a change is needed on a Linked Node, that node (and thus, all the Environment) should be immediately re-linked to avoid miss-references and cache issues.

> ⚠️ A *Linked Environment* heavily depends on it's internal cache! **Do not copy or modify any node from a Linked Environment without *re-linking* the result**.
