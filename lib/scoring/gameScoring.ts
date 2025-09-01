import { executeQuery } from '../db/oracle';

export interface GameResult {
  trialIndex: number;
  stimulus: string;
  response: string | null;
  responseTime: number;
  isCorrect: boolean;
  timestamp: Date;
}

export interface GameScore {
  accuracy: number;
  averageResponseTime: number;
  totalTrials: number;
  correctTrials: number;
  traits: TraitScore[];
}

export interface TraitScore {
  traitId: string;
  score: number;
  percentile: number;
}

// Calculate game score from results
export function calculateGameScore(
  gameId: string,
  results: GameResult[],
  assessmentId: string
): GameScore {
  const totalTrials = results.length;
  const correctTrials = results.filter(r => r.isCorrect).length;
  const accuracy = totalTrials > 0 ? correctTrials / totalTrials : 0;
  
  const responseTimes = results
    .filter(r => r.response !== null)
    .map(r => r.responseTime);
  
  const averageResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
    : 0;

  // Mock trait scores for now
  const traits: TraitScore[] = [
    { traitId: 'attention', score: accuracy * 100, percentile: 75 },
    { traitId: 'processing_speed', score: Math.max(0, 100 - averageResponseTime / 10), percentile: 60 }
  ];

  return {
    accuracy,
    averageResponseTime,
    totalTrials,
    correctTrials,
    traits
  };
}

// Save game results to database
export async function saveGameResults(
  assessmentItemId: string,
  gameId: string,
  results: GameResult[]
): Promise<void> {
  // Mock implementation - in real app would save to database
  console.log('Saving game results:', { assessmentItemId, gameId, results });
}