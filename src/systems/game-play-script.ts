/**
 * GamePlayScript – the core engine that executes the three-phase loop.
 *
 * Phase 1 – Input:   Extract the player's intended action.
 * Phase 2 – Process: Process the turn based on the cartridge's `ruleOrder`.
 *                    Every rule is called in order – even with null context –
 *                    so that the output can instruct the LLM about what must
 *                    NOT be narrated (e.g. "do not narrate player drinking a potion").
 * Phase 3 – Output:  Accumulate a standardised `NarrationDirective[]` for the
 *                    platform adapter.
 *
 * The script is driven by a swappable Cartridge that defines conditions,
 * available actions, resolution rules, effect definitions, and aspect functions.
 */

import {
  Cartridge,
  NarrationDirective,
  State,
  RuleOutcome,
  TurnContext,
  SideEffect,
  SignalSchema,
  Signal
} from '../types';
import { parsePlayerInput } from '../inputs/input-matcher';
import { applySideEffect, revertSideEffect } from '../core/game-state';
import { addDuration, getMidnightsPassed } from '../utils/time-utils';
import { validateSignalTypes, findSignalByKey, renderSchemaInstruction } from '../utils/llm-utils';

class GamePlayScript {
  private cartridge: Cartridge;
  private currentCondition: string;

  constructor(cartridge: Cartridge) {
    this.cartridge = cartridge;
    // Default to the first breakpoint
    this.currentCondition = cartridge.breakpoints.length > 0
      ? cartridge.breakpoints[0]
      : 'default';
  }

  /** Get the currently loaded cartridge. */
  public getCartridge(): Cartridge {
    return this.cartridge;
  }

  /** Swap in a different cartridge at runtime. */
  public setCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
    this.currentCondition = cartridge.breakpoints.length > 0
      ? cartridge.breakpoints[0]
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
   * cartridge's signalDetectors.
   * Returns an empty array if no recognisable intent is found.
   */
  public extractIntents(playerMessage: string): Signal[] {
    return parsePlayerInput(playerMessage, this.cartridge.signalDetectors);
  }

  // ----------------------------------------------------------------
  // Unified Turn Execution
  // ----------------------------------------------------------------

  /**
   * Run the complete 3-phase turn for a player message.
   * Modifies the game state by processing the player action and world events
   * in the exact order specified by `cartridge.ruleOrder`.
   *
   * Every rule in the sequence is called, even when there is no matching
   * player action or world event.  This allows rules to emit `mustNotHappen`
   * entries (e.g. "do not narrate player drinking a potion") which are
   * essential for LLM-based narration engines.
   *
   * @param playerMessage The player's raw free-text input.
   * @param currentState The current game state.
   * @param narrationSummary The parsed narration summary from the LLM.
   * @param preParsedIntents Optional pre-parsed intents provided by a platform adapter.
   * @returns The new game state, accumulated narration guide, narration directives,
   *          conditions to report back.
   */
  public executeTurn(
    playerMessage: string,
    currentState: State,
    narrationSummary: Record<string, unknown>,
    preParsedIntents?: Signal[] | null
  ): {
    newState: State;
    gamePlayEvents: NarrationDirective[];
    effectInstructions: string;
  } {
    // Phase 1 – Input
    const allIntents = preParsedIntents || this.extractIntents(playerMessage);

    // Phase 2 – Process (Unified Aspect Sequence)
    let newState = JSON.parse(JSON.stringify(currentState));

    // First: Handle Time Advance and Expired Effects (Always happens first)
    const typeChecks = validateSignalTypes(narrationSummary);
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

    const gamePlayEvents: NarrationDirective[] = [];

    // Iterate through the cartridge-defined aspect sequence.
    // Every rule is called – even if there is no matching event – so that it
    // can produce mustNotHappen entries for the LLM.
    const sequence = this.cartridge.ruleOrder || [];
    for (const key of sequence) {
      if (this.cartridge.rules && this.cartridge.rules[key]) {
        // Prepare context
        const def = this.cartridge.signalSchemas.find(d => d.key === key);

        let foundEffect: Signal | null = null;
        let foundTypeCheck: Record<string, unknown> | null = null;
        if (def) {
          const found = findSignalByKey(key, narrationSummary, typeChecks);
          foundEffect = found.effect;
          foundTypeCheck = found.typeCheck;
        }

        const context: TurnContext = {
          playerSignals: allIntents.filter(e => e.key === key),
          currentCondition: this.currentCondition,
          ruleKey: key,
          worldSignal: foundEffect,
          typeCheck: foundTypeCheck,
          narrationSummary: narrationSummary
        };

        const result = this.cartridge.rules[key](newState, context);

        // Build the NarrationDirective from the rule result
        const gpe = this.buildNarrationDirective(key, result);
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

    // Generate schema instructions from signalSchemas using renderSchemaInstruction.
    const instructionParts: string[] = [];
    for (const tracker of this.cartridge.signalSchemas) {
      const instruction = renderSchemaInstruction(tracker);
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
  // NarrationDirective construction
  // ----------------------------------------------------------------

  /**
   * Convert a RuleOutcome into a standardised NarrationDirective.
   */
  private buildNarrationDirective(ruleKey: string, result: RuleOutcome | null): NarrationDirective {
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
