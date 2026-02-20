import re

file_path = "/home/neolaw/projects/outposts-and-ogres/src/cartridges/basic-fantasy.ts"
with open(file_path, "r") as f:
    text = f.read()

# To be absolutely sure, let's find the `rules: [` that we added.
# The new array ends with `    })` on line ~353.
# We then have `  aspectFunctions: {` near line 100? No, we have the new array from 361 downwards!
# Let's cleanly take everything before the second `rules: [` or find exactly where the bad code is.

lines = text.split('\n')

# Find the end of `  ],` after `    })`
new_array_end = -1
for i, line in enumerate(lines):
    if line.strip() == "} as import('../types').CartridgeRule;":
        new_array_end = i + 2  # The `    })` and `  ],`
        break

if new_array_end != -1:
    # Now find `  aspectFunctions: {`
    aspect_funcs_start = -1
    for i in range(new_array_end, len(lines)):
        if "aspectFunctions: {" in lines[i]:
            aspect_funcs_start = i
            break
            
    if aspect_funcs_start != -1:
        # Delete everything between new_array_end and aspect_funcs_start
        print(f"Deleting {aspect_funcs_start - new_array_end} lines of old rules")
        lines = lines[:new_array_end] + lines[aspect_funcs_start:]
    else:
        print("Could not find aspectFunctions start.")
else:
    print("Could not find new array end.")

with open(file_path, "w") as f:
    f.write('\n'.join(lines))

