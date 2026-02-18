const typescript = require('@rollup/plugin-typescript');
const babel = require('@rollup/plugin-babel').default;
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const cleanup = require('rollup-plugin-cleanup');
const flattenBundle = require('./rollup-plugin-flatten');

module.exports = {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
    banner: '/* OutpostsAndOgres - Foundation RPG System for Janitor AI and SillyTavern */',
    compact: false,
    strict: false
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
      sourceMap: false
    }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.js'],
      exclude: 'node_modules/**',
      presets: [
        ['@babel/preset-env', {
          targets: {
            ie: '11'
          },
          modules: false,
          loose: true,
          spec: false
        }]
      ],
      plugins: [
        ['@babel/plugin-transform-block-scoping', { throwIfClosureRequired: false }]
      ]
    }),
    cleanup({
      comments: 'some',
      compactComments: false
    }),
    flattenBundle()
  ]
};
