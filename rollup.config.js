const typescript = require('@rollup/plugin-typescript');
const babel = require('@rollup/plugin-babel').default;
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const cleanup = require('rollup-plugin-cleanup');
const flattenBundle = require('./rollup-plugin-flatten');

const buildCartridge = process.env.BUILD_CARTRIDGE || '';
const buildSystem = process.env.BUILD_SYSTEM || '';

function resolveBuildInput() {
  if (!buildCartridge || !buildSystem) {
    throw new Error('BUILD_CARTRIDGE and BUILD_SYSTEM are required. Use scripts like build:basic:aidungeon.');
  }

  const key = buildCartridge + ':' + buildSystem;
  const entries = {
    'basic:aidungeon': 'src/builds/basic/aidungeon.ts',
    'basic:janitorai': 'src/builds/basic/janitorai.ts',
    'basic:sillytavern': 'src/builds/basic/sillytavern.ts'
  };

  if (!entries[key]) {
    throw new Error('Unsupported build combination: ' + key);
  }

  return entries[key];
}

function resolveOutputFile() {
  return 'dist/bundle.' + buildCartridge + '.' + buildSystem + '.js';
}

module.exports = {
  input: resolveBuildInput(),
  output: {
    file: resolveOutputFile(),
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