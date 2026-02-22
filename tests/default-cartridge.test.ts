import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';

describe('Basic Fantasy Cartridge', () => {
  test('should have a name and version', () => {
    expect(basicFantasyCartridge.name).toBe('Outposts & Ogres – Basic');
    expect(basicFantasyCartridge.version).toBe('1.0.0');
  });

  test('should define three stop conditions', () => {
    expect(basicFantasyCartridge.stopConditions).toContain('combat');
    expect(basicFantasyCartridge.stopConditions).toContain('exploration');
    expect(basicFantasyCartridge.stopConditions).toContain('social');
  });

  test('should have inputMatchers for combat, social and exploration actions', () => {
    const keys = basicFantasyCartridge.inputMatchers.map(m => m.key);
    expect(keys).toContain('attack');
    expect(keys).toContain('dodge');
    expect(keys).toContain('cast');
    expect(keys).toContain('persuade');
    expect(keys).toContain('search');
    expect(keys).toContain('move');
  });

  test('should have defined aspect functions for specific actions like attack', () => {
    expect(basicFantasyCartridge.gameRules['attack']).toBeDefined();
  });
});
