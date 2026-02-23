const modifier = (text) => {
    if (typeof onoOnOutput === 'function') {
        text = onoOnOutput(text).text;
    }
    return { text };
}

// Don't modify this part
modifier(text)
