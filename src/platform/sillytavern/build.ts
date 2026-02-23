import { Character } from '../../character';
import { GameEngine } from '../../engine';
import cartridge from '@cartridge';

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
export { SillyTavernAdapter } from './index';

declare const globalThis: any;

function initSillyTavern() {
  const stGlobal = globalThis as any;
  const ST = stGlobal.SillyTavern;
  if (!ST) return;

  const { eventSource, event_types, getContext } = ST;

  // Intercept generation to inject schema instructions / handle pre-turn
  stGlobal.onOgresGenerationProxy = async function (chat: any, contextSize: any, abort: any, type: any) {
    if (type === 'quiet') return;

    const context = getContext();
    const adapter = new (require('./index').SillyTavernAdapter)({ chat });
    const playerMsg = adapter.getPlayerMessage();

    if (playerMsg) {
      const engine = rpgSystem.createGameEngine();
      const runtimeCartridge = engine.getCartridge();

      // Ask LLM to extract signals from player message using quiet prompt
      let signals: import('../../types').Signal[] | null = null;
      if (runtimeCartridge.signalDetectors && runtimeCartridge.signalDetectors.length > 0) {
        try {
          // Prepare quiet prompt context
          const detectorLines = runtimeCartridge.signalDetectors.map(d => `- ${d.key}: ${d.description || 'Detects ' + d.key}`).join('\n');
          const quietPrompt = `Analyze the following user input and detect any intended actions based on these rules:\n${detectorLines}\n\nInput: "${playerMsg}"\n\nReturn ONLY a JSON array of objects with 'key' and optional 'what' targeting the action.`;

          const result = await context.generateQuietPrompt({ quietPrompt });
          if (result) {
            signals = JSON.parse(result);
          }
        } catch (e) {
          console.error("Failed to deduce player intents via quiet prompt:", e);
        }
      }

      const loadedState = adapter.loadState();
      let rpState: import('../../types').State | null = (loadedState && (loadedState as any)['timestamp'])
        ? loadedState as unknown as import('../../types').State
        : null;

      if (!rpState || !rpState.timestamp) {
        rpState = JSON.parse(JSON.stringify(runtimeCartridge.defaultState));
      }

      const narrationSummary = adapter.getScenarioUpdate() || { elapsed_time: 'PT1M', effects: [] };
      const turnResult = engine.executeTurn(playerMsg, rpState!, narrationSummary, signals);

      adapter.saveState(turnResult.newState as any);
      adapter.applyGamePlayOutput(turnResult.directives, turnResult.newState, turnResult.schemaInstructions);

      const systemPrompt = (adapter as any).context['systemPrompt'];
      if (systemPrompt) {
        const systemNote = {
          is_user: false,
          name: "System",
          send_date: Date.now(),
          mes: systemPrompt
        };
        chat.splice(chat.length - 1, 0, systemNote);
      }
    }
  };

  // Process and cleanup message received from LLM
  eventSource.on(event_types.MESSAGE_RECEIVED, async (mes: any) => {
    // Determine if the message has our JSON payload
    const { extractNarrationSummary } = require('../../utils/llm-utils');
    const raw = extractNarrationSummary(mes.mes || null);

    if (raw) {
      // Save this summary for the next turn
      const adapter = new (require('./index').SillyTavernAdapter)({});
      const stContext = ST.getContext();
      if (stContext?.chatMetadata) {
        const extensionData = (stContext.chatMetadata['outposts-and-ogres-state'] || {}) as Record<string, unknown>;
        extensionData['lastNarrationSummary'] = {
          elapsed_time: (raw['elapsed_time'] as string) || 'PT0S',
          flags: (raw['flags'] as Record<string, number>) || {},
          tags: (raw['tags'] as Record<string, string>) || {},
          meters: (raw['meters'] as Record<string, number>) || {},
          effects: (raw['effects'] as import('../../types').Signal[]) || []
        };
        stContext.chatMetadata['outposts-and-ogres-state'] = extensionData;
        if (typeof stContext.saveMetadata === 'function') stContext.saveMetadata();
      }

      // Hide JSON payload from the user output
      const jsonStartMatch = mes.mes.match(/```json/i);
      if (jsonStartMatch) {
        mes.mes = mes.mes.substring(0, jsonStartMatch.index).trim();
      }
    }
  });
}

// Attach init on script load to hook UI extension events
if (globalThis.SillyTavern) {
  initSillyTavern();
} else if (typeof globalThis.addEventListener === 'function') {
  // Wait for DOM or app setup if loaded earlier
  globalThis.addEventListener('load', () => setTimeout(initSillyTavern, 100));
}
