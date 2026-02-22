# Cartridge Developer Guide

Welcome to the Outposts and Ogres Game Engine! This document is the definitive guide for engineers and designers building **Game Cartridges**—the domain-specific modules that define the mechanics, actions, and narrative extraction rules for an individual game setting.

By the end of this guide, you will understand the engine's event-driven architecture, the semantics and syntax of every Cartridge interface, and why developing Prompt-Mappers is an essential part of the cartridge lifecycle.

---

## 1. Engine Architecture & The Gameplay Loop

The engine strictly separates programmatic rule evaluation from Large Language Model (LLM) text generation. It operates on a deterministic, three-phase gameplay loop (`src/systems/game-play-script.ts`):

1. **Phase 1 – Input (Intent Extraction)**  
   The engine intercepts the player's raw free-text message. Using the cartridge's custom `parseInput` hook (Inversion of Control), the unstructured text is translated into a `PlayerInputUnderstanding` object (containing parsed actions, emotional signals, and scenario suggestions).

2. **Phase 2 – Process (Unified Rule Resolution)**  
   The engine evaluates a unified timeline of events according to the sequence defined in `ruleSequence`. It integrates **World Simulation Updates** (structured JSON extracted from the previous LLM response) alongside the player's intent. As it iterates over the sequence, the engine invokes the corresponding `GameRule` closures, which calculate mechanics, mutate the `GameState` (applying `StatusEffect`s), and produce `RuleResolution`s.

3. **Phase 3 – Output (Prompt Generation)**  
   The outcomes from Phase 2 are aggregated into an array of `TurnEvent` objects. These events are handed off to the **Prompt Mapper**, which marshals the programmatic results into natural language `PromptInstructions` that guide the LLM's next narrative generation.

---

## 2. Defining Cartridge Elements: Semantics & Syntax

When developing a Cartridge, you implement the `GameCartridge` TypeScript interface. Each property has a specific semantic purpose in guiding the engine.

### 2.1 Basic Metadata & Flow Control
- **Semantic Purpose**: Identifies your cartridge and defines the boundaries of the LLM's autonomy. `stopConditions` dictate when the AI should stop narrating and yield control back to the player, while `availableActions` defines what the player is mechanically allowed to do in those conditions.
- **Syntax**:
  ```typescript
  name: "Basic Fantasy RPG",
  version: "1.0.0",
  stopConditions: ["combat", "exploration", "dialogue"],
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

### 2.3 State Management (`defaultGameState`)
- **Semantic Purpose**: The initial state vector when a new session begins. It holds a numeric `stats` dictionary and an `activeConditions` array spanning temporary buffs, debuffs, or world states (represented by `StatusEffect`s).
- **Syntax**:
  ```typescript
  defaultGameState: {
    timestamp: "2024-01-01T12:00:00Z",
    stats: { hp: 20, max_hp: 20, gold: 0, strength: 15 },
    activeConditions: [],
    flags: []
  }
  ```

### 2.4 Narrative Extraction Tools (`worldEventTrackers`)
- **Semantic Purpose**: Instructs the LLM on what structured data it needs to extract from its own prose. During narration, the LLM produces a `WorldSimulationUpdate` JSON block containing `flags`, `meters`, and `tags`. 
- **Syntax**:
  ```typescript
  worldEventTrackers: [
    { 
      key: "weather_change", 
      what: "Changes in atmospheric conditions", 
      condition: "Always track.", 
      tags: { weather: "clear|rain|storm" } 
    }
  ]
  ```

### 2.5 Mechanics & Evaluation (`ruleSequence` & `gameRules`)
These elements replace monolithic hardcoded execution logic by creating a pipeline of modular mechanic resolvers.
- **`ruleSequence` (Semantic)**: A strictly ordered array dictating the chronological evaluation of game rules. Order matters profoundly (e.g., environmental effects should resolve before player actions).
  ```typescript
  ruleSequence: ['time_advance', 'weather_change', 'player_action', 'enemy_counter']
  ```
- **`gameRules` (Semantic & Syntax)**: A dictionary mapping the keys in your sequence to actual `GameRule` closures. Each rule reads the `GameState` and `RuleContext`, executes mechanical logic (like rolling dice), and returns a `RuleResolution` alongside optional state-mutating `StatModifier`s.
  ```typescript
  gameRules: {
    player_action: (state, context) => {
      // Access context.action to see what the player attempted
      // Access state.stats.strength for dice rolls
      
      return {
        outcome: { 
          status: "success", 
          mechanicsLogs: ["Rolled 15 vs AC 12"], 
          narrationGuidance: ["Narrate a solid, staggering hit."] 
        },
        stateMutations: [] // e.g., dealing damage, adding bleeding StatusEffect
      };
    }
  }
  ```

---

## 3. Co-Developing Prompt-Mappers

**A Cartridge is incomplete without its corresponding Prompt-Mappers.**

While the Cartridge implementation handles *what* mechanically happened, the Prompt-Mapper controls *how* that outcome is communicated to the LLM. 

Different frontend platforms (SillyTavern, Janitor AI, AI Dungeon) have wholly different architectures for context injection. Some support distinct memory channels, while others only possess a single prompt field. **As the cartridge developer, you explicitly co-develop the `PromptMapper` to seamlessly marshal your mechanical logs into specific platform configurations.**

### The Interface Contract
You supply functions matching the following signature:
```typescript
type PromptMapper = (events: TurnEvent[]) => PromptInstructions;
```

You are responsible for analyzing the `TurnEvent` inputs (which contain the `ActionResolutionEvent` strings you formulated in your `gameRules`) and dispatching them into standard instruction channels:
* **`immediateInstruction`**: High-priority guidance specifically dictating the LLM's very next paragraph.
* **`sceneGuidance`**: Context regarding NPC behavior logic based on player actions.
* **`campaignContinuity`**: Background prompts ensuring the LLM doesn't forget long-term stakes or conditions.

By co-developing Prompt-Mappers alongside your Cartridge, you ensure the stylistic narrative tone and raw mathematical mechanics of your design are preserved perfectly, regardless of which UI platform your player uses.
