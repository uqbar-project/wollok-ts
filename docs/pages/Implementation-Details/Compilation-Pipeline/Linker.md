# Table of Content

* [Intro](#Intro)
* [Purpose](#Purpose)
* [Environment](#Environment)
* [Linking Process](#Linking-Process)
  * [Package Merging](#Package-Merging)
  * [Identifier Assignation](#Identifier-Assignation)
  * [Scoping](#Scoping)
* [Updating an Environment](Updating-an-Environment)


# Intro

The **Linking** phase of [[the Language Pipeline]] takes place after all nodes have been [[filled|Filler]] and combines them to form a single linked **[Environment](#Environment)**, where all nodes are uniquely identified and all **References** are traceable to their target node.

![linker](https://drive.google.com/uc?authuser=0&id=1HHoVx2HYtlWZPTCHclYUaL8cm5WsuNtZ&export=download)

# Purpose

Up to the *Linking* phase, the pipeline throughput might consist of many separate ASTs, obtained from parsing different files or manually generated. These ASTs might contain references to each other (e.g. a Class whose superclass is defined in another file), which means that **Reference**'s targets are undefined (or ambiguous) until those ASTs are put together. Isolated ASTs might also contain duplicated/redundant synthetic package definitions, created to represent folder structures, that need to be merged together to conform a consistent and unambiguous definition.

# Environment

The **Environment** is a synthetic node created by the *Linker* to serve as a container and single-entry-point to all the static definitions of a valid Wollok program. It contains all root-level **Packages** which guarantees that iterating its branches one passes through every single node in the static definition.

There is no syntax in Wollok for defining an Environment, which means that it can only be synthetically generated (usually, by the *Linker*).

# Linking Process

The *Linker* phase receives as input a set of isolated [[filled|Filler]] packages and, optionally, a previously existent *Environment*. The complete linking process can be summarized in the following general steps:

### Package Merging

All the received *Package* nodes are recursively combined into a single tree, with the *Environment* as root. Any two packages that would end having the same **fully qualified name** are combined into a single one containing the union of the other two. If two merged packages contain **Entities** with the same names, the former will be replaced by the later.

![package merging](https://drive.google.com/uc?authuser=0&id=1bhNRyBA7GNCk0QDsj2Ahouv7xYPsxM9N&export=download)

### Identifier Assignation

The linking process assigns each node an [UUID(v4)](https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)) on their `id` attribute, to act as primary key. These ids are meant to be **unique** and **can't be shared, even by nodes on different Environments**.
If a previous *Environment* is provided to the Linker to re-link, a deep copy with new ids is made to use during the process.

Once a node is assigned an id, its methods are susceptible of being cached, so copying a linked node without changing it's id is ill-advised.

### Scoping

The **Scope** of a node is a Record of all possible referenceable **names** available for that node, associated to the ids of the nodes those names represent. This information is used primarily to identify the target of **References** and make navigation on the Environment tree smother, but might also be used to provide some autocomplete support on editors.

Constructing the scopes is, by far, the most complex and time-consuming process of the linking phase, and should be approached with caution. Here are some key aspects to understand it:

- Since scopes are naturally hierarchical, each node's scope is defined mainly by where on the AST it is placed.
- The building of scopes takes place in two main steps:
  - First, a partial scope that doesn't contain inheritable members is assigned to all **Entities**. This is done so **Imports** get resolved and all **Modules** can identify their complete hierarchy.
  - After that, a second iteration is made, fully assigning the complete scope to each node.
- The scope for a node is defined as its parent's scope, plus any contributions that its parent and siblings make. Most named scopes contribute themselves, so any sibling can reference them, but some other nodes (like **Imports**) might also contribute names from other branches.

# Updating an Environment

After the linking phase is finished the Linker outputs an *Environment* tree, which is considered to be in the **Linked** stage of the pipeline. From this point on, the AST should be considered frozen and no nodes should be added or subtracted from it or any of it's copies. If a change is needed on a Linked Node, that node (and thus, all the Environment) should be immediately re-linked to avoid miss-references and cache issues.
