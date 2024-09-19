
## Base environment

Please take a look at [the developer environment page](./Developer-environment.md) in order to install all required components.

## Testing

We use [BDD chai unit testing style](https://www.chaijs.com/api/bdd/), in particular

- [should](http://shouldjs.github.io/)
- expect

They are located in `test` folder.

You can run all the project tests from the console by executing:

```bash
npm test
```

We also have specific tests for each component of Wollok-TS:

```bash
npm run test:dynamicDiagram
npm run test:validations
...
```

Please refer to the `package.json` file or just run `npm run` command to see a list of alternatives.

## Debugging

The folder `.vscode` has a `launch.json` file which configures everything for running tests in an embedded VSCode environment. You can set a breakpoint and run the tests:

![ezgif com-video-to-gif](https://user-images.githubusercontent.com/4549002/71355164-00925e00-255d-11ea-9a83-c37f420d4e61.gif)

More on debugging:

- [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging)
- [Debugging Typescript in VS Code](https://code.visualstudio.com/docs/typescript/typescript-debugging)
- [How to debug Typescript in VS Code](https://medium.com/@PhilippKief/how-to-debug-typescript-with-vs-code-9cec93b4ae56)

### Debugging a single test

You can use **Test Explorer with Mocha**, if you follow current instructions and install plugins Test Explorer and Mocha Test Explorer. Then, you can go to the Test Explorer tab and run/debug a single test from the left sidebar:

![debuggingWollokTs2](https://user-images.githubusercontent.com/4549002/71355441-cd040380-255d-11ea-82b6-1cb7c19c1c7a.gif)

Or, if you prefer using the console:

```bash
npm run test:unit -- -f <test>
```

### Building it locally

If you are developing a dependency of Wollok-TS (for instance Wollok-TS CLI or Wollok Web Tools), you might need to run a local build. To do so, just run:

```bash
npm run build
```

### We, the People

If you need some human interaction, you're always welcome at [our Discord channel](https://discord.gg/Nv72jnTR). We also have [a list of first good issues](https://github.com/uqbar-project/wollok-ts/labels/good%20first%20issue) you can take a look and ask for help to get more information.

### Deploying / Publishing

If you need to deploy or publish a new version, please refer to [this page](../Publish-Instructions.md)

