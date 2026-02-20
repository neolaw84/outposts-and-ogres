import { Character } from '../../character';
import { GamePlayScript } from '../../systems/game-play-script';
import { basicFantasyCartridge } from '../../cartridges/basic-fantasy';
import { mapBasicFantasyJanitorAI } from '../../prompt-mappers/basic-fantasy/janitorai';
import { CharacterSheet } from '../../types';
import { getDow, formatDate12Hr } from '../../utils/time-utils';

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
    return new GamePlayScript(basicFantasyCartridge, mapBasicFantasyJanitorAI);
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
  DiceRollResult,
  ActionResult,
  CartridgeRule,
  GameCartridge,
  OutputPrompt,
  SystemAdapter,
  CharacterSheet,
  SideEffect,
  Impact,
  EffectDefinition,
  AspectFunction,
  AspectFunctionResult
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
export { applySideEffect, revertSideEffect } from '../../core/character-sheet';
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
  let rpState: CharacterSheet | null = (loadedState && (loadedState as Record<string, unknown>)['cur_ts'])
    ? loadedState as unknown as CharacterSheet
    : null;
  const scenarioUpdate = adapter.getScenarioUpdate();

  const dataCorrupted = !rpState || !rpState.cur_ts;

  if (!rpState || !rpState.cur_ts) {
    rpState = JSON.parse(JSON.stringify(cartridge.defaultCharacterSheet)) as CharacterSheet;
  }

  // Build a narration summary in the format expected by processEffects
  let naSum: Record<string, unknown> = {
    elapsed_time: 'PT1M',
    effects: []
  };
  if (scenarioUpdate) {
    naSum = {
      elapsed_time: scenarioUpdate.elapsed_time || 'PT1M',
      effects: scenarioUpdate.effects || [],
      flags: scenarioUpdate.flags || {},
      tags: scenarioUpdate.tags || {},
      meters: scenarioUpdate.meters || {}
    };
  }

  // 2. PROCESS – Apply time, revert expired effects, process aspect functions
  const processed = script.processEffects(rpState, naSum);
  rpState = processed.sheet;
  const effectNarrationGuide = processed.narrationGuide;

  // 3. INPUT/OUTPUT – Standard action processing
  const playerMsg = adapter.getPlayerMessage();

  if (dataCorrupted) {
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
        corruptionInfo += '\n\nHelp the user identify where to retry by quoting this message to delete and retry from:\n"' +
          msgToRetry.substring(0, 200) + '..."';
      }
    }
    character['scenario'] = corruptionInfo;
    context['character'] = character;
  } else {
    // Process player action if available
    let actionPrompt: import('../../types').OutputPrompt | null = null;
    if (playerMsg) {
      actionPrompt = script.processTurn(playerMsg);
    }

    // 4. ENCODE – Save state
    adapter.saveState(rpState as unknown as Record<string, unknown>);

    // 5. INJECT – Apply prompt with effect narration guide + action prompt
    if (actionPrompt) {
      adapter.applyPrompt(actionPrompt);
    }

    // Build and prepend the effect-driven narration guide
    const character = (context['character'] || {}) as Record<string, unknown>;
    const existingScenario = (character['scenario'] || '') as string;

    let turnEndInstructions = '';
    if (cartridge.turnEndTriggers && cartridge.turnEndTriggers.length > 0) {
      turnEndInstructions = '\nIf any of the following events occur, you MUST narrate it briefly and then IMMEDIATELY END this turn (provide NARRATION_SUMMARY):\n';
      for (let i = 0; i < cartridge.turnEndTriggers.length; i++) {
        turnEndInstructions += '- ' + cartridge.turnEndTriggers[i] + '\n';
      }
      turnEndInstructions += 'Do not narrate past these events. Wait for the script to process them.\n';
    }

    // Build narration summary instructions from effect definitions
    let effectInstructions = '';
    for (let i = 0; i < cartridge.effectDefinitions.length; i++) {
      const def = cartridge.effectDefinitions[i];
      const jsonBlock: Record<string, unknown> = {};
      const keys = Object.keys(def);
      for (let j = 0; j < keys.length; j++) {
        if (keys[j] !== 'condition') {
          jsonBlock[keys[j]] = def[keys[j]];
        }
      }
      effectInstructions += '\nIf ' + def.condition + ', include in "effects":\n' +
        JSON.stringify(jsonBlock, null, 2) + '\n';
    }

    const narrationGuide = '\n\nThis is the narration guide for you to follow (for this response):\n\n' +
      '[NARRATION_GUIDE]\n' +
      '"In-Game Date/Time: ' + getDow(rpState.cur_ts) + ' ' + formatDate12Hr(rpState.cur_ts) + '."\n\n' +
      effectNarrationGuide +
      turnEndInstructions +
      '[/NARRATION_GUIDE]\n\n' +
      '**YOU MUST NEVER CONTRADICT OR CONFLICT WITH ANY PART OF THE NARRATION GUIDE.**\n\n' +
      'However, feel free to be creative and add more details to the story as long as it doesn\'t conflict with the narration guide.\n\n' +
      effectInstructions;

    character['scenario'] = narrationGuide + existingScenario;
    context['character'] = character;
  }
}
