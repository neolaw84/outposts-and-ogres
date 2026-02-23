const fs = require('fs');
const file = 'src/cartridges/basic-fantasy.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace top level `breakpoints` and add `debug: true`
code = code.replace(/version: '1\.0\.0',/, "debug: true,\n  version: '1.0.0',");

// Replace the long formatted outcomes
code = code.replace(/outcome: \{\n\s+actionName:[^\n]+,\n\s+actionTarget:[^\n]+,\n\s+status:[^\n]+,\n\s+mechanicsLogs: \[([^\]]*)\],\n\s+mustHappen: (\[[^\]]*\]),\n\s+mustNotHappen: (\[[^\]]*\]),\n\s+mayHappen: (\[[^\]]*\])\n\s+\}/g,
  "ruleDebugLogs: [$1],\n          mustHappen: $2,\n          mustNotHappen: $3,\n          mayHappen: $4");

// Replace the simple neutral outcomes without actionName
code = code.replace(/outcome: \{\n\s+status: 'neutral', mechanicsLogs: \[\],\n\s+mustHappen: (\[[^\]]*\]),\n\s+mustNotHappen: (\[[^\]]*\]),\n\s+mayHappen: (\[[^\]]*\])\n\s+\}/g,
  "ruleDebugLogs: [],\n          mustHappen: $1,\n          mustNotHappen: $2,\n          mayHappen: $3");


// Replace the specific outcome block in combat_event
code = code.replace(/outcome: \{\n\s+status:[^\n]+,\n\s+mechanicsLogs: \[([^\]]*)\],\n\s+mustHappen: \[mustHappenMsg\],\n\s+mustNotHappen: \[\],\n\s+mayHappen: \[\]\n\s+\}/g,
  "ruleDebugLogs: [$1],\n        mustHappen: [mustHappenMsg],\n        mustNotHappen: [],\n        mayHappen: []");

fs.writeFileSync(file, code);
console.log('Done');
