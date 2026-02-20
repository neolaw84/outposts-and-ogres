/**
 * Character sheet utilities for applying and reverting side effects.
 *
 * This module owns all mutations to the character sheet state.
 * - applySideEffect: Applies impacts to stats, tracks temporary effects in se[] for later reversion.
 * - revertSideEffect: Checks expired effects against current time and reverts them.
 */

import { CharacterSheet, SideEffect, StoredSideEffect, StoredImpact } from '../types';
import { isPast } from '../utils/time-utils';

/**
 * Apply one or more side effects to a character sheet.
 * Returns a new sheet (immutable – the original is not modified).
 *
 * For each impact:
 *   - "set": replaces the stat value
 *   - "add": adds to the stat value
 *   - "sub": subtracts from the stat value
 *
 * If the side effect has an expiry, it is stored in the se[] array
 * with original values for later reversion.
 */
function applySideEffect(sheet: CharacterSheet, sideEffects: SideEffect | SideEffect[] | null): CharacterSheet {
  const newSheet: CharacterSheet = JSON.parse(JSON.stringify(sheet));

  if (!sideEffects) return newSheet;

  const effectsList: SideEffect[] = Array.isArray(sideEffects) ? sideEffects : [sideEffects];

  for (let k = 0; k < effectsList.length; k++) {
    const sideEffect = effectsList[k];
    if (!sideEffect) continue;

    const sideEffectEntry: StoredSideEffect = {
      desc: sideEffect.what,
      expiry: sideEffect.expiry || null,
      re_lock: sideEffect.re_lock || null,
      impacts: []
    };

    if (sideEffect.impacts) {
      for (let i = 0; i < sideEffect.impacts.length; i++) {
        const imp = sideEffect.impacts[i];
        const statKey = imp.stats;

        if (newSheet.stats && typeof newSheet.stats[statKey] !== 'undefined') {
          const currentValue = newSheet.stats[statKey];
          let newValue = currentValue;

          const storedImpact: StoredImpact = {
            stats: statKey,
            op: imp.op,
            val: imp.val,
            oriVal: currentValue
          };

          if (imp.op === 'set') {
            newValue = imp.val;
          } else if (imp.op === 'add') {
            newValue = currentValue + imp.val;
          } else if (imp.op === 'sub') {
            newValue = currentValue - imp.val;
          }

          newSheet.stats[statKey] = newValue;
          if (sideEffectEntry.expiry) {
            sideEffectEntry.impacts.push(storedImpact);
          }
        }
      }
    }

    // Only track side effects with valid expiry (saves tokens)
    if (sideEffectEntry.expiry && sideEffectEntry.expiry !== null) {
      if (!newSheet.se) {
        newSheet.se = [];
      }
      newSheet.se.push(sideEffectEntry);
    }
  }

  return newSheet;
}

/**
 * Revert expired side effects from a character sheet.
 * Returns a new sheet (immutable – the original is not modified).
 *
 * For each stored effect:
 *   - If current time has passed the expiry, check re_lock flags.
 *   - If no re_lock prevents it, reverse the impacts:
 *     - "set": restore to oriVal
 *     - "add": subtract the val back
 *     - "sub": add the val back
 *   - Remove the effect from se[].
 */
function revertSideEffect(sheet: CharacterSheet): CharacterSheet {
  const newSheet: CharacterSheet = JSON.parse(JSON.stringify(sheet));
  const currentTime = newSheet.cur_ts;

  if (!newSheet.se) return newSheet;

  const activeEffects: StoredSideEffect[] = [];
  for (let i = 0; i < newSheet.se.length; i++) {
    const eff = newSheet.se[i];
    let shouldExpire = false;

    if (eff.expiry) {
      if (isPast(eff.expiry, currentTime)) {
        shouldExpire = true;

        // Check for re_locks that prevent expiration
        if (eff.re_lock && Array.isArray(eff.re_lock)) {
          for (let k = 0; k < eff.re_lock.length; k++) {
            const lockKey = eff.re_lock[k];
            if (newSheet.stats && newSheet.stats[lockKey]) {
              shouldExpire = false;
              break;
            }
          }
        }
      }
    }

    if (shouldExpire) {
      if (eff.impacts) {
        for (let j = 0; j < eff.impacts.length; j++) {
          const imp = eff.impacts[j];
          const statKey = imp.stats;

          if (newSheet.stats && typeof newSheet.stats[statKey] !== 'undefined') {
            if (imp.op === 'set') {
              if (typeof imp.oriVal !== 'undefined') {
                newSheet.stats[statKey] = imp.oriVal;
              }
            } else if (imp.op === 'add') {
              newSheet.stats[statKey] -= imp.val;
            } else if (imp.op === 'sub') {
              newSheet.stats[statKey] += imp.val;
            }
          }
        }
      }
    } else {
      activeEffects.push(eff);
    }
  }

  newSheet.se = activeEffects;
  return newSheet;
}

export { applySideEffect, revertSideEffect };
