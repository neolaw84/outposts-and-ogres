import { Character } from '../../character';
import { GameEngine } from '../../engine';
import cartridge from '@cartridge';
import { State } from '../../types';

class OutpostsAndOgres {
  private version: string;

  constructor() {
    this.version = '1.0.0';
  }

  public getVersion(): string {
    return this.version;
  }

  public createCharacter(name: string, maxHealth?: number): Character {
    return new Character(name, maxHealth);
  }

  public createGameEngine(): GameEngine {
    return new GameEngine(cartridge);
  }
}

const rpgSystem = new OutpostsAndOgres();

export default rpgSystem;
export { Character };
export { GameEngine } from '../../engine';
export { cartridge };
export {
  Cartridge,
  Platform,
  State,
  SideEffect,
  StatImpact,
  SignalSchema,
  Rule,
  RuleOutcome,
  NarrationDirective,
  Signal,
  SignalDetector
} from '../../types';
export { rollDie, rollDice, sumRolls } from '../../utils/dice';
export { detectSignals } from '../../signals/detect';
export { AIDungeonAdapter } from './index';

declare const state: any;
declare const context: any;

export function onoOnInput(text: string) {
  // Ignore text parameter
  const adapter = new (require('./index').AIDungeonAdapter)(context);
  // Extract input and detect signals
  const playerMsg = adapter.getPlayerMessage(); // Will get from state.raw_input_text eventually
  if (playerMsg) {
    const engine = rpgSystem.createGameEngine();
    const runtimeCartridge = engine.getCartridge();
    const signals = adapter.deducePlayerIntent(playerMsg, runtimeCartridge.signalDetectors);
    state.signals = signals; // Store signals for later
  }
  return { text };
}

export function onoContext(text: string) {
  // Ignore text parameter - usual full before LLM call processing hook.
  const adapter = new (require('./index').AIDungeonAdapter)(context);
  const engine = rpgSystem.createGameEngine();
  const runtimeCartridge = engine.getCartridge();

  const loadedState = adapter.loadState();
  let rpState: State | null = (loadedState && (loadedState as any)['timestamp'])
    ? loadedState as unknown as State
    : null;

  if (!rpState || !rpState.timestamp) {
    rpState = JSON.parse(JSON.stringify(runtimeCartridge.defaultState)) as State;
  }

  const scenarioUpdate = adapter.getScenarioUpdate();
  let narrationSummary: any = { elapsed_time: 'PT1M', effects: [] };
  if (scenarioUpdate) {
    narrationSummary = { ...scenarioUpdate };
  }

  const playerMsg = adapter.getPlayerMessage();
  if (playerMsg) {
    let preParsedIntents = Array.isArray(state.signals) ? state.signals : null;
    const turnResult = engine.executeTurn(playerMsg, rpState, narrationSummary, preParsedIntents);

    adapter.saveState(turnResult.newState as any);
    adapter.applyGamePlayOutput(turnResult.directives, turnResult.newState, turnResult.schemaInstructions);

    // Cleanup
    state.raw_text_input = '';
    state.signals = [];
  } else {
    adapter.saveState(rpState as any);
  }

  return { text };
}

export function onoOnOutput(text: string) {
  // Ignore text parameter
  return { text };
}
