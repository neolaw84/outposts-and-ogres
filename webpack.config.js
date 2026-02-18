const path = require('path');

module.exports = {
  mode: 'none',
  target: ['web', 'es2015'],
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
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
        compiler.hooks.emit.tap('RemoveDefinePropertyPlugin', (compilation) => {
          for (const filename in compilation.assets) {
            if (filename.endsWith('.js')) {
              let source = compilation.assets[filename].source();
              
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

              compilation.assets[filename] = {
                source: () => source,
                size: () => source.length
              };
            }
          }
        });
      }
    }
  ],
  devtool: false
};
