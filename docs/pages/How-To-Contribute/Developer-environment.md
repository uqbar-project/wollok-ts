
## General environment

Before anything else, you will need a *TypeScript* editor. We recomend [Visual Studio Code](https://code.visualstudio.com/) with some extensions.

### Wollok-TS developer environment profile

You can download and import [this profile](./Wollok-Dev%20Base.code-profile) in your Visual Studio Code. See [this tutorial](https://www.youtube.com/watch?v=QjvvqR9KyVo) if you have any question.

### Alternative: manually install VSC extensions

We need these extensions for developing Wollok-TS:

- [:Emoji Sense: - Matt Bierner](https://marketplace.visualstudio.com/items?itemName=bierner.emojisense)
- [Better Comments - Aaron Bond](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments)
- [DotENV - mikestead](https://marketplace.visualstudio.com/items?itemName=mikestead.dotenv)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Git Lens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
- [Move TS and JS - tnrich](https://marketplace.visualstudio.com/items?itemName=tnrich.move-ts-js)
- [Pretty Typescript Errors - yoavbls](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors)
- [Typescript Importer - pmneo](https://marketplace.visualstudio.com/items?itemName=pmneo.tsimporter)
- [Typescript Toolbox - DSKWRK](https://marketplace.visualstudio.com/items?itemName=DSKWRK.vscode-generate-getter-setter)
- [Wollok Highlight](https://marketplace.visualstudio.com/items?itemName=uqbar.wollok-highlight)

There are also other plugins that some people on the team find interesting and you might like:

- [TODO Highlight](https://marketplace.visualstudio.com/items?itemName=wayou.vscode-todo-highlight)
- [Test Explorer UI](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer)
- [Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter)

### Node

You need to install [NodeJS](https://nodejs.org/es/), which provides VM environment, and [NVM - Node Version Manager](https://github.com/nvm-sh/nvm).

Make sure you are using the right version of node by running this command:

```bash
nvm use
```

Expected output is the node version that will be used, for example:

```bash
Found '/home/dodain/workspace/wollok-dev/wollok-ts/.nvmrc' with version <lts/hydrogen>
Now using node v18.20.4 (npm v10.7.0)
```

If you get this result as output:

```bash
Found '/home/dodain/workspace/wollok-dev/wollok-ts/.nvmrc' with version <lts/hydrogen>
N/A: version "lts/hydrogen -> N/A" is not yet installed.

You need to run "nvm install lts/hydrogen" to install it before using it.
```

then you need to install it

```bash
nvm install lts/hydrogen # or the version you get on the previous input
```

### NPM

You will also need to install [NPM](https://www.npmjs.com/). If you are not familiar with *dependency manager tools*, you can think of this program as the entry point for all the important tasks development-related tasks, like installing dependencies and running tests. After installing the client, go to the project root folder and run:

```bash
# This will install all the project dependencies. Give it some time.
npm install
```

After that, you are ready to start working. You can **run the tests and style checks** by typing:

```bash
# This will run tests for all the modules. Try to do this often and avoid commiting changes if any test fails.
npm test
```

A full list of the available scripts is listed on the `package.json` file, on the root folder.

## Linter

We use [ESLint](https://eslint.org/) to make sure our code complies with our codestyle standards. Be sure to use Typescript version from the Workspace and not from current VSC installation:

![settingTSversion](https://user-images.githubusercontent.com/4549002/71355632-68957400-255e-11ea-808b-39ec97abff5c.gif)

## Moving on

You can check Wollok-TS tools in [the specific tools page](./Developer-tools.md)