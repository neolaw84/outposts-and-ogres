/**
 * GamePlayScript – the core engine that executes the three-phase loop.
 *
 * Phase 1 – Input:   Extract the player's intended action.
 * Phase 2 – Process: Process the turn based on the cartridge's `ruleSequence`.
 *                    Every rule is called in order – even with null context –
 *                    so that the output can instruct the LLM about what must
 *                    NOT be narrated (e.g. "do not narrate player drinking a potion").
 * Phase 3 – Output:  Build the AI narration prompt (legacy) and/or accumulate
 *                    a standardised `GamePlayEvent[]` for the system adapter.
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
  GamePlayEvent,
  GameState,
  RuleResolution,
  ActionResolutionEvent,
  RuleContext,
  ActiveCondition,
  WorldEventTracker
} from '../types';
import { understandPlayerInput } from '../inputs/player-input-understanding';
import { PromptMapper } from '../prompt-mappers';
import { applySideEffect, revertSideEffect } from '../core/game-state';
import { addDuration, getMidnightsPassed } from '../utils/time-utils';
import { cleanInput, findEffectByKey } from '../utils/llm-utils';

class GamePlayScript {
  private cartridge: GameCartridge;
  private currentCondition: string;
  private promptMapper: PromptMapper | null;

  constructor(cartridge: GameCartridge, promptMapper?: PromptMapper) {
    this.cartridge = cartridge;
    // Default to the first stop condition
    this.currentCondition = cartridge.stopConditions.length > 0
      ? cartridge.stopConditions[0]
      : 'default';
    this.promptMapper = promptMapper || null;
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
   * Every rule in the sequence is called, even when there is no matching
   * player action or world event.  This allows rules to emit `mustNotHappen`
   * entries (e.g. "do not narrate player drinking a potion") which are
   * essential for LLM-based narration engines.
   *
   * @param playerMessage The player's raw free-text input.
   * @param currentState The current game state.
   * @param narrationSummary The parsed narration summary from the LLM.
   * @param preParsedAction Optional parsed action provided by a system adapter.
   * @returns The new game state, accumulated narration guide, game play events,
   *          conditions to report back, and an optional legacy OutputPrompt.
   */
  public executeTurn(
    playerMessage: string,
    currentState: GameState,
    narrationSummary: Record<string, unknown>,
    preParsedActions?: ParsedAction[] | null
  ): {
    prompt: OutputPrompt | null;
    newState: GameState;
    narrationGuide: string;
    gamePlayEvents: GamePlayEvent[];
    conditionsToReportBack: WorldEventTracker[];
  } {
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
    const gamePlayEvents: GamePlayEvent[] = [];
    let worldEventFired = false;

    // Iterate through the cartridge-defined aspect sequence.
    // Every rule is called – even if there is no matching event – so that it
    // can produce mustNotHappen entries for the LLM.
    const sequence = this.cartridge.ruleSequence || [];
    for (const key of sequence) {
      if (this.cartridge.gameRules && this.cartridge.gameRules[key]) {
        // Prepare context
        const def = this.cartridge.worldEventTrackers.find(d => d.key === key);

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

        // Build the GamePlayEvent from the rule result
        const gpe = this.buildGamePlayEvent(key, result);
        gamePlayEvents.push(gpe);

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

    // Conditions to report back are the cartridge's worldEventTrackers.
    const conditionsToReportBack = this.cartridge.worldEventTrackers;

    if (!parsedActions && !worldEventFired) {
      return {
        prompt: null,
        newState: newState,
        narrationGuide: finalNarrationGuide,
        gamePlayEvents: gamePlayEvents,
        conditionsToReportBack: conditionsToReportBack
      };
    }

    // Phase 3 – Output (legacy prompt path, used when a promptMapper is set)
    let prompt: OutputPrompt | null = null;
    if (this.promptMapper) {
      const events = this.buildTurnEvents(playerMessage, parsedActions, aspectEvents);
      prompt = this.buildPrompt(events);
    }

    return {
      prompt: prompt,
      newState: newState,
      narrationGuide: finalNarrationGuide,
      gamePlayEvents: gamePlayEvents,
      conditionsToReportBack: conditionsToReportBack
    };
  }

  // ----------------------------------------------------------------
  // GamePlayEvent construction
  // ----------------------------------------------------------------

  /**
   * Convert a RuleResolution into a standardised GamePlayEvent.
   *
   * - `narrationGuidance` is treated as `mustHappen` when the new fields
   *   are not explicitly set by the rule.
   * - If the rule provides `mustHappen` / `mustNotHappen` / `mayHappen`
   *   directly, those take precedence.
   */
  private buildGamePlayEvent(ruleKey: string, result: RuleResolution | null): GamePlayEvent {
    if (!result || !result.outcome) {
      return {
        ruleKey: ruleKey,
        status: 'neutral',
        mechanicsLogs: [],
        mustHappen: [],
        mustNotHappen: [],
        mayHappen: [],
        stateMutations: []
      };
    }

    const o = result.outcome;
    const mustHappen = o.mustHappen || (o.narrationGuidance.length > 0 ? o.narrationGuidance.slice() : []);
    const mustNotHappen = o.mustNotHappen || [];
    const mayHappen = o.mayHappen || [];

    return {
      ruleKey: ruleKey,
      status: o.status,
      mechanicsLogs: o.mechanicsLogs.slice(),
      mustHappen: mustHappen,
      mustNotHappen: mustNotHappen,
      mayHappen: mayHappen,
      actionName: o.actionName,
      actionTarget: o.actionTarget,
      stateMutations: result.stateMutations ? result.stateMutations.slice() : []
    };
  }

  // ----------------------------------------------------------------
  // Phase 3 – OUTPUT (legacy prompt path)
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
    if (!this.promptMapper) {
      return {
        text: '',
        channels: {
          campaignContinuity: '',
          sceneGuidance: '',
          immediateInstruction: '',
          combined: ''
        },
        events: events
      };
    }
    const channels = this.promptMapper(events);
    return {
      text: channels.combined,
      channels: channels,
      events: events
    };
  }
}

export { GamePlayScript };
