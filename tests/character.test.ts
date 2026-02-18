import { Character } from '../src/character';

describe('Character', () => {
  test('should create a character with default health', () => {
    const character = new Character('Hero');
    expect(character.getName()).toBe('Hero');
    expect(character.getHealth()).toBe(100);
    expect(character.getMaxHealth()).toBe(100);
    expect(character.getLevel()).toBe(1);
  });

  test('should create a character with custom health', () => {
    const character = new Character('Warrior', 150);
    expect(character.getName()).toBe('Warrior');
    expect(character.getHealth()).toBe(150);
    expect(character.getMaxHealth()).toBe(150);
  });

  test('should take damage correctly', () => {
    const character = new Character('Hero');
    character.takeDamage(30);
    expect(character.getHealth()).toBe(70);
    expect(character.isAlive()).toBe(true);
  });

  test('should not go below 0 health', () => {
    const character = new Character('Hero');
    character.takeDamage(150);
    expect(character.getHealth()).toBe(0);
    expect(character.isAlive()).toBe(false);
  });

  test('should heal correctly', () => {
    const character = new Character('Hero');
    character.takeDamage(50);
    character.heal(30);
    expect(character.getHealth()).toBe(80);
  });

  test('should not heal above max health', () => {
    const character = new Character('Hero');
    character.heal(50);
    expect(character.getHealth()).toBe(100);
  });

  test('should level up correctly', () => {
    const character = new Character('Hero');
    character.takeDamage(50);
    character.levelUp();
    expect(character.getLevel()).toBe(2);
    expect(character.getMaxHealth()).toBe(110);
    expect(character.getHealth()).toBe(110);
  });
});
