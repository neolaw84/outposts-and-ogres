import { Character } from './character';

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
}

const rpgSystem = new OutpostsAndOgres();

rpgSystem.createCharacter('Hero', 150);

export default rpgSystem;
export { Character };
