import { Character } from './character';
import { GameEngine } from './engine';
import { basicFantasyCartridge } from './cartridges/basic-fantasy';

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
    void basicFantasyCartridge;
    throw new Error(
      'GameEngine composition is build-time only. Use a composed bundle (e.g. build:basic:aidungeon) that binds cartridge and system mapper.'
    );
  }
}

const rpgSystem = new OutpostsAndOgres();

rpgSystem.createCharacter('Hero', 150);

export default rpgSystem;
export { Character };
export { GameEngine } from './engine';
export { basicFantasyCartridge } from './cartridges/basic-fantasy';
export {
  Signal,
  SignalDetector,
  Cartridge,
  Platform,
  NarrationSummary,
  StatImpact,
  SideEffect,
  RuleOutcome,
  State,
  StoredSideEffect,
  StoredStatImpact,
  SignalSchema,
  Rule,
  NarrationDirective
} from './types';
export { rollDie, rollDice, sumRolls } from './utils/dice';
export { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from './utils/base64';
export {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  renderSchemaInstruction,
  findSignalByKey,
  validateSignalTypes
} from './utils/llm-utils';
export { extractMatch } from './utils/text-utils';
export {
  detectSignals,
  readScene
} from './signals';
export { JanitorAIAdapter } from './platform/janitorai/index';
export { SillyTavernAdapter } from './platform/sillytavern/index';
export { AIDungeonAdapter } from './platform/aidungeon/index';
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
