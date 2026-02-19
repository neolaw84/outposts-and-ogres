# outposts-and-ogres

Foundation RPG System with LLM as rendering (narration) engine.

A foundation RPG script for Janitor AI and SillyTavern clones, written in TypeScript and compiled to ES5-compatible JavaScript.

## Features

- **TypeScript Development**: Write modern TypeScript code with full type safety
- **ES5 Compatibility**: Transpiled to ES5 for maximum compatibility with older JavaScript engines
- **Flat Bundle**: Single `dist/bundle.js` file with no imports/exports/requires
- **No Modern Syntax**: No IIFE wrappers, arrow functions, or destructuring in the output
- **Scope Hoisting**: Optimized bundle with scope hoisting for better performance
- **Unit Testing**: Comprehensive test suite using Jest

## Installation

```bash
npm install
```

## Building

Builds are composed at build time by selecting a cartridge × system combination.

The base `npm run build` command is intentionally fail-fast and requires explicit selection.

Use one of these commands:

```bash
npm run build:basic:aidungeon
npm run build:basic:janitorai
npm run build:basic:sillytavern
```

These commands generate dedicated bundles, for example `dist/bundle.basic.aidungeon.js`,
without runtime cartridge/system selection logic in the gameplay engine.

The build process:
1. Compiles TypeScript to ES5
2. Bundles all modules into a single file
3. Removes all import/export statements
4. Exposes APIs to global scope (`window.OutpostsAndOgres` or `global.OutpostsAndOgres`)

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

## Usage

After building, you can use the bundle in any JavaScript environment:

### In a Browser

```html
<script src="dist/bundle.js"></script>
<script>
  // Access the RPG system
  var rpg = window.OutpostsAndOgres;
  
  // Create a character
  var hero = rpg.createCharacter('Hero', 100);
  
  // Use character methods
  hero.takeDamage(30);
  console.log(hero.getHealth()); // 70
</script>
```

### In Node.js

```javascript
require('./dist/bundle.js');

var rpg = global.OutpostsAndOgres;
var hero = rpg.createCharacter('Hero', 100);
hero.takeDamage(30);
console.log(hero.getHealth()); // 70
```

## API

### OutpostsAndOgres

Main RPG system class.

- `getVersion()`: Returns the version string
- `createCharacter(name, maxHealth)`: Creates a new character

### Character

Character class for the RPG system.

- `getName()`: Returns character name
- `getHealth()`: Returns current health
- `getMaxHealth()`: Returns maximum health
- `getLevel()`: Returns character level
- `takeDamage(damage)`: Reduces health by damage amount
- `heal(amount)`: Increases health by heal amount (up to max health)
- `levelUp()`: Increases level, max health, and fully heals
- `isAlive()`: Returns true if health > 0

## Project Structure

```
.
├── src/              # TypeScript source files
│   ├── index.ts      # Main entry point
│   └── character.ts  # Character class
├── tests/            # Jest test files
│   ├── index.test.ts
│   └── character.test.ts
├── dist/             # Built bundle (generated)
│   └── bundle.js
├── tsconfig.json     # TypeScript configuration
├── rollup.config.js  # Rollup bundler configuration
├── jest.config.js    # Jest testing configuration
├── .babelrc          # Babel transpiler configuration
└── package.json      # Project dependencies and scripts
```

## Development

The project uses:
- **TypeScript**: For type-safe development
- **Rollup**: For bundling with scope hoisting
- **Babel**: For ES5 transpilation
- **Jest**: For unit testing
- **ts-jest**: For testing TypeScript files

## License

ISC
