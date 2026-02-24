import { AIDungeonHelper } from './types';
import { State, NarrationDirective } from '../../types';
import { collectDirectiveArrays } from '../helpers';

export class DefaultAIDungeonHelper implements AIDungeonHelper {
    beforeApplyGamePlayOutput(
        directives: NarrationDirective[],
        state: State,
        effectInstructions: string,
        context: Record<string, unknown>
    ) {
        const { mustLines, mustNotLines, mayLines } = collectDirectiveArrays(directives);

        const contextParts: string[] = [];
        if (mustLines.length > 0) { contextParts.push('MUST:\n' + mustLines.join('\n')); }
        if (mustNotLines.length > 0) { contextParts.push('MUST NOT:\n' + mustNotLines.join('\n')); }
        const memoryContext = contextParts.join('\n');

        const authorsNote = mayLines.length > 0 ? 'MAY:\n' + mayLines.join('\n') : '';
        const frontMemory = effectInstructions;

        return { memoryContext, authorsNote, frontMemory };
    }
}
