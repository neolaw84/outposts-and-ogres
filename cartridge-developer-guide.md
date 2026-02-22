# Cartridge Developer Guide

Welcome to the Outposts and Ogres Game Engine! This document is the definitive guide for engineers and designers building **Game Cartridges**—the domain-specific modules that define the mechanics, actions, and narrative extraction rules for an individual game setting.

By the end of this guide, you will understand the engine's event-driven architecture, the semantics and syntax of every Cartridge interface, and how the standardized `NarrationDirective` output drives LLM narration across any platform.

---

## 1. Engine Architecture & The Gameplay Loop

The engine strictly separates programmatic rule evaluation from Large Language Model (LLM) text generation. It operates on a deterministic gameplay loop (`src/engine.ts`):

1. **Load Save State**
   The engine loads the persisted `State` via the System Adapter.

2. **Load World Input & Revert Expired Effects**
   The engine reads the `NarrationSummary` (structured JSON from the previous LLM response), works out the in-game timestamp, and reverts any `StoredSideEffect`s that have expired.

3. **Extract Player Intent**
   The engine intercepts the player's raw free-text message. Using the cartridge's custom `parseInput` hook (Inversion of Control), the unstructured text is translated into a `PlayerInputUnderstanding` object (containing parsed actions, emotional signals, and scenario suggestions).

4. **Rule Sequence – Call Every Rule, Accumulate `NarrationDirective`s**
   The engine iterates through the cartridge's `ruleOrder` and calls **every** `Rule`, even when there is no matching player action or world event. Each rule returns a `RuleOutcome`, which is converted into exactly one `NarrationDirective`. After each rule, its `stateMutations` (side effects) are applied to the state.

   > **Why call every rule?** Rules that don't match an action still emit `mustNotHappen` entries (e.g., *"Do not narrate the player drinking a potion"*), which prevent the LLM from hallucinating events that did not mechanically occur.

5. **Output – Generate Effect Instructions & Pass to the System Adapter**
   The engine calls `renderSchemaInstruction()` on each of the cartridge's `signalSchemas` to produce a formatted instruction string. The accumulated `NarrationDirective[]` plus this `schemaInstructions` string are handed to the System Adapter's `applyGamePlayOutput()` method, which converts them into whatever mutations the underlying platform requires (prompt fields, memory slots, system-prompt injections, etc.).

Because the output is a standardized array of `NarrationDirective` objects, **Prompt Mappers are no longer required**. The System Adapter handles the platform-specific conversion directly.

---

## 2. Defining Cartridge Elements: Semantics & Syntax

When developing a Cartridge, you implement the `Cartridge` TypeScript interface. Each property has a specific semantic purpose in guiding the engine.

### 2.1 Basic Metadata & Flow Control
- **Semantic Purpose**: Identifies your cartridge and defines the boundaries of the LLM's autonomy. `breakpoints` dictate when the AI should stop narrating and yield control back to the player, while `availableActions` defines what the player is mechanically allowed to do in those conditions.
- **Syntax**:
  ```typescript
  name: "Basic Fantasy RPG",
  version: "1.0.0",
  breakpoints: ["combat", "exploration", "dialogue"],
  availableActions: {
    "combat": ["attack", "defend", "flee", "cast"],
    "exploration": ["search", "travel", "rest"]
  }
  ```

### 2.2 Inversion of Control: `parseInput`
- **Semantic Purpose**: The engine delegates intent parsing to the cartridge. You can securely enforce exact slash commands (e.g., `/attack`), employ Regex matchers, or even perform lightweight NLP to convert natural language into mechanical intent. It overrides the engine's default parsing.
- **Syntax**:
  ```typescript
  parseInput: (message, availableActions, currentCondition) => {
    // Custom logic returning PlayerInputUnderstanding
    return {
      parsedActions: [{ action: "attack", target: "goblin", raw: message }],
      emotions: [],
      scenario: { suggestedCondition: "combat", confidence: "high", cues: [] }
    };
  }
  ```

### 2.3 State Management (`defaultState`)
- **Semantic Purpose**: The initial state vector when a new session begins. It holds a numeric `stats` dictionary and an `activeConditions` array spanning temporary buffs, debuffs, or world states (represented by `StoredSideEffect`s).
- **Syntax**:
  ```typescript
  defaultState: {
    timestamp: "2024-01-01T12:00:00Z",
    stats: { hp: 20, max_hp: 20, gold: 0, strength: 15 },
    activeConditions: [],
    flags: []
  }
  ```

### 2.4 Narrative Extraction Tools (`signalSchemas`)
- **Semantic Purpose**: Instructs the LLM on what structured data it needs to extract from its own prose. During narration, the LLM produces a `NarrationSummary` JSON block containing `flags`, `meters`, and `tags`. At the end of the game play loop, the engine calls `renderSchemaInstruction()` on each tracker to produce formatted instructions telling the LLM how to populate the `"effects"` array in its `[NARRATION_SUMMARY]` response.
- **Syntax**:
  ```typescript
  signalSchemas: [
    { 
      key: "weather_change", 
      what: "Changes in atmospheric conditions", 
      condition: "Always track.", 
      tags: { weather: "clear|rain|storm" } 
    }
  ]
  ```

### 2.5 Mechanics & Evaluation (`ruleOrder` & `rules`)
These elements replace monolithic hardcoded execution logic by creating a pipeline of modular mechanic resolvers.
- **`ruleOrder` (Semantic)**: A strictly ordered array dictating the chronological evaluation of game rules. Order matters profoundly (e.g., environmental effects should resolve before player actions). **Every rule in the sequence is always called**, regardless of whether the current turn has a matching player action or world event.
  ```typescript
  ruleOrder: ['time_advance', 'weather_change', 'player_action', 'enemy_counter']
  ```
- **`rules` (Semantic & Syntax)**: A dictionary mapping the keys in your sequence to `Rule` closures. Each rule reads the `State` and `TurnContext`, executes mechanical logic (like rolling dice), and returns a `RuleOutcome`. The resolution's `outcome` uses `mustHappen`, `mustNotHappen`, and `mayHappen` arrays to control what the LLM narrates.
  ```typescript
  rules: {
    player_action: (state, context) => {
      if (!context.action || context.action.length === 0) {
        // No player action this turn – prevent hallucination
        return {
          outcome: {
            status: "neutral",
            mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ["Do not narrate the player attacking."],
            mayHappen: []
          },
          stateMutations: []
        };
      }
      // Resolve the action mechanically
      return {
        outcome: { 
          status: "success", 
          mechanicsLogs: ["Rolled 15 vs AC 12"], 
          mustHappen: ["The player lands a solid, staggering hit on the goblin."],
          mustNotHappen: [],
          mayHappen: ["The goblin staggers and calls for reinforcements."],
          actionName: "attack",
          actionTarget: "goblin"
        },
        stateMutations: [] // e.g., dealing damage, adding a bleeding StoredSideEffect
      };
    }
  }
  ```

---

## 3. NarrationDirective & the Output Contract

Every rule in the `ruleOrder` produces exactly one `NarrationDirective`. This is the standardized output of the game play loop—no custom Prompt Mappers are needed.

### The `NarrationDirective` Interface
```typescript
interface NarrationDirective {
  ruleKey: string;
  mustHappen: string[];       // Things the LLM MUST narrate
  mustNotHappen: string[];    // Things the LLM MUST NOT narrate
  mayHappen: string[];        // Things the LLM MAY optionally narrate
}
```

| Field | Purpose |
|---|---|
| `mustHappen` | Mandatory narration beats. The LLM **must** include these in its response. |
| `mustNotHappen` | Forbidden narration beats. The LLM **must not** include these. Critical for preventing hallucination when a rule has no matching action. |
| `mayHappen` | Optional narration beats. The LLM **may** weave these in for flavour. |

### System Adapter: `applyGamePlayOutput()`
The System Adapter consumes the `NarrationDirective[]` and a pre-formatted `schemaInstructions` string:
```typescript
interface Platform {
  // ... other methods ...
  applyGamePlayOutput(
    events: NarrationDirective[],
    state: State,
    schemaInstructions: string
  ): void;
}
```

The `schemaInstructions` string is generated by the engine by calling `renderSchemaInstruction()` on each `SignalSchema`. It tells the LLM how to populate the `"effects"` array in the `[NARRATION_SUMMARY]` JSON block when certain conditions are met.

Different AI platforms (SillyTavern, Janitor AI, AI Dungeon) have different architectures for context injection. The System Adapter encapsulates these platform-specific details, converting the generic `NarrationDirective` array and effect instructions into whatever mutations the platform requires—prompt fields, memory slots, system-prompt injections, etc. As a cartridge developer, you do **not** need to write platform-specific mapping code; you only need to return clear `mustHappen` / `mustNotHappen` / `mayHappen` entries from your rules and define your `signalSchemas`.
