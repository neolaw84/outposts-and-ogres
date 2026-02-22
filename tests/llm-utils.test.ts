import {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey
} from '../src/utils/llm-utils';

describe('LLM utilities', function () {
  // ----------------------------------------------------------------
  // encodeState / decodeState / buildRpStateBlock
  // ----------------------------------------------------------------

  describe('state encoding', function () {
    test('should encode state to non-empty string', function () {
      var encoded = encodeState({ turn: 1 });
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    test('should return empty string for null state', function () {
      expect(encodeState(null)).toBe('');
    });

    test('should build [RP_STATE] block with encoded content', function () {
      var block = buildRpStateBlock({ turn: 1 });
      expect(block).toMatch(/^\[RP_STATE\].+\[\/RP_STATE\]$/);
      // Should NOT contain plain JSON
      expect(block).not.toContain('"turn"');
    });

    test('should decode state from message with [RP_STATE] tags', function () {
      var state = { condition: 'combat', turn: 3 };
      var block = buildRpStateBlock(state);
      var message = 'Some narration text. ' + block + ' More text.';
      expect(decodeState(message)).toEqual(state);
    });

    test('should return null when message has no [RP_STATE] tags', function () {
      expect(decodeState('Just a regular message')).toBeNull();
    });

    test('should return null for null or empty message', function () {
      expect(decodeState(null)).toBeNull();
      expect(decodeState('')).toBeNull();
    });

    test('should handle complex nested state', function () {
      var state = {
        condition: 'combat',
        turn: 5,
        inventory: ['sword', 'shield'],
        stats: { hp: 42, mp: 10 }
      };
      var block = buildRpStateBlock(state);
      var decoded = decodeState('Response with ' + block);
      expect(decoded).toEqual(state);
    });
  });

  // ----------------------------------------------------------------
  // extractNarrationSummary
  // ----------------------------------------------------------------

  describe('extractNarrationSummary', function () {
    test('should extract JSON from [NARRATION_SUMMARY] block', function () {
      var summary = { npc_actions: [{ npc: 'Goblin', action: 'attack' }] };
      var message = 'Narration [NARRATION_SUMMARY]' + JSON.stringify(summary) + '[/NARRATION_SUMMARY]';
      expect(extractNarrationSummary(message)).toEqual(summary);
    });

    test('should extract the last [NARRATION_SUMMARY] if multiple exist', function () {
      var first = { outcome: 'first' };
      var second = { outcome: 'second' };
      var message =
        '[NARRATION_SUMMARY]' + JSON.stringify(first) + '[/NARRATION_SUMMARY] middle ' +
        '[NARRATION_SUMMARY]' + JSON.stringify(second) + '[/NARRATION_SUMMARY]';
      expect(extractNarrationSummary(message)).toEqual(second);
    });

    test('should return null for null message', function () {
      expect(extractNarrationSummary(null)).toBeNull();
    });

    test('should return null when no block exists', function () {
      expect(extractNarrationSummary('No summary here')).toBeNull();
    });

    test('should return null for invalid JSON in block', function () {
      var message = '[NARRATION_SUMMARY]not valid json[/NARRATION_SUMMARY]';
      expect(extractNarrationSummary(message)).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // generateEffectInstruction
  // ----------------------------------------------------------------

  describe('generateEffectInstruction', function () {
    test('should generate instruction text for a valid effect definition', function () {
      var effectDef = {
        key: 'damage',
        condition: 'the player is hit',
        what: 'physical damage',
        meters: { hp: -10 }
      };
      var result = generateEffectInstruction(effectDef);
      expect(result).toContain('if and only if the player is hit');
      expect(result).toContain('"damage"');
      // The condition should NOT be in the JSON block
      expect(result).not.toContain('"condition"');
    });

    test('should return empty string for null definition', function () {
      expect(generateEffectInstruction(null as any)).toBe('');
    });

    test('should return empty string when key is missing', function () {
      expect(generateEffectInstruction({ key: '', condition: 'test' })).toBe('');
    });
  });

  // ----------------------------------------------------------------
  // findEffectByKey
  // ----------------------------------------------------------------

  describe('findEffectByKey', function () {
    test('should find effect by key', function () {
      var narrationSummary = {
        effects: [
          { key: 'damage', what: 'hit' },
          { key: 'heal', what: 'restore' }
        ]
      };
      var typeChecks = {
        effects: [
          { key: true, what: true },
          { key: true, what: true }
        ]
      };
      var result = findEffectByKey('heal', narrationSummary, typeChecks);
      expect(result.effect).toEqual({ key: 'heal', what: 'restore' });
      expect(result.typeCheck).toEqual({ key: true, what: true });
    });

    test('should return nulls when key not found', function () {
      var narrationSummary = { effects: [{ key: 'damage' }] };
      var typeChecks = { effects: [{ key: true }] };
      var result = findEffectByKey('missing', narrationSummary, typeChecks);
      expect(result.effect).toBeNull();
      expect(result.typeCheck).toBeNull();
    });

    test('should return nulls when effects is not an array', function () {
      var result = findEffectByKey('damage', {}, {});
      expect(result.effect).toBeNull();
      expect(result.typeCheck).toBeNull();
    });
  });
});
