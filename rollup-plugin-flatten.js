// Custom Rollup plugin to remove export statements and create flat file
function flattenBundle() {
  return {
    name: 'flatten-bundle',
    renderChunk(code) {
      // Remove export statements to produce a plain self-contained JS file
      let flatCode = code.replace(/export\s*\{[^}]+\};?\s*$/gm, '');
      return { code: flatCode, map: null };
    }
  };
}

module.exports = flattenBundle;
