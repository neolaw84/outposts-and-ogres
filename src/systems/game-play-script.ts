/**
 * GamePlayScript – the core engine that executes the three-phase loop.
 *
 * Phase 1 – Input:   Extract the player's intended action.
 * Phase 2 – Process: Process the turn based on the cartridge's `ruleSequence`.
 *                    Every rule is called in order – even with null context –
 *                    so that the output can instruct the LLM about what must
 *                    NOT be narrated (e.g. "do not narrate player drinking a potion").
 * Phase 3 – Output:  Accumulate a standardised `GamePlayEvent[]` for the
 *                    system adapter.
 *
 * The script is driven by a swappable GameCartridge that defines conditions,
 * available actions, resolution rules, effect definitions, and aspect functions.
 */

import {
  GameCartridge,
  GamePlayEvent,
  GameState,
  RuleResolution,
  RuleContext,
  ActiveCondition,
  WorldEventTracker,
  EffectRecord
} from '../types';
import { parsePlayerInput } from '../inputs/input-matcher';
import { applySideEffect, revertSideEffect } from '../core/game-state';
import { addDuration, getMidnightsPassed } from '../utils/time-utils';
import { cleanInput, findEffectByKey, generateEffectInstruction } from '../utils/llm-utils';

class GamePlayScript {
  private cartridge: GameCartridge;
  private currentCondition: string;

  constructor(cartridge: GameCartridge) {
    this.cartridge = cartridge;
    // Default to the first stop condition
    this.currentCondition = cartridge.stopConditions.length > 0
      ? cartridge.stopConditions[0]
      : 'default';
  }

  /** Get the currently loaded cartridge. */
  public getCartridge(): GameCartridge {
    return this.cartridge;
  }

  /** Swap in a different cartridge at runtime. */
  public setCartridge(cartridge: GameCartridge): void {
    this.cartridge = cartridge;
    this.currentCondition = cartridge.stopConditions.length > 0
      ? cartridge.stopConditions[0]
      : 'default';
  }

  /** Get the current condition / scenario. */
  public getCondition(): string {
    return this.currentCondition;
  }

  /** Set the current condition / scenario. */
  public setCondition(condition: string): void {
    this.currentCondition = condition;
  }

  // ----------------------------------------------------------------
  // Phase 1 – INPUT
  // ----------------------------------------------------------------

  /**
   * Extract the player's intents from the latest player message using the
   * cartridge's inputMatchers.
   * Returns an empty array if no recognisable intent is found.
   */
  public extractIntents(playerMessage: string): EffectRecord[] {
    return parsePlayerInput(playerMessage, this.cartridge.inputMatchers);
  }

  // ----------------------------------------------------------------
  // Unified Turn Execution
  // ----------------------------------------------------------------

  /**
   * Run the complete 3-phase turn for a player message.
   * Modifies the game state by processing the player action and world events
   * in the exact order specified by `cartridge.ruleSequence`.
   *
   * Every rule in the sequence is called, even when there is no matching
   * player action or world event.  This allows rules to emit `mustNotHappen`
   * entries (e.g. "do not narrate player drinking a potion") which are
   * essential for LLM-based narration engines.
   *
   * @param playerMessage The player's raw free-text input.
   * @param currentState The current game state.
   * @param narrationSummary The parsed narration summary from the LLM.
   * @param preParsedIntents Optional pre-parsed intents provided by a system adapter.
   * @returns The new game state, accumulated narration guide, game play events,
   *          conditions to report back.
   */
  public executeTurn(
    playerMessage: string,
    currentState: GameState,
    narrationSummary: Record<string, unknown>,
    preParsedIntents?: EffectRecord[] | null
  ): {
    newState: GameState;
    gamePlayEvents: GamePlayEvent[];
    effectInstructions: string;
  } {
    // Phase 1 – Input
    const allIntents = preParsedIntents || this.extractIntents(playerMessage);

    // Phase 2 – Process (Unified Aspect Sequence)
    let newState = JSON.parse(JSON.stringify(currentState));

    // First: Handle Time Advance and Expired Effects (Always happens first)
    const typeChecks = cleanInput(narrationSummary);
    let durationToAdd = 'PT0M';
    if (typeChecks['elapsed_time']) {
      durationToAdd = narrationSummary['elapsed_time'] as string;
    } else if (narrationSummary['elapsed_time'] && typeof narrationSummary['elapsed_time'] === 'string' &&
      (narrationSummary['elapsed_time'] as string).indexOf('P') === 0) {
      durationToAdd = narrationSummary['elapsed_time'] as string;
    }
    const newCurrentTime = addDuration(newState.timestamp, durationToAdd);
    newState.stats['num_day'] = (newState.stats['num_day'] || 0) +
      getMidnightsPassed(newState.timestamp, newCurrentTime);
    newState.timestamp = newCurrentTime;
    newState = revertSideEffect(newState);

    const gamePlayEvents: GamePlayEvent[] = [];

    // Iterate through the cartridge-defined aspect sequence.
    // Every rule is called – even if there is no matching event – so that it
    // can produce mustNotHappen entries for the LLM.
    const sequence = this.cartridge.ruleSequence || [];
    for (const key of sequence) {
      if (this.cartridge.gameRules && this.cartridge.gameRules[key]) {
        // Prepare context
        const def = this.cartridge.worldEventTrackers.find(d => d.key === key);

        let foundEffect: EffectRecord | null = null;
        let foundTypeCheck: Record<string, unknown> | null = null;
        if (def) {
          const found = findEffectByKey(key, narrationSummary, typeChecks);
          foundEffect = found.effect;
          foundTypeCheck = found.typeCheck;
        }

        const context: RuleContext = {
          intents: allIntents.filter(e => e.key === key),
          currentCondition: this.currentCondition,
          ruleKey: key,
          effectData: foundEffect,
          typeCheck: foundTypeCheck,
          narrationSummary: narrationSummary
        };

        const result = this.cartridge.gameRules[key](newState, context);

        // Build the GamePlayEvent from the rule result
        const gpe = this.buildGamePlayEvent(key, result);
        gamePlayEvents.push(gpe);

        if (result) {
          if (result.stateMutations && result.stateMutations.length > 0) {
            for (let j = 0; j < result.stateMutations.length; j++) {
              newState = applySideEffect(newState, result.stateMutations[j]);
            }
          }
        }
      }
    }

    // Generate effect instructions from worldEventTrackers using generateEffectInstruction.
    const instructionParts: string[] = [];
    for (const tracker of this.cartridge.worldEventTrackers) {
      const instruction = generateEffectInstruction(tracker);
      if (instruction) {
        instructionParts.push(instruction);
      }
    }
    const effectInstructions = instructionParts.join('\n\n');

    return {
      newState: newState,
      gamePlayEvents: gamePlayEvents,
      effectInstructions: effectInstructions
    };
  }

  // ----------------------------------------------------------------
  // GamePlayEvent construction
  // ----------------------------------------------------------------

  /**
   * Convert a RuleResolution into a standardised GamePlayEvent.
   */
  private buildGamePlayEvent(ruleKey: string, result: RuleResolution | null): GamePlayEvent {
    if (!result || !result.outcome) {
      return {
        ruleKey: ruleKey,
        mustHappen: [],
        mustNotHappen: [],
        mayHappen: []
      };
    }

    const o = result.outcome;

    return {
      ruleKey: ruleKey,
      mustHappen: o.mustHappen.slice(),
      mustNotHappen: o.mustNotHappen.slice(),
      mayHappen: o.mayHappen.slice()
    };
  }
}

export { GamePlayScript };
