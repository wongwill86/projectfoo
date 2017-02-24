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

// Install dependencies
npm install

// Initiate JSPM and dev-bundle
npm run init

// Run development server with HMR
npm start
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
```

---

## Project Structure

```
.
├── assets                      # static assets copied to dist folder
|   ├── index.prod.html         # index.html configured for production use
|   ├── loader-styles.css       # css app loading indicator
|   └── shim.min.js             # core-js polyfill
├── configs                     # bundle configuration
|   ├── vendor.config.dev.js    # packages included in "vendor" bundle for dev
|   └── vendor.config.prod.js   # packages included in "vendor" bundle for prod
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
│   └── tsconfig.tsx            # TypeScript compiler config
├── temp                        # development bundle output
├── index.html                  # index.html
├── jspm.config.js              # system.js config for app dependencies
├── server.js                   # dev-server entry module
└── tslint.json                 # linter config
```

---

## Workflows Guide
**NOTE**: Use index.prod.html for production, it have slightly different loading logic. Include references to static assets like links/scripts and copy them to the dist folder on production build.

#### - Development Workflow
1. `npm run build:dev` - create bundle of vendor packages to speed-up full-page reload during development _(re-run only when project dependencies has changed)_
2. `npm run dev` - browser will open automatically

#### - NO-IDE Workflow - command line type checking
1. `npm run tsc:watch` - if you don't use IDE with typescript integration, run tsc compiler in watch mode for fast incremental type-checking (NOTE: this will not emit any JS files, only type-checking - it's OK because you load ts file on-the-fly)
2. `npm run tsc` - one-time project wide type-safety check

#### - Build for Production Workflow
1. `npm run build` - create app.js & vendor.js bundles in 'dist' folder
  - `npm run build:app` - build only app.js bundle _(run when project source code has changed)_
  - `npm run build:vendor` - build only vendor.js bundle _(run when project dependencies has changed)_
2. `npm run dev` & open `http://localhost/dist/` - check prod build on local server

---

## CLI Commands

#### - Development

`npm run dev` or `yarn dev` - start local dev server with hot-reload [jspm-hmr](https://www.npmjs.com/package/jspm-hmr)

`npm run tsc` - run project-wide type-checking with TypeScript CLI (`/src` folder)

`npm run tsc:watch` - start TypeScript CLI in watch mode for fast incremental type-checking (`/src` folder)

#### - Dev Bundling (`temp/` folder)

`npm run dev:bundle` - build vendor packages into vendor.dev.js bundle to speed-up full-page reload during development - non-minified with source-maps (dev bundle)

`npm run dev:unbundle` - delete vendor.dev.js bundle package  
*(**WARNING**: it will result in loading all of vendor packages as multiple requests - use it only when needed e.g. leveraging HTTP/2 multiplexing/pipelining)*

#### - Production Bundling (`dist/` folder)

`npm run build` - build both app.js & vendor.js bundle for production

`npm run build:app` - build app source code into app.js (prod bundle) - minified, no source-maps

`npm run build:vendor` - build vendor packages into vendor.prod.js (prod bundle) - minified, no source-maps

`npm run build:debug` - build app source code into app.js (dev bundle) - non-minified with source-maps

#### - Deployment

`npm run init` - install jspm packages and prebuilds vendor.dev.js bundle

`npm run init:deploy` - clone git repository in `/dist` folder (gh-pages branch)

`npm run deploy` - commit and push all changes found in `/dist` folder

#### - Utility & Git Hooks

`npm run clean` - clean dist, node_modules, jspm_packages folder

`npm run lint` - run linter

`npm run test` or `npm test` - run test suites

`npm run precommit` - pre commit git hook - runs linter

`npm run prepush` - pre push git hook - runs linter and tests

---

## The MIT License (MIT)

Copyright (c) 2017 Nico Kemnitz <> ()

Copyright (c) 2017 Will Wong <wongwill86@gmail.com> ()

Copyright (c) 2016 Piotr Witek <piotrek.witek@gmail.com> (http://piotrwitek.github.io/)

This software was based off of the [react-redux-typescript-starter-kit](https://github.com/piotrwitek/react-redux-typescript-starter-kit) created by Piotr Witek <piotrek.witek@gmail.com> (http://piotrwitek.github.io/) Copyright (c) 2016.

See [LICENSE](./LICENSE)
