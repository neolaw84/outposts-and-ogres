import { JanitorAIAdapter } from '../src/systems/janitorai/index';
import { OutputPrompt } from '../src/types';
import { encodeState, buildRpStateBlock } from '../src/utils/llm-utils';

describe('JanitorAIAdapter', function () {
  test('should have correct name', function () {
    var adapter = new JanitorAIAdapter({});
    expect(adapter.name).toBe('Janitor AI');
  });

  // ----------------------------------------------------------------
  // getPlayerMessage
  // ----------------------------------------------------------------

  test('should extract player message from chat.last_message (singular)', function () {
    var context = {
      chat: {
        last_message: '<attack goblin>'
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.getPlayerMessage()).toBe('<attack goblin>');
  });

  test('should extract player message from chat.last_messages (last item)', function () {
    var context = {
      chat: {
        last_messages: [
          { message: 'Welcome adventurer.' },
          { message: '<attack goblin>' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.getPlayerMessage()).toBe('<attack goblin>');
  });

  test('should prefer last_message over last_messages', function () {
    var context = {
      chat: {
        last_message: 'from singular',
        last_messages: [
          { message: 'Welcome adventurer.' },
          { message: 'from array' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.getPlayerMessage()).toBe('from singular');
  });

  test('should return null when chat is missing', function () {
    var adapter = new JanitorAIAdapter({});
    expect(adapter.getPlayerMessage()).toBeNull();
  });

  test('should return null when chat has no messages', function () {
    var adapter = new JanitorAIAdapter({ chat: {} });
    expect(adapter.getPlayerMessage()).toBeNull();
  });

  test('should return null when last_messages is empty array', function () {
    var adapter = new JanitorAIAdapter({ chat: { last_messages: [] } });
    expect(adapter.getPlayerMessage()).toBeNull();
  });

  // ----------------------------------------------------------------
  // applyPrompt
  // ----------------------------------------------------------------

  test('should prepend prompt to personality and scenario', function () {
    var context: Record<string, unknown> = {
      character: {
        personality: 'Existing personality',
        scenario: 'Existing scenario'
      }
    };
    var adapter = new JanitorAIAdapter(context);
    var prompt: OutputPrompt = {
      text: 'combined text',
      channels: {
        longHorizon: 'Long horizon',
        midTerm: 'Mid term',
        shortTerm: 'Short term',
        combined: 'Long horizon\n\nMid term\n\nShort term'
      },
      events: []
    };
    adapter.applyPrompt(prompt);
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
    var context: Record<string, unknown> = {};
    var adapter = new JanitorAIAdapter(context);
    var prompt: OutputPrompt = {
      text: 'combined text',
      channels: {
        longHorizon: 'Long horizon',
        midTerm: 'Mid term',
        shortTerm: 'Short term',
        combined: 'Long horizon\n\nMid term\n\nShort term'
      },
      events: []
    };
    adapter.applyPrompt(prompt);
    var character = context['character'] as Record<string, unknown>;
    expect(character['personality']).toContain('Long horizon');
    expect(character['scenario']).toContain('Short term');
  });

  // ----------------------------------------------------------------
  // State persistence (Base64 in [RP_STATE] tags)
  // ----------------------------------------------------------------

  test('should load empty state when no previous LLM response exists', function () {
    var adapter = new JanitorAIAdapter({});
    expect(adapter.loadState()).toEqual({});
  });

  test('should load empty state when less than 2 messages', function () {
    var context = {
      chat: {
        last_messages: [
          { message: 'Only one message' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.loadState()).toEqual({});
  });

  test('should load state from Base64-encoded [RP_STATE] in second-last message', function () {
    var state = { condition: 'combat', turn: 3 };
    var stateBlock = buildRpStateBlock(state);

    var context = {
      chat: {
        last_messages: [
          { message: 'Some narration with ' + stateBlock + ' in it.' },
          { message: 'Player says something' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.loadState()).toEqual(state);
  });

  test('should return empty object when [RP_STATE] block is missing from response', function () {
    var context = {
      chat: {
        last_messages: [
          { message: 'Narration without state block' },
          { message: 'Player says something' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.loadState()).toEqual({});
  });

  test('should save state as Base64 in [RP_STATE] block in personality', function () {
    var context: Record<string, unknown> = {};
    var adapter = new JanitorAIAdapter(context);
    var state = { condition: 'combat', turn: 3 };
    adapter.saveState(state);

    var character = context['character'] as Record<string, unknown>;
    var personality = character['personality'] as string;
    expect(personality).toContain('[RP_STATE]');
    expect(personality).toContain('[/RP_STATE]');
    expect(personality).toContain('MUST include it EXACTLY');
    // Should NOT contain plain JSON (it's Base64-encoded)
    expect(personality).not.toContain('"condition":"combat"');
  });

  test('should produce state that can be round-tripped through load', function () {
    var state = { condition: 'combat', turn: 3, hp: 42 };

    // Save state into personality
    var saveContext: Record<string, unknown> = {};
    var saveAdapter = new JanitorAIAdapter(saveContext);
    saveAdapter.saveState(state);

    // Extract the [RP_STATE] block from personality
    var character = saveContext['character'] as Record<string, unknown>;
    var personality = character['personality'] as string;

    // Simulate the LLM returning the personality verbatim in its response
    var loadContext = {
      chat: {
        last_messages: [
          { message: personality },
          { message: 'Player message' }
        ]
      }
    };
    var loadAdapter = new JanitorAIAdapter(loadContext);
    expect(loadAdapter.loadState()).toEqual(state);
  });

  test('should update existing state block on second save', function () {
    var context: Record<string, unknown> = {};
    var adapter = new JanitorAIAdapter(context);
    adapter.saveState({ turn: 1 });
    adapter.saveState({ turn: 2 });

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
          { message: personality },
          { message: 'Player message' }
        ]
      }
    };
    var loadAdapter = new JanitorAIAdapter(loadContext);
    expect(loadAdapter.loadState()).toEqual({ turn: 2 });
  });

  // ----------------------------------------------------------------
  // Scenario update extraction
  // ----------------------------------------------------------------

  test('should extract scenario update from previous LLM response', function () {
    var update = {
      elapsed_time: 'PT5M',
      flags: { in_combat: 1 },
      tags: { weather: 'storm' },
      meters: { tension: 0.8 }
    };
    var context = {
      chat: {
        last_messages: [
          { message: 'Narration text [NARRATION_SUMMARY]' + JSON.stringify(update) + '[/NARRATION_SUMMARY]' },
          { message: 'Player message' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.getScenarioUpdate()).toEqual({ ...update, effects: [] });
  });

  test('should return null when no narration summary exists', function () {
    var context = {
      chat: {
        last_messages: [
          { message: 'Narration without summary' },
          { message: 'Player message' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    expect(adapter.getScenarioUpdate()).toBeNull();
  });

  test('should use defaults for missing ScenarioUpdate fields', function () {
    var context = {
      chat: {
        last_messages: [
          { message: 'Narration [NARRATION_SUMMARY]{}[/NARRATION_SUMMARY]' },
          { message: 'Player message' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    var result = adapter.getScenarioUpdate();
    expect(result).not.toBeNull();
    expect(result!.elapsed_time).toBe('PT0S');
    expect(result!.flags).toEqual({});
    expect(result!.tags).toEqual({});
    expect(result!.meters).toEqual({});
    expect(result!.effects).toEqual([]);
  });

  test('should include effects array in scenario update', function () {
    var summary = {
      elapsed_time: 'PT5M',
      effects: [
        { key: 'drink_potion', what: 'healing', meters: { potency: 3 } }
      ]
    };
    var context = {
      chat: {
        last_messages: [
          { message: 'Narration [NARRATION_SUMMARY]' + JSON.stringify(summary) + '[/NARRATION_SUMMARY]' },
          { message: 'Player message' }
        ]
      }
    };
    var adapter = new JanitorAIAdapter(context);
    var result = adapter.getScenarioUpdate();
    expect(result).not.toBeNull();
    expect(result!.effects).toBeDefined();
    expect(result!.effects!.length).toBe(1);
    expect(result!.effects![0]['key']).toBe('drink_potion');
  });
});
