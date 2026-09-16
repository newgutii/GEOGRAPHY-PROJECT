import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GeneratedQuizSchema, GeneratedQuizJsonSchema } from '@/lib/gemini/schemas';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { 
      prompt,
      difficulty = 'Intermediate',
      timeLimit = 20,
      questionCount = 5,
      style = 'standard',
      customFocus = '',
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const zodDef = zodToJsonSchema(GeneratedQuizSchema as any, 'GeneratedQuizSchema').definitions?.GeneratedQuizSchema;
    const jsonSchema = (zodDef && Object.keys(zodDef).length > 0) ? zodDef : GeneratedQuizJsonSchema;

    const difficultyGuidance: Record<string, string> = {
      Beginner: 'Beginner / Casual: Accessible, foundational questions suitable for newcomers or relaxed learning.',
      Intermediate: 'Intermediate / Standard: Balanced questions testing core understanding of key facts and concepts.',
      Advanced: 'Advanced / Challenger: Demanding questions testing nuanced details, subtle mechanics, and edge cases with plausible distractors.',
      Master: 'Master / Elite: Extreme competition-grade questions testing rare trivia, obscure facts, and deep-cut expertise.',
    };

    const styleGuidance: Record<string, string> = {
      standard: 'Standard multiple choice testing general comprehension and key facts.',
      trivia: 'Surprising, quirky, and fascinating trivia questions that spark curiosity.',
      conceptual: 'Scenario-based and analytical problem solving focusing on cause-and-effect and principles.',
    };

    const count = typeof questionCount === 'number' && questionCount > 0 ? Math.min(questionCount, 15) : 5;

    const promptText = `
Create a custom multiple-choice quiz based on the user's requested theme: "${prompt}".

Configuration & Parameters:
- Total Questions: Exactly ${count} questions.
- Target Difficulty: ${difficultyGuidance[difficulty] || difficultyGuidance.Intermediate}
- Quiz Style: ${styleGuidance[style] || styleGuidance.standard}
- Time Pacing: ${timeLimit > 0 ? `${timeLimit} seconds per question (tailor question length so it can be read and answered in time)` : 'Untimed (allow in-depth reading)'}
${customFocus ? `- Specific Topic Focus / Note from user: "${customFocus}". Please emphasize this.` : ''}

Strict Requirements:
1. Provide exactly ${count} questions in the "questions" array.
2. For each question, provide exactly 4 distinct, plausible options.
3. The "correct_answer" must exactly match one of the 4 options.
4. Keep "concept_tag" concise, descriptive, and specific so it maps to an individual concept in our Spaced Repetition System (SRS).
5. Generate an engaging "title" and an informative "description" reflecting this topic and difficulty.
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      config: {
        systemInstruction: 'You are an expert educational AI and quiz master. You craft brilliant, accurate, highly engaging quizzes tailored precisely to the user\'s desired difficulty, format, and pacing.',
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as any,
        temperature: 0.7,
      }
    });

    console.log("RAW RESPONSE:", response.text);

    let rawData = JSON.parse(response.text || '{}');

    if (Array.isArray(rawData) && rawData.length > 0) {
      rawData = rawData[0];
    }

    if (rawData?.GeneratedQuizSchema) {
      rawData = rawData.GeneratedQuizSchema;
    } else if (rawData?.quiz) {
      rawData = rawData.quiz;
    }

    if (Array.isArray(rawData) && rawData.length > 0) {
      rawData = rawData[0];
    }

    const validatedQuiz = GeneratedQuizSchema.parse(rawData);

    return NextResponse.json(validatedQuiz);
  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json({ error: 'Failed to generate custom quiz' }, { status: 500 });
  }
}
