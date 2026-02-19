import { JanitorAIAdapter } from '../src/systems/janitorai/index';
import { OutputPrompt } from '../src/types';

describe('JanitorAIAdapter', () => {
  test('should have correct name', () => {
    const adapter = new JanitorAIAdapter();
    expect(adapter.name).toBe('Janitor AI');
  });

  test('should extract player message from chat array', () => {
    const adapter = new JanitorAIAdapter();
    const context = {
      chat: [
        { role: 'assistant', content: 'Welcome adventurer.' },
        { role: 'user', content: '<attack goblin>' }
      ]
    };
    expect(adapter.getPlayerMessage(context)).toBe('<attack goblin>');
  });

  test('should return null when chat is empty', () => {
    const adapter = new JanitorAIAdapter();
    expect(adapter.getPlayerMessage({ chat: [] })).toBeNull();
  });

  test('should return null when last message is not from user', () => {
    const adapter = new JanitorAIAdapter();
    const context = {
      chat: [{ role: 'assistant', content: 'Hello' }]
    };
    expect(adapter.getPlayerMessage(context)).toBeNull();
  });

  test('should apply prompt to character scenario', () => {
    const adapter = new JanitorAIAdapter();
    const context: Record<string, unknown> = {};
    const prompt: OutputPrompt = {
      text: 'The player attacked the goblin.',
      channels: {
        longHorizon: 'Long horizon',
        midTerm: 'Mid term',
        shortTerm: 'Short term',
        combined: 'Long horizon\n\nMid term\n\nShort term'
      },
      events: [],
      result: {
        success: true,
        action: { action: 'attack', target: 'goblin', raw: '<attack goblin>' },
        rolls: [{ sides: 20, value: 15 }],
        difficulty: 10,
        rollTotal: 15
      }
    };
    adapter.applyPrompt(context, prompt);
    const character = context['character'] as Record<string, unknown>;
    expect(character['personality']).toContain('Long horizon');
    expect(character['scenario']).toBe('Short term');
  });

  test('should load empty state when none exists', () => {
    const adapter = new JanitorAIAdapter();
    expect(adapter.loadState({})).toEqual({});
  });

  test('should save and load state via personality field', () => {
    const adapter = new JanitorAIAdapter();
    const context: Record<string, unknown> = {};
    const state = { condition: 'combat', turn: 3 };
    adapter.saveState(context, state);
    expect(adapter.loadState(context)).toEqual(state);
  });

  test('should update existing state block on save', () => {
    const adapter = new JanitorAIAdapter();
    const context: Record<string, unknown> = {};
    adapter.saveState(context, { turn: 1 });
    adapter.saveState(context, { turn: 2 });
    expect(adapter.loadState(context)).toEqual({ turn: 2 });
  });
});
