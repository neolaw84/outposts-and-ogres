const path = require('path');

const buildCartridge = process.env.BUILD_CARTRIDGE || '';
const buildSystem = process.env.BUILD_SYSTEM || '';

function resolveBuildEntry() {
  if (!buildCartridge || !buildSystem) {
    throw new Error('BUILD_CARTRIDGE and BUILD_SYSTEM are required. Use scripts like build:webpack:basic:aidungeon.');
  }

  const key = buildCartridge + ':' + buildSystem;

  if (buildSystem === 'aidungeon') {
    return {
      'aidungeon': `./src/platform/aidungeon/build.ts`,
      'aidungeon-onInput': `./src/platform/aidungeon/aidungeon-onInput.js`,
      'aidungeon-context': `./src/platform/aidungeon/aidungeon-context.js`,
      'aidungeon-onOutput': `./src/platform/aidungeon/aidungeon-onOutput.js`
    };
  }

  if (buildSystem === 'sillytavern') {
    return {
      'index': `./src/platform/sillytavern/build.ts`
    };
  }

  if (buildSystem === 'janitorai') {
    return {
      [key]: './src/platform/janitorai/build.ts'
    };
  }

  throw new Error('Unsupported build system: ' + buildSystem);
}

function resolveOutputFile() {
  if (buildSystem === 'aidungeon' || buildSystem === 'sillytavern') {
    return '[name].js';
  }
  return 'bundle.' + buildCartridge + '.' + buildSystem + '.webpack.js';
}

const plugins = [
  {
    apply: (compiler) => {
      const { Compilation, sources } = compiler.webpack;
      compiler.hooks.thisCompilation.tap('RemoveDefinePropertyPlugin', (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'RemoveDefinePropertyPlugin',
            stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COMPATIBILITY
          },
          (assets) => {
            for (const filename of Object.keys(assets)) {
              if (filename.endsWith('.js')) {
                let source = assets[filename].source().toString();

                // Replace Object.defineProperty for exports with simple assignment
                source = source.replace(
                  /Object\.defineProperty\(exports, key, \{ enumerable: true, get: definition\[key\] \}\);/g,
                  'exports[key] = definition[key]();'
                );

                // Replace __esModule defineProperty
                source = source.replace(
                  /Object\.defineProperty\(exports, '__esModule', \{ value: true \}\);/g,
                  "exports['__esModule'] = true;"
                );

                // Remove Symbol.toStringTag defineProperty
                source = source.replace(
                  /Object\.defineProperty\(exports, Symbol\.toStringTag, \{ value: 'Module' \}\);/g,
                  ''
                );

                // Clean up empty if statements
                source = source.replace(
                  /if\s*\(typeof Symbol !== 'undefined' && Symbol\.toStringTag\)\s*\{\s*\}/g,
                  ''
                );

                // Convert const to var for exported variables to avoid temporal dead zone
                source = source.replace(
                  /\/\* harmony default export \*\/ const /g,
                  '/* harmony default export */ var '
                );

                compilation.updateAsset(filename, new sources.RawSource(source));
              }
            }
          }
        );
      });
    }
  }
];

if (buildSystem === 'sillytavern') {
  const CopyWebpackPlugin = require('copy-webpack-plugin');
  plugins.push(new CopyWebpackPlugin({
    patterns: [
      {
        from: 'src/platform/sillytavern/manifest.json',
        to: 'manifest.json',
        transform(content) {
          return content.toString().replace('<cartridge-name>', buildCartridge);
        }
      }
    ]
  }));
}

if (buildSystem === 'janitorai') {
  plugins.push({
    apply: (compiler) => {
      compiler.hooks.thisCompilation.tap('JanitorAIStatePlugin', (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'JanitorAIStatePlugin',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
          },
          (assets) => {
            const bundleName = Object.keys(assets).find(k => k.endsWith('.js'));
            if (!bundleName) return;

            const source = assets[bundleName].source().toString();
            const vm = require('vm');
            const sandbox = { globalThis: {}, console: console, require: require, setTimeout: setTimeout };
            vm.createContext(sandbox);

            try {
              // We execute the compiled bundle to extract the exported default state
              vm.runInContext(source, sandbox);
              const cartridge = sandbox.globalThis.__outpostsCartridge;

              if (cartridge && cartridge.defaultState) {
                const stateStr = JSON.stringify(cartridge.defaultState);
                const b64 = Buffer.from(stateStr).toString('base64');
                const rpStateFile = `[RP_STATE]${b64}[/RP_STATE]`;
                compilation.emitAsset('rp_state.md', new compiler.webpack.sources.RawSource(rpStateFile));

                const seedNarration = {
                  elapsed_time: "PT0S",
                  effects: []
                };
                const narrationStr = `[NARRATION_SUMMARY]\n${JSON.stringify(seedNarration, null, 2)}\n[/NARRATION_SUMMARY]`;
                compilation.emitAsset('seed_narration.md', new compiler.webpack.sources.RawSource(narrationStr));
              }
            } catch (e) {
              console.error("Failed to extract default state for JanitorAI:", e);
            }
          }
        );
      });
    }
  });
}

module.exports = {
  mode: 'none',
  target: ['web', 'es2015'],
  entry: resolveBuildEntry(),
  output: {
    filename: resolveOutputFile(),
    path: path.resolve(__dirname, 'dist', `${buildCartridge}-${buildSystem}`),
    iife: false,
    environment: {
      arrowFunction: true,
      const: true,
      destructuring: true,
      forOf: true,
      dynamicImport: true,
      module: true
    }
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@cartridge': path.resolve(__dirname, `src/cartridges/${buildCartridge === 'basic' ? 'basic-fantasy' : buildCartridge}.ts`)
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: { esmodules: true },
                  modules: false,
                  useBuiltIns: false
                }]
              ]
            }
          },
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: false
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  },
  optimization: {
    concatenateModules: true,
    minimize: false,
    moduleIds: 'named'
  },
  plugins: plugins,
  devtool: false
};
