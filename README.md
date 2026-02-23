# Outposts and Ogres

**Foundation RPG System with LLM as rendering (narration) engine.**

Outposts and Ogres is a core framework designed for building text-based RPGs and interactive stories (referred to as "Cartridges"). Instead of a traditional rendering engine for graphics, it uses Large Language Models (LLMs) to narrate the story based on strict game rules, state management, and side effects.

## Features

- **LLM Narration Engine:** Uses an LLM to render dynamic, reactive storytelling while enforcing game mechanics.
- **Cartridge System:** Game logic, rules, and world definitions are isolated into "Cartridges" (e.g., `basic-fantasy`, `toy-platform`).
- **Platform Agnostic:** Built-in adapters for various AI and text RPG platforms:
  - JanitorAI
  - AI Dungeon
  - SillyTavern
- **Robust State Management:** Manages stats, side effects (both permanent and temporary), and time progression.
- **Controlled LLM Prompts:** Uses structured updates (`NarrationSummary`) and explicit directions (`NarrationDirective`) with `NARRATION_GUIDE` blocks to keep the LLM within game bounds.

## Getting Started

### Prerequisites

Ensure you have Node.js and NPM installed. The project relies on TypeScript and Webpack.

### Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/neolaw84/outposts-and-ogres.git
cd outposts-and-ogres
npm install
```

### Building the Project

The project builds via Webpack and uses parameters to determine the targeted cartridge and platform.

To build a specific cartridge for a specific platform (e.g., `basic-fantasy` for `janitorai`), run:
```bash
npm run build --cartridge=basic-fantasy --system=janitorai
```

Available core platforms (`--system`):
- `janitorai`
- `aidungeon`
- `sillytavern`

Available cartridges (`--cartridge`):
- `basic-fantasy`
- `toy-platform`
- (Or any other cartridge defined in `src/cartridges/<cartridge-name>/index.ts`)

## Architecture

At its core, Outposts and Ogres operates on a game loop facilitated by the `GameEngine`:

1. **Signal Detection:** Parses player input for intents or actions.
2. **State & Time Update:** Advances time and manages expiration of temporary side effects.
3. **Rule Execution:** The active Cartridge evaluates rules based on the Turn Context, producing `SideEffect`s (state mutations) and `NarrationDirective`s.
4. **LLM Rendering:** Produces a set of `mustHappen`, `mustNotHappen`, and `mayHappen` directives which are fed into the LLM via adapters to generate the next story beat.

### Core Components

- **GameEngine (`src/engine.ts`):** The heart of the system. Processes turns, applies state changes, and builds directives.
- **Cartridge (`src/types.ts`):** Defines the specific game's rules, schemas, and logic.
- **Platform Adapters (`src/platform/`):** Middlewares that bridge the GameEngine with specific platform APIs (JanitorAI, AI Dungeon, SillyTavern).
- **State Management:** Tracks timestamps, flags, and `activeConditions` (temporary side effects).

## Testing

The project uses Jest for testing. Tests are organized into three primary categories:
- `tests/ono/`: Core engine, game state, signaling, and utilities.
- `tests/platform/<platform-name>/`: Platform adapter tests. 
- `tests/cartridges/<cartridge-name>/`: Specific tests for individual game rulesets.

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Contributing

Please see [CONTRIBUTION.md](CONTRIBUTION.md) for details on setting up your development environment and contributing to the project.

## License

This project is licensed under the ISC License.
