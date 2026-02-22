# Cartridge Developer Guide

Welcome to the Outposts & Ogres Cartridge Developer Guide. This document will walk you through creating your own RPG rule systems (Cartridges) and integrating them with the core GamePlayScript engine. The system is designed to seamlessly blend AI narration (e.g., via Janitor AI) with structured, programmatic game mechanics.

## Table of Contents
1. [What is a Cartridge?](#what-is-a-cartridge)
2. [Elements of a Cartridge](#elements-of-a-cartridge)
3. [The Game Loop](#the-game-loop)
4. [Co-Developing Prompt Mappers](#co-developing-prompt-mappers)
5. [Example Cartridge](#example-cartridge)

---

## What is a Cartridge?

A Cartridge defines the rules, actions, effect conditions, state mutations, and narrative boundaries for a specific game setting or rule system. It implements the `GameCartridge` interface and acts as the "brain" for the `GamePlayScript`. By swapping cartridges, you can instantly change the game from a fantasy dungeon crawler to a sci-fi mystery.

## Elements of a Cartridge

When building a Cartridge, you need to define the following key elements to fulfill the `GameCartridge` interface:

* **`name`** (`string`): The human-readable name of your rule system.
* **`version`** (`string`): The version identifier.
* **`stopConditions`** (`string[]`): Named scenarios or scenes (like `'combat'`, `'exploration'`, `'social'`) where the AI stops narrating freely and yields control to the player for action input.
* **`availableActions`** (`Record<string, string[]>`): A mapping between each `stopCondition` and the actions a player can take in that state. E.g. `combat: ['attack', 'defend']`.
* **`defaultGameState`** (`GameState`): The initial configuration of the character sheet, including stats, flags, and `cur_ts` (current in-game timestamp). It is the payload used when no prior save exists.
* **`effectDefinitions`** (`EffectDefinition[]`): The schema telling the LLM what structural events (effects) it is allowed to report in its `[NARRATION_SUMMARY]`. Each definition includes:
  * `key`: Unique identifier (e.g., `'drink_potion'`).
  * `what`, `when`, `meters`, `flags`, `tags`: Explanations of fields the LLM should output.
  * `condition`: The natural language trigger telling the LLM *when* to emit this effect (e.g., ` "{{user}} drinks a potion"`).
* **`aspectFunctions`** (`Record<string, AspectFunction>`): The mechanical logic. Every aspect key has a function that processes player intent or LLM-reported effect data, modifies `GameState` via `SideEffect`s, and returns outcomes (success/failure) alongside instructions on how the LLM should narrate the result (`narrationGuidance` and `mechanicsLogs`).
* **`aspectSequence`** (`string[]`): The strict execution order for `aspectFunctions`. It allows you to reliably interleave world simulation (e.g., `time_advance`, `weather_change`) with player actions (e.g., `attack`, `cast`).
* **`turnEndTriggers`** (`string[]`): Specific events that legally compel the LLM to halt its narration immediately and output the `[NARRATION_SUMMARY]` so the script can process the next turn.

## The Game Loop

The engine (`GamePlayScript`) operates on a strict three-phase loop for each turn:

### Phase 1: Input
The engine extracts the player's intended action from their free-text message. It matches the raw text against the `availableActions` associated with the current condition (e.g. 'exploration'), resulting in `ParsedAction` objects.

### Phase 2: Process (Unified Execution)
The engine copies the current state and steps through the `aspectSequence` defined in your cartridge in exact order:
1. **Time Advance**: Time elapsed provided by the LLM is added to `cur_ts`, and expired side effects are reverted.
2. **Aspect Evaluation**: For each key in the sequence, if it matches a parsed player action OR an effect reported by the LLM in the previous `[NARRATION_SUMMARY]`, the corresponding `aspectFunction` is executed.
3. **State Mutation**: The aspect function returns `SideEffect`s (which mutate stats, apply buffs/debuffs) and `outcome` details. The engine immediately applies these mutations.
4. **Event Accumulation**: Outcomes and narrative guidance returned by the aspects are compiled into `ActionResolutionEvent`s.

### Phase 3: Output
The engine packages the parsed actions, resolutions from Phase 2, and the available choices for the *next* turn into `TurnEvent`s. These events are passed to the **Prompt Mapper**, which synthesizes the final prompt to instruct the AI (e.g., updating Janitor AI's setup or `NARRATION_GUIDE`).

## Co-Developing Prompt Mappers

A Cartridge defines *what* happens, but the **Prompt Mapper** defines *how* to tell the specific AI platform (like Janitor AI) about it. Because different LLMs and platforms require different prompt engineering, **the Cartridge developer is also responsible for co-developing the prompt mappers**.

The mapper's job is to take the universal `TurnEvent` objects and generate a platform-specific `PromptChannels` object. 

For example, when building for Janitor AI:
1. **`buildNarrationGuide`**: You must instruct the LLM on how to describe actions. E.g., instructing the LLM: `"DO NOT resolve the final outcome of this combat action for {{user}}. Narrate {{user}}'s action and the NPC's reaction."`
2. **`buildNarrationSummaryInstructions`**: You must inject your cartridge's `effectDefinitions` into the prompt so the LLM knows to output a JSON `[NARRATION_SUMMARY]` block when a `turnEndTrigger` or effect condition is met.
3. **Channel Mapping**: You merge long-term persistent rules (personality), mid-term instructions, and the short-term narration guide into the final payload the system adapter pushes to the AI platform. 

## Example Cartridge

Below is an abbreviated example showcasing the cartridge structure and capabilities. It features combat rules and an effect triggered by the LLM when the player takes damage.

```typescript
import { GameCartridge, GameState, AspectFunctionResult, SideEffect } from '../types';
import { rollDice, sumRolls } from '../utils/dice';

const myCartridge: GameCartridge = {
  name: 'Mini Fantasy',
  version: '1.0.0',
  stopConditions: ['combat', 'exploration'],
  
  availableActions: {
    combat: ['attack', 'flee'],
    exploration: ['investigate']
  },

  defaultGameState: {
    cur_ts: '1000-01-01T08:00:00',
    stats: { hp: 50, gold: 0, strength: 12 },
    se: [],
    flags: []
  },

  effectDefinitions: [
    {
      key: 'take_damage',
      what: "string; type of damage ('slashing', 'fire')",
      meters: { amount: 'number; the raw damage dealt' },
      condition: 'The player takes physical or magical damage'
    }
  ],

  aspectSequence: [
    'take_damage', // Evaluate world events first
    'attack',      // Then player acts
    'flee'
  ],

  turnEndTriggers: [
    'Combat Round Ends',
    'Player is knocked unconscious'
  ],

  aspectFunctions: {
    // 1. World Effect Handling
    take_damage: (sheet, context) => {
      if (!context.effectData) return { outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [] }, stateMutations: [] };
      
      const effect = context.effectData as any;
      const damage = effect.meters?.amount || 0;
      
      return {
        stateMutations: [
          { what: 'took damage', temp: false, impacts: [{ stats: 'hp', op: 'sub', val: damage }] }
        ],
        outcome: {
          status: 'neutral',
          mechanicsLogs: [`Lost ${damage} HP.`],
          narrationGuidance: [`Describe the impact of the ${effect.what} attack on {{user}}.`]
        }
      };
    },

    // 2. Player Action Handling
    attack: (sheet, context) => {
      const intent = context.action?.find(a => a.action === 'attack');
      if (!intent || context.currentCondition !== 'combat') {
        return { outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [] }, stateMutations: [] };
      }

      const roll = sumRolls(rollDice(1, 20));
      const strMod = Math.floor((sheet.stats.strength - 10) / 2);
      const isSuccess = (roll + strMod) >= 12; // DC 12

      return {
        stateMutations: [], // Damage to enemy tracked contextually via LLM
        outcome: {
          actionName: 'attack',
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [`Rolled ${roll} + ${strMod} vs DC 12`],
          narrationGuidance: [isSuccess ? 
            '{{user}} lands a solid blow.' : 
            '{{user}}\\'s attack misses.'
          ]
        }
      };
    }
  }
};

export { myCartridge };
```
