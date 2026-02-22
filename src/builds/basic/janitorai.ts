import { Character } from '../../character';
import { GamePlayScript } from '../../systems/game-play-script';
import { basicFantasyCartridge } from '../../cartridges/basic-fantasy';
import { GameState } from '../../types';

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

  public createGamePlayScript(): GamePlayScript {
    return new GamePlayScript(basicFantasyCartridge);
  }
}

const rpgSystem = new OutpostsAndOgres();

export default rpgSystem;
export { Character };
export { GamePlayScript } from '../../systems/game-play-script';
export { basicFantasyCartridge } from '../../cartridges/basic-fantasy';
export {
  Message,
  ParsedAction,
  GameCartridge,
  OutputPrompt,
  SystemAdapter,
  GameState,
  ActiveCondition,
  StatModifier,
  WorldEventTracker,
  GameRule,
  RuleResolution,
  GamePlayEvent
} from '../../types';
export { rollDie, rollDice, sumRolls } from '../../utils/dice';
export { parseActionInput } from '../../inputs/action-parser';
export { parsePlayerInput } from '../../utils/input-parser';
export { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from '../../utils/base64';
export {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey,
  cleanInput
} from '../../utils/llm-utils';
import { extractMatch } from '../../utils/text-utils';
import { JanitorAIAdapter } from '../../systems/janitorai/index';
export { applySideEffect, revertSideEffect } from '../../core/game-state';
export {
  parseDuration,
  addDuration,
  isPast,
  isValidDateStr,
  isValidDurationStr,
  formatDate,
  formatDate12Hr,
  getDow,
  clampTime,
  getMidnightsPassed
} from '../../utils/time-utils';

export { extractMatch, JanitorAIAdapter };

// ------------------------------------------------------------------
// DRIVER SCRIPT
// ------------------------------------------------------------------

declare const context: Record<string, unknown>;

// Only execute if we are in the JanitorAI environment (context is present)
if (typeof context !== 'undefined') {
  const adapter = new JanitorAIAdapter(context);
  const script = rpgSystem.createGamePlayScript();
  const cartridge = script.getCartridge();

  // 1. DECODE – Extract state and narration summary from chat history
  const loadedState = adapter.loadState();
  let rpState: GameState | null = (loadedState && (loadedState as Record<string, unknown>)['timestamp'])
    ? loadedState as unknown as GameState
    : null;
  const scenarioUpdate = adapter.getScenarioUpdate();

  const dataCorrupted = !rpState || !rpState.timestamp;

  if (!rpState || !rpState.timestamp) {
    rpState = JSON.parse(JSON.stringify(cartridge.defaultGameState)) as GameState;
  }

  // Build a narration summary in the format expected by processEffects
  let narrationSummary: Record<string, unknown> = {
    elapsed_time: 'PT1M',
    effects: []
  };
  if (scenarioUpdate) {
    narrationSummary = {
      elapsed_time: scenarioUpdate.elapsed_time || 'PT1M',
      effects: scenarioUpdate.effects || [],
      flags: scenarioUpdate.flags || {},
      tags: scenarioUpdate.tags || {},
      meters: scenarioUpdate.meters || {}
    };
  }

  // 2. PROCESS EFFECTS AND ACTION via Unified executeTurn Sequence
  const playerMsg = adapter.getPlayerMessage();

  if (!dataCorrupted && playerMsg) {
    let preParsedAction: import('../../types').ParsedAction[] | null = null;
    if (adapter.deducePlayerIntent) {
      const actions = cartridge.availableActions[script.getCondition()] || [];
      const deduced = adapter.deducePlayerIntent(playerMsg, actions);
      if (!(deduced instanceof Promise)) {
        preParsedAction = deduced;
      }
    }
    const turnResult = script.executeTurn(playerMsg, rpState as GameState, narrationSummary, preParsedAction);
    rpState = turnResult.newState;

    // 4. ENCODE & INJECT
    adapter.saveState(rpState as unknown as Record<string, unknown>);
    adapter.applyGamePlayOutput(turnResult.gamePlayEvents, rpState, turnResult.conditionsToReportBack);
  } else if (dataCorrupted) {
    // Handle data corruption
    const character = (context['character'] || {}) as Record<string, unknown>;
    character['personality'] = 'You are a fair game master that ALWAYS AND PROMPTLY INFORMS the player {{user}} when ' +
      'there is data corruption. After you have informed, the player will restart from 1 or 2 turns ago.';

    let corruptionInfo = 'Your next response must be to tell {{user}} that there is data corruption and ' +
      'she must restart from the corruption point.';

    const chat = context['chat'] as Record<string, unknown> | undefined;
    if (chat) {
      const msgs = chat['last_messages'] as Array<Record<string, unknown>> | undefined;
      if (msgs && msgs.length >= 3) {
        const msgToRetry = (msgs[msgs.length - 3]['message'] || '') as string;
        corruptionInfo += '\\n\\nHelp the user identify where to retry by quoting this message to delete and retry from:\\n"' +
          msgToRetry.substring(0, 200) + '..."';
      }
    }
    character['scenario'] = corruptionInfo;
    context['character'] = character;
  } else {
    // No player message and no corruption – just save state
    adapter.saveState(rpState as unknown as Record<string, unknown>);
  }
}
