import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  mockQuizzes,
  mockQuestions,
  mockAttempts,
  mockAnswers,
  mockLedger,
  QuizRecord,
  QuizQuestionRecord,
  UserAttemptRecord,
  UserAnswerRecord,
  SpacedRepetitionRecord,
} from './mockStore'

class MockQueryBuilder {
  private table: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderField: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private selectFields: string | null = null;
  private pendingInsert: any = null;
  private pendingUpsert: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  insert(values: any) {
    this.pendingInsert = values;
    return this;
  }

  upsert(values: any, _options?: any) {
    this.pendingUpsert = values;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((item) => item[field] === value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push((item) => item[field] <= value);
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push((item) => values.includes(item[field]));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private execute() {
    // Handle inserts
    if (this.pendingInsert) {
      const items = Array.isArray(this.pendingInsert) ? this.pendingInsert : [this.pendingInsert];
      const inserted: any[] = [];

      for (const item of items) {
        const id = item.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const record = { ...item, id };

        if (this.table === 'quizzes') {
          mockQuizzes.set(id, record as QuizRecord);
        } else if (this.table === 'quiz_questions') {
          mockQuestions.set(id, record as QuizQuestionRecord);
        } else if (this.table === 'user_attempts') {
          mockAttempts.set(id, record as UserAttemptRecord);
        } else if (this.table === 'user_answers') {
          mockAnswers.set(id, record as UserAnswerRecord);
        }
        inserted.push(record);
      }

      const resultData = this.isSingle
        ? inserted[0]
        : Array.isArray(this.pendingInsert)
        ? inserted
        : inserted[0];
      return { data: resultData, error: null };
    }

    // Handle upsert
    if (this.pendingUpsert) {
      const items = Array.isArray(this.pendingUpsert) ? this.pendingUpsert : [this.pendingUpsert];
      for (const item of items) {
        if (this.table === 'spaced_repetition_ledger') {
          const key = `${item.user_id}:${item.concept_tag}`;
          mockLedger.set(key, item as SpacedRepetitionRecord);
        }
      }
      return { data: items, error: null };
    }

    // Handle select
    let dataset: any[] = [];
    if (this.table === 'quizzes') {
      dataset = Array.from(mockQuizzes.values());
    } else if (this.table === 'quiz_questions') {
      dataset = Array.from(mockQuestions.values());
    } else if (this.table === 'user_attempts') {
      dataset = Array.from(mockAttempts.values());
    } else if (this.table === 'user_answers') {
      dataset = Array.from(mockAnswers.values());
    } else if (this.table === 'spaced_repetition_ledger') {
      dataset = Array.from(mockLedger.values());
    }

    // Apply filters
    for (const filter of this.filters) {
      dataset = dataset.filter(filter);
    }

    // Apply ordering
    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderAscending;
      dataset.sort((a, b) => {
        if (a[field] < b[field]) return asc ? -1 : 1;
        if (a[field] > b[field]) return asc ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitCount !== null) {
      dataset = dataset.slice(0, this.limitCount);
    }

    // Enrich joins if selecting attempts with quiz / answers / ghost
    if (this.table === 'user_attempts' && this.selectFields && this.selectFields.includes('quiz:quizzes')) {
      dataset = dataset.map((attempt) => {
        const quiz = mockQuizzes.get(attempt.quiz_id);
        const answers = Array.from(mockAnswers.values())
          .filter((ans) => ans.attempt_id === attempt.id)
          .map((ans) => {
            const question = mockQuestions.get(ans.question_id);
            return {
              ...ans,
              question: question || {
                question_text: 'Question',
                correct_answer: ans.selected_option,
                concept_tag: 'General',
              },
            };
          });

        const ghost = attempt.ghost_reference_id ? mockAttempts.get(attempt.ghost_reference_id) : null;

        return {
          ...attempt,
          quiz: quiz ? { title: quiz.title } : { title: 'Geography Quiz' },
          answers,
          ghost: ghost ? { answers_per_second: ghost.answers_per_second } : null,
        };
      });
    }

    // Enrich joins if selecting user_answers with question
    if (this.table === 'user_answers' && this.selectFields && this.selectFields.includes('question:quiz_questions')) {
      dataset = dataset.map((ans) => {
        const question = mockQuestions.get(ans.question_id);
        return {
          ...ans,
          question: question ? { concept_tag: question.concept_tag } : { concept_tag: 'Geography' },
        };
      });
    }

    if (this.isSingle) {
      return { data: dataset[0] || null, error: dataset[0] ? null : { message: 'Not found' } };
    }

    return { data: dataset, error: null };
  }

  then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    try {
      const res = this.execute();
      return Promise.resolve(resolve(res));
    } catch (err) {
      if (reject) return Promise.resolve(reject(err));
      return Promise.reject(err);
    }
  }
}

function createMockClient() {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'guest_user',
            email: 'guest@geography.app',
            aud: 'authenticated',
            role: 'authenticated',
          },
        },
        error: null,
      }),
    },
    from: (table: string) => new MockQueryBuilder(table),
  } as any;
}

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-supabase') &&
    supabaseAnonKey
  );

  if (!isConfigured) {
    return createMockClient();
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored when called from Server Component
          }
        },
      },
    }
  );
}