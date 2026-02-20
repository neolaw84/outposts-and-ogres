/**
 * GamePlayScript – the core engine that executes the three-phase loop.
 *
 * Phase 1 – Input:   Extract the player's intended action.
 * Phase 2 – Process: Roll dice and apply cartridge rules.
 *                     Process effect-driven side effects from narration summary.
 * Phase 3 – Output:  Build the AI narration prompt.
 *
 * The script is driven by a swappable GameCartridge that defines conditions,
 * available actions, resolution rules, effect definitions, and aspect functions.
 */

import {
  Message,
  ParsedAction,
  GameCartridge,
  CartridgeRule,
  OutputPrompt,
  TurnEvent,
  GameState,
  AspectFunctionResult,
  ActionResolutionEvent
} from '../types';
import { understandPlayerInput } from '../inputs/player-input-understanding';
import { PromptMapper } from '../prompt-mappers';
import { applySideEffect, revertSideEffect } from '../core/game-state';
import { addDuration, getMidnightsPassed } from '../utils/time-utils';
import { cleanInput, findEffectByKey } from '../utils/llm-utils';

class GamePlayScript {
  private cartridge: GameCartridge;
  private currentCondition: string;
  private messages: Message[];
  private promptMapper: PromptMapper;

  constructor(cartridge: GameCartridge, promptMapper: PromptMapper) {
    this.cartridge = cartridge;
    // Default to the first stop condition
    this.currentCondition = cartridge.stopConditions.length > 0
      ? cartridge.stopConditions[0]
      : 'default';
    this.messages = [];
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

  /** Get all messages exchanged so far. */
  public getMessages(): Message[] {
    return this.messages;
  }

  /** Add a message to the history. */
  public addMessage(message: Message): void {
    this.messages.push(message);
  }

  // ----------------------------------------------------------------
  // Phase 1 – INPUT
  // ----------------------------------------------------------------

  /**
   * Extract the player's intended action from the latest player message.
   * Returns null if no recognisable action is found.
   */
  public extractAction(playerMessage: string): ParsedAction | null {
    const actions = this.cartridge.availableActions[this.currentCondition] || [];
    const understanding = understandPlayerInput(
      playerMessage,
      actions,
      this.cartridge.stopConditions
    );
    return understanding.parsedAction;
  }

  // ----------------------------------------------------------------
  // Phase 2 – PROCESS
  // ----------------------------------------------------------------

  /** Find the cartridge rule for the current condition + action. */
  public findRule(actionKeyword: string): CartridgeRule | null {
    const rules = this.cartridge.rules;
    for (let i = 0; i < rules.length; i++) {
      if (
        rules[i].condition === this.currentCondition &&
        rules[i].action === actionKeyword
      ) {
        return rules[i];
      }
    }
    return null;
  }


  /**
   * Process effects from a narration summary against the character sheet.
   * Iterates through effectDefinitions in order, calls each aspect function,
   * collects narration guides and applies side effects.
   *
   * @param sheet - The current state.
   * @param naSum - The parsed narration summary from the LLM.
   * @returns Updated game state and accumulated narration guide.
   */
  public processEffects(
    sheet: GameState,
    naSum: Record<string, unknown>
  ): { sheet: GameState; narrationGuide: string } {
    const typeChecks = cleanInput(naSum);
    // Deep-clone the input so we never mutate the caller's sheet.
    let currentSheet: GameState = JSON.parse(JSON.stringify(sheet));
    let finalNarrationGuide = '';

    // Update time
    let durationToAdd = 'PT0M';
    if (typeChecks['elapsed_time']) {
      durationToAdd = naSum['elapsed_time'] as string;
    } else if (naSum['elapsed_time'] && typeof naSum['elapsed_time'] === 'string' &&
      (naSum['elapsed_time'] as string).indexOf('P') === 0) {
      durationToAdd = naSum['elapsed_time'] as string;
    }

    const newCurrentTime = addDuration(currentSheet.cur_ts, durationToAdd);
    currentSheet.stats['num_day'] = (currentSheet.stats['num_day'] || 0) +
      getMidnightsPassed(currentSheet.cur_ts, newCurrentTime);
    currentSheet.cur_ts = newCurrentTime;

    // Revert expired side effects
    currentSheet = revertSideEffect(currentSheet);

    // Process each effect definition
    const effectDefs = this.cartridge.effectDefinitions;
    for (let i = 0; i < effectDefs.length; i++) {
      const def = effectDefs[i];
      const key = def.key;

      const found = findEffectByKey(key, naSum, typeChecks);
      const foundEffect = found.effect;
      const foundTypeCheck = found.typeCheck;

      if (this.cartridge.aspectFunctions && this.cartridge.aspectFunctions[key]) {
        const result = this.cartridge.aspectFunctions[key](currentSheet, {
          type: 'world_event',
          effectKey: key,
          effectData: foundEffect,
          typeCheck: foundTypeCheck
        });

        if (result) {
          if (result.outcome && result.outcome.narrationGuidance) {
            finalNarrationGuide += result.outcome.narrationGuidance.join('\n') + '\n';
          }
          if (result.stateMutations && result.stateMutations.length > 0) {
            for (let j = 0; j < result.stateMutations.length; j++) {
              currentSheet = applySideEffect(currentSheet, result.stateMutations[j]);
            }
          }
        }
      }
    }

    return { sheet: currentSheet, narrationGuide: finalNarrationGuide };
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
    parsedAction: ParsedAction,
    aspectResult: AspectFunctionResult
  ): TurnEvent[] {
    const actions = this.cartridge.availableActions[this.currentCondition] || [];
    const understanding = understandPlayerInput(
      playerMessage,
      actions,
      this.cartridge.stopConditions
    );

    const availableActions = this.cartridge.availableActions[this.currentCondition] || [];

    return [
      {
        type: 'player_input',
        rawText: playerMessage,
        condition: this.currentCondition,
        parsedAction: parsedAction,
        emotions: understanding.emotions,
        scenarioUnderstanding: understanding.scenario
      },
      {
        type: 'action_resolution',
        action: parsedAction.action,
        target: parsedAction.target,
        status: aspectResult.outcome.status,
        mechanicsLogs: aspectResult.outcome.mechanicsLogs,
        narrationGuidance: aspectResult.outcome.narrationGuidance
      },
      {
        type: 'available_choices',
        condition: this.currentCondition,
        choices: availableActions
      }
    ];
  }

  public buildPrompt(events: TurnEvent[]): OutputPrompt {
    const channels = this.promptMapper(events);
    return {
      text: channels.combined,
      channels: channels,
      events: events
    };
  }

  // ----------------------------------------------------------------
  // Full turn execution
  // ----------------------------------------------------------------

  /**
   * Run the complete 3-phase turn for a player message.
   *
   * @param playerMessage The player's raw free-text input.
   * @param currentState The current game state.
   * @param preParsedAction Optional parsed action provided by a system adapter.
   * @returns An OutputPrompt to send to the AI and the new game state.
   */
  public processTurn(
    playerMessage: string,
    currentState: GameState,
    preParsedAction?: ParsedAction | null
  ): { prompt: OutputPrompt | null; newState: GameState; aspectResult: AspectFunctionResult | null } {
    // Record the player's message
    this.addMessage({ role: 'player', content: playerMessage });

    // Phase 1 – Input
    const parsed = preParsedAction || this.extractAction(playerMessage);
    if (!parsed) {
      return { prompt: null, newState: currentState, aspectResult: null };
    }

    // Phase 2 – Process Action via unified AspectFunction
    let newState = JSON.parse(JSON.stringify(currentState));
    const rule = this.findRule(parsed.action);
    let aspectResult: AspectFunctionResult;

    if (rule && rule.aspectFunction) {
      aspectResult = rule.aspectFunction(newState, {
        type: 'player_action',
        action: parsed
      });

      if (aspectResult.stateMutations && aspectResult.stateMutations.length > 0) {
        for (let i = 0; i < aspectResult.stateMutations.length; i++) {
          newState = applySideEffect(newState, aspectResult.stateMutations[i]);
        }
      }
    } else {
      // Fallback for missing rules / unhandled actions
      aspectResult = {
        outcome: {
          status: 'neutral',
          mechanicsLogs: ['Action was not recognised by any specific rule.'],
          narrationGuidance: ['Narrate the attempt to ' + parsed.action + ' vaguely.']
        },
        stateMutations: []
      };
    }

    // Phase 3 – Output
    const events = this.buildTurnEvents(playerMessage, parsed, aspectResult);

    return {
      prompt: this.buildPrompt(events),
      newState: newState,
      aspectResult: aspectResult
    };
  }
}

export { GamePlayScript };
