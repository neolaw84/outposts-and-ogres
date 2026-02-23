Here are the design principles:

- **LLM narration:** LLM is supposed to do the narration that is not against any description in the [NARRATION_GUIDE] block. As long as it does not breach any description in the [NARRATION_GUIDE] block, it should be allowed to narrate any way it would like. However, the script needs to know what happened (during the last narration) and update the state accordingly.

- **Creation of the narration guide:** The script should create a narration guide ([NARRATION_GUIDE]) based on the `state` ([RP_STATE]) and the LLM's summary ([NARRATION_SUMMARY]). This guide defines what to happen, what must not happen during the narration for this turn. 

- **Script state update:** The script should update the `state` ([RP_STATE]) based on the LLM's summary ([NARRATION_SUMMARY]). The following updates happen:
  - The time update as per how much time has elapsed since the last narration.
  - The side-effects (only temporary) reversion based on their expiration (if the current time passes the expiration time).
  - The side-effects (both permanent and temporary) update as per the LLM's summary.

- **Instructing LLM to update the state:** The LLM should update the script of what happened in the latest narration in the `summary` ([NARRATION_SUMMARY]) block. The script should create a set of instructions for the LLM on how to update the `summary` ([NARRATION_SUMMARY]) based on the user-defined events. 

**Side-Effects (or `impacts`)**

We should have two types of side-effects. First one is permanent side-effect, such as damage taken and drink health portions. Second one is temporary side-effect, such as intoxication, which should be removed after expiry time.

Therefore,

- The developer should define the template of `summary` ([NARRATION_SUMMARY]) and for each of the entry (key) in the `summary`, define when and how the LLM is supposed to update it. The LLM reports observations as a NarrationEffect:
  - "key": "a string identifier for the event type"
  - "what": "a string value from a list of allowed values"
  - "when": (OPTIONAL) "ISO standard date/time string without timezone"
  - "flags": (OPTIONAL) a dictionary of boolean values for the event
  - "meters": (OPTIONAL) a dictionary of numeric values for the event
  - "tags": (OPTIONAL) a dictionary of string values for the event
  - "condition": "when the LLM should report this event"

- Aspect functions receive NarrationEffects and produce SideEffects for state management. The SideEffect has:
  - "what": description of the side effect
  - "temp": true or false
  - "impacts": [{"stats": "stat_key", "op": "set|add|sub", "value": number}]
  - "expiry": (OPTIONAL for permanent side-effects) "ISO standard date/time string"
  
  For example, if the NarrationEffect has `consume_alcohol` key, the aspect function would:
    - Read `what` (beer, wine, liquor) and `when` from the NarrationEffect
    - Compute impacts based on game rules (e.g. intelligence reduced by 2 for beer)
    - Compute expiry using `TimeUtils.addDuration(when, duration)`
    - Return `{ narrationGuide, sideEffect: { what, temp: true, impacts, expiry } }`

- The developer should define an array of standardized functions that takes `state` ([RP_STATE]) and `summary` ([NARRATION_SUMMARY]) as arguments and returns a string value. The `rollxdy` function will be available to the standardized functions defined as above. The returned string will be used to instruct the LLM on what to happen next as lines in the `narration_guide` ([NARRATION_GUIDE]) block. These functions can have side-effects to the `state` variables if needed.
