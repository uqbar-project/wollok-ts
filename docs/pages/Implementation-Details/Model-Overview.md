The main bricks conforming [[the Language Pipeline]] phases' output are **AST Nodes**. Each node represents a core concept of Wollok's syntax so any program can be represented with some combination of them. Even though all nodes are equally important, they might be naturally categorized as follows:

- **Top Level Entities**: These nodes are the root containers for all others. They represent high level concepts and require little-to-none context to exist.

- **Modules**: These are special **Entities** used to define and shape Objects.

- **Class/Object Members**: These nodes define each posible content of a **Module** definition.

- **Sentences**: These nodes represent computations and conform the bulk of any Wollok program.

- **Expressions**: These nodes are particular cases of **Sentences**, which return a value instead of only producing an effect.

- **Synthetics**: Some nodes have no syntax associated with them and can only be created as part of the Language Pipeline process or through IDE manipulation. The **Environment** node is an example of this.

The following diagram shows all the different nodes types, how they relate to each other, and a general overview of their most important attributes.

![General Class Diagram](https://drive.google.com/uc?authuser=0&id=1pYLoOemQYWZye-rV0k-UK5TW10aX-o2Z&export=download)
