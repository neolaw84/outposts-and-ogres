import { JanitorAIHelper } from './types';
import { State, NarrationDirective } from '../../types';
import { formatDirectiveLines } from '../helpers';
import { buildRpStateBlock } from '../../utils/llm-utils';

export class DefaultJanitorAIHelper implements JanitorAIHelper {
    beforeSaveState(state: Record<string, unknown>, context: Record<string, unknown>) {
        const shortState: Record<string, unknown> = { ...state };
        if ('timestamp' in shortState) {
            shortState['ts'] = shortState['timestamp'];
            delete shortState['timestamp'];
        }
        if ('activeConditions' in shortState) {
            shortState['ac'] = shortState['activeConditions'];
            delete shortState['activeConditions'];
        }
        if ('flags' in shortState) {
            shortState['fl'] = shortState['flags'];
            delete shortState['flags'];
        }

        const stateBlock = buildRpStateBlock(shortState);
        const instruction = 'IMPORTANT: The following block contains encoded game state. ' +
            'You MUST include it EXACTLY as-is in your response, without ' +
            'any modification whatsoever.\n' +
            stateBlock;

        return { state, stateBlockInstruction: instruction };
    }

    beforeApplyGamePlayOutput(
        directives: NarrationDirective[],
        state: State,
        effectInstructions: string,
        context: Record<string, unknown>
    ) {
        const lines: string[] = [];
        lines.push('[NARRATION_GUIDE]');
        lines.push(...formatDirectiveLines(directives));
        lines.push('[/NARRATION_GUIDE]');
        const directivesBlock = lines.join('\n');

        let instructionsBlock: string | undefined;
        if (effectInstructions) {
            const elines: string[] = [];
            elines.push('[NARRATION_SUMMARY_INSTRUCTIONS]');
            elines.push(effectInstructions);
            elines.push('[/NARRATION_SUMMARY_INSTRUCTIONS]');
            instructionsBlock = elines.join('\n');
        }

        return { directivesBlock, instructionsBlock };
    }
}
