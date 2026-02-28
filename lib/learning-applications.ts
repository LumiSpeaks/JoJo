import { IntelligenceIndices } from './storage';

export interface LearningApplication {
  title: string;
  icon: string;
  color: string;
  tips: string[];
  explanation: string;
}

/**
 * Generate personalized learning application strategies based on user's
 * Intelligence Matrix scores and strongest/weakest areas.
 * 
 * This bridges the gap from "cognitive training" → "real-world learning outcomes"
 */
export function generateLearningApplications(
  indices: IntelligenceIndices,
  userLevel: number,
  strongestArea?: 'reasoning' | 'spatial' | 'fluid' | 'crystallized',
  weakestArea?: 'reasoning' | 'spatial' | 'fluid' | 'crystallized'
): LearningApplication[] {
  const applications: LearningApplication[] = [];

  // Determine strongest/weakest if not provided
  if (!strongestArea || !weakestArea) {
    const scores = [
      { area: 'reasoning' as const, score: indices.reasoning },
      { area: 'spatial' as const, score: indices.spatial },
      { area: 'fluid' as const, score: indices.fluid },
      { area: 'crystallized' as const, score: indices.crystallized },
    ];
    scores.sort((a, b) => b.score - a.score);
    strongestArea = strongestArea || scores[0].area;
    weakestArea = weakestArea || scores[scores.length - 1].area;
  }

  // Always include primary learning strategy
  applications.push(getPrimaryStrategy(indices, userLevel));

  // Add strength-based strategy
  applications.push(getStrengthStrategy(strongestArea, indices[strongestArea], userLevel));

  // Add improvement strategy for weakness
  if (indices[weakestArea] < 50) {
    applications.push(getImprovementStrategy(weakestArea, indices[weakestArea]));
  }

  return applications;
}

function getPrimaryStrategy(indices: IntelligenceIndices, userLevel: number): LearningApplication {
  const avgScore = (indices.reasoning + indices.spatial + indices.fluid + indices.crystallized) / 4;

  if (avgScore < 30) {
    return {
      title: 'Build Learning Foundations',
      icon: 'construct',
      color: '#FFB74D',
      explanation: 'Your cognitive capacity is developing. Focus on consistent practice and basic strategies.',
      tips: [
        'Study in 15-minute focused blocks (Pomodoro)',
        'Review material within 24 hours of learning it',
        'Break complex topics into smaller chunks (3-5 items)',
        'Use simple visual aids like bullet points and diagrams',
      ],
    };
  } else if (avgScore < 60) {
    return {
      title: 'Accelerate Your Learning',
      icon: 'rocket',
      color: '#00E676',
      explanation: 'Your cognitive skills are solid. Use advanced techniques to learn faster.',
      tips: [
        `Study in 25-minute blocks, retain ${Math.round(userLevel / 10 + 5)}-${Math.round(userLevel / 10 + 7)} concepts per session`,
        'Use spaced repetition: review at 1 day, 3 days, 1 week, 1 month',
        'Create mind maps connecting new info to what you know',
        'Teach concepts to others to deepen understanding',
      ],
    };
  } else {
    return {
      title: 'Master Advanced Learning',
      icon: 'trophy',
      color: '#7B61FF',
      explanation: 'Your cognitive capacity matches top performers. Use expert strategies.',
      tips: [
        `Manage ${Math.round(userLevel / 8 + 7)}-${Math.round(userLevel / 8 + 9)} concepts simultaneously in working memory`,
        'Use the Feynman Technique: explain complex ideas simply',
        'Build mental models and frameworks for entire domains',
        'Practice metacognition: reflect on how you learn best',
      ],
    };
  }
}

function getStrengthStrategy(
  area: 'reasoning' | 'spatial' | 'fluid' | 'crystallized',
  score: number,
  userLevel: number
): LearningApplication {
  const strategies = {
    reasoning: {
      title: 'Leverage Your Logical Strength',
      icon: 'bulb',
      color: '#FFB74D',
      explanation: `Your reasoning score (${Math.round(score)}) is strong. Use logic to learn faster.`,
      tips: [
        'Break problems into logical steps before solving',
        'Ask "why" and "how" to understand cause-effect chains',
        'Create if-then rules for complex procedures',
        'Use deductive reasoning to predict outcomes before testing',
      ],
    },
    spatial: {
      title: 'Use Your Visual Advantage',
      icon: 'cube',
      color: '#00D4FF',
      explanation: `Your spatial reasoning (${Math.round(score)}) is strong. Visualize to learn.`,
      tips: [
        'Draw diagrams, flowcharts, and concept maps',
        'Visualize 3D models and spatial relationships',
        'Use color coding and spatial organization in notes',
        'Create mental "journey" through information',
      ],
    },
    fluid: {
      title: 'Harness Adaptive Thinking',
      icon: 'water',
      color: '#7B61FF',
      explanation: `Your fluid intelligence (${Math.round(score)}) excels. Tackle novel challenges.`,
      tips: [
        'Seek out unfamiliar problems and domains',
        'Cross-apply concepts from one field to another',
        'Experiment with multiple solution strategies',
        'Learn by doing rather than passive reading',
      ],
    },
    crystallized: {
      title: 'Build on Your Knowledge Base',
      icon: 'library',
      color: '#00E676',
      explanation: `Your crystallized intelligence (${Math.round(score)}) is strong. Connect new to known.`,
      tips: [
        'Always link new info to existing knowledge',
        'Use analogies from familiar domains',
        'Build elaborate networks of interconnected facts',
        'Read broadly to expand your knowledge foundation',
      ],
    },
  };

  return strategies[area];
}

function getImprovementStrategy(
  area: 'reasoning' | 'spatial' | 'fluid' | 'crystallized',
  score: number
): LearningApplication {
  const strategies = {
    reasoning: {
      title: 'Strengthen Logical Thinking',
      icon: 'analytics',
      color: '#FF6EC7',
      explanation: `Your reasoning (${Math.round(score)}) can improve. Focus on logic practice.`,
      tips: [
        'Practice identifying patterns in sequences',
        'Work through logic puzzles daily',
        'Break complex problems into clear steps',
        'Study formal logic and argumentation',
      ],
    },
    spatial: {
      title: 'Develop Visual Thinking',
      icon: 'shapes',
      color: '#FF6EC7',
      explanation: `Your spatial reasoning (${Math.round(score)}) needs work. Practice visualization.`,
      tips: [
        'Practice mentally rotating 3D objects',
        'Draw more diagrams and visual representations',
        'Play spatial games (Tetris, puzzles)',
        'Visualize concepts before writing them down',
      ],
    },
    fluid: {
      title: 'Build Problem-Solving Flexibility',
      icon: 'flask',
      color: '#FF6EC7',
      explanation: `Your fluid intelligence (${Math.round(score)}) is developing. Embrace novelty.`,
      tips: [
        'Deliberately learn in unfamiliar ways',
        'Try multiple approaches to each problem',
        'Step outside your comfort zone regularly',
        'Practice transferring concepts across domains',
      ],
    },
    crystallized: {
      title: 'Expand Your Knowledge Base',
      icon: 'book',
      color: '#FF6EC7',
      explanation: `Your crystallized intelligence (${Math.round(score)}) needs depth. Read more.`,
      tips: [
        'Read diverse non-fiction daily',
        'Build vocabulary systematically',
        'Learn facts in organized frameworks',
        'Make connections between different topics',
      ],
    },
  };

  return strategies[area];
}

/**
 * Generate a specific "Try This Now" actionable prompt based on session performance
 */
export function generateImmediateAction(
  indices: IntelligenceIndices,
  userLevel: number
): { title: string; action: string; icon: string } {
  const avgScore = (indices.reasoning + indices.spatial + indices.fluid + indices.crystallized) / 4;

  if (userLevel < 15) {
    return {
      title: 'Apply This Today',
      icon: 'flash',
      action: 'In your next study session, try the Pomodoro Technique: 15 minutes focused work, 5 minute break. Notice how your improved focus helps you learn faster.',
    };
  } else if (userLevel < 40) {
    return {
      title: 'Level Up Your Learning',
      icon: 'trending-up',
      action: `Your working memory can now handle ${Math.round(userLevel / 5 + 4)}-${Math.round(userLevel / 5 + 6)} items. When studying, chunk information into groups of this size for better retention.`,
    };
  } else if (userLevel < 70) {
    return {
      title: 'Expert Strategy',
      icon: 'star',
      action: 'Use the Feynman Technique: pick a concept you studied recently and explain it out loud as if teaching a beginner. Your enhanced reasoning will help you identify gaps.',
    };
  } else {
    return {
      title: 'Master-Level Application',
      icon: 'rocket',
      action: 'Build a comprehensive mental model: map out how today\'s learning connects to 3+ other domains. Your fluid intelligence lets you see these cross-domain patterns.',
    };
  }
}
