import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GeneratedQuizSchema } from '@/lib/gemini/schemas';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const jsonSchema = zodToJsonSchema(GeneratedQuizSchema as any, 'GeneratedQuizSchema').definitions?.GeneratedQuizSchema;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: `Create a custom quiz based on this request: "${prompt}"` }]
        }
      ],
      config: {
        systemInstruction: 'You are an expert educational AI. Generate high-quality, engaging multiple-choice quizzes. Ensure all options are plausible but only one is definitively correct. Keep concept_tags concise and highly relevant to the core knowledge being tested so they can be effectively tracked in our Spaced Repetition System (SRS).',
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as any,
        temperature: 0.7,
      }
    });

    let rawData = JSON.parse(response.text || '{}');

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
