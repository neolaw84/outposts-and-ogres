import { basicFantasyCartridge } from '../../src/cartridges/basic-fantasy/index';
import { State } from '../../src/types';

function makeSheet(overrides?: Partial<State>): State {
  return JSON.parse(JSON.stringify({
    ...basicFantasyCartridge.defaultState,
    ...overrides,
    stats: {
      ...basicFantasyCartridge.defaultState.stats,
      ...(overrides && overrides.stats ? overrides.stats : {})
    }
  }));
}

describe('RPG Mechanics - Aspect Functions', () => {
  describe('drink_potion', () => {
    test('Healing potion restores HP', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, hp: 50 } });
      const effect = {
        key: 'drink_potion',
        what: 'healing',
        meters: { potency: 5 }
      };
      const typeCheck = { what: true, meters: { potency: true } };

      const result = basicFantasyCartridge.rules['drink_potion'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'drink_potion', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      expect(result.stateMutations).not.toBeNull();
      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact).toBeDefined();
      expect(impact!.op).toBe('add');
      expect(impact!.val).toBe(50); // 5 * 10 = 50
    });

    test('Healing potion does not overheal beyond max_hp', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, hp: 95 } });
      const effect = {
        key: 'drink_potion',
        what: 'healing',
        meters: { potency: 5 }
      };
      const typeCheck = { what: true, meters: { potency: true } };

      const result = basicFantasyCartridge.rules['drink_potion'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'drink_potion', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; val: number }> }>;
      const hpImpact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(hpImpact!.val).toBe(5); // 100 - 95 = 5 (capped)
    });

    test('Healing potion at full health returns no side effect', () => {
      const sheet = makeSheet(); // hp = 100, max_hp = 100
      const effect = {
        key: 'drink_potion',
        what: 'healing',
        meters: { potency: 5 }
      };
      const typeCheck = { what: true, meters: { potency: true } };

      const result = basicFantasyCartridge.rules['drink_potion'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'drink_potion', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      expect(result.outcome.mustHappen.join(' ')).toContain('already at full health');
    });

    test('Strength potion adds temporary buff', () => {
      const sheet = makeSheet();
      const effect = {
        key: 'drink_potion',
        what: 'strength',
        meters: { potency: 2 },
        when: '1000-01-01T08:00:00'
      };
      const typeCheck = { what: true, meters: { potency: true }, when: true };

      const result = basicFantasyCartridge.rules['drink_potion'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'drink_potion', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ expiry: string; impacts: Array<{ stats: string; val: number }> }>;
      expect(effects[0].expiry).toBeTruthy();
      expect(effects[0].expiry).toBeDefined();
      const impact = effects[0].impacts.find(i => i.stats === 'strength');
      expect(impact!.val).toBe(10); // 2 * 5
    });

    test('Poison sets poisoned flag temporarily', () => {
      const sheet = makeSheet();
      const effect = {
        key: 'drink_potion',
        what: 'poison',
        meters: { potency: 3 },
        when: '1000-01-01T08:00:00'
      };
      const typeCheck = { what: true, meters: { potency: true }, when: true };

      const result = basicFantasyCartridge.rules['drink_potion'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'drink_potion', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ what: string }>;
      const poisonImpact = effects[0].what;
      expect(poisonImpact).toContain('drank poison');
    });

    test('Null effect returns default prompt', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.rules['drink_potion'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'drink_potion', narrationSummary: {}, worldSignal: null, typeCheck: null });

      expect(result.outcome.mustNotHappen.join(' ')).toContain('potion');
      expect(result.stateMutations.length).toBe(0);
    });
  });

  describe('combat_event', () => {
    test('Enemy attack deals damage reduced by defense', () => {
      const sheet = makeSheet();
      const effect = {
        key: 'combat_event',
        what: 'enemy_attack',
        meters: { damage: 20 },
        flags: { critical: false }
      };
      const typeCheck = { what: true, meters: { damage: true }, flags: { critical: true } };

      const result = basicFantasyCartridge.rules['combat_event'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'combat_event', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact!.op).toBe('sub');
      expect(impact!.val).toBe(15); // 20 - 5 (defense) = 15
    });

    test('Critical hit deals increased damage', () => {
      const sheet = makeSheet();
      const effect = {
        key: 'combat_event',
        what: 'enemy_attack',
        meters: { damage: 20 },
        flags: { critical: true }
      };
      const typeCheck = { what: true, meters: { damage: true }, flags: { critical: true } };

      const result = basicFantasyCartridge.rules['combat_event'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'combat_event', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; val: number }> }>;
      const impact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(impact!.val).toBe(25); // floor(20 * 1.5) - 5 = 25
    });

    test('Heavy damage causes stunned state', () => {
      const sheet = makeSheet();
      // Need 26 damage to cause > 20 actual damage (26 - 5 defense = 21)
      const effect = {
        key: 'combat_event',
        what: 'enemy_attack',
        meters: { damage: 30 },
        flags: { critical: false }
      };
      const typeCheck = { what: true, meters: { damage: true } };

      const result = basicFantasyCartridge.rules['combat_event'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'combat_event', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ what: string; temp: boolean }>;
      const stunEffect = effects.find(e => e.what === 'stunned by heavy blow');
      expect(stunEffect).toBeTruthy();
      expect(stunEffect!.temp).toBe(true);
      expect(result.outcome.mustHappen.join(' ')).toContain('STUNNED');
    });

    test('Combat end awards gold and xp', () => {
      const sheet = makeSheet();
      const effect = {
        key: 'combat_event',
        what: 'combat_end',
        meters: { gold_gained: 25, xp_gained: 100 }
      };
      const typeCheck = { what: true, meters: { gold_gained: true, xp_gained: true } };

      const result = basicFantasyCartridge.rules['combat_event'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'combat_event', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const hpImpact = effects[0]?.impacts?.find(i => i.stats === 'hp');
      expect(hpImpact).toBeUndefined(); // It's combat end, should not damage HP

      const goldImpact = effects[0].impacts.find(i => i.stats === 'gold');
      const xpImpact = effects[0].impacts.find(i => i.stats === 'xp');
      expect(goldImpact!.val).toBe(25);
      expect(xpImpact!.val).toBe(100);
      expect(result.outcome.mustHappen.join(' ')).toContain('25 gold');
      expect(result.outcome.mustHappen.join(' ')).toContain('100 XP');
    });

    test('Null effect returns ambient narration guide', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.rules['combat_event'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'combat_event', narrationSummary: {}, worldSignal: null, typeCheck: null });

      expect(result.outcome.mustNotHappen.join(' ')).toContain('combat');
      expect(result.stateMutations.length).toBe(0);
    });
  });

  describe('travel', () => {
    test('Travel ignores past timestamps', () => {
      const sheet = makeSheet();
      const effect = {
        key: 'travel',
        what: 'walk',
        when: '1000-01-01T07:00:00' // Past
      };
      const typeCheck = { what: true, when: true };

      const result = basicFantasyCartridge.rules['travel'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'travel', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });
      // Should use current time since provided time is in the past
      expect(result.outcome.mustHappen.join(' ')).toContain('1000-01-01T08:00:00');
    });

    test('Running causes fatigue', () => {
      const sheet = makeSheet();
      const effect = { key: 'travel', what: 'run', when: '1000-01-01T08:30:00' };
      const typeCheck = { what: true, when: true };

      const result = basicFantasyCartridge.rules['travel'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'travel', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ what: string; temp: boolean }>;
      const fatigue = effects.find(e => e.what === 'fatigued from running');
      expect(fatigue).toBeDefined();
      expect(fatigue!.temp).toBe(true);
    });

    test('Walking does not cause fatigue', () => {
      const sheet = makeSheet();
      const effect = { key: 'travel', what: 'walk', when: '1000-01-01T08:30:00' };
      const typeCheck = { what: true, when: true };

      const result = basicFantasyCartridge.rules['travel'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'travel', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ what: string }>;
      const fatigue = effects.find(e => e.what === 'fatigued from running');
      expect(fatigue).toBeUndefined();
    });

    test('Null effect returns mustNotHappen for travel', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.rules['travel'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'travel', narrationSummary: {}, worldSignal: null, typeCheck: null });

      expect(result.outcome.mustHappen.length).toBe(0);
      expect(result.outcome.mustNotHappen.length).toBeGreaterThan(0);
      expect(result.stateMutations.length).toBe(0);
    });
  });

  describe('rest', () => {
    test('Short rest restores 25% HP', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, hp: 50 } });
      const effect = { key: 'rest', what: 'short', when: '1000-01-01T10:00:00' };
      const typeCheck = { what: 'string', when: 'string' };
      const result = basicFantasyCartridge.rules['rest'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'rest', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const hpImpact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(hpImpact!.op).toBe('add');
      expect(hpImpact!.val).toBe(25); // 100 * 0.25 = 25
      expect(result.outcome.mustHappen.join(' ')).toContain('Awoke from rest');
    });

    test('Long rest fully restores HP', () => {
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, hp: 30 } });
      const effect = { key: 'rest', what: 'long', when: '1000-01-01T10:00:00' };
      const typeCheck = { what: 'string', when: 'string' };
      const result = basicFantasyCartridge.rules['rest'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'rest', narrationSummary: {}, worldSignal: effect, typeCheck: typeCheck });

      const effects = result.stateMutations as Array<{ impacts: Array<{ stats: string; op: string; val: number }> }>;
      const hpImpact = effects[0].impacts.find(i => i.stats === 'hp');
      expect(hpImpact!.op).toBe('set');
      expect(hpImpact!.val).toBe(100); // max_hp
      expect(result.outcome.mustHappen.join(' ')).toContain('Awoke from rest');
    });

    test('Null effect returns no mustHappen entries', () => {
      const sheet = makeSheet();
      const result = basicFantasyCartridge.rules['rest'](sheet, { playerSignals: [], currentCondition: 'combat', ruleKey: 'rest', narrationSummary: {}, worldSignal: null, typeCheck: null });

      expect(result.outcome.mustNotHappen.length).toBeGreaterThan(0);
      expect(result.stateMutations.length).toBe(0);
    });

    describe('dynamically generated actions (e.g. attack)', () => {
      test('Attack triggers combat logic correctly on success', () => {
        const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, strength: 100 } }); // auto-success
        const result = basicFantasyCartridge.rules['attack'](sheet, {
          playerSignals: [{ key: 'attack', what: 'goblin' }],
          currentCondition: 'combat',
          ruleKey: 'attack',
          narrationSummary: {}, worldSignal: null, typeCheck: null
        });

        expect(result.outcome.status).toBe('success');
        expect(result.outcome.actionName).toBe('attack');
        expect(result.outcome.actionTarget).toBe('goblin');
        expect(result.outcome.mustHappen.join(' ')).toContain('decisively');
      });

      test('Attack triggers combat logic correctly on failure', () => {
        const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, strength: 1 } }); // very weak
        const result = basicFantasyCartridge.rules['attack'](sheet, {
          playerSignals: [{ key: 'attack', what: 'goblin' }],
          currentCondition: 'combat',
          ruleKey: 'attack',
          narrationSummary: {}, worldSignal: null, typeCheck: null
        });

        // Roll must be >= 10. Stat is 1 (mod -4). Best roll 20 - 4 = 16. So it CAN succeed, but usually fails. So check mechanics logs exist
        expect(result.outcome.mechanicsLogs.length).toBeGreaterThan(0);
        expect(result.outcome.actionName).toBe('attack');
      });

      test('Action used in wrong condition yields neutral outcome', () => {
        const sheet = makeSheet();
        const result = basicFantasyCartridge.rules['attack'](sheet, {
          playerSignals: [{ key: 'attack', what: 'goblin' }],
          currentCondition: 'social',
          ruleKey: 'attack',
          narrationSummary: {}, worldSignal: null, typeCheck: null
        });

        expect(result.outcome.status).toBe('neutral');
        expect(result.outcome.mechanicsLogs[0]).toContain('not optimal');
      });
    });
  });
});
