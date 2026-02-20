import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { CharacterSheet } from '../src/types';

function makeSheet(overrides?: Partial<CharacterSheet>): CharacterSheet {
  return JSON.parse(JSON.stringify({
    ...basicFantasyCartridge.defaultCharacterSheet,
    ...overrides,
    stats: {
      ...basicFantasyCartridge.defaultCharacterSheet.stats,
      ...(overrides && overrides.stats ? overrides.stats : {})
    }
  }));
}

describe('RPG Mechanics - Aspect Functions', () => {
  describe('drink_potion', () => {
    test('Healing potion restores HP', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultCharacterSheet.stats, hp: 50 } });
      const effect = {
        what: 'healing',
        meters: { potency: 5 }
      };
      const typeCheck = { what: true, meters: { potency: true } };

      const result = basicFantasyCartridge.aspectFunctions['drink_potion'](sheet, effect, typeCheck);

      expect(result.sideEffect).not.toBeNull();
      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact).toBeDefined();
      expect(impact!.op).toBe('add');
      expect(impact!.val).toBe(50); // 5 * 10 = 50
    });

    test('Healing potion does not overheal beyond max_hp', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultCharacterSheet.stats, hp: 95 } });
      const effect = {
        what: 'healing',
        meters: { potency: 5 }
      };
      const typeCheck = { what: true, meters: { potency: true } };

      const result = basicFantasyCartridge.aspectFunctions['drink_potion'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact!.val).toBe(5); // 100 - 95 = 5 (capped)
    });

    test('Healing potion at full health returns no side effect', () => {
      const sheet = makeSheet(); // hp = 100, max_hp = 100
      const effect = {
        what: 'healing',
        meters: { potency: 5 }
      };
      const typeCheck = { what: true, meters: { potency: true } };

      const result = basicFantasyCartridge.aspectFunctions['drink_potion'](sheet, effect, typeCheck);

      expect(result.narrationGuide).toContain('full health');
    });

    test('Strength potion adds temporary buff', () => {
      const sheet = makeSheet();
      const effect = {
        what: 'strength',
        meters: { potency: 2 },
        when: '1000-01-01T08:00:00'
      };
      const typeCheck = { what: true, meters: { potency: true }, when: true };

      const result = basicFantasyCartridge.aspectFunctions['drink_potion'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ temp: boolean; expiry: string; impacts: Array<{ stats: string; val: number }> }>;
      expect(effects[0].temp).toBe(true);
      expect(effects[0].expiry).toBeDefined();
      const impact = effects[0].impacts.find(i => i.stats === 'strength');
      expect(impact!.val).toBe(10); // 2 * 5
    });

    test('Poison sets poisoned flag temporarily', () => {
      const sheet = makeSheet();
      const effect = {
        what: 'poison',
        meters: { potency: 3 },
        when: '1000-01-01T08:00:00'
      };
      const typeCheck = { what: true, meters: { potency: true }, when: true };

      const result = basicFantasyCartridge.aspectFunctions['drink_potion'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ temp: boolean; impacts: Array<{ stats: string; op: string; val: number }> }>;
      expect(effects[0].temp).toBe(true);
      const impact = effects[0].impacts.find(i => i.stats === 'poisoned');
      expect(impact!.op).toBe('set');
      expect(impact!.val).toBe(1);
      expect(result.narrationGuide).toContain('Poisoned');
    });

    test('Null effect returns ambient narration guide', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.aspectFunctions['drink_potion'](sheet, null, null);

      expect(result.narrationGuide).toContain('potion');
      expect(result.sideEffect).toBeNull();
    });
  });

  describe('combat_event', () => {
    test('Enemy attack deals damage reduced by defense', () => {
      const sheet = makeSheet();
      const effect = {
        what: 'enemy_attack',
        meters: { damage: 20 },
        flags: { critical: false }
      };
      const typeCheck = { what: true, meters: { damage: true }, flags: { critical: true } };

      const result = basicFantasyCartridge.aspectFunctions['combat_event'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact!.op).toBe('sub');
      expect(impact!.val).toBe(15); // 20 - 5 (defense) = 15
    });

    test('Critical hit deals increased damage', () => {
      const sheet = makeSheet();
      const effect = {
        what: 'enemy_attack',
        meters: { damage: 20 },
        flags: { critical: true }
      };
      const typeCheck = { what: true, meters: { damage: true }, flags: { critical: true } };

      const result = basicFantasyCartridge.aspectFunctions['combat_event'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact!.val).toBe(25); // floor(20 * 1.5) - 5 = 25
    });

    test('Heavy damage causes stunned state', () => {
      const sheet = makeSheet();
      // Need 26 damage to cause > 20 actual damage (26 - 5 defense = 21)
      const effect = {
        what: 'enemy_attack',
        meters: { damage: 30 },
        flags: { critical: false }
      };
      const typeCheck = { what: true, meters: { damage: true } };

      const result = basicFantasyCartridge.aspectFunctions['combat_event'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ what: string; temp: boolean }>;
      const stunEffect = effects.find(e => e.what === 'stunned by heavy blow');
      expect(stunEffect).toBeDefined();
      expect(stunEffect!.temp).toBe(true);
      expect(result.narrationGuide).toContain('STUNNED');
    });

    test('Combat end awards gold and xp', () => {
      const sheet = makeSheet();
      const effect = {
        what: 'combat_end',
        meters: { gold_gained: 25, xp_gained: 100 }
      };
      const typeCheck = { what: true, meters: { gold_gained: true, xp_gained: true } };

      const result = basicFantasyCartridge.aspectFunctions['combat_event'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const goldImpact = effects[0].impacts.find(i => i.stats === 'gold');
      const xpImpact = effects[0].impacts.find(i => i.stats === 'xp');
      expect(goldImpact!.val).toBe(25);
      expect(xpImpact!.val).toBe(100);
      expect(result.narrationGuide).toContain('25 gold');
      expect(result.narrationGuide).toContain('100 XP');
    });

    test('Null effect returns ambient narration guide', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.aspectFunctions['combat_event'](sheet, null, null);

      expect(result.narrationGuide).toContain('combat');
      expect(result.sideEffect).toBeNull();
    });
  });

  describe('travel', () => {
    test('Travel ignores past timestamps', () => {
      const sheet = makeSheet();
      const effect = {
        what: 'walk',
        when: '1000-01-01T07:00:00' // Past
      };
      const typeCheck = { what: true, when: true };

      const result = basicFantasyCartridge.aspectFunctions['travel'](sheet, effect, typeCheck);
      // Should use current time since provided time is in the past
      expect(result.narrationGuide).toContain('1000-01-01T08:00:00');
    });

    test('Running causes fatigue', () => {
      const sheet = makeSheet();
      const effect = { what: 'run', when: '1000-01-01T08:30:00' };
      const typeCheck = { what: true, when: true };

      const result = basicFantasyCartridge.aspectFunctions['travel'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ what: string; temp: boolean }>;
      const fatigue = effects.find(e => e.what === 'fatigued from running');
      expect(fatigue).toBeDefined();
      expect(fatigue!.temp).toBe(true);
    });

    test('Walking does not cause fatigue', () => {
      const sheet = makeSheet();
      const effect = { what: 'walk', when: '1000-01-01T08:30:00' };
      const typeCheck = { what: true, when: true };

      const result = basicFantasyCartridge.aspectFunctions['travel'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ what: string }>;
      const fatigue = effects.find(e => e.what === 'fatigued from running');
      expect(fatigue).toBeUndefined();
    });

    test('Null effect returns no narration guide', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.aspectFunctions['travel'](sheet, null, null);

      expect(result.narrationGuide).toBe('');
      expect(result.sideEffect).toBeNull();
    });
  });

  describe('rest', () => {
    test('Short rest restores 25% HP', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultCharacterSheet.stats, hp: 50 } });
      const effect = { what: 'short' };
      const typeCheck = { what: true };

      const result = basicFantasyCartridge.aspectFunctions['rest'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const hpImpact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(hpImpact!.op).toBe('add');
      expect(hpImpact!.val).toBe(25); // 100 * 0.25 = 25
    });

    test('Long rest fully restores HP', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultCharacterSheet.stats, hp: 30 } });
      const effect = { what: 'long' };
      const typeCheck = { what: true };

      const result = basicFantasyCartridge.aspectFunctions['rest'](sheet, effect, typeCheck);

      const effects = result.sideEffect as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const hpImpact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(hpImpact!.op).toBe('set');
      expect(hpImpact!.val).toBe(100); // max_hp
    });

    test('Null effect returns no narration guide', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.aspectFunctions['rest'](sheet, null, null);

      expect(result.narrationGuide).toBe('');
      expect(result.sideEffect).toBeNull();
    });
  });
});
