import { State, NarrationDirective } from '../../types';

export interface SillyTavernHelper {
    beforeApplyGamePlayOutput?(
        directives: NarrationDirective[],
        state: State,
        effectInstructions: string,
        context: Record<string, unknown>
    ): { directivesBlock?: string, instructionsBlock?: string };
}
