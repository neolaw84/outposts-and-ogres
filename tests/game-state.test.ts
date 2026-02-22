import { applySideEffect, revertSideEffect } from '../src/core/game-state';
import { State, SideEffect } from '../src/types';

function makeSheet(overrides?: Partial<State>): State {
  return {
    timestamp: '1000-01-01T08:00:00',
    stats: {
      hp: 100,
      max_hp: 100,
      strength: 10,
      defense: 5,
      stunned: 0,
      poisoned: 0,
      scars: 0,
      gold: 50,
      xp: 0
    },
    activeConditions: [],
    flags: [],
    ...overrides
  };
}

describe('CharacterSheetUtils', () => {
  describe('applySideEffect', () => {
    test('should apply permanent add effect', () => {
      const sheet = makeSheet();
      const effect: SideEffect = {
        what: 'healed',
        temp: false,
        impacts: [{ stats: 'hp', op: 'add', val: 20 }]
      };

      const result = applySideEffect(sheet, effect);
      expect(result.stats['hp']).toBe(120); // 100 + 20
      expect(result.activeConditions.length).toBe(0); // permanent, not stored
    });

    test('should apply permanent sub effect', () => {
      const sheet = makeSheet();
      const effect: SideEffect = {
        what: 'took damage',
        temp: false,
        impacts: [{ stats: 'hp', op: 'sub', val: 30 }]
      };

      const result = applySideEffect(sheet, effect);
      expect(result.stats['hp']).toBe(70); // 100 - 30
    });

    test('should apply permanent set effect', () => {
      const sheet = makeSheet();
      const effect: SideEffect = {
        what: 'full heal',
        temp: false,
        impacts: [{ stats: 'hp', op: 'set', val: 100 }]
      };

      const result = applySideEffect(sheet, effect);
      expect(result.stats['hp']).toBe(100);
    });

    test('should apply temporary effect with expiry and store in activeConditions[]', () => {
      const sheet = makeSheet();
      const effect: SideEffect = {
        what: 'strength potion',
        temp: true,
        expiry: '1000-01-01T08:10:00',
        impacts: [{ stats: 'strength', op: 'add', val: 10 }]
      };

      const result = applySideEffect(sheet, effect);
      expect(result.stats['strength']).toBe(20); // 10 + 10
      expect(result.activeConditions.length).toBe(1);
      expect(result.activeConditions[0].desc).toBe('strength potion');
      expect(result.activeConditions[0].expiry).toBe('1000-01-01T08:10:00');
      expect(result.activeConditions[0].impacts[0].oriVal).toBe(10); // original value stored
    });

    test('should apply array of side effects', () => {
      const sheet = makeSheet();
      const effects: SideEffect[] = [
        {
          what: 'damage',
          temp: false,
          impacts: [{ stats: 'hp', op: 'sub', val: 15 }]
        },
        {
          what: 'scar',
          temp: false,
          impacts: [{ stats: 'scars', op: 'add', val: 1 }]
        }
      ];

      const result = applySideEffect(sheet, effects);
      expect(result.stats['hp']).toBe(85);
      expect(result.stats['scars']).toBe(1);
    });

    test('should return unchanged sheet for null input', () => {
      const sheet = makeSheet();
      const result = applySideEffect(sheet, null);
      expect(result.stats['hp']).toBe(100);
    });

    test('should not mutate the original sheet', () => {
      const sheet = makeSheet();
      applySideEffect(sheet, {
        what: 'damage',
        temp: false,
        impacts: [{ stats: 'hp', op: 'sub', val: 50 }]
      });
      expect(sheet.stats['hp']).toBe(100); // original unchanged
    });
  });

  describe('revertSideEffect', () => {
    test('should revert expired add effect', () => {
      const sheet = makeSheet({
        timestamp: '1000-01-01T09:00:00', // 1 hour later
        stats: {
          hp: 100, max_hp: 100, strength: 20, defense: 5,
          stunned: 0, poisoned: 0, scars: 0, gold: 50, xp: 0
        },
        activeConditions: [{
          desc: 'strength potion',
          expiry: '1000-01-01T08:10:00', // expired
          re_lock: null,
          impacts: [{
            stats: 'strength',
            op: 'add',
            val: 10,
            oriVal: 10
          }]
        }]
      });

      const result = revertSideEffect(sheet);
      expect(result.stats['strength']).toBe(10); // reverted from 20 to 10
      expect(result.activeConditions.length).toBe(0);
    });

    test('should revert expired set effect to original value', () => {
      const sheet = makeSheet({
        timestamp: '1000-01-01T09:00:00',
        stats: {
          hp: 100, max_hp: 100, strength: 10, defense: 5,
          stunned: 1, poisoned: 0, scars: 0, gold: 50, xp: 0
        },
        activeConditions: [{
          desc: 'stunned',
          expiry: '1000-01-01T08:01:00', // expired
          re_lock: null,
          impacts: [{
            stats: 'stunned',
            op: 'set',
            val: 1,
            oriVal: 0
          }]
        }]
      });

      const result = revertSideEffect(sheet);
      expect(result.stats['stunned']).toBe(0); // reverted
      expect(result.activeConditions.length).toBe(0);
    });

    test('should keep non-expired effects', () => {
      const sheet = makeSheet({
        timestamp: '1000-01-01T08:05:00', // only 5 minutes in
        stats: {
          hp: 100, max_hp: 100, strength: 20, defense: 5,
          stunned: 0, poisoned: 0, scars: 0, gold: 50, xp: 0
        },
        activeConditions: [{
          desc: 'strength potion',
          expiry: '1000-01-01T08:10:00', // not expired yet
          re_lock: null,
          impacts: [{
            stats: 'strength',
            op: 'add',
            val: 10,
            oriVal: 10
          }]
        }]
      });

      const result = revertSideEffect(sheet);
      expect(result.stats['strength']).toBe(20); // still buffed
      expect(result.activeConditions.length).toBe(1);
    });

    test('should respect re_lock preventing expiration', () => {
      const sheet = makeSheet({
        timestamp: '1000-01-01T09:00:00',
        stats: {
          hp: 100, max_hp: 100, strength: 20, defense: 5,
          stunned: 0, poisoned: 0, scars: 0, gold: 50, xp: 0,
          combat_lock: 1 // lock is active
        },
        activeConditions: [{
          desc: 'combat buff',
          expiry: '1000-01-01T08:10:00', // expired
          re_lock: ['combat_lock'], // but locked
          impacts: [{
            stats: 'strength',
            op: 'add',
            val: 10,
            oriVal: 10
          }]
        }]
      });

      const result = revertSideEffect(sheet);
      expect(result.stats['strength']).toBe(20); // still buffed due to re_lock
      expect(result.activeConditions.length).toBe(1);
    });

    test('should expire when re_lock is inactive', () => {
      const sheet = makeSheet({
        timestamp: '1000-01-01T09:00:00',
        stats: {
          hp: 100, max_hp: 100, strength: 20, defense: 5,
          stunned: 0, poisoned: 0, scars: 0, gold: 50, xp: 0,
          combat_lock: 0 // lock is inactive
        },
        activeConditions: [{
          desc: 'combat buff',
          expiry: '1000-01-01T08:10:00', // expired
          re_lock: ['combat_lock'],
          impacts: [{
            stats: 'strength',
            op: 'add',
            val: 10,
            oriVal: 10
          }]
        }]
      });

      const result = revertSideEffect(sheet);
      expect(result.stats['strength']).toBe(10); // reverted since lock inactive
      expect(result.activeConditions.length).toBe(0);
    });

    test('should not mutate the original sheet', () => {
      const sheet = makeSheet({
        timestamp: '1000-01-01T09:00:00',
        activeConditions: [{
          desc: 'test',
          expiry: '1000-01-01T08:10:00',
          re_lock: null,
          impacts: [{ stats: 'strength', op: 'add', val: 5, oriVal: 10 }]
        }]
      });

      revertSideEffect(sheet);
      expect(sheet.activeConditions.length).toBe(1); // original unchanged
    });
  });
});
