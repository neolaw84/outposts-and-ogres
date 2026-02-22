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


/**
 * Concrete data record matching the shape the LLM returns for each effect
 * in the NARRATION_SUMMARY "effects" array.  This is `SignalSchema`
 * minus `condition` (and minus the index signature), with actual values
 * instead of descriptive strings.
 *
 * Used as the unified data envelope for:
 * - LLM-reported effect data (`TurnContext.worldSignal`)
 * - Detected player intents (actions, emotions, etc.)
 * - Each entry in `NarrationSummary.effects`
 */
interface Signal {
  /** Unique identifier — maps to a key in `rules`. */
  key: string;
  /** Descriptive value, e.g. "healing", "goblin", "fear". */
  what?: string;
  /** Temporal marker, e.g. an ISO date string. */
  when?: string;
  /** Numeric meter values. */
  meters?: Record<string, number>;
  /** Boolean flag values. */
  flags?: Record<string, boolean>;
  /** Arbitrary string tag values. */
  tags?: Record<string, string>;
}

/**
 * Describes how to detect a player intent from free text input.
 * Analogous to `SignalSchema` (which describes how the LLM reports
 * effects), this describes how the engine detects player intents.
 *
 * The `key` maps to the corresponding function in `rules`.
 */
interface SignalDetector {
  /** Unique key — maps to the corresponding function in rules. */
  key: string;
  /** Free-text description of what this matcher detects (for LLM-based systems). */
  description: string;
  /** Simple keyword strings to scan for (case-insensitive substring match). */
  keywords: string[];
  /** Optional regex patterns for more precise matching. */
  patterns?: RegExp[];
}

/**
 * Represents the unified context in which a Rule is triggered.
 * Receives both the player intents (if any) and the parsed LLM summary data.
 */
export interface TurnContext {
  /** Detected player intents for this rule key (actions, emotions, etc.) */
  playerSignals: Signal[];
  /** The current condition/scenario of the engine (e.g., 'combat') */
  currentCondition: string;
  /** The key of the aspect function currently being executed in the sequence */
  ruleKey: string;
  /** The matching effect data from the LLM narration summary (if matched by effectDefinition) */
  worldSignal: Signal | null;
  /** The type check results for the effect data (if any) */
  typeCheck: Record<string, unknown> | null;
  /** The full raw narration summary object */
  narrationSummary: Record<string, unknown>;
}

/* Cartridge is defined below together with effect-driven types. */


/** 
 * Cartridge-specific understanding of the raw LLM NarrationSummary.
 */
export interface SceneReading {
  suggestedCondition: string | null;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
}


/**
 * Standardized output of the game play loop for each rule execution.
 *
 * This is the generic output that any system can consume to instruct
 * the LLM narration engine.  Every rule in the cartridge's ruleOrder
 * produces exactly one NarrationDirective, even when it has nothing to do.
 *
 * - mustHappen:   Narration elements that MUST appear (e.g. "player takes 15 damage").
 * - mustNotHappen: Narration elements that MUST NOT appear (e.g. "do not narrate player drinking a potion").
 * - mayHappen:    Narration elements that MAY appear (e.g. "you may narrate the goblin calling for help").
 */
interface NarrationDirective {
  /** The rule key that produced this event. */
  ruleKey: string;
  /** Things that MUST be narrated. */
  mustHappen: string[];
  /** Things that MUST NOT be narrated. */
  mustNotHappen: string[];
  /** Things that MAY be narrated. */
  mayHappen: string[];
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
export interface NarrationSummary {
  /** ISO 8601 duration – how much in-game time passed this narration turn (e.g. "PT5M"). */
  elapsed_time: string;
  /** Integer flags emitted by the LLM (0 = false, 1 = true, etc.). */
  flags: Record<string, number>;
  /** Arbitrary string tags emitted by the LLM. */
  tags: Record<string, string>;
  /** Numeric meters emitted by the LLM (e.g. tension, distance). */
  meters: Record<string, number>;
  /** Structured effects array reported by the LLM for aspect-function processing. */
  effects?: Signal[];
}

/**
 * Interface that each platform adapter must implement.
 *
 * Different AI platforms (Janitor AI, SillyTavern, AI Dungeon) have
 * different ways to access player input, modify prompts to the AI,
 * and persist game state. Each platform adapter encapsulates these
 * platform-specific details.
 */
interface Platform {
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
   * last narration response and return it as a `NarrationSummary`.
   * The exact field / mechanism used to locate the block differs per platform.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): NarrationSummary | null;

  /**
   * Attempts to deduce the player's structured intent from their raw chat message.
   * Useful for platforms that allow hidden LLM prompts (like SillyTavern).
   * Returns null if the platform does not support advanced intent deduction.
   */
  deducePlayerIntent?(
    rawMessage: string,
    matchers: SignalDetector[]
  ): Promise<Signal[] | null> | Signal[] | null;

  /**
   * Apply the accumulated game play loop output to the platform's context.
   *
   * The platform adapter converts the generic `NarrationDirective[]` into whatever
   * mutations the underlying platform requires (prompt fields, memory slots,
   * system-prompt injections, etc.).
   *
   * @param events - All NarrationDirectives produced by the current turn, one per rule.
   * @param state - The game state after all side effects have been applied.
   * @param effectInstructions - Pre-formatted effect instruction string generated
   *   by calling `generateEffectInstruction` on each SignalSchema.
   */
  applyGamePlayOutput(
    events: NarrationDirective[],
    state: State,
    effectInstructions: string
  ): void;
}

// ---- Effect-driven state management types ----

/** A single stat impact: which stat to change, what operation, and what value. */
interface StatImpact {
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
interface SideEffect {
  /** Description of the side effect. */
  what: string;
  /** True if the effect is temporary (will be reverted after expiry). */
  temp: boolean;
  /** Array of stat impacts to apply. */
  impacts: StatImpact[];
  /** ISO datetime when a temporary effect expires. Only required when temp is true. */
  expiry?: string;
  /** Stat keys that prevent this effect from expiring while they are truthy. */
  re_lock?: string[];
}

/** The result returned by an aspect function. */
interface RuleOutcome {
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
  stateMutations: SideEffect[];
}

/** The game state persisted across turns. */
interface State {
  /** Current in-game timestamp in ISO format. */
  timestamp: string;
  /** All tracked stat values (hp, gold, strength, custom flags, etc.). */
  stats: Record<string, number>;
  /** Array of active temporary side effects with expiry tracking. */
  activeConditions: StoredSideEffect[];
  /** Boolean flags for game state tracking. */
  flags: string[];
}

/** A stored side effect entry in the game state's activeConditions[] array. */
interface StoredSideEffect {
  /** Description of the effect. */
  desc: string;
  /** ISO datetime when the effect expires. */
  expiry: string | null;
  /** Stat keys that prevent this effect from expiring while they are truthy. */
  re_lock: string[] | null;
  /** Array of impacts with original values for reversion. */
  impacts: StoredStatImpact[];
}

/** An impact entry stored for later reversion, includes original value. */
interface StoredStatImpact {
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
interface SignalSchema {
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
type Rule = (
  state: State,
  context: TurnContext
) => RuleOutcome;

/**
 * Extended game cartridge that includes effect-driven state management.
 * Adds effect definitions, aspect functions, a default character sheet,
 * and turn-end triggers on top of the base Cartridge.
 */
interface Cartridge {
  /** Human-readable name of this game system. */
  name: string;
  /** Version string. */
  version: string;
  /** Conditions under which the AI should stop narrating and hand control to the player. */
  breakpoints: string[];
  /**
   * Matchers that describe how to detect player intents from free text.
   * Each matcher's `key` maps to a corresponding function in `rules`.
   */
  signalDetectors: SignalDetector[];

  /** Default character sheet used when no prior state exists. */
  defaultState: State;
  /** Definitions of effects the LLM can report in NARRATION_SUMMARY. */
  signalSchemas: SignalSchema[];
  /** Aspect functions keyed by effect definition key. Called in signalSchemas order. */
  rules: Record<string, Rule>;
  /** 
   * The explicit order in which rules should be evaluated.
   * Can interleave world simulation aspects with player actions.
   * e.g., ['time_advance', 'weather_change', 'player_action', 'enemy_attack']
   */
  ruleOrder: string[];
}

export {
  Signal,
  SignalDetector,
  Cartridge,
  NarrationDirective,
  Platform,
  StatImpact,
  SideEffect,
  RuleOutcome,
  State,
  StoredSideEffect,
  StoredStatImpact,
  SignalSchema,
  Rule
};
