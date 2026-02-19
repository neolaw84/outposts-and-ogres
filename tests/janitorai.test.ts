import { JanitorAIAdapter } from '../src/systems/janitorai/index';
import { OutputPrompt } from '../src/types';
import { encodeState, buildRpStateBlock } from '../src/utils/llm-utils';

describe('JanitorAIAdapter', function () {
  test('should have correct name', function () {
    var adapter = new JanitorAIAdapter();
    expect(adapter.name).toBe('Janitor AI');
  });

  // ----------------------------------------------------------------
  // getPlayerMessage
  // ----------------------------------------------------------------

  test('should extract player message from chat.last_message (singular)', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_message: '<attack goblin>'
      }
    };
    expect(adapter.getPlayerMessage(context)).toBe('<attack goblin>');
  });

  test('should extract player message from chat.last_messages (last item)', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_messages: [
          { content: 'Welcome adventurer.' },
          { content: '<attack goblin>' }
        ]
      }
    };
    expect(adapter.getPlayerMessage(context)).toBe('<attack goblin>');
  });

  test('should prefer last_message over last_messages', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_message: 'from singular',
        last_messages: [
          { content: 'Welcome adventurer.' },
          { content: 'from array' }
        ]
      }
    };
    expect(adapter.getPlayerMessage(context)).toBe('from singular');
  });

  test('should return null when chat is missing', function () {
    var adapter = new JanitorAIAdapter();
    expect(adapter.getPlayerMessage({})).toBeNull();
  });

  test('should return null when chat has no messages', function () {
    var adapter = new JanitorAIAdapter();
    expect(adapter.getPlayerMessage({ chat: {} })).toBeNull();
  });

  test('should return null when last_messages is empty array', function () {
    var adapter = new JanitorAIAdapter();
    expect(adapter.getPlayerMessage({ chat: { last_messages: [] } })).toBeNull();
  });

  // ----------------------------------------------------------------
  // applyPrompt
  // ----------------------------------------------------------------

  test('should prepend prompt to personality and scenario', function () {
    var adapter = new JanitorAIAdapter();
    var context: Record<string, unknown> = {
      character: {
        personality: 'Existing personality',
        scenario: 'Existing scenario'
      }
    };
    var prompt: OutputPrompt = {
      text: 'combined text',
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
    var character = context['character'] as Record<string, unknown>;
    // Personality should have prompt prepended to existing text
    expect(character['personality']).toContain('Long horizon');
    expect(character['personality']).toContain('Mid term');
    expect(character['personality']).toContain('Existing personality');
    // Scenario should have short-term prepended to existing text
    expect(character['scenario']).toContain('Short term');
    expect(character['scenario']).toContain('Existing scenario');
  });

  test('should work when character fields are initially empty', function () {
    var adapter = new JanitorAIAdapter();
    var context: Record<string, unknown> = {};
    var prompt: OutputPrompt = {
      text: 'combined text',
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
    var character = context['character'] as Record<string, unknown>;
    expect(character['personality']).toContain('Long horizon');
    expect(character['scenario']).toContain('Short term');
  });

  // ----------------------------------------------------------------
  // State persistence (Base64 in [RP_STATE] tags)
  // ----------------------------------------------------------------

  test('should load empty state when no previous LLM response exists', function () {
    var adapter = new JanitorAIAdapter();
    expect(adapter.loadState({})).toEqual({});
  });

  test('should load empty state when less than 2 messages', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_messages: [
          { content: 'Only one message' }
        ]
      }
    };
    expect(adapter.loadState(context)).toEqual({});
  });

  test('should load state from Base64-encoded [RP_STATE] in second-last message', function () {
    var adapter = new JanitorAIAdapter();
    var state = { condition: 'combat', turn: 3 };
    var stateBlock = buildRpStateBlock(state);

    var context = {
      chat: {
        last_messages: [
          { content: 'Some narration with ' + stateBlock + ' in it.' },
          { content: 'Player says something' }
        ]
      }
    };
    expect(adapter.loadState(context)).toEqual(state);
  });

  test('should return empty object when [RP_STATE] block is missing from response', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_messages: [
          { content: 'Narration without state block' },
          { content: 'Player says something' }
        ]
      }
    };
    expect(adapter.loadState(context)).toEqual({});
  });

  test('should save state as Base64 in [RP_STATE] block in personality', function () {
    var adapter = new JanitorAIAdapter();
    var context: Record<string, unknown> = {};
    var state = { condition: 'combat', turn: 3 };
    adapter.saveState(context, state);

    var character = context['character'] as Record<string, unknown>;
    var personality = character['personality'] as string;
    expect(personality).toContain('[RP_STATE]');
    expect(personality).toContain('[/RP_STATE]');
    expect(personality).toContain('MUST include it EXACTLY');
    // Should NOT contain plain JSON (it's Base64-encoded)
    expect(personality).not.toContain('"condition":"combat"');
  });

  test('should produce state that can be round-tripped through load', function () {
    var adapter = new JanitorAIAdapter();
    var state = { condition: 'combat', turn: 3, hp: 42 };

    // Save state into personality
    var saveContext: Record<string, unknown> = {};
    adapter.saveState(saveContext, state);

    // Extract the [RP_STATE] block from personality
    var character = saveContext['character'] as Record<string, unknown>;
    var personality = character['personality'] as string;

    // Simulate the LLM returning the personality verbatim in its response
    var loadContext = {
      chat: {
        last_messages: [
          { content: personality },
          { content: 'Player message' }
        ]
      }
    };
    expect(adapter.loadState(loadContext)).toEqual(state);
  });

  test('should update existing state block on second save', function () {
    var adapter = new JanitorAIAdapter();
    var context: Record<string, unknown> = {};
    adapter.saveState(context, { turn: 1 });
    adapter.saveState(context, { turn: 2 });

    var character = context['character'] as Record<string, unknown>;
    var personality = character['personality'] as string;

    // Should only have one [RP_STATE] block
    var matches = personality.match(/\[RP_STATE\]/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);

    // The state should be the latest one when loaded
    var loadContext = {
      chat: {
        last_messages: [
          { content: personality },
          { content: 'Player message' }
        ]
      }
    };
    expect(adapter.loadState(loadContext)).toEqual({ turn: 2 });
  });

  // ----------------------------------------------------------------
  // Scenario update extraction
  // ----------------------------------------------------------------

  test('should extract scenario update from previous LLM response', function () {
    var adapter = new JanitorAIAdapter();
    var update = {
      elapsed_time: 'PT5M',
      flags: { in_combat: 1 },
      tags: { weather: 'storm' },
      meters: { tension: 0.8 }
    };
    var context = {
      chat: {
        last_messages: [
          { content: 'Narration text [NARRATION_SUMMARY]' + JSON.stringify(update) + '[/NARRATION_SUMMARY]' },
          { content: 'Player message' }
        ]
      }
    };
    expect(adapter.getScenarioUpdate(context)).toEqual(update);
  });

  test('should return null when no narration summary exists', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_messages: [
          { content: 'Narration without summary' },
          { content: 'Player message' }
        ]
      }
    };
    expect(adapter.getScenarioUpdate(context)).toBeNull();
  });

  test('should use defaults for missing ScenarioUpdate fields', function () {
    var adapter = new JanitorAIAdapter();
    var context = {
      chat: {
        last_messages: [
          { content: 'Narration [NARRATION_SUMMARY]{}[/NARRATION_SUMMARY]' },
          { content: 'Player message' }
        ]
      }
    };
    var result = adapter.getScenarioUpdate(context);
    expect(result).not.toBeNull();
    expect(result!.elapsed_time).toBe('PT0S');
    expect(result!.flags).toEqual({});
    expect(result!.tags).toEqual({});
    expect(result!.meters).toEqual({});
  });
});
