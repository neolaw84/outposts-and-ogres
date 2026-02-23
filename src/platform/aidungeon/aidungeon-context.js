const modifier = (text) => {
    state.raw_text_input = state.raw_text_input || "";
    // usual turn processing starting with time, expiring efects etc. 
    // now, reset everything that is used to persist input/signals
    // between on input and context calls
    state.raw_text_input = "";
    state.signals = {}; // or are we using an array ?

    if (typeof onoContext === 'function') {
        text = onoContext(text).text;
    }
    return { text };
}

// Don't modify this part
modifier(text)
