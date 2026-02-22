import { detectSignals } from '../src/signals/detect';
import { SignalDetector } from '../src/types';

describe('Input Parser (SignalDetector-based)', () => {
  const matchers: SignalDetector[] = [
    { key: 'attack', description: 'Player attacks', keywords: ['attack', 'hit', 'strike'] },
    { key: 'dodge', description: 'Player dodges', keywords: ['dodge', 'evade'] },
    { key: 'cast', description: 'Player casts a spell', keywords: ['cast', 'spell'] },
    { key: 'defend', description: 'Player defends', keywords: ['defend', 'block'] },
    { key: 'flee', description: 'Player flees', keywords: ['flee', 'run'] },
  ];

  test('should parse bracket syntax with action only', () => {
    const result = detectSignals('I want to <attack>', matchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('attack');
    expect(result[0].what).toBeUndefined();
  });

  test('should parse bracket syntax with space-separated target', () => {
    const result = detectSignals('<attack goblin>', matchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('attack');
    expect(result[0].what).toBe('goblin');
  });

  test('should parse bracket syntax with colon-separated target', () => {
    const result = detectSignals('<cast:fireball>', matchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('cast');
    expect(result[0].what).toBe('fireball');
  });

  test('should be case-insensitive for action keyword', () => {
    const result = detectSignals('<ATTACK>', matchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('attack');
  });

  test('should fallback to keyword matching when no brackets', () => {
    const result = detectSignals('I want to attack the orc', matchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('attack');
  });

  test('should return empty array when no action is recognised', () => {
    const result = detectSignals('I look around confused', matchers);
    expect(result.length).toBe(0);
  });

  test('should handle empty matchers list', () => {
    const result = detectSignals('I want to attack', []);
    expect(result.length).toBe(0);
  });

  test('should reject bracket actions that do not match any matcher key', () => {
    const result = detectSignals('<unknown_action>', matchers);
    expect(result.length).toBe(0);
  });

  test('should detect emotions when matchers include emotion keywords', () => {
    const emotionMatchers: SignalDetector[] = [
      { key: 'fear', description: 'Player expresses fear', keywords: ['afraid', 'fear', 'terrified'] },
      { key: 'anger', description: 'Player expresses anger', keywords: ['angry', 'rage', 'furious'] },
    ];
    const result = detectSignals('I am terrified of the dragon', emotionMatchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('fear');
    expect(result[0].tags?.sourceKeyword).toBe('terrified');
  });

  test('should detect multiple intents from a single message', () => {
    const combined: SignalDetector[] = [
      ...matchers,
      { key: 'fear', description: 'Player expresses fear', keywords: ['afraid', 'fear', 'terrified'] },
    ];
    const result = detectSignals('<attack goblin> I am terrified', combined);
    expect(result.length).toBe(2);
    expect(result.find(e => e.key === 'attack')).toBeDefined();
    expect(result.find(e => e.key === 'fear')).toBeDefined();
  });

  test('should support regex patterns', () => {
    const regexMatchers: SignalDetector[] = [
      { key: 'cast', description: 'Player casts a spell', keywords: [], patterns: [/cast\s+(\w+)/i] },
    ];
    const result = detectSignals('I cast fireball at the enemy', regexMatchers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].key).toBe('cast');
    expect(result[0].what).toBe('fireball');
  });

  test('bracket match takes precedence over keyword match for same key', () => {
    const result = detectSignals('<attack goblin> I attack the orc', matchers);
    const attackIntents = result.filter(e => e.key === 'attack');
    // Should only have ONE attack intent (bracket takes precedence, keyword skipped)
    expect(attackIntents.length).toBe(1);
    expect(attackIntents[0].what).toBe('goblin');
  });
});
