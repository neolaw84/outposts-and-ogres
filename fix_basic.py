import re

file_path = "/home/neolaw/projects/outposts-and-ogres/src/cartridges/basic-fantasy.ts"
with open(file_path, "r") as f:
    text = f.read()

# We need to wipe everything starting from `    // ---- Combat ----` to `  aspectFunctions: {`.
# The replacement should just be `  aspectFunctions: {`
text = re.sub(r"\s*// ---- Combat ----[\s\S]*?aspectFunctions: \{", "\n\n  aspectFunctions: {", text)

with open(file_path, "w") as f:
    f.write(text)

print("Fixed rules duplication.")
