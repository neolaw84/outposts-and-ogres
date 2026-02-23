import rpgSystem from '../../src/index';

describe('OutpostsAndOgres', () => {
  test('should have a version', () => {
    expect(rpgSystem.getVersion()).toBe('1.0.0');
  });

  test('should create a character', () => {
    const character = rpgSystem.createCharacter('TestHero');
    expect(character.getName()).toBe('TestHero');
    expect(character.getHealth()).toBe(100);
  });

  test('should create a character with custom health', () => {
    const character = rpgSystem.createCharacter('TestWarrior', 200);
    expect(character.getName()).toBe('TestWarrior');
    expect(character.getHealth()).toBe(200);
  });
});
