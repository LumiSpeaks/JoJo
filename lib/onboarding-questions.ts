/**
 * Onboarding questionnaire for AceStudy: tailored to real-world learning outcomes.
 * Mission: Expand intellectual capacity so you learn faster and think like top performers.
 * Values are stored in profile.onboardingAnswers and used to adapt the experience.
 */

export type QuestionnairePhase = 'current' | 'goals' | 'next';

export interface OnboardingQuestionOption {
  label: string;
  value: string;
}

export interface OnboardingQuestion {
  id: string;
  phase: QuestionnairePhase;
  question: string;
  subtitle?: string;
  options: OnboardingQuestionOption[];
  multiSelect?: boolean;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  // ——— Where are you with learning right now? ———
  {
    id: 'learning-situation',
    phase: 'current',
    question: 'Which best describes your learning right now?',
    options: [
      { label: 'I take too long to grasp new material', value: 'slow-to-grasp' },
      { label: 'I forget what I learn quickly', value: 'forget-quickly' },
      { label: 'I get distracted when studying', value: 'easily-distracted' },
      { label: 'I learn okay but want to be faster', value: 'want-faster' },
    ],
  },
  {
    id: 'learning-challenges',
    phase: 'current',
    question: 'What gets in the way of learning or studying?',
    subtitle: 'Select all that apply',
    options: [
      { label: 'Can\'t focus for long', value: 'short-focus' },
      { label: 'Information overload', value: 'overload' },
      { label: 'Slow processing / reading', value: 'slow-processing' },
      { label: 'Poor retention / memory', value: 'poor-retention' },
      { label: 'Cramming instead of consistent practice', value: 'cramming' },
      { label: 'Multitasking while studying', value: 'multitasking' },
    ],
    multiSelect: true,
  },
  {
    id: 'learning-area',
    phase: 'current',
    question: 'Where do you most want to improve?',
    options: [
      { label: 'Processing speed — take in info faster', value: 'speed' },
      { label: 'Memory — remember more, longer', value: 'memory' },
      { label: 'Patterns — spot connections quickly', value: 'patterns' },
      { label: 'Focus — stay on task under load', value: 'focus' },
      { label: 'All of the above', value: 'all' },
    ],
  },
  // ——— Where do you want to go? ———
  {
    id: 'learning-goal',
    phase: 'goals',
    question: 'What do you want most from cognitive training?',
    options: [
      { label: 'Learn faster - absorb material in half the time', value: 'less-time' },
      { label: 'Remember more - retain what I study longer', value: 'retain-more' },
      { label: 'Think clearer - maintain focus under pressure', value: 'focus-under-pressure' },
      { label: 'Process faster - like top performers at work/school', value: 'think-faster' },
      { label: 'Build cognitive strength - enhance my mental capacity', value: 'habit' },
    ],
  },
  {
    id: 'future-if-no-change',
    phase: 'goals',
    question: 'If your learning speed and retention didn\'t improve, how would you feel in a year?',
    options: [
      { label: 'Frustrated', value: 'frustrated' },
      { label: 'Behind compared to others', value: 'behind' },
      { label: 'Stuck in the same study habits', value: 'stuck' },
      { label: 'Okay, but I\'d like to do better', value: 'okay-want-better' },
      { label: 'That worries me', value: 'worried' },
    ],
  },
  // ——— What would you do next? ———
  {
    id: 'study-frequency',
    phase: 'next',
    question: 'How often can you train your brain?',
    options: [
      { label: 'Every day — short sessions', value: 'every-day' },
      { label: 'Most days', value: 'most-days' },
      { label: 'A few times a week', value: 'few-times-week' },
      { label: 'When I have a big exam or deadline', value: 'when-deadline' },
    ],
  },
  {
    id: 'what-would-help',
    phase: 'next',
    question: 'What would make cognitive training work for you?',
    options: [
      { label: 'Short sessions (15–20 min) that fit my schedule', value: 'short-sessions' },
      { label: 'Difficulty that grows with me (adaptive intelligence)', value: 'adaptive-difficulty' },
      { label: 'Clear metrics showing real cognitive improvement', value: 'clear-progress' },
      { label: 'Variety to challenge all aspects of intelligence', value: 'variety' },
      { label: 'All of the above', value: 'all-help' },
    ],
  },
];

export function getTotalQuestionnaireSteps(): number {
  return ONBOARDING_QUESTIONS.length;
}

/** Build a short personalized message from questionnaire answers for the home screen. */
export function getPersonalizedMessage(answers: {
  learningGoal?: string;
  studyFrequency?: string;
  learningSituation?: string;
  whatWouldHelp?: string[];
}): string | null {
  const parts: string[] = [];
  if (answers.learningGoal) {
    const labels: Record<string, string> = {
      'less-time': 'learning in less time',
      'retain-more': 'retaining more',
      'focus-under-pressure': 'staying focused under pressure',
      'think-faster': 'thinking faster',
      habit: 'a stronger learning habit',
    };
    parts.push(`You're focused on ${labels[answers.learningGoal] ?? answers.learningGoal}.`);
  }
  if (answers.studyFrequency === 'every-day') {
    parts.push("Today's session fits your daily training plan.");
  } else if (answers.whatWouldHelp?.includes('short-sessions')) {
    parts.push("We'll keep sessions short and focused.");
  }
  if (answers.learningSituation === 'slow-to-grasp') {
    parts.push("Training will help you process and grasp material faster.");
  } else if (answers.learningSituation === 'forget-quickly') {
    parts.push("We'll work on memory and retention.");
  }
  if (parts.length === 0) return null;
  return parts.join(' ');
}
