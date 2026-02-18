/**
 * Systems module – exports all platform-specific system adapters.
 *
 * Each system adapter encapsulates the differences between AI platforms:
 * - How to access player input
 * - How to modify prompts to the AI
 * - How to persist game state
 */

export { JanitorAIAdapter } from './janitorai/index';
export { SillyTavernAdapter } from './sillytavern/index';
export { AIDungeonAdapter } from './aidungeon/index';
