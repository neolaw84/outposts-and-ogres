import {
  parseDuration,
  addDuration,
  isPast,
  isValidDateStr,
  isValidDurationStr,
  formatDate,
  formatDate12Hr,
  getDow,
  clampTime,
  getMidnightsPassed
} from '../src/utils/time-utils';

describe('TimeUtils', () => {
  describe('parseDuration', () => {
    test('should parse hours and minutes', () => {
      expect(parseDuration('PT1H30M')).toBe(5400000);
    });

    test('should parse days', () => {
      expect(parseDuration('P1D')).toBe(86400000);
    });

    test('should parse complex duration', () => {
      // 1 day + 2 hours + 30 minutes
      expect(parseDuration('P1DT2H30M')).toBe(86400000 + 7200000 + 1800000);
    });

    test('should return 0 for invalid input', () => {
      expect(parseDuration('invalid')).toBe(0);
    });

    test('should parse seconds', () => {
      expect(parseDuration('PT5S')).toBe(5000);
    });

    test('should parse minutes only', () => {
      expect(parseDuration('PT10M')).toBe(600000);
    });
  });

  describe('addDuration', () => {
    test('should add minutes to a date', () => {
      const result = addDuration('1000-01-01T08:00:00', 'PT30M');
      expect(result).toBe('1000-01-01T08:30:00');
    });

    test('should add hours to a date', () => {
      const result = addDuration('1000-01-01T08:00:00', 'PT2H');
      expect(result).toBe('1000-01-01T10:00:00');
    });

    test('should accept milliseconds as number', () => {
      const result = addDuration('1000-01-01T08:00:00', 3600000); // 1 hour in ms
      expect(result).toBe('1000-01-01T09:00:00');
    });
  });

  describe('isPast', () => {
    test('should return true when date is before reference', () => {
      expect(isPast('1000-01-01T07:00:00', '1000-01-01T08:00:00')).toBe(true);
    });

    test('should return false when date is after reference', () => {
      expect(isPast('1000-01-01T09:00:00', '1000-01-01T08:00:00')).toBe(false);
    });
  });

  describe('isValidDateStr', () => {
    test('should accept valid date string', () => {
      expect(isValidDateStr('1000-01-01T08:00:00')).toBe(true);
    });

    test('should reject invalid format', () => {
      expect(isValidDateStr('not-a-date')).toBe(false);
    });

    test('should reject date with milliseconds', () => {
      expect(isValidDateStr('1000-01-01T08:00:00.000')).toBe(false);
    });
  });

  describe('isValidDurationStr', () => {
    test('should accept valid duration', () => {
      expect(isValidDurationStr('PT1H30M')).toBe(true);
    });

    test('should reject empty duration', () => {
      expect(isValidDurationStr('PT')).toBe(false);
    });

    test('should reject invalid string', () => {
      expect(isValidDurationStr('abc')).toBe(false);
    });
  });

  describe('formatDate12Hr', () => {
    test('should format AM time', () => {
      const result = formatDate12Hr('1000-01-01T08:00:00');
      expect(result).toContain('AM');
      expect(result).toContain('08:00:00');
    });

    test('should format PM time', () => {
      const result = formatDate12Hr('1000-01-01T14:30:00');
      expect(result).toContain('PM');
      expect(result).toContain('02:30:00');
    });
  });

  describe('getDow', () => {
    test('should return day of week for a string date', () => {
      const dow = getDow('2024-01-01T00:00:00');
      expect(typeof dow).toBe('string');
      expect(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).toContain(dow);
    });
  });

  describe('clampTime', () => {
    test('should clamp to max', () => {
      expect(clampTime(null, '1000-01-01T10:00:00', '1000-01-01T12:00:00')).toBe('1000-01-01T10:00:00');
    });

    test('should clamp to min', () => {
      expect(clampTime('1000-01-01T08:00:00', null, '1000-01-01T06:00:00')).toBe('1000-01-01T08:00:00');
    });

    test('should return as-is when in range', () => {
      expect(clampTime('1000-01-01T06:00:00', '1000-01-01T12:00:00', '1000-01-01T09:00:00')).toBe('1000-01-01T09:00:00');
    });
  });

  describe('getMidnightsPassed', () => {
    test('should return 0 for same day', () => {
      expect(getMidnightsPassed('2024-01-01T08:00:00', '2024-01-01T20:00:00')).toBe(0);
    });

    test('should return 1 for next day', () => {
      expect(getMidnightsPassed('2024-01-01T20:00:00', '2024-01-02T08:00:00')).toBe(1);
    });
  });
});
