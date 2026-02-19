function extractMatch(allowedValues, defaultValue, inputValue) {
    const lowerWhat = inputValue.toLowerCase();

    if (allowedValues.indexOf(lowerWhat) !== -1) {
        return lowerWhat;
    }

    for (let i = 0; i < allowedValues.length; i++) {
        if (lowerWhat.indexOf(allowedValues[i]) !== -1 ||
            allowedValues[i].indexOf(lowerWhat) !== -1) {
            return allowedValues[i];
        }
    }

    return defaultValue;
}

const TextUtils = {
    extractMatch
};

if (typeof module !== 'undefined') module.exports = TextUtils;
