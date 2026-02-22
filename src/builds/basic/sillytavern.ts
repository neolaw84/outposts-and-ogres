import { Character } from '../../character';
import { GameEngine } from '../../engine';
import { basicFantasyCartridge } from '../../cartridges/basic-fantasy';

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
    return new GameEngine(basicFantasyCartridge);
  }
}

const rpgSystem = new OutpostsAndOgres();

export default rpgSystem;
export { Character };
export { GameEngine } from '../../engine';
export { basicFantasyCartridge } from '../../cartridges/basic-fantasy';
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
export { SillyTavernAdapter } from '../../platform/sillytavern/index';
