import { defaultCartridge } from '../src/systems/default-cartridge';

describe('Default Cartridge', () => {
  test('should have a name and version', () => {
    expect(defaultCartridge.name).toBe('Outposts & Ogres – Basic');
    expect(defaultCartridge.version).toBe('1.0.0');
  });

  test('should define three stop conditions', () => {
    expect(defaultCartridge.stopConditions).toContain('combat');
    expect(defaultCartridge.stopConditions).toContain('exploration');
    expect(defaultCartridge.stopConditions).toContain('social');
  });

  test('should have available actions for each condition', () => {
    expect(defaultCartridge.availableActions['combat'].length).toBeGreaterThan(0);
    expect(defaultCartridge.availableActions['exploration'].length).toBeGreaterThan(0);
    expect(defaultCartridge.availableActions['social'].length).toBeGreaterThan(0);
  });

  test('should have rules for combat actions', () => {
    const combatRules = defaultCartridge.rules.filter(function (r) {
      return r.condition === 'combat';
    });
    expect(combatRules.length).toBe(5);
  });

  test('should have rules for exploration actions', () => {
    const explorationRules = defaultCartridge.rules.filter(function (r) {
      return r.condition === 'exploration';
    });
    expect(explorationRules.length).toBe(5);
  });

  test('should have rules for social actions', () => {
    const socialRules = defaultCartridge.rules.filter(function (r) {
      return r.condition === 'social';
    });
    expect(socialRules.length).toBe(5);
  });

  test('each rule should have required fields', () => {
    for (let i = 0; i < defaultCartridge.rules.length; i++) {
      const rule = defaultCartridge.rules[i];
      expect(rule.condition).toBeTruthy();
      expect(rule.action).toBeTruthy();
      expect(rule.diceCount).toBeGreaterThan(0);
      expect(rule.diceSides).toBeGreaterThan(0);
      expect(rule.difficulty).toBeGreaterThan(0);
      expect(rule.successPrompt).toBeTruthy();
      expect(rule.failurePrompt).toBeTruthy();
    }
  });
});
