# Wollok-TS

TypeScript based Wollok language implementation

## Usage 
[[TODO]]
- modules description
- examples


## Contributing

All contributions are welcome! Feel free to report issues on [the project's issue tracker](https://github.com/uqbar-project/wollok-ts/issues), or fork the project and [create a *Pull Request*](https://help.github.com/articles/creating-a-pull-request-from-a-fork/).

If you plan to contribute with code, here are some hints to help you start:


### Working Environment

Before anything else, you will need a *TypeScript* editor. We recomend [Visual Studio Code](https://code.visualstudio.com/) along with the following plugins:

- [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint)
- [TypeScript Importer](https://marketplace.visualstudio.com/items?itemName=pmneo.tsimporter)
- [Move TS](https://marketplace.visualstudio.com/items?itemName=stringham.move-ts)

You might also want to copy the following configurations to your user settings (`ctrl+,`):

```json
  "window.menuBarVisibility": "default",
  "workbench.activityBar.visible": false,
  "workbench.startupEditor": "none",
  "explorer.openEditors.visible": 0,
  "files.exclude": {
    "dist": true,
    ".vscode": true,
    "yarn.lock": true,
    "node_modules": true,
  },
  "git.enabled": false,
  "editor.tabSize": 2,
  "explorer.autoReveal": true,
  "editor.formatOnSave": true,
  "tslint.autoFixOnSave": true,
  "tslint.alwaysShowStatus": true,
  "workbench.statusBar.feedback.visible": false,
  "window.zoomLevel": 0,
  "workbench.colorTheme": "Visual Studio Dark",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.foldingStrategy": "indentation",
```

### Yarn

You will also need to install [Yarn](https://yarnpkg.com/). If you are not familiar with *dependency manager tools*, you can think of this program as the entry point for all the important tasks development-related tasks, like installing dependencies and running tests. After installing the client, go to the project root folder and run:

```bash
# This will install all the project dependencies. Give it some time.
yarn install
```

After that, you are ready to start working. You can **run the test suite** by typing:

```bash
# This will run tests for all the modules. Try to do this often and avoid commiting changes if any test fails.
yarn test
```

Or check if your changes comply with our **style policies** by running:

```bash
# This will ensure we all apply the same code style.
# If you used the tools as described above this won't be necessary, since the IDE will highlight the errors (and fix most of them on save!).
yarn lint
```

A full list of the available scripts is listed on the `package.json` file, on the root folder.

### File Description
[[TODO]]: Describe what is each file

### Dependencies
[[TODO]]: Describe what we are usinng, give links, and explain what docs to read based on what you will be touching.