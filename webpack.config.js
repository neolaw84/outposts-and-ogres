const path = require('path');

const buildCartridge = process.env.BUILD_CARTRIDGE || '';
const buildSystem = process.env.BUILD_SYSTEM || '';

function resolveBuildEntry() {
  if (!buildCartridge || !buildSystem) {
    throw new Error('BUILD_CARTRIDGE and BUILD_SYSTEM are required. Use scripts like build:webpack:basic:aidungeon.');
  }

  const key = buildCartridge + ':' + buildSystem;
  const entries = {
    'basic:aidungeon': './src/builds/basic/aidungeon.ts',
    'basic:janitorai': './src/builds/basic/janitorai.ts',
    'basic:sillytavern': './src/builds/basic/sillytavern.ts'
  };

  if (!entries[key]) {
    throw new Error('Unsupported build combination: ' + key);
  }

  return entries[key];
}

function resolveOutputFile() {
  return 'bundle.' + buildCartridge + '.' + buildSystem + '.webpack.js';
}

module.exports = {
  mode: 'none',
  target: ['web', 'es2015'],
  entry: resolveBuildEntry(),
  output: {
    filename: resolveOutputFile(),
    path: path.resolve(__dirname, 'dist'),
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
    extensions: ['.ts', '.js']
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
  plugins: [
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
  ],
  devtool: false
};
