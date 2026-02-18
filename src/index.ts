import { Character } from './character';
import { GamePlayScript } from './systems/game-play-script';
import { defaultCartridge } from './systems/default-cartridge';

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
    return new GamePlayScript(defaultCartridge);
  }
}

const rpgSystem = new OutpostsAndOgres();

rpgSystem.createCharacter('Hero', 150);

export default rpgSystem;
export { Character };
export { GamePlayScript } from './systems/game-play-script';
export { defaultCartridge } from './systems/default-cartridge';
export {
  Message,
  ParsedAction,
  DiceRollResult,
  ActionResult,
  CartridgeRule,
  GameCartridge,
  OutputPrompt
} from './systems/types';
export { rollDie, rollDice, sumRolls } from './systems/dice';
export { parsePlayerInput } from './systems/input-parser';
