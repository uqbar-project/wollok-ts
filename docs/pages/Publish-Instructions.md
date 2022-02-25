
## Check package.json file

In `package.json` make sure the package.json points out to the right versions

- **version:** wollok-ts version to be released (the current one, you should increment yourself, it is a manual process)
- **wollokVersion**: wollok-language version needed by current release. It must exist in [github repository](https://github.com/uqbar-project/wollok-language/releases).

```json
  "version": "x.y.z",
  "wollokVersion": "a.b.c",
```

And `CHANGELOG.md` should be up to date with latest changes.

These values should be ok, since it is expected to be updated by previous PRs.

## Checkout wollok-ts

Go to `wollok-ts` root folder

```bash
git checkout master
```

Be sure you have no local changes:

```bash
git status
```

## Checkout wollok-language

Go to `language` subfolder from `wollok-ts`, confirm you have no local changes:

```bash
cd language
git status
```

After that you should remove `language` directory and re-checkout it:

```bash
cd ..
rm -rf language
npm i
```

`npm i` will checkout the version 

## First time: adding npm user

You must have an npm account with 2FA set, then you can type the following command:

```bash
npm adduser
```

Your user must be added to `wollok-ts` project in [npm](https://www.npmjs.com/package/wollok-ts). For example, [check this page](https://www.npmjs.com/package/wollok-ts) and you should appear in maintainers list.

## Publish

Run this command:

```bash
npm publish
```

It will run all tests and also publish existing version to NPM.

## Update new development version

Go to `package.json` and increment the new version value. For example, if version was "2.9.1" you should change it to "2.9.2". Commit & push.



