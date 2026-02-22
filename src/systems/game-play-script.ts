/**
 * GamePlayScript – the core engine that executes the three-phase loop.
 *
 * Phase 1 – Input:   Extract the player's intended action.
 * Phase 2 – Process: Process the turn based on the cartridge's `ruleSequence`.
 *                    This incorporates both the player's action and world effects.
 * Phase 3 – Output:  Build the AI narration prompt.
 *
 * The script is driven by a swappable GameCartridge that defines conditions,
 * available actions, resolution rules, effect definitions, and aspect functions.
 */

import {
  Message,
  ParsedAction,
  GameCartridge,
  OutputPrompt,
  TurnEvent,
  GameState,
  RuleResolution,
  ActionResolutionEvent,
  RuleContext
} from '../types';
import { understandPlayerInput } from '../inputs/player-input-understanding';
import { PromptMapper } from '../prompt-mappers';
import { applySideEffect, revertSideEffect } from '../core/game-state';
import { addDuration, getMidnightsPassed } from '../utils/time-utils';
import { cleanInput, findEffectByKey } from '../utils/llm-utils';

class GamePlayScript {
  private cartridge: GameCartridge;
  private currentCondition: string;
  private promptMapper: PromptMapper;

  constructor(cartridge: GameCartridge, promptMapper: PromptMapper) {
    this.cartridge = cartridge;
    // Default to the first stop condition
    this.currentCondition = cartridge.stopConditions.length > 0
      ? cartridge.stopConditions[0]
      : 'default';
    this.promptMapper = promptMapper;
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
   * Extract the player's intended action from the latest player message.
   * Returns null if no recognisable action is found.
   */
  public extractAction(playerMessage: string): ParsedAction[] | null {
    const actions = this.cartridge.availableActions[this.currentCondition] || [];

    if (this.cartridge.parseInput) {
      const customUnderstanding = this.cartridge.parseInput(playerMessage, actions, this.currentCondition);
      return customUnderstanding.parsedActions;
    }

    const understanding = understandPlayerInput(
      playerMessage,
      actions,
      this.cartridge.stopConditions
    );
    return understanding.parsedActions;
  }

  // ----------------------------------------------------------------
  // Unified Turn Execution
  // ----------------------------------------------------------------

  /**
   * Run the complete 3-phase turn for a player message.
   * Modifies the game state by processing the player action and world events
   * in the exact order specified by `cartridge.ruleSequence`.
   *
   * @param playerMessage The player's raw free-text input.
   * @param currentState The current game state.
   * @param narrationSummary The parsed narration summary from the LLM.
   * @param preParsedAction Optional parsed action provided by a system adapter.
   * @returns An OutputPrompt to send to the AI, the new game state, and the accumulated narration guide.
   */
  public executeTurn(
    playerMessage: string,
    currentState: GameState,
    narrationSummary: Record<string, unknown>,
    preParsedActions?: ParsedAction[] | null
  ): { prompt: OutputPrompt | null; newState: GameState; narrationGuide: string } {
    // Phase 1 – Input
    const parsedActions = preParsedActions || this.extractAction(playerMessage);

    // Phase 2 – Process (Unified Aspect Sequence)
    let newState = JSON.parse(JSON.stringify(currentState));
    let finalNarrationGuide = '';

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

    const aspectEvents: TurnEvent[] = [];
    let worldEventFired = false;

    // Iterate through the cartridge-defined aspect sequence
    const sequence = this.cartridge.ruleSequence || [];
    for (const key of sequence) {
      if (this.cartridge.gameRules && this.cartridge.gameRules[key]) {
        // Prepare context
        // If it's a world effect, grab data if it exists
        const def = this.cartridge.worldEventTrackers.find(d => d.key === key);
        const isWorldEvent = def !== undefined;
        const isPlayerAction = parsedActions ? parsedActions.some(a => a.action === key) : false;

        // Skip execution if this aspect is neither a defined world event nor a triggered player action
        if (!isWorldEvent && !isPlayerAction) {
          continue;
        }

        let foundEffect: Record<string, unknown> | null = null;
        let foundTypeCheck: Record<string, unknown> | null = null;
        if (def) {
          const found = findEffectByKey(key, narrationSummary, typeChecks);
          foundEffect = found.effect;
          foundTypeCheck = found.typeCheck;
        }

        const context: RuleContext = {
          action: parsedActions,
          currentCondition: this.currentCondition,
          ruleKey: key,
          effectData: foundEffect,
          typeCheck: foundTypeCheck,
          narrationSummary: narrationSummary
        };

        const result = this.cartridge.gameRules[key](newState, context);

        if (result) {
          if (result.stateMutations && result.stateMutations.length > 0) {
            worldEventFired = true;
            for (let j = 0; j < result.stateMutations.length; j++) {
              newState = applySideEffect(newState, result.stateMutations[j]);
            }
          }
          if (result.outcome) {
            if (result.outcome.status !== 'neutral') {
              worldEventFired = true;
            }
            if (result.outcome.mechanicsLogs.length > 0 || result.outcome.narrationGuidance.length > 0) {
              finalNarrationGuide += result.outcome.narrationGuidance.join('\n') + '\n';
              aspectEvents.push({
                type: 'action_resolution',
                action: result.outcome.actionName || key,
                target: result.outcome.actionTarget,
                status: result.outcome.status,
                mechanicsLogs: result.outcome.mechanicsLogs,
                narrationGuidance: result.outcome.narrationGuidance
              });
            }
          }
        }
      }
    }

    if (!parsedActions && !worldEventFired) {
      return {
        prompt: null,
        newState: newState,
        narrationGuide: finalNarrationGuide
      };
    }

    // Phase 3 – Output
    // We always build turn events, even if there's no parsed action, because world effects might have happened
    // and we need to pass those to the LLM.
    const events = this.buildTurnEvents(playerMessage, parsedActions, aspectEvents);
    const prompt = this.buildPrompt(events);

    return {
      prompt: prompt,
      newState: newState,
      narrationGuide: finalNarrationGuide
    };
  }

  // ----------------------------------------------------------------
  // Phase 3 – OUTPUT
  // ----------------------------------------------------------------

  /**
   * Build the prompt that instructs the AI on how to narrate the outcome.
   * The prompt covers:
   *   (a) narrate the player's action
   *   (b) whether the action succeeded/failed and how
   *   (c) upcoming NPC actions
   *   (d) what the player can do next turn
   */
  public buildTurnEvents(
    playerMessage: string,
    parsedActions: ParsedAction[] | null,
    aspectEvents: TurnEvent[]
  ): TurnEvent[] {
    const actions = this.cartridge.availableActions[this.currentCondition] || [];

    const understanding = this.cartridge.parseInput
      ? this.cartridge.parseInput(playerMessage, actions, this.currentCondition)
      : understandPlayerInput(
        playerMessage,
        actions,
        this.cartridge.stopConditions
      );

    const availableActions = this.cartridge.availableActions[this.currentCondition] || [];
    const eventsList: TurnEvent[] = [];

    if (parsedActions && parsedActions.length > 0) {
      eventsList.push({
        type: 'player_input',
        rawText: playerMessage,
        condition: this.currentCondition,
        parsedActions: parsedActions,
        emotions: understanding.emotions,
        scenarioUnderstanding: understanding.scenario
      });
    }

    // Insert all the individual aspect events
    for (let i = 0; i < aspectEvents.length; i++) {
      eventsList.push(aspectEvents[i]);
    }

    eventsList.push({
      type: 'available_choices',
      condition: this.currentCondition,
      choices: availableActions
    });

    return eventsList;
  }

  public buildPrompt(events: TurnEvent[]): OutputPrompt {
    const channels = this.promptMapper(events);
    return {
      text: channels.combined,
      channels: channels,
      events: events
    };
  }
}

export { GamePlayScript };
