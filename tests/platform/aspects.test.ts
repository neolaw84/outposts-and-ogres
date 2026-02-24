import { JanitorAIAdapter } from '../../src/platform/janitorai';
import { State, NarrationDirective } from '../../src/types';
import { JanitorAIHelper } from '../../src/platform/janitorai/types';

describe('JanitorAI Aspect Helpers Injection', () => {

    it('should use beforeSaveState hook to manipulate state block instruction and shortState', () => {
        // A mock context representing the platform runtime environment
        const context: Record<string, unknown> = { character: { personality: '' } };

        // Custom helper overriding default saves
        const customHelper: JanitorAIHelper = {
            beforeSaveState(state, ctx) {
                // We override state directly and override the prompt instruction
                const overridenState = { ...state, customPropertyAdded: true };
                return {
                    state: overridenState,
                    stateBlockInstruction: '[CUSTOM_INSTRUCTION]\nEncoded state below:\n'
                };
            },
            afterSaveState(ctx) {
                // Tag context after the core logic saves
                ctx.savedCustomHook = true;
            }
        };

        const adapter = new JanitorAIAdapter(context, customHelper);

        const testState: State = { timestamp: '123', stats: {}, activeConditions: [], flags: [] };

        adapter.saveState(testState as unknown as Record<string, unknown>);

        // Assert on context side effects
        const character = context['character'] as Record<string, unknown>;
        expect(character['personality']).toContain('[CUSTOM_INSTRUCTION]');

        // Validate after hook ran
        expect(context['savedCustomHook']).toBe(true);
    });

    it('should use beforeApplyGamePlayOutput hook to override directives and instructions blocks', () => {
        const context: Record<string, unknown> = { character: { scenario: '' } };

        const customHelper: JanitorAIHelper = {
            beforeApplyGamePlayOutput(directives, state, effectInstructions, ctx) {
                return {
                    directivesBlock: '[OVERRIDE_DIRECTIVES]\nCustom format\n[/OVERRIDE_DIRECTIVES]',
                    instructionsBlock: effectInstructions ? '[OVERRIDE_INSTRUCTIONS]\nCustom instructions\n[/OVERRIDE_INSTRUCTIONS]' : undefined
                };
            }
        };

        const adapter = new JanitorAIAdapter(context, customHelper);

        const testState: State = { timestamp: '123', stats: {}, activeConditions: [], flags: [] };
        const directives: NarrationDirective[] = [
            { ruleKey: 'test', mustHappen: ['Do this'], mustNotHappen: [], mayHappen: [] }
        ];

        adapter.applyGamePlayOutput(directives, testState, 'Custom Effect');

        const character = context['character'] as Record<string, unknown>;
        expect(character['scenario']).toContain('[OVERRIDE_DIRECTIVES]');
        expect(character['scenario']).toContain('Custom format');
        expect(character['scenario']).toContain('[OVERRIDE_INSTRUCTIONS]');
    });

    it('should gracefully continue using default internal strings when no hooks are supplied', () => {
        const context: Record<string, unknown> = { character: { personality: '', scenario: '' } };
        const adapter = new JanitorAIAdapter(context); // No helper provided

        const testState: State = { timestamp: '123', stats: {}, activeConditions: [], flags: [] };
        const directives: NarrationDirective[] = [
            { ruleKey: 'r1', mustHappen: ['Do this'], mustNotHappen: [], mayHappen: [] }
        ];

        adapter.saveState(testState as unknown as Record<string, unknown>);
        let character = context['character'] as Record<string, unknown>;
        expect(character['personality']).toContain('IMPORTANT: The following block contains encoded game state.');

        adapter.applyGamePlayOutput(directives, testState, 'Custom Effect');
        character = context['character'] as Record<string, unknown>;
        expect(character['scenario']).toContain('[NARRATION_GUIDE]');
        expect(character['scenario']).toContain('MUST: Do this');
    });

});
