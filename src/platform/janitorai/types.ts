import { State, NarrationDirective } from '../../types';

export interface JanitorAIHelper {
    beforeSaveState?(state: Record<string, unknown>, context: Record<string, unknown>): { state: Record<string, unknown>, stateBlockInstruction?: string };
    afterSaveState?(context: Record<string, unknown>): void;

    beforeApplyGamePlayOutput?(
        directives: NarrationDirective[],
        state: State,
        effectInstructions: string,
        context: Record<string, unknown>
    ): { directivesBlock?: string, instructionsBlock?: string };
}
