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

  test('should have available actions for each condition', () => {
    expect(basicFantasyCartridge.availableActions['combat'].length).toBeGreaterThan(0);
    expect(basicFantasyCartridge.availableActions['exploration'].length).toBeGreaterThan(0);
    expect(basicFantasyCartridge.availableActions['social'].length).toBeGreaterThan(0);
  });

  test('should have defined aspect functions for specific actions like attack', () => {
    expect(basicFantasyCartridge.aspectFunctions['attack']).toBeDefined();
  });
});
