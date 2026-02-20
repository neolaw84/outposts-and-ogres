import re

file_path = "/home/neolaw/projects/outposts-and-ogres/src/cartridges/basic-fantasy.ts"
with open(file_path, "r") as f:
    text = f.read()

# Replace any old aspect function syntax in the old rules. Wait, we just cleared the rules block!
# But there might be other aspectFunctions in effectDefinitions or in other parts of the cartridge object.

# Old: aspectFunction: (state, effect, typecheck, actionResult) => {
# New: aspectFunction: (state, context) => {

# Old: return { narrationGuide: 'string', sideEffect: [] }
# New: return { outcome: { status: 'resolve', mechanicsLogs: [], narrationGuidance: ['string'] }, stateMutations: [] }

# There are effect aspectFunctions mapping:
# 1. sleep_event
text = re.sub(
    r"sleep_event:\s*function\s*\(\s*state\s*,\s*effect\s*,\s*typeCheck\s*\)\s*:\s*AspectFunctionResult\s*\{",
    "sleep_event: function (state, context): AspectFunctionResult {",
    text
)
text = re.sub(
    r"return\s*\{\s*narrationGuide:\s*'([^']+)',\s*sideEffect:\s*heal\s*\}",
    r"return {\n        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: ['\1'] },\n        stateMutations: [heal]\n      }",
    text
)
text = re.sub(
    r"return\s*\{\s*narrationGuide:\s*''\s*,\s*sideEffect:\s*heal\s*\}",
    r"return {\n        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [] },\n        stateMutations: [heal]\n      }",
    text
)


# 2. auto_save
text = re.sub(
    r"auto_save:\s*function\s*\(\s*state\s*,\s*effect\s*,\s*typeCheck\s*\)\s*:\s*AspectFunctionResult\s*\{",
    "auto_save: function (state, context): AspectFunctionResult {",
    text
)
text = re.sub(
    r"return\s*\{\s*narrationGuide:\s*guide,\s*sideEffect:\s*null\s*\}",
    r"return {\n        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [guide] },\n        stateMutations: []\n      }",
    text
)


# 3. stat_check
text = re.sub(
    r"stat_check:\s*function\s*\(\s*state\s*,\s*effect\s*,\s*typeCheck\s*\)\s*:\s*AspectFunctionResult\s*\{",
    "stat_check: function (state, context): AspectFunctionResult {",
    text
)
# Inside stat_check:
text = text.replace("let guide = '';", "let guides = [];")
text = text.replace("guide += ", "guides.push(")
text = text.replace("} else {", "}); } else {")
text = text.replace(";\n          }", ");\n          }")
text = text.replace(";\n        }", ");\n        }")
# Actually simple replacement over return:
text = re.sub(
    r"return\s*\{\s*narrationGuide:\s*guide,\s*sideEffect:\s*null\s*\}",
    r"return {\n        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: guides },\n        stateMutations: []\n      }",
    text
)


# 4. update_status
text = re.sub(
    r"update_status:\s*function\s*\(\s*state\s*,\s*effect\s*,\s*typeCheck\s*\)\s*:\s*AspectFunctionResult\s*\{",
    "update_status: function (state, context): AspectFunctionResult {",
    text
)
# we need to fix the return block in update_status
# Note update_status has logic assigning guide and effects.
# Wait, this regex is too brittle for manual changes in Python over large functions. It's better to multi_replace directly in TypeScript or sed for exact matches. Let's do it via multi_replace tool instead of Python since the file is short.

