/**
 * Text matching utilities.
 *
 * Provides fuzzy matching against a list of allowed values.
 */

/**
 * Match an input value against a list of allowed values.
 * Returns the first exact match (case-insensitive), then tries
 * substring matching in both directions. Falls back to defaultValue.
 */
function extractMatch(allowedValues: string[], defaultValue: string, inputValue: string): string {
  const lowerWhat = inputValue.toLowerCase();

  if (allowedValues.indexOf(lowerWhat) !== -1) {
    return lowerWhat;
  }

  for (var i = 0; i < allowedValues.length; i++) {
    if (lowerWhat.indexOf(allowedValues[i]) !== -1 ||
      allowedValues[i].indexOf(lowerWhat) !== -1) {
      return allowedValues[i];
    }
  }

  return defaultValue;
}

export { extractMatch };
