# Outposts & Ogres — Cartridge Developer Manual

> For game designers and developers creating new game cartridges for ONO.

---

## 1. What is a Cartridge?

A **cartridge** is a self-contained game rule book. It defines everything the engine needs to run a specific game: stats, available actions, signal schemas, and the rules that resolve player actions and world events.

The engine itself (the `GameEngine`) is generic — it doesn't know about hit points, potions, or goblins. All of that comes from the cartridge.

---

## 2. The `Cartridge` Interface

```typescript
interface Cartridge {
  name: string;
  version: string;
  breakpoints: string[];
  signalDetectors: SignalDetector[];
  defaultState: State;
  signalSchemas: SignalSchema[];
  rules: Record<string, Rule>;
  ruleOrder: string[];
}
```

Each field is explained below.

---

## 3. Defining Your Cartridge

### 3.1 Metadata & Flow Control

```typescript
name: 'My Sci-Fi RPG',
version: '1.0.0',
breakpoints: ['combat', 'exploration', 'dialogue', 'Combat round ends', 'Critical injury'],
signalDetectors: [
  // Combat actions
  { key: 'shoot', description: 'Player shoots a target', keywords: ['shoot', 'fire', 'blast'] },
  { key: 'take_cover', description: 'Player takes cover', keywords: ['cover', 'hide', 'duck'] },
  { key: 'throw_grenade', description: 'Player throws a grenade', keywords: ['grenade', 'throw', 'lob'] },
  { key: 'flee', description: 'Player flees from danger', keywords: ['flee', 'run', 'escape', 'retreat'] },
  // Exploration actions
  { key: 'scan', description: 'Player scans the area', keywords: ['scan', 'survey', 'detect'] },
  { key: 'move', description: 'Player moves to a location', keywords: ['move', 'go', 'walk'] },
  { key: 'hack', description: 'Player hacks a terminal', keywords: ['hack', 'crack', 'decrypt'] },
  { key: 'rest', description: 'Player rests', keywords: ['rest', 'sleep', 'camp'] },
  // Dialogue actions
  { key: 'persuade', description: 'Player persuades an NPC', keywords: ['persuade', 'convince'] },
  { key: 'threaten', description: 'Player threatens an NPC', keywords: ['threaten', 'intimidate'] },
  { key: 'lie', description: 'Player lies to an NPC', keywords: ['lie', 'bluff', 'deceive'] },
  { key: 'bribe', description: 'Player bribes an NPC', keywords: ['bribe', 'pay', 'offer'] }
]
```

* **`breakpoints`** — The scenarios in which the LLM should stop narrating and wait for the player's input. This includes both general game modes (e.g. `'combat'`, `'exploration'`) and specific events that force the LLM to end its turn immediately (e.g. `'Combat round ends'`, `'Critical injury'`).
* **`signalDetectors`** — Defines how to detect player intents from free text. Each detector has:
  * `key` — Maps to the corresponding function in `rules`.
  * `description` — Free-text explanation of what this detector matches (can be used by LLM-based systems).
  * `keywords` — Simple keyword strings to scan for (case-insensitive).
  * `patterns?` — Optional regex patterns for more precise matching.

### 3.2 Default Game State

The initial state when a new session begins:

```typescript
defaultState: {
  timestamp: '3024-06-15T08:00:00',
  stats: {
    hp: 100, max_hp: 100,
    shields: 50,
    credits: 200,
    tech_skill: 12,
    combat_skill: 10,
    charm: 8
  },
  activeConditions: [],
  flags: []
}
```

* **`stats`** — A flat `Record<string, number>`. Any keys you like.
* **`activeConditions`** — Active temporary effects (buffs/debuffs). Starts empty.
* **`flags`** — Named boolean markers for narrative state (e.g. `"door_unlocked"`).

### 3.3 World Event Trackers (`signalSchemas`)

These tell the LLM **what structured data to report back** at the end of each narration turn. At the end of the game play loop, the engine calls `renderSchemaInstruction()` on each tracker to produce a formatted instruction string. This string is then passed to the system adapter's `applyGamePlayOutput()`, which injects it into the LLM's context alongside the narration guide.

```typescript
signalSchemas: [
  {
    key: 'combat_event',
    what: "string; 'player_attack' | 'enemy_attack' | 'combat_end'",
    meters: {
      damage: 'number; damage dealt or received',
      xp_gained: 'number; experience gained'
    },
    flags: {
      critical: 'boolean; true if it was a critical hit'
    },
    condition: 'Combat is happening or ending'
  },
  {
    key: 'use_medkit',
    what: "string; 'standard' | 'advanced'",
    meters: { potency: 'number; healing strength 1-10' },
    condition: '{{user}} uses a medkit'
  }
]
```

Each tracker has:
* **`key`** — Unique identifier, matching a key in `rules`.
* **`what`**, **`meters`**, **`flags`**, **`tags`** — Describe the fields the LLM should include in the `"effects"` array entry.
* **`condition`** — When the LLM should report this event.

The engine calls `renderSchemaInstruction(tracker)` on each tracker at the end of `executeTurn()`. This produces instructions like:

> *In the above narration of yours, if and only if {{user}} uses a medkit, include one instance of the following in the "effects" array.*
>
> `{ "key": "use_medkit", "what": "standard", "meters": { "potency": 5 } }`

As a cartridge developer, you only need to define the trackers. The engine and system adapter handle the rest.

### 3.4 Rule Sequence & Game Rules

#### `ruleOrder`

A strictly ordered array of rule keys. **Every rule is called on every turn**, even when there is no matching action or world event.

```typescript
ruleOrder: [
  // World events first
  'combat_event', 'use_medkit',
  // Then player actions
  'shoot', 'take_cover', 'throw_grenade', 'flee',
  'scan', 'move', 'hack', 'rest',
  'persuade', 'threaten', 'lie', 'bribe'
]
```

Order matters: put world events (potion effects, enemy attacks) before player actions so the game state is current when the player's action resolves.

#### `rules`

A dictionary mapping each key in `ruleOrder` to a `Rule` function:

```typescript
type Rule = (state: State, context: TurnContext) => RuleOutcome;
```

**The `TurnContext`:**

```typescript
interface TurnContext {
  playerSignals: Signal[];                      // Detected player intents for this rule key
  currentCondition: string;                     // e.g. 'combat'
  ruleKey: string;                              // The key being evaluated
  worldSignal: Signal | null;                   // Matched LLM effect data
  typeCheck: Record<string, unknown> | null;    // Type-check results
  narrationSummary: Record<string, unknown>;    // Full raw summary
}
```

**The `RuleOutcome`:**

```typescript
interface RuleOutcome {
  outcome: {
    status: 'success' | 'failure' | 'mixed' | 'neutral';
    mechanicsLogs: string[];
    mustHappen: string[];      // LLM MUST narrate these
    mustNotHappen: string[];   // LLM MUST NOT narrate these
    mayHappen: string[];       // LLM MAY narrate these
    actionName?: string;
    actionTarget?: string;
  };
  stateMutations: SideEffect[];
}
```

---

## 4. Writing a Game Rule

Every rule must handle **two cases**:

### Case 1: Not triggered (no matching action or world event)

Return `mustNotHappen` to prevent the LLM from hallucinating:

```typescript
rules: {
  shoot: (state, context) => {
    const intent = context.playerSignals.find(s => s.key === 'shoot');
    if (!intent) {
      return {
        outcome: {
          status: 'neutral',
          mechanicsLogs: [],
          mustHappen: [],
          mustNotHappen: ['Do not narrate {{user}} shooting unless explicitly requested.'],
          mayHappen: []
        },
        stateMutations: []
      };
    }
    // ... resolve the action ...
  }
}
```

### Case 2: Triggered

Resolve the action mechanically and return the result:

```typescript
    // ... continuing from above ...

    // Check if the action makes sense in the current condition
    if (context.currentCondition !== 'combat') {
      return {
        outcome: {
          actionName: 'shoot', actionTarget: intent.what || '',
          status: 'neutral',
          mechanicsLogs: [`Shooting is not optimal in '${context.currentCondition}'.`],
          mustHappen: [`{{user}} tries to shoot${intent.what ? ' ' + intent.what : ''}.`],
          mustNotHappen: [], mayHappen: []
        },
        stateMutations: []
      };
    }

    // Roll dice
    const rolls = rollDice(1, 20);
    const total = sumRolls(rolls);
    const bonus = Math.floor((state.stats['combat_skill'] - 10) / 2);
    const isSuccess = (total + bonus) >= 12;

    return {
      outcome: {
        actionName: 'shoot', actionTarget: intent.what || '',
        status: isSuccess ? 'success' : 'failure',
        mechanicsLogs: [`Rolled ${total} + ${bonus} = ${total + bonus} vs DC 12.`],
        mustHappen: [isSuccess
          ? 'The shot hits its mark with a satisfying impact.'
          : 'The shot goes wide, sparking off the bulkhead.'],
        mustNotHappen: [],
        mayHappen: isSuccess ? ['The enemy staggers back.'] : []
      },
      stateMutations: []  // Add SideEffect entries for damage, buffs, etc.
    };
```

---

## 5. State Mutations (Side Effects)

To modify the game state, return `SideEffect` entries in `stateMutations`:

```typescript
// Permanent effect (e.g. taking damage)
stateMutations: [{
  what: 'took laser damage',
  temp: false,
  impacts: [{ stats: 'hp', op: 'sub', val: 15 }]
}]

// Temporary effect (e.g. a buff with expiry)
stateMutations: [{
  what: 'adrenaline boost',
  temp: true,
  expiry: addDuration(state.timestamp, 'PT5M'),
  impacts: [{ stats: 'combat_skill', op: 'add', val: 3 }]
}]
```

The `op` field supports `'set'`, `'add'`, and `'sub'`. Temporary effects are automatically reverted by the engine when they expire.

---

## 6. World Event Rules

For events reported by the LLM (not player actions), use `context.worldSignal` and `context.typeCheck`:

```typescript
rules: {
  use_medkit: (state, context) => {
    if (!context.worldSignal) {
      return {
        outcome: {
          status: 'neutral', mechanicsLogs: [],
          mustHappen: [],
          mustNotHappen: ['Do not narrate {{user}} using a medkit.'],
          mayHappen: []
        },
        stateMutations: []
      };
    }

    const effect = context.worldSignal;
    const typeCheck = context.typeCheck;

    let potency = 1;
    if (typeCheck?.['meters']) {
      const meters = effect['meters'] as Record<string, number> | undefined;
      if (meters && typeof meters['potency'] === 'number') {
        potency = Math.max(1, Math.min(10, meters['potency']));
      }
    }

    const healAmount = potency * 8;
    return {
      outcome: {
        status: 'neutral', mechanicsLogs: [],
        mustHappen: [`{{user}} heals ${healAmount} HP from the medkit.`],
        mustNotHappen: [], mayHappen: []
      },
      stateMutations: [{
        what: 'used medkit',
        temp: false,
        impacts: [{ stats: 'hp', op: 'add', val: healAmount }]
      }]
    };
  }
}
```

---

## 7. Signal Detection (`signalDetectors`)

The engine detects player intents from free text using the cartridge's `signalDetectors` array. Each detector is a `SignalDetector`:

```typescript
interface SignalDetector {
  key: string;          // Maps to a rule key
  description: string;  // What this detector matches (for LLM-based systems)
  keywords: string[];   // Keywords to scan for (case-insensitive)
  patterns?: RegExp[];  // Optional regex patterns for precise matching
}
```

The engine's `detectSignals(message, detectors)` function:

1. First tries bracket syntax: `<action:target>` or `<action target>`.
2. Then for each detector, checks `patterns` (regex) first, then falls back to `keywords`.
3. Returns `Signal[]` — each matched detector produces a `Signal` with `key` matching the detector's key.

Platform adapters may override this with `deducePlayerIntent()` for LLM-assisted intent detection. The engine falls back to its built-in detector if the adapter returns `null`.

Example detectors:

```typescript
signalDetectors: [
  {
    key: 'shoot',
    description: 'Player shoots a target',
    keywords: ['shoot', 'fire', 'blast'],
    patterns: [/(?:shoot|fire)\s+(?:at\s+)?(.+)/i]  // First capture group populates Signal.what
  },
  {
    key: 'fear',
    description: 'Player expresses fear',
    keywords: ['afraid', 'fear', 'terrified', 'scared', 'panic']
  }
]
```

---

## 8. Available Utilities

The engine provides these utilities you can use in your rules:

| Function | Import from | Description |
|---|---|---|
| `rollDice(n, sides)` | `utils/dice` | Roll *n* dice with *sides* faces |
| `sumRolls(rolls)` | `utils/dice` | Sum an array of roll results |
| `addDuration(iso, dur)` | `utils/time-utils` | Add an ISO 8601 duration to a timestamp |
| `formatDate(date)` | `utils/time-utils` | Format a Date as `yyyy-mm-ddTHH:MM:SS` |
| `extractMatch(options, def, input)` | `utils/text-utils` | Fuzzy-match `input` against `options` |
| `renderSchemaInstruction(tracker)` | `utils/llm-utils` | Format a `SignalSchema` as an LLM instruction (called automatically by the engine) |

---

## 9. Quick-Start: Minimal Cartridge

```typescript
import { Cartridge, State, RuleOutcome } from '../types';
import { rollDice, sumRolls } from '../utils/dice';

const myCartridge: Cartridge = {
  name: 'Minimal Example',
  version: '0.1.0',
  breakpoints: ['play'],
  signalDetectors: [
    { key: 'roll', description: 'Player rolls the dice', keywords: ['roll', 'dice', 'throw'] }
  ],
  defaultState: {
    timestamp: '2025-01-01T12:00:00',
    stats: { score: 0 },
    activeConditions: [],
    flags: []
  },
  signalSchemas: [],
  ruleOrder: ['roll'],
  rules: {
    roll: (state: State, context): RuleOutcome => {
      const intent = context.playerSignals.find(s => s.key === 'roll');
      if (!intent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [], mustNotHappen: ['Do not roll dice.'], mayHappen: []
          },
          stateMutations: []
        };
      }
      const total = sumRolls(rollDice(2, 6));
      return {
        outcome: {
          status: total >= 7 ? 'success' : 'failure',
          mechanicsLogs: [`Rolled ${total}`],
          mustHappen: [`{{user}} rolled ${total}.`],
          mustNotHappen: [], mayHappen: [],
          actionName: 'roll'
        },
        stateMutations: [{
          what: 'dice roll score', temp: false,
          impacts: [{ stats: 'score', op: 'add', val: total }]
        }]
      };
    }
  }
};

export { myCartridge };
```

---

## 10. Reference

The complete reference cartridge is `src/cartridges/basic-fantasy.ts`. It demonstrates:

* World event rules (`drink_potion`, `combat_event`, `travel`, `rest`)
* Player action rules (14 actions across combat, social, and exploration)
* Stat modifier arithmetic (healing, damage, temporary buffs)
* Temporal effects with expiry
