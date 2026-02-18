const path = require('path');

module.exports = {
  mode: 'none',
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'window',
      name: 'OutpostsAndOgres',
      export: 'default'
    },
    iife: false,
    environment: {
      arrowFunction: false,
      const: false,
      destructuring: false,
      forOf: false,
      dynamicImport: false,
      module: false
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
                  targets: {
                    ie: '11'
                  },
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
  devtool: false
};
