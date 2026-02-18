/**
 * Core types for the game play script system.
 *
 * The game loop works as follows:
 * 1. AI narrates (odd messages)
 * 2. Player enters free-text input (even messages)
 * 3. The script runs through three phases:
 *    - Input:   extract the player's intended action
 *    - Process: roll dice and apply rules to determine success/failure
 *    - Output:  build a prompt instructing the AI how to narrate the result
 */

/** Represents a single message in the conversation. */
interface Message {
  role: 'player' | 'ai';
  content: string;
}

/** Result of parsing a player's input. */
interface ParsedAction {
  /** The action keyword the player chose, e.g. "attack", "dodge". */
  action: string;
  /** Optional target or parameter for the action. */
  target: string;
  /** The raw text of the player's message. */
  raw: string;
}

/** Outcome of a single dice roll. */
interface DiceRollResult {
  /** Number of sides on the die. */
  sides: number;
  /** The value that was rolled. */
  value: number;
}

/** Result produced by the process phase. */
interface ActionResult {
  /** Whether the player's action succeeded. */
  success: boolean;
  /** The parsed action that was attempted. */
  action: ParsedAction;
  /** Dice rolls that were made. */
  rolls: DiceRollResult[];
  /** Difficulty threshold that had to be met. */
  difficulty: number;
  /** Sum of all dice rolls. */
  rollTotal: number;
}

/**
 * A single rule in a cartridge that maps a condition + action pair
 * to the dice check and narration prompts.
 */
interface CartridgeRule {
  /** Condition / scenario name, e.g. "combat", "exploration". */
  condition: string;
  /** Action keyword this rule handles. */
  action: string;
  /** Number of dice to roll. */
  diceCount: number;
  /** Number of sides per die. */
  diceSides: number;
  /** Minimum roll total needed for success. */
  difficulty: number;
  /** Prompt fragment sent to AI on success. */
  successPrompt: string;
  /** Prompt fragment sent to AI on failure. */
  failurePrompt: string;
}

/**
 * A game play cartridge defines the rules for one game system.
 * Cartridges are swappable so different RPG rule-sets can be used.
 */
interface GameCartridge {
  /** Human-readable name of this game system. */
  name: string;
  /** Version string. */
  version: string;
  /** Conditions under which the AI should stop narrating and hand control to the player. */
  stopConditions: string[];
  /**
   * Map from condition name to the list of actions the player may attempt.
   * E.g. { "combat": ["attack", "dodge", "cast"] }
   */
  availableActions: Record<string, string[]>;
  /** The full set of rules. */
  rules: CartridgeRule[];
}

/**
 * The prompt that the output phase produces for the AI.
 */
interface OutputPrompt {
  /** Complete prompt text to send to the AI. */
  text: string;
  /** The action result that informed the prompt. */
  result: ActionResult;
}

export {
  Message,
  ParsedAction,
  DiceRollResult,
  ActionResult,
  CartridgeRule,
  GameCartridge,
  OutputPrompt
};
