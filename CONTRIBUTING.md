# Contributing to Outposts and Ogres

Thank you for your interest in contributing to Outposts and Ogres!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

## Project Structure

- `src/` - TypeScript source files
- `tests/` - Jest test files  
- `dist/` - Build output (generated, not committed)
- Configuration files in root directory

## Development Workflow

1. **Write TypeScript**: Create or modify files in `src/`
2. **Write Tests**: Add tests in `tests/` for any new functionality
3. **Run Tests**: Ensure all tests pass with `npm test`
4. **Build**: Create the bundle with `npm run build`
5. **Verify**: Check that `dist/bundle.js` meets the requirements

## Code Requirements

The build output (`dist/bundle.js`) must meet these strict requirements for compatibility with Janitor AI and SillyTavern:

- **No import/export/require statements** - All code must be in a single flat file
- **No IIFE wrappers** - No immediately invoked function expressions at the top level
- **No arrow functions** - Use traditional `function` syntax only
- **No destructuring** - Avoid ES6 destructuring syntax
- **ES5 compatible** - Target older JavaScript engines
- **Global scope exposure** - APIs must be accessible via `window` or `global`

## Build System

The project uses:
- **Rollup** for bundling with scope hoisting
- **TypeScript** for type-safe development
- **Babel** for ES5 transpilation
- **Custom plugin** (`rollup-plugin-flatten.js`) to create flat output

## Testing

- Write unit tests for all new functionality
- Tests are located in `tests/` directory
- Use Jest testing framework
- Run `npm test` before committing

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Build and verify the output
7. Submit a pull request

## Questions?

Open an issue for any questions or suggestions!
