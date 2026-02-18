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
    return new GamePlayScript(basicFantasyCartridge);
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
  DiceRollResult,
  ActionResult,
  CartridgeRule,
  GameCartridge,
  OutputPrompt,
  SystemAdapter
} from './types';
export { rollDie, rollDice, sumRolls } from './utils/dice';
export { parsePlayerInput } from './utils/input-parser';
export { JanitorAIAdapter } from './systems/janitorai/index';
export { SillyTavernAdapter } from './systems/sillytavern/index';
export { AIDungeonAdapter } from './systems/aidungeon/index';
