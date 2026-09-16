import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GeneratedQuizSchema, GeneratedQuizJsonSchema } from '@/lib/gemini/schemas';
import { saveGeneratedQuiz } from '@/actions/quizzes';
import Link from 'next/link';

export default async function DailyMixPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/dashboard');
  }

  const { data: dueConcepts, error: ledgerError } = await supabase
    .from('spaced_repetition_ledger')
    .select('concept_tag')
    .eq('user_id', user.id)
    .lte('next_review_date', new Date().toISOString())
    .order('ease_factor', { ascending: true })
    .limit(10);

  if (ledgerError) {
    console.error('Failed to fetch SRS ledger:', ledgerError);
    throw new Error('Failed to load Daily Mix data');
  }

  if (!dueConcepts || dueConcepts.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="space-y-6 text-center max-w-lg">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4 ring-1 ring-emerald-500/20">
            <span className="text-3xl text-emerald-400">✧</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white">Memory Optimized</h1>
          <p className="text-zinc-400 text-lg font-medium leading-relaxed">
            There are no concepts due for review today. Your neural pathways are fully fortified.
          </p>
          <div className="pt-8">
            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 rounded-full bg-white text-black text-sm font-bold tracking-wide hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Back to Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tags = dueConcepts.map((c: any) => c.concept_tag);
  const prompt = `Generate a ${tags.length}-question quiz specifically testing the following concepts: ${tags.join(', ')}. Create exactly one distinct question per concept.`;

  const ai = new GoogleGenAI({});
  const zodDef = zodToJsonSchema(GeneratedQuizSchema as any, "GeneratedQuizSchema").definitions?.GeneratedQuizSchema;
  const jsonSchema = (zodDef && Object.keys(zodDef).length > 0) ? zodDef : GeneratedQuizJsonSchema;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config: {
        systemInstruction: "You are an expert educational AI generating a Spaced Repetition quiz. You MUST generate exactly the requested questions targeting the specific concepts provided. Ensure the `concept_tag` field in your output perfectly matches the requested strings so they map correctly to the database.",
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

    validatedQuiz.title = `Daily Mix: ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    validatedQuiz.subject = "Spaced Repetition Review";
    validatedQuiz.description = "Curated algorithmically targeting your weakest memory nodes.";

    const result = await saveGeneratedQuiz(validatedQuiz);

    if (result.success && result.quizId) {
      redirect(`/quiz/${result.quizId}`);
    }
  } catch (error) {
    console.error('Failed to generate Daily Mix:', error);
    throw new Error('Failed to compile your mix. Please try again.');
  }
}
