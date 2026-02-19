/**
 * Character sheet utilities for managing side effects.
 *
 * These utilities handle:
 * - Applying temporary or permanent side effects to a character sheet
 * - Reverting expired temporary side effects based on timestamp
 * - Managing flags, tags, and meters as side effect modifications
 */

/** 
 * Represents a side effect that can be applied to a character sheet.
 * Side effects modify flags, tags, or meters, and can be temporary (with expiration).
 */
interface SideEffect {
  /** When this side effect expires (null = permanent). */
  expiresAt?: string | null;
  /** Boolean flags to set. */
  flags?: Record<string, boolean>;
  /** String tags to set. */
  tags?: Record<string, string>;
  /** Numeric meters to modify (incremental changes). */
  meters?: Record<string, number>;
}

/**
 * Apply a side effect (or array of side effects) to a character sheet.
 * 
 * For flags and tags: values are directly set.
 * For meters: values are added to existing values (incremental).
 * 
 * Temporary effects are tracked in the sheet's `_temp_effects` array.
 */
function applySideEffect(
  sheet: Record<string, unknown>,
  sideEffect: SideEffect | SideEffect[]
): void {
  const effects = Array.isArray(sideEffect) ? sideEffect : [sideEffect];

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];

    // Apply flags
    if (effect.flags) {
      if (!sheet.flags) {
        sheet.flags = {};
      }
      const sheetFlags = sheet.flags as Record<string, boolean>;
      for (const key in effect.flags) {
        sheetFlags[key] = effect.flags[key];
      }
    }

    // Apply tags
    if (effect.tags) {
      if (!sheet.tags) {
        sheet.tags = {};
      }
      const sheetTags = sheet.tags as Record<string, string>;
      for (const key in effect.tags) {
        sheetTags[key] = effect.tags[key];
      }
    }

    // Apply meters (incremental)
    if (effect.meters) {
      if (!sheet.meters) {
        sheet.meters = {};
      }
      const sheetMeters = sheet.meters as Record<string, number>;
      for (const key in effect.meters) {
        if (sheetMeters[key] === undefined) {
          sheetMeters[key] = 0;
        }
        sheetMeters[key] += effect.meters[key];
      }
    }

    // Track temporary effects
    if (effect.expiresAt) {
      if (!sheet._temp_effects) {
        sheet._temp_effects = [];
      }
      const tempEffects = sheet._temp_effects as Array<Record<string, unknown>>;
      tempEffects.push({
        expiresAt: effect.expiresAt,
        flags: effect.flags || {},
        tags: effect.tags || {},
        meters: effect.meters || {}
      });
    }
  }
}

/**
 * Revert any temporary side effects that have expired.
 * 
 * This function checks the `_temp_effects` array and removes effects
 * where `expiresAt` is in the past relative to `currentTime`.
 * 
 * For flags: reverts to false.
 * For tags: removes the key.
 * For meters: subtracts the original increment.
 */
function revertSideEffect(
  sheet: Record<string, unknown>,
  currentTime: string
): void {
  if (!sheet._temp_effects || !Array.isArray(sheet._temp_effects)) {
    return;
  }

  const tempEffects = sheet._temp_effects as Array<Record<string, unknown>>;
  const remainingEffects: Array<Record<string, unknown>> = [];

  for (let i = 0; i < tempEffects.length; i++) {
    const effect = tempEffects[i];
    const expiresAt = effect.expiresAt as string;

    // Check if effect has expired
    if (expiresAt && expiresAt <= currentTime) {
      // Revert flags
      if (effect.flags && typeof effect.flags === 'object') {
        const sheetFlags = sheet.flags as Record<string, boolean> | undefined;
        if (sheetFlags) {
          const effectFlags = effect.flags as Record<string, boolean>;
          for (const key in effectFlags) {
            sheetFlags[key] = false;
          }
        }
      }

      // Revert tags (remove them)
      if (effect.tags && typeof effect.tags === 'object') {
        const sheetTags = sheet.tags as Record<string, string> | undefined;
        if (sheetTags) {
          const effectTags = effect.tags as Record<string, string>;
          for (const key in effectTags) {
            delete sheetTags[key];
          }
        }
      }

      // Revert meters (subtract the increment)
      if (effect.meters && typeof effect.meters === 'object') {
        const sheetMeters = sheet.meters as Record<string, number> | undefined;
        if (sheetMeters) {
          const effectMeters = effect.meters as Record<string, number>;
          for (const key in effectMeters) {
            if (sheetMeters[key] !== undefined) {
              sheetMeters[key] -= effectMeters[key];
            }
          }
        }
      }
    } else {
      // Effect has not expired, keep it
      remainingEffects.push(effect);
    }
  }

  sheet._temp_effects = remainingEffects;
}

export {
  SideEffect,
  applySideEffect,
  revertSideEffect
};
