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

  test('should have rules for combat actions', () => {
    const combatRules = basicFantasyCartridge.rules.filter(function (r) {
      return r.condition === 'combat';
    });
    expect(combatRules.length).toBeGreaterThan(0);
  });

  test('should have rules for exploration actions', () => {
    const explorationRules = basicFantasyCartridge.rules.filter(function (r) {
      return r.condition === 'exploration';
    });
    expect(explorationRules.length).toBeGreaterThan(0);
  });

  test('should have rules for social actions', () => {
    const socialRules = basicFantasyCartridge.rules.filter(function (r) {
      return r.condition === 'social';
    });
    expect(socialRules.length).toBeGreaterThan(0);
  });

  test('each rule should have required fields', () => {
    for (let i = 0; i < basicFantasyCartridge.rules.length; i++) {
      const rule = basicFantasyCartridge.rules[i];
      expect(rule.condition).toBeTruthy();
      expect(rule.action).toBeTruthy();
      expect(rule.aspectFunction).toBeDefined();
    }
  });
});
