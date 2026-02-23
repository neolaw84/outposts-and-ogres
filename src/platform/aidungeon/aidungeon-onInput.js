const modifier = (text) => {
    state.raw_text_input = text;
    if (typeof onoOnInput === 'function') {
        text = onoOnInput(text).text;
    }
}

// Don't modify this part
modifier(text)
