import { SillyTavernHelper } from './types';
import { State, NarrationDirective } from '../../types';
import { formatDirectiveLines } from '../helpers';

export class DefaultSillyTavernHelper implements SillyTavernHelper {
    beforeApplyGamePlayOutput(
        directives: NarrationDirective[],
        state: State,
        effectInstructions: string,
        context: Record<string, unknown>
    ) {
        const directivesBlock = formatDirectiveLines(directives).join('\n');
        const instructionsBlock = effectInstructions || undefined;
        return { directivesBlock, instructionsBlock };
    }
}
