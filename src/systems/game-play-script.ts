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
  OutputPrompt
} from './types';
import { rollDice, sumRolls } from './dice';
import { parsePlayerInput } from './input-parser';

class GamePlayScript {
  private cartridge: GameCartridge;
  private currentCondition: string;
  private messages: Message[];

  constructor(cartridge: GameCartridge) {
    this.cartridge = cartridge;
    // Default to the first stop condition
    this.currentCondition = cartridge.stopConditions.length > 0
      ? cartridge.stopConditions[0]
      : 'default';
    this.messages = [];
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
    return parsePlayerInput(playerMessage, actions);
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
  public buildPrompt(result: ActionResult): OutputPrompt {
    const rule = this.findRule(result.action.action);
    let outcomeFragment: string;

    if (rule) {
      outcomeFragment = result.success ? rule.successPrompt : rule.failurePrompt;
    } else {
      outcomeFragment = result.success
        ? 'The action succeeds.'
        : 'The action fails.';
    }

    const targetText = result.action.target
      ? ' targeting ' + result.action.target
      : '';

    const availableActions = this.cartridge.availableActions[this.currentCondition] || [];
    const actionList = availableActions.join(', ');

    const prompt =
      'The player attempted to ' + result.action.action + targetText + '. ' +
      'They rolled ' + result.rollTotal + ' against difficulty ' + result.difficulty + '. ' +
      outcomeFragment + ' ' +
      'Narrate the outcome of the player\'s action. ' +
      'Describe any NPC reactions or actions that follow. ' +
      'End by telling the player what they can do next. ' +
      'Available actions: ' + actionList + '.';

    return { text: prompt, result: result };
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
    return this.buildPrompt(result);
  }
}

export { GamePlayScript };
