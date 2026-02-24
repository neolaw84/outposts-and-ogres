import { State, NarrationDirective } from '../../types';

export interface AIDungeonHelper {
    beforeApplyGamePlayOutput?(
        directives: NarrationDirective[],
        state: State,
        effectInstructions: string,
        context: Record<string, unknown>
    ): { promptString?: string, memoryContext?: string, authorsNote?: string, frontMemory?: string };
}
