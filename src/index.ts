import { Character } from './character';
import { GamePlayScript } from './systems/game-play-script';
import { basicFantasyCartridge } from './cartridges/basic-fantasy';

/**
 * OutpostsAndOgres - Foundation RPG System
 * A foundation RPG script for Janitor AI and SillyTavern clones
 */
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
    void basicFantasyCartridge;
    throw new Error(
      'GamePlayScript composition is build-time only. Use a composed bundle (e.g. build:basic:aidungeon) that binds cartridge and system mapper.'
    );
  }
}

const rpgSystem = new OutpostsAndOgres();

rpgSystem.createCharacter('Hero', 150);

export default rpgSystem;
export { Character };
export { GamePlayScript } from './systems/game-play-script';
export { basicFantasyCartridge } from './cartridges/basic-fantasy';
export {
  Message,
  ParsedAction,
  CartridgeRule,
  GameCartridge,
  OutputPrompt,
  SystemAdapter,
  ScenarioUpdate,
  Impact,
  SideEffect,
  AspectFunctionResult,
  GameState,
  StoredSideEffect,
  StoredImpact,
  EffectDefinition,
  AspectFunction
} from './types';
export { rollDie, rollDice, sumRolls } from './utils/dice';
export { parsePlayerInput } from './utils/input-parser';
export { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from './utils/base64';
export {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey,
  cleanInput
} from './utils/llm-utils';
export { extractMatch } from './utils/text-utils';
export {
  parseActionInput,
  detectEmotionSignals,
  understandScenario,
  understandPlayerInput
} from './inputs';
export { JanitorAIAdapter } from './systems/janitorai/index';
export { SillyTavernAdapter } from './systems/sillytavern/index';
export { AIDungeonAdapter } from './systems/aidungeon/index';
export { applySideEffect, revertSideEffect } from './core/game-state';
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
} from './utils/time-utils';
