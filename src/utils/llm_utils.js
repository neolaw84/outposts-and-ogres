const LLMUtils = {
    // Parse LLM input string to object
    parseInput: function (input) {
        if (typeof input === 'object' && input !== null) return input;
        try {
            return JSON.parse(input);
        } catch (e) {
            return { error: "Failed to parse JSON", raw: input };
        }
    },

    // Validate input recursively and return a mirror object indicating validity
    cleanInput: function (inputObject) {
        const result = {};

        // 1. Validate elapsed_time
        if (typeof inputObject.elapsed_time === 'string' && inputObject.elapsed_time.indexOf('P') === 0) {
            result.elapsed_time = true;
        } else {
            result.elapsed_time = false;
        }

        // 2. Validate effects
        if (Array.isArray(inputObject.effects)) {
            result.effects = [];
            for (let i = 0; i < inputObject.effects.length; i++) {
                const eff = inputObject.effects[i];
                const resEff = {};

                // Key
                resEff.key = (typeof eff.key === 'string' && eff.key.length > 0);

                // What
                resEff.what = (typeof eff.what === 'string');

                // When
                // Using TimeUtils.isValidDateStr if available in scope (it is in our build)
                resEff.when = (typeof eff.when === 'string' && TimeUtils.isValidDateStr(eff.when));

                // Flags
                if (eff.flags && typeof eff.flags === 'object') {
                    resEff.flags = {};
                    for (const k in eff.flags) {
                        resEff.flags[k] = (typeof eff.flags[k] === 'boolean');
                    }
                }

                // Tags
                if (eff.tags && typeof eff.tags === 'object') {
                    resEff.tags = {};
                    for (const k in eff.tags) {
                        resEff.tags[k] = (typeof eff.tags[k] === 'string');
                    }
                }

                // Meters
                if (eff.meters && typeof eff.meters === 'object') {
                    resEff.meters = {};
                    for (const k in eff.meters) {
                        resEff.meters[k] = (typeof eff.meters[k] === 'number');
                    }
                }

                result.effects.push(resEff);
            }
        } else {
            result.effects = false;
        }

        // 3. Debug
        if (inputObject.debug) {
            result.debug = true;
        }

        return result;
    },

    // Return instruction block with encoded state (Base64 only)
    encodeState: function (characterSheet) {
        if (!characterSheet) return "";
        const jsonStr = JSON.stringify(characterSheet);
        const b64 = Base64.encodeRaw(jsonStr);
        return b64;
    },

    // Extract and decode state from message
    decodeState: function (message) {
        if (!message) return null;
        const startTag = "[RP_STATE]";
        const endTag = "[/RP_STATE]";
        const startIndex = message.indexOf(startTag);
        const endIndex = message.indexOf(endTag);

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) return null;

        const b64 = message.substring(startIndex + startTag.length, endIndex);
        try {
            const jsonStr = Base64.decodeRaw(b64);
            return JSON.parse(jsonStr);
        } catch (e) {
            return null;
        }
    },

    // Extract [NARRATION_SUMMARY] JSON from message (last occurrence)
    extractNarrationSummary: function (message) {
        if (!message) return null;
        const endTag = "[/NARRATION_SUMMARY]";
        const startTag = "[NARRATION_SUMMARY]";

        const endIndex = message.lastIndexOf(endTag);
        if (endIndex === -1) return null;

        const startIndex = message.lastIndexOf(startTag, endIndex);
        if (startIndex === -1) return null;

        const jsonStr = message.substring(startIndex + startTag.length, endIndex);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            return null;
        }
    },


    // Generate instruction for LLM to include a specific effect
    // based on user defined effect definition
    generateEffectInstruction: function (effectDef) {
        if (!effectDef || !effectDef.key || !effectDef.condition) return "";

        // Create a copy to remove 'condition' property for the JSON block
        const jsonBlock = {};
        for (const key in effectDef) {
            if (key !== 'condition') {
                jsonBlock[key] = effectDef[key];
            }
        }

        const jsonString = JSON.stringify(jsonBlock, null, 4);

        return `In the above narration of yours, if and only if ${effectDef.condition}, include one instance of the following in the "effects" array.\n\n${jsonString}`;
    },

    findEffectByKey: function (key, naSum, typeChecks) {
        let foundEffect = null;
        let foundTypeCheck = null;

        if (naSum.effects && Array.isArray(naSum.effects)) {
            for (let j = 0; j < naSum.effects.length; j++) {
                if (naSum.effects[j].key === key) {
                    foundEffect = naSum.effects[j];
                    if (typeChecks.effects && typeChecks.effects[j]) {
                        foundTypeCheck = typeChecks.effects[j];
                    }
                    break;
                }
            }
        }

        return { effect: foundEffect, typeCheck: foundTypeCheck };
    }
};


if (typeof module !== 'undefined') module.exports = LLMUtils;
