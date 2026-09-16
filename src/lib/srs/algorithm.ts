export type MemoryState = 'New' | 'Learning' | 'Review' | 'Mastered';

export interface SRSData {
  easeFactor: number;
  intervalDays: number;
  consecutiveCorrect: number;
}

export interface SRSResult extends SRSData {
  nextReviewDate: Date;
  state: MemoryState;
}

export function calculateNextReview(
  isCorrect: boolean,
  prev: SRSData
): SRSResult {
  let { easeFactor, intervalDays, consecutiveCorrect } = prev;

  if (isCorrect) {
    consecutiveCorrect += 1;
    if (consecutiveCorrect === 1) {
      intervalDays = 1;
    } else if (consecutiveCorrect === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    easeFactor = Math.min(2.5, easeFactor + 0.1);
  } else {
    consecutiveCorrect = 0;
    intervalDays = 1; 
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  }

  let state: MemoryState = 'Learning';
  if (intervalDays >= 21) {
    state = 'Mastered';
  } else if (intervalDays > 1) {
    state = 'Review';
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  return {
    easeFactor,
    intervalDays,
    consecutiveCorrect,
    nextReviewDate,
    state
  };
}
