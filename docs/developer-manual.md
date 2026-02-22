# Outposts & Ogres — Developer Manual

> For contributors and maintainers of the ONO library/repository.

---

## 1. What is Outposts & Ogres?

Outposts & Ogres (ONO) is a foundation RPG engine that uses a Large Language Model (LLM) as its narration (rendering) engine. The game logic — dice rolls, state tracking, hit-point arithmetic — is deterministic TypeScript; the LLM's job is restricted to *narrating* the outcomes.

The architecture has two pluggable axes:

| Axis | What it defines | Examples |
|---|---|---|
| **Cartridge** | Game rules, stats, available actions, signal schemas | `basic-fantasy` |
| **System** | Platform adapter (how to read input, save state, inject prompts) | `janitorai`, `sillytavern`, `aidungeon` |

At build time a specific `cartridge × system` combination is selected. The result is a single ES5-compatible JavaScript bundle that runs inside the target platform's scripting environment.

---

## 2. Repository Layout

```
src/
├── builds/basic/           Build entry-points (one per system)
│   ├── janitorai.ts
│   ├── sillytavern.ts
│   └── aidungeon.ts
├── cartridges/             Game rule books
│   ├── basic-fantasy.ts
│   └── index.ts
├── core/                   Engine-level state utilities
│   └── game-state.ts       applySideEffect / revertSideEffect
├── signals/                Player signal detection
│   ├── detect.ts
│   ├── read-scene.ts
│   └── index.ts
├── engine.ts               GameEngine (the core loop)
├── platform/               Platform adapters
│   ├── helpers.ts          Shared formatting helpers
│   ├── janitorai/
│   ├── sillytavern/
│   ├── aidungeon/
│   └── index.ts
├── utils/                  Dice, base64, time, LLM, text utilities
├── character.ts            Simple Character class (legacy)
├── index.ts                Library entry-point & re-exports
└── types.ts                All shared interfaces & type aliases

tests/                      Jest test suite (mirrors src/)
docs/                       User manuals (this file + others)
```

---

## 3. Setup & Tooling

### Prerequisites

* Node.js ≥ 18
* npm

### Install

```bash
npm install
```

### Build

Builds are composed at build time. Pick a `cartridge × system`:

```bash
npm run build:basic:janitorai      # Rollup
npm run build:basic:sillytavern
npm run build:basic:aidungeon

npm run build:webpack:basic:janitorai   # Webpack alternative
```

Output lands in `dist/`.

### Test

```bash
npm test               # run full suite
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report
```

The project uses **Jest** with **ts-jest**. All tests live under `tests/`. Coverage is collected from `src/**/*.ts`.

---

## 4. Architecture Deep-Dive

### 4.1 The Game Play Loop (`GameEngine.executeTurn`)

```
┌──────────────────────────────────────────────────────────────┐
│  1. Load state  ──>  2. Advance time & revert expired effects │
│        │                                                      │
│  3. Extract player intent                                     │
│        │                                                      │
│  4. For EVERY key in cartridge.ruleOrder:                  │
│        │   • Build TurnContext (effect data, action, etc.)     │
│        │   • Call rules[key]  ──>  RuleOutcome          │
│        │   • Convert to NarrationDirective                         │
│        │   • Apply stateMutations to state                    │
│        │                                                      │
│  5. Generate schemaInstructions from signalSchemas        │
│     (calls renderSchemaInstruction on each tracker)          │
│                                                                │
│  6. Return { newState, directives, schemaInstructions }    │
└──────────────────────────────────────────────────────────────┘
```

Key invariant: **every rule is always called**, even when there is no matching player action or world event. This lets rules emit `mustNotHappen` entries to prevent the LLM from hallucinating events.

### 4.2 Types at a Glance

| Type | Role |
|---|---|
| `Cartridge` | Defines the entire rule book — actions, rules, state template, signal schemas |
| `GameEngine` | The engine — calls rules, manages state, produces `NarrationDirective[]` |
| `NarrationDirective` | Standardised per-rule output: `mustHappen` / `mustNotHappen` / `mayHappen` |
| `Platform` | Platform adapter — reads input, saves state, injects output into the LLM prompt |
| `RuleOutcome` | What a single `Rule` returns (outcome + side effects) |
| `State` | Persisted state: timestamp, stats dict, active conditions, flags |
| `SignalSchema` | Describes effects the LLM can report; used by `renderSchemaInstruction` to produce LLM instructions |

### 4.3 State Management

Side effects use `applySideEffect` / `revertSideEffect` in `src/core/game-state.ts`. Temporary effects have an `expiry` timestamp and are automatically reverted by the engine at the start of each turn.

### 4.4 Utility Library (`src/utils/`)

| File | Contents |
|---|---|
| `dice.ts` | `rollDie`, `rollDice`, `sumRolls` |
| `base64.ts` | Raw & typed base64 encode/decode |
| `time-utils.ts` | ISO 8601 duration parsing, date arithmetic, formatting |
| `llm-utils.ts` | State encode/decode, `[RP_STATE]` blocks, `[NARRATION_SUMMARY]` extraction, `validateSignalTypes`, `renderSchemaInstruction` |
| `text-utils.ts` | `extractMatch` — fuzzy enum matcher |
| `input-parser.ts` | `detectSignals` — `<action target>` bracket parser |

---

## 5. Adding a New System Adapter

1. Create `src/platform/<name>/index.ts` implementing `Platform`.
2. Create `src/builds/basic/<name>.ts` wiring the cartridge + adapter.
3. Add build scripts to `package.json`.
4. Add tests under `tests/<name>.test.ts`.

See `src/platform/janitorai/index.ts` for a full reference implementation.

---

## 6. Adding a New Cartridge

1. Create `src/cartridges/<name>.ts` exporting a `Cartridge`.
2. Re-export from `src/cartridges/index.ts`.
3. Create build entry-points under `src/builds/<name>/` for each system.
4. Add build scripts to `package.json`.
5. Add tests.

See `src/cartridges/basic-fantasy.ts` for the reference cartridge.

---

## 7. Testing Conventions

* One test file per source module: `tests/<module>.test.ts`.
* Use `makeSheet()` helper to create default `State` instances with overrides.
* Tests should not depend on random dice rolls when asserting exact values — override stats to guarantee success/failure where needed.
* Run the full suite before opening a PR.

---

## 8. Build Output Requirements

The built `dist/bundle.*.js` must be:

* **ES5-compatible** — no arrow functions, no destructuring, no `let`/`const` in output.
* **Flat** — a single file, no `import`/`export`/`require`.
* **Global-scoped** — APIs exposed on `window` or `global`.
* **Self-contained** — zero runtime dependencies.

These constraints exist because target platforms (Janitor AI, SillyTavern) execute the script inside restrictive JavaScript sandboxes.
