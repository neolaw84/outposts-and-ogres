import { GamePlayScript } from '../src/systems/game-play-script';
import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { mapBasicFantasyJanitorAI } from '../src/prompt-mappers/basic-fantasy/janitorai';
import { GameState } from '../src/types';
import { applySideEffect } from '../src/core/game-state';

function createScript(): GamePlayScript {
  return new GamePlayScript(basicFantasyCartridge, mapBasicFantasyJanitorAI);
}

function makeSheet(overrides?: Partial<GameState>): GameState {
  return JSON.parse(JSON.stringify({
    ...basicFantasyCartridge.defaultGameState,
    ...overrides,
    stats: {
      ...basicFantasyCartridge.defaultGameState.stats,
      ...(overrides && overrides.stats ? overrides.stats : {})
    }
  }));
}

describe('processEffects integration', () => {
  test('should process healing potion effect from narration summary', () => {
    const script = createScript();
    const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultGameState.stats, hp: 50 } });
    const naSum = {
      elapsed_time: 'PT5M',
      effects: [
        {
          key: 'drink_potion',
          what: 'healing',
          meters: { potency: 3 }
        }
      ]
    };

    const result = script.executeTurn('', sheet, naSum);

    expect(result.newState.stats['hp']).toBe(80); // 50 + 30 (3 * 10)
    expect(result.narrationGuide).toContain('Healed 30 HP');
  });

  test('should update time from elapsed_time', () => {
    const script = createScript();
    const sheet = makeSheet();
    const naSum = {
      elapsed_time: 'PT30M',
      effects: []
    };

    const result = script.executeTurn('', sheet, naSum);

    expect(result.newState.cur_ts).toBe('1000-01-01T08:30:00');
  });

  test('should revert expired side effects before processing new ones', () => {
    const script = createScript();
    const sheet = makeSheet({
      stats: { ...basicFantasyCartridge.defaultGameState.stats, strength: 20 },
      se: [{
        desc: 'strength potion',
        expiry: '1000-01-01T08:10:00', // will be expired after time update
        re_lock: null,
        impacts: [{
          stats: 'strength',
          op: 'add' as const,
          val: 10,
          oriVal: 10
        }]
      }]
    });
    const naSum = {
      elapsed_time: 'PT30M', // 8:00 + 30m = 8:30, past 8:10 expiry
      effects: []
    };

    const result = script.executeTurn('', sheet, naSum);

    expect(result.newState.stats['strength']).toBe(10); // reverted
    expect(result.newState.se.length).toBe(0);
  });

  test('should process combat damage effect', () => {
    const script = createScript();
    const sheet = makeSheet();
    const naSum = {
      elapsed_time: 'PT1M',
      effects: [
        {
          key: 'combat_event',
          what: 'enemy_attack',
          meters: { damage: 20 },
          flags: { critical: false }
        }
      ]
    };

    const result = script.executeTurn('', sheet, naSum);

    expect(result.newState.stats['hp']).toBe(85); // 100 - (20 - 5 defense) = 85
    expect(result.narrationGuide).toContain('15 damage');
  });

  test('should process multiple effects in order', () => {
    const script = createScript();
    const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultGameState.stats, hp: 80 } });
    const naSum = {
      elapsed_time: 'PT5M',
      effects: [
        {
          key: 'drink_potion',
          what: 'healing',
          meters: { potency: 2 } // heals 20
        },
        {
          key: 'combat_event',
          what: 'enemy_attack',
          meters: { damage: 10 },
          flags: { critical: false }
        }
      ]
    };

    const result = script.executeTurn('', sheet, naSum);

    // HP: 80 + 20 (heal) = 100, then 100 - (10 - 5) = 95
    expect(result.newState.stats['hp']).toBe(95);
  });

  test('should handle empty narration summary gracefully', () => {
    const script = createScript();
    const sheet = makeSheet();
    const naSum = {
      elapsed_time: 'PT0M',
      effects: []
    };

    const result = script.executeTurn('', sheet, naSum);

    expect(result.newState.stats['hp']).toBe(100); // unchanged
    // Aspect functions called with null effect should return ambient narration
    expect(result.narrationGuide.length).toBeGreaterThan(0);
  });

  test('should track midnights passed in num_day', () => {
    const script = createScript();
    const sheet = makeSheet({
      cur_ts: '1000-01-01T23:00:00',
      stats: { ...basicFantasyCartridge.defaultGameState.stats, num_day: 0 }
    });
    const naSum = {
      elapsed_time: 'PT8H', // crosses midnight
      effects: []
    };

    const result = script.executeTurn('', sheet, naSum);

    expect(result.newState.stats['num_day']).toBe(1);
  });

  test('should not mutate the input sheet', () => {
    const script = createScript();
    const sheet = makeSheet();
    const originalCurTs = sheet.cur_ts;
    const originalHp = sheet.stats['hp'];
    const originalNumDay = sheet.stats['num_day'];
    const naSum = {
      elapsed_time: 'PT30M',
      effects: [
        {
          key: 'combat_event',
          what: 'enemy_attack',
          meters: { damage: 20 },
          flags: { critical: false }
        }
      ]
    };

    script.executeTurn('', sheet, naSum);

    // The input sheet must remain unchanged
    expect(sheet.cur_ts).toBe(originalCurTs);
    expect(sheet.stats['hp']).toBe(originalHp);
    expect(sheet.stats['num_day']).toBe(originalNumDay);
  });
});

describe('cleanInput validation', () => {
  test('should be used by processEffects for type checking', () => {
    const script = createScript();
    const sheet = makeSheet();
    // Invalid elapsed_time should be handled gracefully
    const naSum = {
      elapsed_time: 'invalid',
      effects: [
        {
          key: 'drink_potion',
          what: 123, // wrong type (should be string)
          meters: { potency: 'not a number' } // wrong type
        }
      ]
    };

    // Should not throw, should use defaults
    const result = script.executeTurn('', sheet, naSum);
    expect(result.newState).toBeDefined();
  });
});
