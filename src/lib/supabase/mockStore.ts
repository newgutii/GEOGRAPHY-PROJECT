// In-memory data store for local preview & offline fallback

export interface QuizRecord {
  id: string;
  title: string;
  description: string;
  subject: string;
  is_ai_generated: boolean;
  created_by?: string | null;
  created_at?: string;
}

export interface QuizQuestionRecord {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  concept_tag: string;
  order_index: number;
}

export interface UserAttemptRecord {
  id: string;
  user_id: string;
  quiz_id: string;
  start_time: string;
  end_time: string;
  score: number;
  total_questions: number;
  answers_per_second: number;
  ghost_reference_id?: string | null;
  created_at?: string;
}

export interface UserAnswerRecord {
  id: string;
  attempt_id: string;
  question_id: string;
  is_correct: boolean;
  time_taken_ms: number;
  selected_option: string;
}

export interface SpacedRepetitionRecord {
  user_id: string;
  concept_tag: string;
  state: 'New' | 'Learning' | 'Review' | 'Mastered';
  next_review_date: string;
  ease_factor: number;
  interval_days: number;
  consecutive_correct: number;
  last_reviewed_at: string;
}

// Global in-memory storage (persists across requests during server runtime)
const globalStore = globalThis as unknown as {
  __mockQuizzes?: Map<string, QuizRecord>;
  __mockQuestions?: Map<string, QuizQuestionRecord>;
  __mockAttempts?: Map<string, UserAttemptRecord>;
  __mockAnswers?: Map<string, UserAnswerRecord>;
  __mockLedger?: Map<string, SpacedRepetitionRecord>;
};

if (!globalStore.__mockQuizzes) {
  globalStore.__mockQuizzes = new Map<string, QuizRecord>();
  globalStore.__mockQuestions = new Map<string, QuizQuestionRecord>();
  globalStore.__mockAttempts = new Map<string, UserAttemptRecord>();
  globalStore.__mockAnswers = new Map<string, UserAnswerRecord>();
  globalStore.__mockLedger = new Map<string, SpacedRepetitionRecord>();

  // Seed default Geography Quiz: World Capitals
  const worldCapitalsId = 'world-capitals';
  globalStore.__mockQuizzes.set(worldCapitalsId, {
    id: worldCapitalsId,
    title: 'World Capitals',
    description: 'Geography fundamentals testing international capitals.',
    subject: 'Geography',
    is_ai_generated: false,
    created_by: 'system',
    created_at: new Date().toISOString(),
  });

  const sampleQuestions: Array<Omit<QuizQuestionRecord, 'id' | 'quiz_id'>> = [
    {
      question_text: 'What is the capital of Australia?',
      options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'],
      correct_answer: 'Canberra',
      concept_tag: 'Oceania Capitals',
      order_index: 0,
    },
    {
      question_text: 'What is the capital of Canada?',
      options: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'],
      correct_answer: 'Ottawa',
      concept_tag: 'North America Capitals',
      order_index: 1,
    },
    {
      question_text: 'What is the capital of Japan?',
      options: ['Kyoto', 'Tokyo', 'Osaka', 'Sapporo'],
      correct_answer: 'Tokyo',
      concept_tag: 'East Asia Capitals',
      order_index: 2,
    },
    {
      question_text: 'What is the capital of Brazil?',
      options: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'],
      correct_answer: 'Brasília',
      concept_tag: 'South America Capitals',
      order_index: 3,
    },
    {
      question_text: 'What is the capital of Morocco?',
      options: ['Casablanca', 'Marrakech', 'Rabat', 'Fes'],
      correct_answer: 'Rabat',
      concept_tag: 'North Africa Capitals',
      order_index: 4,
    },
  ];

  sampleQuestions.forEach((q, idx) => {
    const qId = `q_capitals_${idx + 1}`;
    globalStore.__mockQuestions!.set(qId, {
      id: qId,
      quiz_id: worldCapitalsId,
      ...q,
    });
  });

  // Seed React Hooks Quiz
  const reactHooksId = 'react-hooks';
  globalStore.__mockQuizzes.set(reactHooksId, {
    id: reactHooksId,
    title: 'React Hooks',
    description: 'Frontend state management and lifecycle essentials.',
    subject: 'Web Development',
    is_ai_generated: false,
    created_by: 'system',
    created_at: new Date().toISOString(),
  });

  const reactQuestions: Array<Omit<QuizQuestionRecord, 'id' | 'quiz_id'>> = [
    {
      question_text: 'Which hook is primarily used for handling component side-effects?',
      options: ['useState', 'useEffect', 'useMemo', 'useRef'],
      correct_answer: 'useEffect',
      concept_tag: 'React Lifecycle',
      order_index: 0,
    },
    {
      question_text: 'Which hook caches the calculated result between re-renders?',
      options: ['useCallback', 'useMemo', 'useReducer', 'useId'],
      correct_answer: 'useMemo',
      concept_tag: 'React Performance',
      order_index: 1,
    },
    {
      question_text: 'Which hook holds a persistent mutable reference without triggering re-render on change?',
      options: ['useState', 'useContext', 'useRef', 'useImperativeHandle'],
      correct_answer: 'useRef',
      concept_tag: 'React Refs',
      order_index: 2,
    },
  ];

  reactQuestions.forEach((q, idx) => {
    const qId = `q_hooks_${idx + 1}`;
    globalStore.__mockQuestions!.set(qId, {
      id: qId,
      quiz_id: reactHooksId,
      ...q,
    });
  });
}

export const mockQuizzes = globalStore.__mockQuizzes!;
export const mockQuestions = globalStore.__mockQuestions!;
export const mockAttempts = globalStore.__mockAttempts!;
export const mockAnswers = globalStore.__mockAnswers!;
export const mockLedger = globalStore.__mockLedger!;
