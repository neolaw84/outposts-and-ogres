# Outposts & Ogres: Cartridge Developer Guide

Welcome to Cartridge Development! As a Cartridge Developer, you are the Lead Game Designer. 
The `GameEngine` and the Platform Adapters (like JanitorAI or AIDungeon) are simply agnostic containers. They don't know what "hit points" or "stealth checks" are. **You** define the rules of the universe, the data the story generates, and how that data manipulates the math of the game.

This guide will walk you through the `Cartridge` interface and how to build a fully functional ruleset from scratch.

---

## 1. The Cartridge Interface Overview

Every Cartridge must implement the `Cartridge` interface exported from `src/types.ts`. A Cartridge is a stateless blueprint consisting of 7 core properties. Cartridges should be isolated into their own directories under `src/cartridges/<cartridge-name>/index.ts`.

```typescript
import { Cartridge } from 'outposts-and-ogres';

const myCartridge: Cartridge = {
  name: 'My Awesome RPG',
  version: '1.0.0',
  debug: true, // Set to true to print Rule execution logs to the console
  
  defaultState: { /* ... */ },
  signalDetectors: [ /* ... */ ],
  signalSchemas: [ /* ... */ ],
  
  ruleOrder: ['stealth_check', 'combat_event', 'attack'],
  rules: { /* ... */ }
};
```

### Definitions:
*   **name & version:** Identifiers for your cartridge.
*   **debug:** A boolean. When `true`, the Engine will print any logs you push to `ruleDebugLogs` in your rules to the host console.
*   **defaultState:** The initial configuration of a player's Character Sheet before the game starts.
*   **signalDetectors:** The "Input Bridge". These detect what the *Player* is trying to do from their raw chat messages.
*   **signalSchemas:** The "Output Bridge". These instruct the *LLM* what data to extract and format when narrating an event.
*   **ruleOrder:** An array of strings defining the strict execution sequence of your rules every turn.
*   **rules:** The actual functions containing the math and logic of your game.

---

## 2. Defining State (`defaultState`)

Your game needs variables. `State` is a JSON-serializable object that holds everything the Engine needs to remember between chat messages.

```typescript
const defaultState: State = {
  timestamp: "2024-01-01T08:00:00Z", // Required ISO string for tracking in-game time
  stats: {
    // Define any numbers, booleans, or nested objects here
    health: { current: 10, max: 10 },
    gold: 0,
    in_combat: 0,  // Toggles can be integers (0/1) or booleans
  },
  activeConditions: [], // Engine manages temporary side effects here
  flags: []            // Simple string array for generic tracking
};
```

---

## 3. The Input Bridge: `signalDetectors`

When a user types "I swing my sword at the goblin," the platform adapter passes that text through your `signalDetectors`.

Detectors use basic keyword matching or Regex to classify player intent into a `Signal`.

```typescript
const signalDetectors: SignalDetector[] = [
  { 
    key: 'attack', // The unique ID of this intent
    description: 'Player attempts to harm an entity.', 
    keywords: ['attack', 'hit', 'strike', 'swing', 'shoot'],
    patterns: [/cast (fireball|magic missile)/i] 
  }
];
```

If the engine finds a match, it creates a `Signal` (e.g., `{ key: 'attack' }`) and passes it to your rules in the `TurnContext.playerSignals` array.

---

## 4. The Output Bridge: `signalSchemas`

This is where you perform **Structural Prompt Engineering**. 
LLMs output raw text. You need the LLM to convert that text into hard data variables (Booleans, Numbers, Strings) so your Rules can do math.

```typescript
const signalSchemas: SignalSchema[] = [
  {
    key: 'enemy_attack', // Corresponds to a Rule Key
    what: 'An NPC or enemy attempts to harm the player.',
    condition: 'Applicable when the narration describes the player taking damage or dodging an assault.',
    
    // Primitives mapped to semantics:
    flags: {
      "critical": "Output true if the attack struck a highly vulnerable spot or was a surprise attack, false otherwise"
    },
    meters: {
      "damage": "Rate the physical damage dealt on a scale from 1 (minor scratch) to 10 (lethal wound)"
    },
    tags: {
      "damage_type": "The type of damage (e.g., 'slashing', 'fire', 'blunt')"
    }
  }
];
```

### Why these three primitives?
*   **Flags (Booleans):** Used for binary triggers. Did they land a critical hit? Is the door locked?
*   **Meters (Numbers):** Used for magnitude. How much damage? How much time passed? How scary is the monster?
*   **Tags (Strings):** Used for categorization and routing. What type of spell? Which body part was hit?

---

## 5. Writing Rules (`rules` & `ruleOrder`)

Rules are where the actual Game Design happens. A Rule is a pure function that takes the current `State` and the `TurnContext`, and returns a `RuleOutcome`.

The Engine executes rules in the exact sequence specified by your `ruleOrder` array. 

### The `TurnContext`
```typescript
interface TurnContext {
  playerSignals: Signal[];     // What the player *tried* to do (from signalDetectors)
  ruleKey: string;             // The ID of the currently executing rule
  worldSignal: Signal | null;  // The data the LLM *extracted* (from signalSchemas)
  typeCheck: Record<string, unknown> | null; 
  narrationSummary: Record<string, unknown>; // Unfiltered LLM payload
}
```

### The `RuleOutcome`
Your rule function must output instructions for the Engine and the LLM via this flat object:
```typescript
interface RuleOutcome {
  ruleDebugLogs: string[];          // Math/Logic logs (printed if Cartridge.debug is true)
  mustHappen: string[];             // STRICT directives the LLM MUST include in its response
  mustNotHappen: string[];          // STRICT negative directives
  mayHappen: string[];              // Suggestions or "author's notes"
  stateMutations: SideEffect[];     // Math changes to apply to the State
}
```

### Example: A Complete Combat Rule
Let's tie it all together. The LLM parsed an enemy attacking the player and gave us a `damage` meter and a `critical` flag.

```typescript
const rules: Record<string, Rule> = {
  enemy_attack: function(sheet: State, context: TurnContext): RuleOutcome {
    const effect = context.worldSignal;
    
    // 1. Check if this rule should run
    if (!effect) return { ruleDebugLogs: [], mustHappen: [], mustNotHappen: [], mayHappen: [], stateMutations: [] };
    
    // 2. Extract Data from Prompt
    const rawDamage = (effect.meters && effect.meters['damage']) ? effect.meters['damage'] : 0;
    const isCrit = (effect.flags && effect.flags['critical']) === true;
    
    // 3. Game Math
    const blockPower = sheet.stats.health.block || 0;
    let finalDamage = Math.max(1, rawDamage - blockPower);
    if (isCrit) finalDamage *= 2;
    
    // 4. State Mutations
    const sideEffects: SideEffect[] = [];
    sideEffects.push({
      what: 'Damage taken',
      temp: false,
      impacts: [{ stats: 'health.current', op: 'sub', val: finalDamage }]
    });

    // Example of a Temporary Status Effect
    if (isCrit) {
       sideEffects.push({
         what: 'Bleeding deeply',
         temp: true,
         expiry: 'PT5M', // Expires in 5 in-game minutes
         re_lock: ['in_combat'], // Pauses expiry while stats.in_combat is truthy
         impacts: [{ stats: 'health.current', op: 'sub', val: 1 }]
       });
    }

    // 5. LLM Narrations
    let mustMsg = `The player takes ${finalDamage} damage.`;
    if (isCrit) mustMsg += " Emphasize the severity of this critical wound.";

    return {
      ruleDebugLogs: [`Enemy Attack calculated: Base ${rawDamage}, Block ${blockPower}, Crit? ${isCrit}. Final: ${finalDamage}`],
      mustHappen: [mustMsg],
      mustNotHappen: ['Do not narrate the player instantly healing or ignoring the blow.'],
      mayHappen: ['Describe blood or broken armor.'],
      stateMutations: sideEffects
    };
  }
};
```

---

## 6. Co-Developing with Prompts

Cartridge Development is inextricably linked to LLM behavior. When designing a cartridge, you are essentially programming a complex system where one of your co-processors is a creative AI.

**Golden Rule:** If a mechanic relies heavily on the LLM "getting it exactly right" using complex reasoning, it will eventually fail. 
*   Rely on the Engine (`rules`) for deterministic math (addition, subtraction, state toggles).
*   Rely on the LLM (`signalSchemas`) for fuzzy interpretation (how scary was that monster? Did the player hit the arm or the leg?).

Always test your schemas with the `debug` flag enabled to verify that what you *asked* for in the prompt (`what`, `flags`, `meters`) is actually what the LLM is providing. 

Additionally, we strongly encourage writing unit tests for your cartridges. Tests should be placed in `tests/cartridges/<cartridge-name>/` to keep them isolated from the core engine tests.
