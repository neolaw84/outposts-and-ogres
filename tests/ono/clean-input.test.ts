import { validateSignalTypes } from '../../src/utils/llm-utils';

describe('validateSignalTypes', () => {
  test('should validate elapsed_time as valid ISO duration', () => {
    const result = validateSignalTypes({ elapsed_time: 'PT5M', effects: [] });
    expect(result['elapsed_time']).toBe(true);
  });

  test('should reject invalid elapsed_time', () => {
    const result = validateSignalTypes({ elapsed_time: 'invalid', effects: [] });
    expect(result['elapsed_time']).toBe(false);
  });

  test('should reject numeric elapsed_time', () => {
    const result = validateSignalTypes({ elapsed_time: 123, effects: [] });
    expect(result['elapsed_time']).toBe(false);
  });

  test('should validate effects array', () => {
    const result = validateSignalTypes({
      elapsed_time: 'PT1M',
      effects: [
        {
          key: 'drink_potion',
          what: 'healing',
          when: '1000-01-01T08:00:00',
          meters: { potency: 5 },
          flags: { critical: true },
          tags: { color: 'red' }
        }
      ]
    });

    const effects = result['effects'] as Array<Record<string, unknown>>;
    expect(effects).toBeDefined();
    expect(effects.length).toBe(1);
    expect(effects[0]['key']).toBe(true);
    expect(effects[0]['what']).toBe(true);
    expect(effects[0]['when']).toBe(true);

    const meters = effects[0]['meters'] as Record<string, boolean>;
    expect(meters['potency']).toBe(true);

    const flags = effects[0]['flags'] as Record<string, boolean>;
    expect(flags['critical']).toBe(true);

    const tags = effects[0]['tags'] as Record<string, boolean>;
    expect(tags['color']).toBe(true);
  });

  test('should reject non-array effects', () => {
    const result = validateSignalTypes({ elapsed_time: 'PT1M', effects: 'not an array' });
    expect(result['effects']).toBe(false);
  });

  test('should validate invalid field types within effects', () => {
    const result = validateSignalTypes({
      elapsed_time: 'PT1M',
      effects: [
        {
          key: 123, // wrong type
          what: true, // wrong type
          when: 'not-a-date',
          meters: { potency: 'not a number' }
        }
      ]
    });

    const effects = result['effects'] as Array<Record<string, unknown>>;
    expect(effects[0]['key']).toBe(false);
    expect(effects[0]['what']).toBe(false);
    expect(effects[0]['when']).toBe(false);

    const meters = effects[0]['meters'] as Record<string, boolean>;
    expect(meters['potency']).toBe(false);
  });
});
