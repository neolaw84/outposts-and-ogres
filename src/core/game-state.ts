import { State, SideEffect, StoredSideEffect, StoredStatImpact } from '../types';
import { isPast } from '../utils/time-utils';

/** Apply side effects to a State. Returns a new State (immutable). */
function applySideEffect(sheet: State, sideEffects: SideEffect | SideEffect[] | null): State {
  const newSheet: State = JSON.parse(JSON.stringify(sheet));

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

          const storedImpact: StoredStatImpact = {
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

    // Only track effects with valid expiry
    if (sideEffectEntry.expiry && sideEffectEntry.expiry !== null) {
      if (!newSheet.activeConditions) {
        newSheet.activeConditions = [];
      }
      newSheet.activeConditions.push(sideEffectEntry);
    }
  }

  return newSheet;
}

/** Revert expired side effects. Returns a new State (immutable). */
function revertSideEffect(sheet: State): State {
  const newSheet: State = JSON.parse(JSON.stringify(sheet));
  const currentTime = newSheet.timestamp;

  if (!newSheet.activeConditions) return newSheet;

  const activeEffects: StoredSideEffect[] = [];
  for (let i = 0; i < newSheet.activeConditions.length; i++) {
    const eff = newSheet.activeConditions[i];
    let shouldExpire = false;

    if (eff.expiry) {
      if (isPast(eff.expiry, currentTime)) {
        shouldExpire = true;

        // re_lock flags prevent expiration
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

  newSheet.activeConditions = activeEffects;
  return newSheet;
}

export { applySideEffect, revertSideEffect };
