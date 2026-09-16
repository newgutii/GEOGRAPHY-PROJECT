# Geography & Concept Quiz

An adaptive, AI-powered quiz platform featuring multi-parameter quiz generation, real-time timed test engines, AI Lifeline tutor hints, and spaced repetition (SRS) mastery tracking.

---

## Features

### 1. Guided AI Quiz Architect
- **Theme & Topic Customization**: Input any subject, exam topic, or niche domain (or select from quick-launch topics like World Capitals, Ancient Civilizations, Quantum Physics, etc.).
- **Difficulty Calibration**:
  - **Beginner**: Accessible, foundational concepts and relaxed learning.
  - **Intermediate**: Balanced testing of core facts and mechanisms.
  - **Advanced**: Subtle nuances, edge cases, and plausible distractors.
  - **Master**: Elite competition-grade trivia and deep-cut domain knowledge.
- **Pacing & Timer Modes**:
  - ⚡ **Blitz (10s)**: High-adrenaline reflex speedrun.
  - ⏱️ **Standard (20s)**: Classic balanced exam pace.
  - ⏳ **Thinker (35s)**: Deep analytical thinking time.
  - 🧘 **Untimed (Zen)**: Self-paced study with an ambient elapsed-time stopwatch.
- **Deep Customization ("And More")**:
  - Select question count (5, 10, or 15 questions).
  - Select quiz style (*Academic Standard*, *Fascinating Trivia*, or *Problem Solving*).
  - Add optional custom directives or notes to guide AI generation.
- **Live Synthesis Status**: Real-time visual feedback while the AI constructs ontology nodes, calibrates distractors, and maps SRS concept tags.

### 2. Interactive Timed Quiz Engine
- Animated countdown progress bar with color-shifting urgency (normal → warning amber at ≤5s → pulsing rose at ≤3s).
- Automatic time-out handling and instant selection feedback.
- **AI Lifeline**: On-demand Socratic hint generator powered by Gemini that provides mnemonic clues and guidance without revealing the answer.
- Seamless end-of-quiz submission and routing to the debrief analysis.

### 3. Spaced Repetition & Daily Mix
- **Concept Ontology Tagging**: Every question tracks a specific concept node (e.g. `oceania-capitals`, `react-hooks-usememo`).
- **Concept Mastery Tracking**: Identifies weak areas and calculates repetition intervals.
- **Daily Mix Generator**: Synthesizes custom quizzes targeted specifically at your flagged or lowest-accuracy concepts.

### 4. Comprehensive Performance Debrief
- Visual score cards, accuracy metrics, and answers-per-minute speed analytics.
- Detailed question-by-question review displaying chosen vs. correct answers, response times, and concept tags.
- Post-run AI recommendations and quick retake actions.

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Engine**: Google GenAI SDK (`@google/genai`) with Gemini models
- **Validation**: [Zod](https://zod.dev/) & [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema)
- **Storage / Database**: Supabase client with seamless in-memory fallback store

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Google Gemini API key (optional for UI preview, required for live AI quiz generation)

### Environment Setup
Copy the example environment file:
```bash
cp .env.example .env.local
```

Configure your environment variables:
```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Supabase configuration (in-memory mock store activates automatically if unset)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Installation & Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

- `npm run dev`: Starts the Next.js development server on port 3000
- `npm run build`: Compiles the production build
- `npm run start`: Starts the production server
- `npm run lint`: Runs ESLint checks

