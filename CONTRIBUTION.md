# Contributing to Outposts and Ogres

Thank you for your interest in contributing to Outposts and Ogres! This document provides guidelines and instructions for developers who want to contribute to the core engine, platform adapters, or new cartridges.

## Setting Up Your Development Environment

1. **Fork and Clone:** Fork the repository on GitHub and clone it locally.
2. **Install Dependencies:** Run `npm install` in the project root to install all required dependencies (TypeScript, Jest, Rollup, Webpack, Babel).
3. **TypeScript:** The codebase is written entirely in TypeScript. Familiarize yourself with `src/types.ts` as it dictates the core data structures used throughout the system.

## Project Structure

A quick overview of the repository structure to help you navigate:

- `/src/` - The source code.
  - `/core/` - Core state management and execution logic.
  - `/engine.ts` - The primary `GameEngine` handling turn loops.
  - `/types.ts` - Central interface definitions for State, Signals, Cartridges, and Rules.
  - `/platform/` - Platform adapters (JanitorAI, AI Dungeon, SillyTavern).
  - `/cartridges/<name>/index.ts` - (Omitted in standard analysis, but this is where distinct game logic resides as isolated packages).
  - `/utils/` - Shared utilities for time management, dice rolling, base64 encoding, and LLM text parsing.
  - `/signals/` - Logic for intent parsing and signal detection.
- `/tests/` - Jest test suites.
  - `/ono/` - Core engine, game state, and utilities tests.
  - `/platform/<platform-name>/` - Platform adapter tests.
  - `/cartridges/<cartridge-name>/` - Specific tests for individual cartridge rules.
- `package.json` - Defines build scripts and dependencies.

## Developing Cartridges

If you are a Cartridge developer, please refer to the `cartridge-developer-guide.md` and design principles inside the repository (e.g., `janitorai-design-principles.md`). 
- Focus on defining clear `SignalSchema`s and robust `Rule`s.
- Always ensure side effects (temporary and permanent) accurately reflect in the TurnContext.
- Co-develop prompt mappers and `NarrationDirective` patterns effectively to keep the LLM contained within your game rules.

## Build System Guidelines

We support multiple targets across multiple platforms via Webpack.
- When modifying build output, ensure changes are reflected in `webpack.config.js`.
- Platform-specific logic should remain strictly within `src/platform/<platform-name>/`. Do not bleed platform details into `src/engine.ts` or `src/core/`.

## Testing

We use **Jest** for all unit testing.

1. **Write Tests:** All new features or bug fixes must be accompanied by corresponding unit tests in the `/tests/` directory.
2. **Run Tests:** Before opening a PR, ensure all tests pass cleanly:
   ```bash
   npm run test
   ```
3. **Coverage:** Aim to uphold or improve test coverage. You can check coverage locally by running `npm run test:coverage`. Keep an eye on edge cases, especially related to time parsing and state reversion.

## Submitting Pull Requests

1. **Create a Branch:** Create a new branch for your feature or bugfix (e.g., `feature/improved-time-parsing` or `fix/sillytavern-adapter`).
2. **Commit Messages:** Use clear, descriptive commit messages. Explain *why* a change is necessary, not just *what* changed.
3. **Open a PR:** Open a Pull Request against the main branch. Fill out the PR template completely if one is provided.
4. **Code Review:** Be responsive to feedback during code review. Ensure the CI pipeline passes (all builds and tests).

## Terminology Best Practices

Please respect the domain semantics when naming variables and functions:
- **Signal:** Represents an intent, a detected event, or world condition.
- **SideEffect:** Represents a mutation on the `State`.
- **NarrationSummary:** Structured block returned by the LLM summarizing the action.
- **NarrationDirective:** Constraints handed to the LLM (`mustHappen`, `mustNotHappen`, `mayHappen`).

Thank you for contributing!
