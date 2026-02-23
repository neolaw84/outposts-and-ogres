import { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from '../../src/utils/base64';

describe('Base64 utilities', function () {
  test('should encode and decode a simple ASCII string (raw)', function () {
    var input = 'Hello, World!';
    var encoded = base64EncodeRaw(input);
    expect(encoded).toBeTruthy();
    expect(encoded).not.toBe(input);
    expect(base64DecodeRaw(encoded)).toBe(input);
  });

  test('should handle empty string', function () {
    expect(base64EncodeRaw('')).toBe('');
    expect(base64DecodeRaw('')).toBe('');
  });

  test('should round-trip JSON state data', function () {
    var state = JSON.stringify({ condition: 'combat', turn: 3, hp: 42 });
    var encoded = base64EncodeRaw(state);
    var decoded = base64DecodeRaw(encoded);
    expect(JSON.parse(decoded)).toEqual({ condition: 'combat', turn: 3, hp: 42 });
  });

  test('should encode and decode with UTF-8 support', function () {
    var input = 'Hello, World!';
    var encoded = base64Encode(input);
    expect(base64Decode(encoded)).toBe(input);
  });

  test('should handle padding correctly for different input lengths', function () {
    // 1 byte -> padded
    expect(base64DecodeRaw(base64EncodeRaw('a'))).toBe('a');
    // 2 bytes -> padded
    expect(base64DecodeRaw(base64EncodeRaw('ab'))).toBe('ab');
    // 3 bytes -> no padding needed
    expect(base64DecodeRaw(base64EncodeRaw('abc'))).toBe('abc');
    // 4 bytes -> padded
    expect(base64DecodeRaw(base64EncodeRaw('abcd'))).toBe('abcd');
  });
});
