import { PlayerEmotionSignal } from '../types';

function detectEmotionSignals(message: string): PlayerEmotionSignal[] {
  const normalized = message.toLowerCase();
  const rules: Array<{ emotion: PlayerEmotionSignal['emotion']; keywords: string[] }> = [
    { emotion: 'fear', keywords: ['afraid', 'fear', 'terrified', 'scared', 'panic'] },
    { emotion: 'anger', keywords: ['angry', 'rage', 'furious', 'mad'] },
    { emotion: 'hope', keywords: ['hope', 'trust', 'believe'] },
    { emotion: 'calm', keywords: ['calm', 'steady', 'focus', 'focused'] },
    { emotion: 'curiosity', keywords: ['curious', 'wonder', 'investigate', 'question'] }
  ];

  const detected: PlayerEmotionSignal[] = [];
  for (let i = 0; i < rules.length; i++) {
    const keywords = rules[i].keywords;
    for (let j = 0; j < keywords.length; j++) {
      if (normalized.indexOf(keywords[j]) !== -1) {
        detected.push({ emotion: rules[i].emotion, sourceKeyword: keywords[j] });
        break;
      }
    }
  }

  return detected;
}

export { detectEmotionSignals };
