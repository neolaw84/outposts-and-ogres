/**
 * GamePlayScript – the core engine that executes the three-phase loop.
 *
 * Phase 1 – Input:   Extract the player's intended action.
 * Phase 2 – Process: Roll dice and apply cartridge rules.
 * Phase 3 – Output:  Build the AI narration prompt.
 *
 * The script is driven by a swappable GameCartridge that defines conditions,
 * available actions, and resolution rules.
 */

import {
  Message,
  ParsedAction,
  ActionResult,
  GameCartridge,
  CartridgeRule,
  OutputPrompt,
  TurnEvent
} from '../types';
import { rollDice, sumRolls } from '../utils/dice';
import { understandPlayerInput } from '../inputs/player-input-understanding';
import { PromptMapper } from '../prompt-mappers';

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
   * Resolve the player's action: roll dice and determine success or failure.
   */
  public resolveAction(parsedAction: ParsedAction): ActionResult {
    const rule = this.findRule(parsedAction.action);
    if (!rule) {
      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      return {
        success: total >= 10,
        action: parsedAction,
        rolls: rolls,
        difficulty: 10,
        rollTotal: total
      };
    }

    const rolls = rollDice(rule.diceCount, rule.diceSides);
    const total = sumRolls(rolls);
    return {
      success: total >= rule.difficulty,
      action: parsedAction,
      rolls: rolls,
      difficulty: rule.difficulty,
      rollTotal: total
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
    parsedAction: ParsedAction,
    result: ActionResult
  ): TurnEvent[] {
    const rule = this.findRule(result.action.action);
    let outcomeFragment = '';

    if (rule) {
      outcomeFragment = result.success ? rule.successPrompt : rule.failurePrompt;
    }

    if (!outcomeFragment) {
      outcomeFragment = result.success ? 'The action succeeds.' : 'The action fails.';
    }

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
        type: 'dice_resolution',
        action: result.action.action,
        target: result.action.target,
        success: result.success,
        rolls: result.rolls,
        rollTotal: result.rollTotal,
        difficulty: result.difficulty
      },
      {
        type: 'narrative_cue',
        success: result.success,
        cue: outcomeFragment
      },
      {
        type: 'available_choices',
        condition: this.currentCondition,
        choices: availableActions
      }
    ];
  }

  public buildPrompt(result: ActionResult, events: TurnEvent[]): OutputPrompt {
    const channels = this.promptMapper(events);
    return {
      text: channels.combined,
      channels: channels,
      events: events,
      result: result
    };
  }

  // ----------------------------------------------------------------
  // Full turn execution
  // ----------------------------------------------------------------

  /**
   * Run the complete 3-phase turn for a player message.
   *
   * @param playerMessage The player's raw free-text input.
   * @returns An OutputPrompt to send to the AI, or null if no action was found.
   */
  public processTurn(playerMessage: string): OutputPrompt | null {
    // Record the player's message
    this.addMessage({ role: 'player', content: playerMessage });

    // Phase 1 – Input
    const parsed = this.extractAction(playerMessage);
    if (!parsed) {
      return null;
    }

    // Phase 2 – Process
    const result = this.resolveAction(parsed);

    // Phase 3 – Output
    const events = this.buildTurnEvents(playerMessage, parsed, result);
    return this.buildPrompt(result, events);
  }
}

export { GamePlayScript };
