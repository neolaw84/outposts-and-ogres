/** Unified data envelope for effects, player intents, and LLM-reported events. */
interface Signal {
  key: string;
  what?: string;
  when?: string;
  meters?: Record<string, number>;
  flags?: Record<string, boolean>;
  tags?: Record<string, string>;
}

/** Describes how to detect a player intent from free text. Key maps to a rule. */
interface SignalDetector {
  key: string;
  description: string;
  keywords: string[];
  patterns?: RegExp[];
}

/** Context passed to a Rule during turn execution. */
export interface TurnContext {
  playerSignals: Signal[];
  currentCondition: string;
  ruleKey: string;
  worldSignal: Signal | null;
  typeCheck: Record<string, unknown> | null;
  narrationSummary: Record<string, unknown>;
}

export interface SceneReading {
  suggestedCondition: string | null;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
}


/** Per-rule output instructing the LLM what to narrate. */
interface NarrationDirective {
  ruleKey: string;
  mustHappen: string[];
  mustNotHappen: string[];
  mayHappen: string[];
}

/** Structured scenario-update block returned by the LLM. */
export interface NarrationSummary {
  elapsed_time: string;
  flags: Record<string, number>;
  tags: Record<string, string>;
  meters: Record<string, number>;
  effects?: Signal[];
}

/** Interface that each platform adapter must implement. */
interface Platform {
  readonly name: string;
  getPlayerMessage(): string | null;
  loadState(): Record<string, unknown>;
  saveState(state: Record<string, unknown>): void;
  getScenarioUpdate(): NarrationSummary | null;
  deducePlayerIntent?(
    rawMessage: string,
    matchers: SignalDetector[]
  ): Promise<Signal[] | null> | Signal[] | null;
  applyGamePlayOutput(
    events: NarrationDirective[],
    state: State,
    effectInstructions: string
  ): void;
}

interface StatImpact {
  stats: string;
  op: 'set' | 'add' | 'sub';
  val: number;
}

interface SideEffect {
  what: string;
  temp: boolean;
  impacts: StatImpact[];
  /** ISO datetime when a temporary effect expires. */
  expiry?: string;
  /** Stat keys that prevent expiry while truthy. */
  re_lock?: string[];
}

/** Result returned by a Rule. */
interface RuleOutcome {
  outcome: {
    status: 'success' | 'failure' | 'mixed' | 'neutral';
    mechanicsLogs: string[];
    mustHappen: string[];
    mustNotHappen: string[];
    mayHappen: string[];
    actionName?: string;
    actionTarget?: string;
  };
  stateMutations: SideEffect[];
}

interface State {
  timestamp: string;
  stats: Record<string, any>;
  activeConditions: StoredSideEffect[];
  flags: string[];
}

interface StoredSideEffect {
  desc: string;
  expiry: string | null;
  re_lock: string[] | null;
  impacts: StoredStatImpact[];
}

interface StoredStatImpact {
  stats: string;
  op: 'set' | 'add' | 'sub';
  val: number;
  oriVal: number;
}

/** Schema telling the LLM when and how to report a game event. */
interface SignalSchema {
  key: string;
  what: string;
  when?: string;
  meters?: Record<string, string>;
  flags?: Record<string, string>;
  tags?: Record<string, string>;
  condition: string;
  [prop: string]: unknown;
}

type Rule = (
  state: State,
  context: TurnContext
) => RuleOutcome;

interface Cartridge {
  name: string;
  version: string;
  breakpoints: string[];
  signalDetectors: SignalDetector[];
  defaultState: State;
  signalSchemas: SignalSchema[];
  rules: Record<string, Rule>;
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
