/** Match input against allowed values: exact, then substring, then default. */
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
