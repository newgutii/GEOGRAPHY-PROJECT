import { z } from 'zod';

export const QuizQuestionSchema = z.object({
  question_text: z.string().describe('The text of the multiple choice question.'),
  options: z.array(z.string()).length(4).describe('Exactly four possible answers for the question. Ensure they are distinct and plausible.'),
  correct_answer: z.string().describe('The exact string of the correct answer, which must perfectly match one of the items in the options array.'),
  concept_tag: z.string().describe('A concise, abstract tag representing the core concept tested (e.g., "React Hooks", "90s BMX Frames"). Must be highly specific so spaced repetition can track this exact knowledge node.'),
});

export const GeneratedQuizSchema = z.object({
  title: z.string().describe('A catchy, relevant title for the generated quiz.'),
  description: z.string().describe('A short, engaging description of what the quiz covers.'),
  subject: z.string().describe('The overarching subject area (e.g., "History", "Web Development", "Pop Culture").'),
  questions: z.array(QuizQuestionSchema).describe('The list of generated questions for the quiz.'),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type GeneratedQuiz = z.infer<typeof GeneratedQuizSchema>;

export const GeneratedQuizJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'A catchy, relevant title for the generated quiz.' },
    description: { type: 'string', description: 'A short, engaging description of what the quiz covers.' },
    subject: { type: 'string', description: 'The overarching subject area.' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question_text: { type: 'string', description: 'The text of the multiple choice question.' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exactly four possible answers for the question.'
          },
          correct_answer: { type: 'string', description: 'The exact string of the correct answer, which must match one of the items in options.' },
          concept_tag: { type: 'string', description: 'A concise tag representing the core concept tested.' }
        },
        required: ['question_text', 'options', 'correct_answer', 'concept_tag']
      }
    }
  },
  required: ['title', 'description', 'subject', 'questions']
};
