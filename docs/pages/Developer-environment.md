
## General environment

Before anything else, you will need a *TypeScript* editor. We recomend [Visual Studio Code](https://code.visualstudio.com/) along with the following plugins:

- [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint)
- [TypeScript Importer](https://marketplace.visualstudio.com/items?itemName=pmneo.tsimporter)
- [Move TS](https://marketplace.visualstudio.com/items?itemName=stringham.move-ts)
- [Wollok Highlight](https://marketplace.visualstudio.com/items?itemName=uqbar.wollok-highlight)
- [Git Lens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)
- [Test Explorer UI](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer)
- [Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter)
 
Optional extra plugins could be:

- [Prettier - Code Formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [TypeScript Extension Pack](https://marketplace.visualstudio.com/items?itemName=loiane.ts-extension-pack)

### Settings

You might also want to copy the following configurations to your user settings (`ctrl+,` or File > Preferences > Settings, search for TSLint, tab User, look for Edit in settings.json link):

```json
{
  "window.menuBarVisibility": "default",
  "window.zoomLevel": 0,
  "workbench.statusBar.feedback.visible": false,
  "workbench.startupEditor": "none",
  "explorer.openEditors.visible": 0,
  "files.exclude": {
    "dist": true,
    ".vscode": true,
    "node_modules": true,
  },
  "explorer.autoReveal": true,
  "editor.tabSize": 2,
  "editor.formatOnSave": true,
  "editor.fontFamily": "Fira Code",    
  "editor.fontLigatures": true,
  "editor.foldingStrategy": "indentation",
  "tslint.autoFixOnSave": true,
  "tslint.alwaysShowStatus": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "javascript.implicitProjectConfig.checkJs": true
}
```

### Node

You need to install [node](https://nodejs.org/es/) > 11, which provides VM environment, and [nvm - Node Version Manager](https://github.com/nvm-sh/nvm). Before anything make sure you'll use the right version of node by running this command:

```bash
nvm use
```

Expected output is the node version that will be used, for example:

```bash
Found '/home/wollok-ts/.nvmrc' with version <v11.15.0>
Now using node v11.15.0 (npm v6.7.0)
```

> Please remember anytime you add 

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

Linter should follow settings above defined. Be sure to use Typescript version from the Workspace and not from current VSC installation:

![settingTSversion](https://user-images.githubusercontent.com/4549002/71355632-68957400-255e-11ea-808b-39ec97abff5c.gif)

## Testing

We use [BDD chai unit testing style](https://www.chaijs.com/api/bdd/), in particular

- [should](http://shouldjs.github.io/)
- expect

They are located in `test` folder.

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
