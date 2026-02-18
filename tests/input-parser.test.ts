import { parsePlayerInput } from '../src/systems/input-parser';

describe('Input Parser', () => {
  const knownActions = ['attack', 'dodge', 'cast', 'defend', 'flee'];

  test('should parse bracket syntax with action only', () => {
    const result = parsePlayerInput('I want to <attack>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
    expect(result!.target).toBe('');
  });

  test('should parse bracket syntax with space-separated target', () => {
    const result = parsePlayerInput('<attack goblin>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
    expect(result!.target).toBe('goblin');
  });

  test('should parse bracket syntax with colon-separated target', () => {
    const result = parsePlayerInput('<cast:fireball>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('cast');
    expect(result!.target).toBe('fireball');
  });

  test('should be case-insensitive for action keyword', () => {
    const result = parsePlayerInput('<ATTACK>', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
  });

  test('should fallback to keyword matching when no brackets', () => {
    const result = parsePlayerInput('I want to attack the orc', knownActions);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
  });

  test('should return null when no action is recognised', () => {
    const result = parsePlayerInput('I look around confused', knownActions);
    expect(result).toBeNull();
  });

  test('should preserve raw message text', () => {
    const message = 'Let me <dodge> this time';
    const result = parsePlayerInput(message, knownActions);
    expect(result).not.toBeNull();
    expect(result!.raw).toBe(message);
  });

  test('should handle empty known actions list', () => {
    const result = parsePlayerInput('I want to attack', []);
    expect(result).toBeNull();
  });

  test('should still parse brackets even with empty known actions', () => {
    const result = parsePlayerInput('<attack>', []);
    expect(result).not.toBeNull();
    expect(result!.action).toBe('attack');
  });
});
