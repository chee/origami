# OCC
the *o*rigami *c*omponent *c*onverter

## usage

```sh
$ npm install --global @chee/occ
$ occ --working-directory ~/tmp/origami
```

this will:

1. create ~/tmp/origami containing:
  - `.npmrc` pointing to the local sinopia registry
  - `package.json` depending on babel for building the components
2. fetch the latest release of all the components (you can pass targets like `--components o-typography,o-colors`
3. create `package.json` files for all the components
4. build the components
5. clean the `package.json`
6. publish to your local `npm` registry

## notes

you can pass `--components o-typography,o-table` to build only those components.

you'll probably need to [generate a github read
token](https://github.com/settings/tokens) and add it to your environment as
`ON_GITHUB_TOKEN`, because we are hitting the github api as many times as there
are components to convert. it adds a fetch cache to your working directory, but
that only helps the second time.

## todo

* run the obt tests on the node module version of a component
* write literally any tests for this code
