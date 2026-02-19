interface ScenarioUnderstanding {
  suggestedCondition: string | null;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
}

function understandScenario(
  message: string,
  availableConditions: string[]
): ScenarioUnderstanding {
  const text = message.toLowerCase();
  const conditionKeywords: Record<string, string[]> = {
    combat: ['attack', 'strike', 'fight', 'defend', 'flee', 'enemy'],
    exploration: ['search', 'inspect', 'look', 'move', 'rest', 'explore'],
    social: ['persuade', 'talk', 'ask', 'barter', 'intimidate', 'deceive']
  };

  let bestCondition: string | null = null;
  let bestScore = 0;
  let matched: string[] = [];

  for (let i = 0; i < availableConditions.length; i++) {
    const condition = availableConditions[i];
    const keywords = conditionKeywords[condition] || [];
    let score = 0;
    const cues: string[] = [];
    for (let j = 0; j < keywords.length; j++) {
      if (text.indexOf(keywords[j]) !== -1) {
        score = score + 1;
        cues.push(keywords[j]);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCondition = condition;
      matched = cues;
    }
  }

  if (bestScore === 0) {
    return { suggestedCondition: null, confidence: 'low', cues: [] };
  }
  if (bestScore === 1) {
    return { suggestedCondition: bestCondition, confidence: 'medium', cues: matched };
  }
  return { suggestedCondition: bestCondition, confidence: 'high', cues: matched };
}

export { ScenarioUnderstanding, understandScenario };
