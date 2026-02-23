import { SillyTavernAdapter } from '../src/platform/sillytavern/index';

describe('SillyTavernAdapter', () => {
  test('should have correct name', () => {
    const adapter = new SillyTavernAdapter({});
    expect(adapter.name).toBe('SillyTavern');
  });

  test('should extract player message from chat array', () => {
    const context = {
      chat: [
        { is_user: 'false', mes: 'Welcome adventurer.' },
        { is_user: 'true', mes: '<attack goblin>' }
      ]
    };
    const adapter = new SillyTavernAdapter(context);
    expect(adapter.getPlayerMessage()).toBe('<attack goblin>');
  });

  test('should return null when chat is empty', () => {
    const adapter = new SillyTavernAdapter({ chat: [] });
    expect(adapter.getPlayerMessage()).toBeNull();
  });

  beforeEach(() => {
    // Reset globalThis mock before each test but keep a persistent reference to context
    const mockContext = {
      chatMetadata: {} as Record<string, any>,
      saveMetadata: jest.fn()
    };
    (globalThis as any).SillyTavern = {
      getContext: () => mockContext
    };
  });

  afterAll(() => {
    delete (globalThis as any).SillyTavern;
  });

  test('should load empty state when none exists', () => {
    const adapter = new SillyTavernAdapter({});
    expect(adapter.loadState()).toEqual({});
  });

  test('should save and load state via chatMetadata', () => {
    const context: Record<string, unknown> = {};
    const adapter = new SillyTavernAdapter(context);
    const state = { condition: 'combat', turn: 3 };
    adapter.saveState(state);

    // Check that it was saved globally
    const stGlobal = (globalThis as any).SillyTavern.getContext();
    expect(stGlobal.chatMetadata['outposts-and-ogres-state'].gameState).toEqual(state);

    // Check that it can be loaded
    expect(adapter.loadState()).toEqual(state);
  });

  // ----------------------------------------------------------------
  // getScenarioUpdate
  // ----------------------------------------------------------------

  test('should extract scenario update from chatMetadata', () => {
    const update = {
      elapsed_time: 'PT2M',
      flags: { door_open: 0 },
      tags: { npc_mood: 'hostile' },
      meters: { distance_to_exit: 12 },
      effects: []
    };

    // Pre-populate global mock
    (globalThis as any).SillyTavern.getContext().chatMetadata['outposts-and-ogres-state'] = {
      lastNarrationSummary: update
    };

    const adapter = new SillyTavernAdapter({});
    expect(adapter.getScenarioUpdate()).toEqual(update);
  });

  test('should return null when last AI message has no summary in metadata', () => {
    const adapter = new SillyTavernAdapter({});
    expect(adapter.getScenarioUpdate()).toBeNull();
  });
});
