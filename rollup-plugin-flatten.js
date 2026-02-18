// Custom Rollup plugin to remove export statements and create flat file
function flattenBundle() {
  return {
    name: 'flatten-bundle',
    renderChunk(code) {
      // Remove export statements and expose via global variable
      let flatCode = code.replace(/export\s*\{[^}]+\};?\s*$/gm, '');
      
      // Add global variable assignment at the end
      flatCode += '\n// Expose to global scope\n';
      flatCode += 'if (typeof window !== "undefined") {\n';
      flatCode += '  window.OutpostsAndOgres = rpgSystem;\n';
      flatCode += '  window.Character = Character;\n';
      flatCode += '} else if (typeof global !== "undefined") {\n';
      flatCode += '  global.OutpostsAndOgres = rpgSystem;\n';
      flatCode += '  global.Character = Character;\n';
      flatCode += '}\n';
      
      return { code: flatCode, map: null };
    }
  };
}

module.exports = flattenBundle;
