import { JanitorAIAdapter } from '../../src/platform/janitorai/index';
import { SillyTavernAdapter } from '../../src/platform/sillytavern/index';
import { AIDungeonAdapter } from '../../src/platform/aidungeon/index';
import { NarrationDirective, State } from '../../src/types';

function makeSampleEvents(): NarrationDirective[] {
  return [
    {
      ruleKey: 'drink_potion',
      mustHappen: [],
      mustNotHappen: ['Do not narrate player drinking a potion.'],
      mayHappen: ['You may describe a potion bottle on a shelf.']
    },
    {
      ruleKey: 'attack',
      mustHappen: ['Player strikes the goblin decisively.'],
      mustNotHappen: ['Goblin must not die from this single hit.'],
      mayHappen: ['Goblin staggers backward.']
    }
  ];
}

const sampleEffectInstructions =
  'In the above narration of yours, if and only if {{user}} drinks a potion, ' +
  'include one instance of the following in the "effects" array.\n\n' +
  '{\n    "key": "drink_potion",\n    "what": "healing"\n}';

const sampleState: State = {
  timestamp: '1000-01-01T08:00:00',
  stats: { hp: 100 },
  activeConditions: [],
  flags: []
};

describe('Platform.applyGamePlayOutput', () => {
  describe('JanitorAIAdapter', () => {
    test('applyGamePlayOutput injects MUST/MUST NOT/MAY into scenario', () => {
      const context: Record<string, unknown> = {
        character: { personality: '', scenario: '' }
      };
      const adapter = new JanitorAIAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, sampleEffectInstructions);

      const character = context['character'] as Record<string, unknown>;
      const scenario = character['scenario'] as string;
      expect(scenario).toContain('MUST: Player strikes the goblin decisively.');
      expect(scenario).toContain('MUST NOT: Do not narrate player drinking a potion.');
      expect(scenario).toContain('MUST NOT: Goblin must not die from this single hit.');
      expect(scenario).toContain('MAY: You may describe a potion bottle on a shelf.');
      expect(scenario).toContain('[NARRATION_GUIDE]');
      expect(scenario).toContain('[/NARRATION_GUIDE]');
    });

    test('applyGamePlayOutput includes effect instructions', () => {
      const context: Record<string, unknown> = {
        character: { personality: '', scenario: '' }
      };
      const adapter = new JanitorAIAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, sampleEffectInstructions);

      const character = context['character'] as Record<string, unknown>;
      const scenario = character['scenario'] as string;
      expect(scenario).toContain('drinks a potion');
      expect(scenario).toContain('drink_potion');
      expect(scenario).toContain('[NARRATION_SUMMARY_INSTRUCTIONS]');
      expect(scenario).toContain('"effects" array');
    });
  });

  describe('SillyTavernAdapter', () => {
    test('applyGamePlayOutput sets systemPrompt', () => {
      const context: Record<string, unknown> = {};
      const adapter = new SillyTavernAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, sampleEffectInstructions);

      const systemPrompt = context['systemPrompt'] as string;
      expect(systemPrompt).toContain('MUST: Player strikes the goblin decisively.');
      expect(systemPrompt).toContain('MUST NOT: Do not narrate player drinking a potion.');
      expect(systemPrompt).toContain('MAY: You may describe a potion bottle on a shelf.');
      expect(systemPrompt).toContain('drinks a potion');
      expect(systemPrompt).toContain('"effects" array');
    });
  });

  describe('AIDungeonAdapter', () => {
    test('applyGamePlayOutput sets memory channels', () => {
      const context: Record<string, unknown> = {
        state: {}
      };
      const adapter = new AIDungeonAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, sampleEffectInstructions);

      const state = context['state'] as Record<string, unknown>;
      const memory = state['memory'] as Record<string, unknown>;
      expect(memory['context']).toContain('MUST');
      expect(memory['context']).toContain('Player strikes the goblin decisively.');
      expect(memory['context']).toContain('MUST NOT');
      expect(memory['context']).toContain('Do not narrate player drinking a potion.');
      expect(memory['authorsNote']).toContain('MAY');
      expect(memory['authorsNote']).toContain('You may describe a potion bottle on a shelf.');
      expect(memory['frontMemory']).toContain('drinks a potion');
      expect(memory['frontMemory']).toContain('"effects" array');
    });
  });
});
