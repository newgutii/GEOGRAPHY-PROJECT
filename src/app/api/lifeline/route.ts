import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { question_text, concept_tag } = await req.json();

    if (!question_text || !concept_tag) {
      return NextResponse.json({ error: 'Missing question or concept tag' }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `Question: "${question_text}"\nConcept Focus: "${concept_tag}"`,
      config: {
        systemInstruction: "You are an expert tutor. Provide a brief, 1-2 sentence hint, mnemonic, or contextual clue for the provided question. You MUST NOT reveal the correct answer directly. Keep the tone encouraging but concise.",
        temperature: 0.7,
      }
    });

    const hint = response.text || "I cannot generate a hint at this time.";

    return NextResponse.json({ hint });
  } catch (error) {
    console.error('Lifeline generation error:', error);
    return NextResponse.json({ error: 'Failed to generate lifeline hint' }, { status: 500 });
  }
}
