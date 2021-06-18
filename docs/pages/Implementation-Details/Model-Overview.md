# Model Overview

The main goal of the [Compilation Pipeline](Compilation-Pipeline) is to turn a text-based piece of *Wollok* code into more computer-friendly data representations, so it can be queried, manipulated and even executed with ease.

## AST Nodes

By far the most important of these structures is the **Abstract Syntax Tree** (or **AST**, for short). This **immutable** assortment of interconnected **Nodes** contains all the information distilled from the *Static Model* described in the source code. Each **Node** on the tree represents a core concept of Wollok's syntax so any program can be represented with some combination of them.

Every *Node* has a unique `id`, a `kind` label identifying its type and a `sourceMap` attribute that serves to link the *Node* to its original position in the source code. Some *Nodes* might also contain a list of `problems` that arised during the compilation and indicate that some parts of it might be invalid or broken.

Even though all nodes represent a different syntactic concept, some of them can be grouped together based on their key characteristics. These aggrupations of node types are called **Categories** and are a nifty way to think about similar Nodes.

Next is a list of each *Node* type, grouped by their *Categories*.

### Entity
This *Category* includes the top-level definitions of *Wollok*. These Nodes represent any declaration that can exists at package or file level and have a **Fully Qualified Name** that can be used to uniquely identify them.


#### Package
*Package* Nodes represent all forms of *Wollok* packages. This includes the ones explicitly created using the `package` keyword and the ones implicitly created by files and folder structure. They are the main containers of [Entities](#entity). 

#### Program
*Program* Nodes represent all *Wollok* programs created with the `program` keyword.

#### Test
*Test* Nodes represent all *Wollok* tests created with the `test` keyword. They can also be found as [Describe](#describe) children.

#### Variable
*Variable* Nodes represent both *Wollok* **Constants** (created using the `const` keyword) and *Wollok* **Variables** (created using the `var` keyword). These Nodes are, at the same time [Entities](#entity) and [Sentences](#sentence), but should not be confused with [Fields](#fields), which are created using the same keywords but can only be defined in the context of a [Module](#module).

### Module
The *Module* category is a sub-category of [Entity](#entity) (meaning all *Modules* are *Entities*). These nodes act as *Object* definitions and *Method Providers* and can be **linearized** to take part in the **Method Lookup** process.

#### Class
*Class* Nodes represent *Wollok* Classes defined with the `class` keyword.

#### Singleton
*Singleton* Nodes represent *Wollok* Stand-Alone Objects. This includes *named* and *anonymous* objects explicitly created using the `object` keyword and some [synthetic elements](#synthetic-nodes) derived from other grammar constructions, but only *named* singletons are considered [Entities](#entity).

#### Mixin
*Mixin* Nodes represent *Wollok* Mixins defined with the `mixin` keyword.

#### Describe
*Describe* Nodes represent *Wollok* test evaluation contexts defined with the `describe` keyword. It might seem a bit odd to think of *Describes* as *Modules* since the don't really represent object descriptions, but under the hood they have many of the same needs and behaviors because *Describes* are also method providers of a sort.

### Sentence
This *Category* includes all logic computations and conform the bulk of any Wollok *AST*. They are usually contained within the scope of a [Body](#bodies) and constitute the building blocks for [Methods](#methods), [Tests](#test) and [Programs](#program).

#### Variable
See [Variables](#variable).

#### Return
*Return* nodes represent *Wollok* return statements created with the `return` keyword.

#### Assignment
*Assignment* nodes represent *Wollok* assignations statements created with the `=` keyword or any of the *Special Assignation Operators*.

### Expression
The *Expression* category is a sub-category of [Sentence](#sentence) (meaning all *Expressions* are *Sentences*) and include all Node types representing statements which are **guaranteed to return a value** (as oposite of regular *Sentences* that might only produce an effect and return nothing).

#### Reference
*Reference* nodes represent any non-keyword *identifier* used to refer to some other term by its name. Everytime you use a previously defined [Variable](#variable), [Field](#fields) or [Parameter](#parameters) you do it through a *Reference*.

*References* are also commonly used as a sort of "pointer" between Nodes that need to be connected but don't directly contain each other. Manifesting these relations is one of the main goals of the [Linker Stage](Compilation-Pipeline/Linker).

#### Self
*Self* nodes represent *Wollok* self-reference created with the `self` keyword.

#### Literal
*Literal* nodes represent any *Wollok* literal value. Its main purpose is to serve as a wrapper for all primitive values that we represent with abstractions from the host language:

* **Number Literals** contain a *TypeScript* `number`.
* **String Literals** contain a *TypeScript* `string`.
* **Boolean Literals** contain a *TypeScript* `boolean`.
* **Null Literals** contain a *TypeScript* `null`.

*Literals* can also contain some non-native constructions:

* **Singleton Literals** contain a *nameless* [Singleton](#singleton) node, product of either an explicit declaration of an *Anonymous Object* or the [synthetic materialization](#synthetic-nodes) of a *Closure*.
* **Collection Literals** contain a `[Reference<Class>, List<Expression>]` pair with a [Reference](#reference) to either `wollok.lang.List` and `wollok.lang.Set` and a list of [Expression](#expression) members.

#### Send
*Send* nodes represent a message chain. Each one of this nodes contain the *Name* of the sent message, along with the [Expressions](#expression) that conform the arguments and receiver (which, of course, could also be a *Send* node, thus the term "message chain").

#### Super
*Super* nodes represent a super-call statement created by the use of the `super` keyword.

#### New
*New* nodes represent a *Class* instantiation created by the use of the `new` keyword.

#### If
*If* nodes represent an "if" statement created by the use of the `if-else` composed keywords.

#### Try
*Try* nodes represent an "try" statement created by the use of the `try-catch-finally` composed keyword. It contains a collection of [Catch](#catches) nodes representing the potential exception handlers, but these are not [Sentence](#sentence) themselves.

#### Throw
*Throw* nodes represent the raise of an *Exception* explicitly created by the use of the `throw` keyword. Even though this sentence does not strictly return a value it is considered an [Expression](#expression) because its evaluation inmediately stops the execution of the current frame, thus allowing it to be used in any place where a value is expected.

### Unique Nodes
Some nodes are just too unique to be grouped in any way and don't belong to any [Category](#categories).

#### Catch
*Catch* nodes represent an exception handler defined by the `catch` keyword. Even though their are not [Expressions](#expression) by themselves, they are always contained within a parent [Try](#try) node.

#### Import
*Import* nodes represent the inclussion into a package's scope of an externally defined [Entity](#Entity) by using the `import` keyword.They can be marked with the `isGeneric` flag that denotes that all the children of the referenced *Entity* are meant to be included instead of itself.

#### Body
*Body* nodes represent a sequence of [Sentences](#sentence) and are one of the main forms to define a lexical scope. Every [Entity](#entity) or [Expression](#expression) that contain a fragment of code potentially bigger than a single sentence, has a *Body* to contain it.

#### Parameter
*Parameter* nodes represent the declared parameters of [Methods](#methods) or [Catches](#catches). In the case of *Methods*, the last *Parameter* of the declaration can be marked as `varArgs`, meaning the node represent a variable number of parameters and should be considered to contain a *List*.

#### NamedArgument
*NamedArgument* nodes represent a *Name*-[Expression](#expression) pair, used to pass values bound to a name to [New](#new) and [ParameterizedType](#parameterizedtype) nodes.

#### ParameterizedType
*ParameterizedType* nodes are used to define the linearization of [Modules](#module) and consist of a [Module Reference](#reference) and a list of [NamedArguments](#namedargument).

#### Environment
*Environment* nodes are a special kind of node that does not relate to any syntactic construction. They act as the *Root* of the *AST* and can only be [sintheticly created](synthetic-nodes) by the [Linker](Compilation-Pipeline/Linker).

## Synthetic Nodes
Some *Nodes* are not directly derived from a syntactic element and cannot be directly mapped to a source file. Some of them, like the [Environment](#environment) or the accesor methods of **Property Fields**, are created as part of the [Compilation Pipeline](Compilation-Pipeline); others can be the result of direct manipulation of the *AST* by a program or IDE. Whatever the reason, these nodes are usually called **Synthetic Nodes** and can be identified by their lack of `sourceMap`.

## Surrogated Nodes
Some syntactic elements can easily be expressed in terms of others and don't require their own kind of *Node*. These abstractions (such as **Closures** and some **Special Assignation Operators**), that are compiled into a combination of other constructions instead of having their own, are often refered as "**Surrogated Nodes**".

## Class Diagram
The following diagram shows all the different nodes types, how they relate to each other, and a general overview of their most important attributes and responsibilities.

![General Class Diagram](https://drive.google.com/uc?authuser=0&id=1mAtNF6uwhqZibyOUCawxkI_FjAx9VC4T&export=download)
