module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^@platform-helper$': '<rootDir>/src/platform/empty-helper.ts',
    '^@cartridge$': '<rootDir>/src/cartridges/basic-fantasy/index.ts'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        outDir: './dist-test',
        target: 'ES5',
        module: 'commonjs',
        lib: ['ES5', 'ES2015'],
        rootDir: './',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true
      }
    }]
  }
};
