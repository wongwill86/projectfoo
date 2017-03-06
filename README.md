#### React Best Practices & Optimizations
- no mixins -> use ES6 style PureRenderMixin with PureComponent
- no ref strings -> use ref callbacks
- no method binding -> use ES Class Fields
- no function/objects instantiation in render method -> instantiate in outer scope and use references
- render big collections in separate, dedicated components -> no unfortunate re-renders when other props changes
- don't use array index as key property -> use item unique id property to eliminate bugs
- remove `bindActionCreators` boilerplate using object literal with actions instead of `mapDispatchToProps` function [issue #32](/../../issues/32)


## Installation

#### Prerequisites
- Node.js `>=6.0.0`
- Global [JSPM](http://jspm.io/) installation for CLI commands - `npm i -g jspm`

```
// Clone repo
git clone https://github.com/wongwill86/projectfoo

cd projectfoo

// Install dependencies
yarn install

// Initiate JSPM and dev-bundle
npm run init

// Run development server with HMR
npm run dev
```

*NOTE* We are using a fork of babylonjs that has new experimental WebGL2 features. See [wongwill86/Babylon.js](https://github.com/wongwill86/Babylon.js/tree/projectfoo)
```
// clone fork of Babylon.js
git clone https://github.com/wongwill86/Babylon.js/tree/projectfoo

// switch to babylon gulp
cd Babylon.js/Tools/Gulp/

// build
gulp typescript

// replace this with your directory structure here
project_directory=~/src

// ugly hacks to use forked babylon instead of official until webgl2 features are supported
rm $project_directory/projectfoo/jspm_packages/npm/babylonjs@2.5.0/babylon.max.js 
ln -s $project_directory/Babylon.js/dist/preview\ release/babylon.max.js $project_directory/projectfoo/jspm_packages/npm/babylonjs@2.5.0/babylon.max.js 
rm $project_directory/projectfoo/jspm_packages/npm/babylonjs@2.5.0/babylon.js 
ln -s $project_directory/Babylon.js/dist/preview\ release/babylon.js $project_directory/projectfoo/jspm_packages/npm/babylonjs@2.5.0/babylon.js 
rm $project_directory/projectfoo/node_modules/@types/babylonjs/index.d.ts 
ln -s $project_directory/Babylon.js/dist/preview\ release/babylon.module.d.ts $project_directory/projectfoo/node_modules/@types/babylonjs/index.d.ts

// rebundle app with custom babylonjs
cd $project_directory/projectfoo
npm run dev:bundle

```

---

## Project Structure

```
.
├── assets                      # static assets copied to dist folder
|   ├── index.prod.html         # index.html configured for production use
|   ├── loader-styles.css       # css app loading indicator
|   └── shim.min.js             # core-js polyfill
├── dist                        # production build output
├── scripts                     # build and workflow scripts
├── src                         # app source code
│   ├── components              # global reusable presentational components
│   ├── containers              # global container components providing redux context
│   ├── layouts                 # global components defining page layouts
│   ├── services                # global modules abstracting communication with web services
│   ├── store                   # global modules containing redux modules (reducers/constants/action creators)
│   ├── routes                  # where to place fractal routing
│   ├── types                   # custom TypeScript definitions
│   ├── utils                   # app utility modules
│   ├── app.tsx                 # app entry module with routing config
│   └── tsconfig.json           # TypeScript compiler config
├── temp                        # development bundle output
├── index.html                  # index.html
├── jspm.config.js              # system.js config for app dependencies
└── tslint.json                 # linter config
```

---
## Workflows Guide
**NOTE**: Use index.html from assets for production, it have optimized loading logic for production. It is already configured in build script.

#### - Development Workflow
1. `npm run dev:bundle` - build optional vendor dependencies bundle to speed-up page reload during development _(re-run when dependencies was changed)_
2. `npm run dev` - start local dev server with hot-reload and open browser

#### - NO-IDE Workflow - command line type checking
1. `npm run tsc:watch` - if you don't use IDE with Intellisense, run this command for fast incremental type-checking in CLI

#### - Build for Production Workflow
1. `npm run build` - create app.js & vendor.js bundles in `dist/` folder
  - `npm run build:app` - build only app.js bundle _(run when project source code has changed)_
  - `npm run build:vendor` - build only vendor.js bundle _(run when project dependencies has changed)_
2. `npm run prod` - start local dev server in `dist/` folder running production bundle

---

## CLI Commands

#### - Init

`npm run init` - install jspm packages and prebuilds vendor.dev.js bundle

#### - Development

`npm run dev` or `yarn dev` - start local dev server with hot-reload [jspm-hmr](https://www.npmjs.com/package/jspm-hmr)

`npm run dev:bundle` - build optional vendor dependencies bundle (vendor.dev.js) to speed-up page reload during development (non-minified with source-maps)

`npm run dev:unbundle` - remove vendor.dev.js bundle package  
*(**WARNING**: it will result in loading all of vendor packages as multiple requests - use it only when needed e.g. leveraging HTTP/2 multiplexing/pipelining)*

#### - Type checking

`npm run tsc` - single thorough check 

`npm run tsc:watch` - fast incremental type-checking in watch mode

#### - Production Bundling (`dist/` folder)

`npm run prod` - start local dev server in `dist/` folder running production bundle

`npm run build` - build all, app.js & vendor.prod.js bundle

`npm run build:app` - build only `src/` - app.js (minified, no source-maps)

`npm run build:vendor` - build only `node_modules/` dependencies - vendor.prod.js (minified, no source-maps)

`npm run build:debug` - build debug version of app.js (non-minified with source-maps)

#### - Utility & Git Hooks

`npm run clean` - clean dist, node_modules, jspm_packages folders

`npm run lint` - run ts linter

`npm run test` - run tests with jest runner

`npm run test:update` - updates jest snapshots

`npm run precommit` - pre commit git hook - runs linter and check types

`npm run prepush` - pre push git hook - runs linter and tests

#### - Deployment

`npm run deploy:init` - clone git repository in `/dist` folder (gh-pages branch)

`npm run deploy` - commit and push all changes found in `/dist` folder

---

## The MIT License (MIT)

Copyright (c) 2017 Nico Kemnitz <> ()

Copyright (c) 2017 Will Wong <wongwill86@gmail.com> ()

Copyright (c) 2016 Piotr Witek <piotrek.witek@gmail.com> (http://piotrwitek.github.io/)

This software was based off of the [react-redux-typescript-starter-kit](https://github.com/piotrwitek/react-redux-typescript-starter-kit) created by Piotr Witek <piotrek.witek@gmail.com> (http://piotrwitek.github.io/) Copyright (c) 2016.

See [LICENSE](./LICENSE)
