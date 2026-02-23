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
export { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from '../../utils/base64';
export {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  renderSchemaInstruction,
  findSignalByKey,
  validateSignalTypes
} from '../../utils/llm-utils';
import { extractMatch } from '../../utils/text-utils';
import { JanitorAIAdapter, runJanitorAILoop } from './index';
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

export { extractMatch, JanitorAIAdapter, runJanitorAILoop };

declare const context: Record<string, unknown>;

if (typeof context !== 'undefined') {
  runJanitorAILoop(context, rpgSystem.createGameEngine());
}

declare const globalThis: any;
if (typeof globalThis !== 'undefined') {
  globalThis.__outpostsCartridge = cartridge;
}
