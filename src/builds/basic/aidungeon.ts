import { Character } from '../../character';
import { GamePlayScript } from '../../systems/game-play-script';
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
  GameCartridge,
  SystemAdapter,
  GameState,
  ActiveCondition,
  StatModifier,
  WorldEventTracker,
  GameRule,
  RuleResolution,
  GamePlayEvent,
  EffectRecord,
  InputMatcher
} from '../../types';
export { rollDie, rollDice, sumRolls } from '../../utils/dice';
export { parsePlayerInput } from '../../inputs/input-matcher';
export { AIDungeonAdapter } from '../../systems/aidungeon/index';
