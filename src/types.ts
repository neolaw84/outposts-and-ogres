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

/**
 * Represents the unified context in which an GameRule is triggered.
 * Receives both the player intent (if any) and the parsed LLM summary data.
 */
export interface RuleContext {
  /** The parsed actions from the player's input (if any) e.g., <attack goblin> <drink potion> */
  action: ParsedAction[] | null;
  /** The current condition/scenario of the engine (e.g., 'combat') */
  currentCondition: string;
  /** The key of the aspect function currently being executed in the sequence */
  ruleKey: string;
  /** The matching effect data from the LLM narration summary (if matched by effectDefinition) */
  effectData: Record<string, unknown> | null;
  /** The type check results for the effect data (if any) */
  typeCheck: Record<string, unknown> | null;
  /** The full raw narration summary object */
  narrationSummary: Record<string, unknown>;
}

/* GameCartridge is defined below together with effect-driven types. */

/**
 * The prompt that the output phase produces for the AI.
 */
interface OutputPrompt {
  /** Complete prompt text to send to the AI. */
  text: string;
  /** Prompt split into channel-specific segments for each platform. */
  channels: PromptInstructions;
  /** Structured turn events used to build platform prompts. */
  events: TurnEvent[];
}

/** Prompt fragments for systems that support separate memory channels. */
interface PromptInstructions {
  /** Long horizon context and world-state continuity. */
  campaignContinuity: string;
  /** Mid-term instructions for upcoming narration behaviour. */
  sceneGuidance: string;
  /** Immediate narration guidance for the very next model response. */
  immediateInstruction: string;
  /** Fallback full prompt for platforms with a single prompt field. */
  combined: string;
}

/** Emotional signal extracted from free-text player input. */
interface PlayerEmotionSignal {
  /** Emotion label detected in the player text. */
  emotion: 'fear' | 'anger' | 'hope' | 'calm' | 'curiosity';
  /** Keyword that triggered the signal detection. */
  sourceKeyword: string;
}

/** 
 * Cartridge-specific understanding of the raw LLM WorldSimulationUpdate.
 */
export interface ScenarioUnderstanding {
  suggestedCondition: string | null;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
}

/** 
 * Comprehensive understanding of the player's input intent, 
 * optionally provided by a cartridge's custom parser.
 */
export interface PlayerInputUnderstanding {
  parsedActions: ParsedAction[] | null;
  emotions: PlayerEmotionSignal[];
  scenario: ScenarioUnderstanding;
}

/** Player input event emitted for each processed turn. */
interface PlayerInputEvent {
  type: 'player_input';
  rawText: string;
  condition: string;
  parsedActions: ParsedAction[];
  emotions: PlayerEmotionSignal[];
  scenarioUnderstanding: ScenarioUnderstanding;
}

/** Event emitted to expose what the player can do next. */
interface AvailableChoicesEvent {
  type: 'available_choices';
  condition: string;
  choices: string[];
}

/** 
 * Event emitted after the unified resolution phase. 
 * Replaces old DiceResolution and NarrativeCue events. 
 */
interface ActionResolutionEvent {
  type: 'action_resolution';
  action: string;
  target?: string;
  status: 'success' | 'failure' | 'mixed' | 'neutral';
  mechanicsLogs: string[];
  narrationGuidance: string[];
}

/** Union of all gameplay events used by prompt mappers. */
type TurnEvent =
  | PlayerInputEvent
  | ActionResolutionEvent
  | AvailableChoicesEvent;

/**
 * Standardized output of the game play loop for each rule execution.
 *
 * This is the generic output that any system can consume to instruct
 * the LLM narration engine.  Every rule in the cartridge's ruleSequence
 * produces exactly one GamePlayEvent, even when it has nothing to do.
 *
 * - mustHappen:   Narration elements that MUST appear (e.g. "player takes 15 damage").
 * - mustNotHappen: Narration elements that MUST NOT appear (e.g. "do not narrate player drinking a potion").
 * - mayHappen:    Narration elements that MAY appear (e.g. "you may narrate the goblin calling for help").
 */
interface GamePlayEvent {
  /** The rule key that produced this event. */
  ruleKey: string;
  /** High-level resolution status. */
  status: 'success' | 'failure' | 'mixed' | 'neutral';
  /** Mechanical logs for debugging / display. */
  mechanicsLogs: string[];
  /** Things that MUST be narrated. */
  mustHappen: string[];
  /** Things that MUST NOT be narrated. */
  mustNotHappen: string[];
  /** Things that MAY be narrated. */
  mayHappen: string[];
  /** Action name override for reporting. */
  actionName?: string;
  /** Action target for reporting. */
  actionTarget?: string;
  /** Side effects produced by this rule (already applied to the state). */
  stateMutations: ActiveCondition[];
}

/**
 * Structured scenario-update block returned by the LLM at the end of each
 * narration turn.  This is the raw, generic bridge between free-text LLM
 * narration and the game script.  It is intentionally kept wide and open so
 * it works across all systems and cartridges.
 *
 * The cartridge is responsible for interpreting the fields and converting
 * them into its own (cartridge-specific) domain objects if needed.
 *
 * Example LLM output (inside a [NARRATION_SUMMARY] block):
 * {
 *   "elapsed_time": "PT5M",
 *   "flags": { "in_combat": 1, "door_open": 0 },
 *   "tags":  { "weather": "storm", "npc_mood": "hostile" },
 *   "meters": { "tension": 0.8, "distance_to_exit": 42 }
 * }
 */
export interface WorldSimulationUpdate {
  /** ISO 8601 duration – how much in-game time passed this narration turn (e.g. "PT5M"). */
  elapsed_time: string;
  /** Integer flags emitted by the LLM (0 = false, 1 = true, etc.). */
  flags: Record<string, number>;
  /** Arbitrary string tags emitted by the LLM. */
  tags: Record<string, string>;
  /** Numeric meters emitted by the LLM (e.g. tension, distance). */
  meters: Record<string, number>;
  /** Structured effects array reported by the LLM for aspect-function processing. */
  effects?: Array<Record<string, unknown>>;
}

/**
 * Interface that each platform system adapter must implement.
 *
 * Different AI platforms (Janitor AI, SillyTavern, AI Dungeon) have
 * different ways to access player input, modify prompts to the AI,
 * and persist game state. Each system adapter encapsulates these
 * platform-specific details.
 */
interface SystemAdapter {
  /** Human-readable name of this system, e.g. "Janitor AI". */
  readonly name: string;

  /**
   * Extract the player's latest message from the platform's context.
   * Each platform stores conversation history differently.
   */
  getPlayerMessage(): string | null;

  /**
   * Load persisted game state from the platform's storage mechanism.
   * Returns an empty object if no state exists yet.
   */
  loadState(): Record<string, unknown>;

  /**
   * Save game state using the platform's storage mechanism.
   * E.g. AI Dungeon uses a global `state` JSON object.
   */
  saveState(state: Record<string, unknown>): void;

  /**
   * Extract the structured scenario-update JSON emitted by the LLM in its
   * last narration response and return it as a `WorldSimulationUpdate`.
   * The exact field / mechanism used to locate the block differs per platform.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): WorldSimulationUpdate | null;

  /**
   * Attempts to deduce the player's structured intent from their raw chat message.
   * Useful for platforms that allow hidden LLM prompts (like SillyTavern).
   * Returns null if the platform does not support advanced intent deduction.
   */
  deducePlayerIntent?(
    rawMessage: string,
    availableActions: string[]
  ): Promise<ParsedAction[] | null> | ParsedAction[] | null;

  /**
   * Apply the accumulated game play loop output to the platform's context.
   *
   * The system adapter converts the generic `GamePlayEvent[]` into whatever
   * mutations the underlying platform requires (prompt fields, memory slots,
   * system-prompt injections, etc.).
   *
   * @param events - All GamePlayEvents produced by the current turn, one per rule.
   * @param state - The game state after all side effects have been applied.
   * @param conditionsToReportBack - The cartridge's WorldEventTrackers telling
   *   the LLM what to report back (e.g. potion type, damage dealt).
   */
  applyGamePlayOutput(
    events: GamePlayEvent[],
    state: GameState,
    conditionsToReportBack: WorldEventTracker[]
  ): void;
}

// ---- Effect-driven state management types ----

/** A single stat impact: which stat to change, what operation, and what value. */
interface StatModifier {
  /** Key into the character sheet stats object. */
  stats: string;
  /** Operation: "set" replaces the value, "add" adds to it, "sub" subtracts. */
  op: 'set' | 'add' | 'sub';
  /** The numeric value to apply. */
  val: number;
}

/**
 * A side effect produced by an aspect function.
 * Represents a change to the character sheet stats.
 */
interface ActiveCondition {
  /** Description of the side effect. */
  what: string;
  /** True if the effect is temporary (will be reverted after expiry). */
  temp: boolean;
  /** Array of stat impacts to apply. */
  impacts: StatModifier[];
  /** ISO datetime when a temporary effect expires. Only required when temp is true. */
  expiry?: string;
  /** Stat keys that prevent this effect from expiring while they are truthy. */
  re_lock?: string[];
}

/** The result returned by an aspect function. */
interface RuleResolution {
  outcome: {
    /** High-level resolution state for the action. */
    status: 'success' | 'failure' | 'mixed' | 'neutral';
    /** Optional mechanical logs, e.g. "Rolled 15 vs 12" or "Consumed 5 mana". */
    mechanicsLogs: string[];
    /** Things that MUST be narrated by the LLM. */
    mustHappen: string[];
    /** Things that MUST NOT be narrated by the LLM. */
    mustNotHappen: string[];
    /** Things that MAY optionally be narrated by the LLM. */
    mayHappen: string[];
    /** Override the action name reported to the prompt-mapper/LLM (defaults to ruleKey). */
    actionName?: string;
    /** Optional target reported to the prompt-mapper/LLM. */
    actionTarget?: string;
  };
  /** Side effect(s) to apply to the game state. */
  stateMutations: ActiveCondition[];
}

/** The game state persisted across turns. */
interface GameState {
  /** Current in-game timestamp in ISO format. */
  timestamp: string;
  /** All tracked stat values (hp, gold, strength, custom flags, etc.). */
  stats: Record<string, number>;
  /** Array of active temporary side effects with expiry tracking. */
  activeConditions: StatusEffect[];
  /** Boolean flags for game state tracking. */
  flags: string[];
}

/** A stored side effect entry in the game state's activeConditions[] array. */
interface StatusEffect {
  /** Description of the effect. */
  desc: string;
  /** ISO datetime when the effect expires. */
  expiry: string | null;
  /** Stat keys that prevent this effect from expiring while they are truthy. */
  re_lock: string[] | null;
  /** Array of impacts with original values for reversion. */
  impacts: StoredStatModifier[];
}

/** An impact entry stored for later reversion, includes original value. */
interface StoredStatModifier {
  stats: string;
  op: 'set' | 'add' | 'sub';
  val: number;
  /** Original value before the impact was applied, used for reversion. */
  oriVal: number;
}

/**
 * An effect definition that tells the LLM when and how to report game events.
 * Each definition produces an entry in the NARRATION_SUMMARY "effects" array.
 */
interface WorldEventTracker {
  /** Unique identifier for this effect type. */
  key: string;
  /** Description of allowed values for "what" field. */
  what: string;
  /** Description of "when" field format. */
  when?: string;
  /** Descriptions of numeric meter fields. */
  meters?: Record<string, string>;
  /** Descriptions of boolean flag fields. */
  flags?: Record<string, string>;
  /** Descriptions of string tag fields. */
  tags?: Record<string, string>;
  /** When the LLM should report this event. */
  condition: string;
  /** Allow dynamic property access for JSON serialisation. */
  [prop: string]: unknown;
}

/**
 * Signature for unified aspect functions.
 * Handles both user input actions and world simulation events.
 *
 * @param state - The current game state.
 * @param context - Context explaining why this function is being called.
 * @returns The narration guide text and side effects to apply.
 */
type GameRule = (
  state: GameState,
  context: RuleContext
) => RuleResolution;

/**
 * Extended game cartridge that includes effect-driven state management.
 * Adds effect definitions, aspect functions, a default character sheet,
 * and turn-end triggers on top of the base GameCartridge.
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

  /**
   * Optional cartridge-level parser.
   * Overrides the engine's default input understanding if provided.
   */
  parseInput?: (
    message: string,
    availableActions: string[],
    currentCondition: string
  ) => PlayerInputUnderstanding;

  /** Default character sheet used when no prior state exists. */
  defaultGameState: GameState;
  /** Definitions of effects the LLM can report in NARRATION_SUMMARY. */
  worldEventTrackers: WorldEventTracker[];
  /** Aspect functions keyed by effect definition key. Called in worldEventTrackers order. */
  gameRules: Record<string, GameRule>;
  /** 
   * The explicit order in which gameRules should be evaluated.
   * Can interleave world simulation aspects with player actions.
   * e.g., ['time_advance', 'weather_change', 'player_action', 'enemy_attack']
   */
  ruleSequence: string[];
  /** Events that force the LLM to end the turn immediately. */
  turnEndTriggers: string[];
}

export {
  Message,
  ParsedAction,
  GameCartridge,
  OutputPrompt,
  PromptInstructions,
  PlayerEmotionSignal,
  PlayerInputEvent,
  ActionResolutionEvent,
  AvailableChoicesEvent,
  TurnEvent,
  GamePlayEvent,
  SystemAdapter,
  StatModifier,
  ActiveCondition,
  RuleResolution,
  GameState,
  StatusEffect,
  StoredStatModifier,
  WorldEventTracker,
  GameRule
};
