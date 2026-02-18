import { parsePlayerInput } from '../src/systems/input-parser';

describe('Input Parser', () => {
  var knownActions = ['attack', 'dodge', 'cast', 'defend', 'flee'];

  test('should parse bracket syntax with action only', () => {
    var result = parsePlayerInput('I want to <attack>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
    expect(result!.target).toBe('');
  });

  test('should parse bracket syntax with space-separated target', () => {
    var result = parsePlayerInput('<attack goblin>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
    expect(result!.target).toBe('goblin');
  });

  test('should parse bracket syntax with colon-separated target', () => {
    var result = parsePlayerInput('<cast:fireball>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('cast');
    expect(result!.target).toBe('fireball');
  });

  test('should be case-insensitive for action keyword', () => {
    var result = parsePlayerInput('<ATTACK>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
  });

  test('should fallback to keyword matching when no brackets', () => {
    var result = parsePlayerInput('I want to attack the orc', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
  });

  test('should return null when no action is recognised', () => {
    var result = parsePlayerInput('I look around confused', knownActions);
    expect(result).toBeNull();
  });

  test('should preserve raw message text', () => {
    var message = 'Let me <dodge> this time';
    var result = parsePlayerInput(message, knownActions);
    expect(result).not.toBeNull();
    expect(result!.raw).toBe(message);
  });

  test('should handle empty known actions list', () => {
    var result = parsePlayerInput('I want to attack', []);
    expect(result).toBeNull();
  });

  test('should still parse brackets even with empty known actions', () => {
    var result = parsePlayerInput('<attack>', []);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
  });
});
