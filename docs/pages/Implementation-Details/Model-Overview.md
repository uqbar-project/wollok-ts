# Model Overview

The main goal of the [Compilation Pipeline](Compilation-Pipeline) is to turn a text-based piece of *Wollok* code into more computer-friendly data representations, so it can be queried, manipulated and even executed with ease.

## AST Nodes

By far the most important of these structures is the **Abstract Syntax Tree** (or **AST**, for short). This **immutable** assortment of interconnected **Nodes** contains all the information distilled from the *Static Model* described in the source code. Each **Node** on the tree represents a core concept of Wollok's syntax so any program can be represented with some combination of them.

Every *Node* has a unique `id`, a `kind` label identifying its type and a `sourceMap` attribute that serves to link the *Node* to its original position in the source code. Some *Nodes* might also contain a list of `problems` that arised during the compilation and indicate that some parts of it might be invalid or broken.

Even though all nodes represent a different syntactic concept, some of them can be grouped together based on their key characteristics:

### Entities
These Nodes are the top-level definitions of *Wollok*. They represent any declaration that can exists at package or file level and have a **Fully Qualified Name** that uniquely identifies them.

*Entities* include:
  - **Packages**
  - **Programs**
  - **Tests**
  - **Variables**
  - **Modules**


### Modules
**Modules** are a special subtype of **Entity** that englobes all those entities that act as method providers and can be **linearized** to take part in the **Method Lookup** process.

*Modules* include:
  - **Classes**
  - **Singletons**
  - **Mixins**
  - **Describes**

### Sentences
These nodes represent logic computations and conform the bulk of any Wollok *AST*. They are usually contained within the scope of a **Body** and constitute the building blocks for **Methods**, **Tests** and **Programs**.

*Sentences* include:
  - **Variables**
  - **Returns**
  - **Assignments**
  - **Expressions**

### Expressions
**Expressions** are particular cases of **Sentences**, which are guaranteed to return a value (as oposite of regular *Sentences* that might only produce an effect and return nothing).

*Expressions* include:
  - **References**
  - **Selfs**
  - **Literals**
  - **Sends**
  - **Super**
  - **News**
  - **Ifs**
  - **Throws**
  - **Tries**

## Synthetic Nodes
Some *Nodes* are not directly derived from a syntactic element and cannot be directly mapped to a source file. Some of them, like the **Environment** or the accesor methods of **Property Fields**, are created as part of the [Compilation Pipeline](Compilation-Pipeline); others can be the result of direct manipulation of the *AST* by a program or IDE. Whatever the reason, these nodes are usually called **Synthetic Nodes** and can be identified by their lack of `sourceMap`.

## Surrogated Nodes
Some syntactic elements can easily be expressed in terms of others and don't require their own kind of *Node*. These abstractions (such as **Closures** and some **Special Assignation Operators**), that are compiled into a combination of other constructions instead of having their own, are often refered as "**Surrogated Nodes**".

## Class Diagram

> ### ☠️ Out Of Date!
> This section of the documentation is based on an out-of-date version of the code and might no longer apply. Proceed at your own risk...

The following diagram shows all the different nodes types, how they relate to each other, and a general overview of their most important attributes.

![General Class Diagram](https://drive.google.com/uc?authuser=0&id=1pYLoOemQYWZye-rV0k-UK5TW10aX-o2Z&export=download)