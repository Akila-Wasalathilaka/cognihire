import { executeQuery } from '../db/postgres';

export interface GameResult {
  trialIndex: number;
  correct: boolean;
  responseTime: number;
  stimulus?: string;
  response?: any;
  [key: string]: any;
}

export interface TraitScore {
  trait: string;
  score: number;
  weight: number;
  rawScore: number;
}

export interface GameScoringResult {
  overallScore: number;
  accuracy: number;
  averageResponseTime: number;
  traitScores: TraitScore[];
  metadata: {
    gameCode: string;
    trialsCompleted: number;
    totalTrials: number;
  };
}

/**
 * Calculate comprehensive score for a game including trait mapping
 */
export async function calculateGameScore(
  gameCode: string,
  results: GameResult[],
  assessmentId: string
): Promise<GameScoringResult> {
  // Basic metrics
  const correctResults = results.filter(r => r.correct);
  const accuracy = results.length > 0 ? correctResults.length / results.length : 0;
  const averageResponseTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    : 0;

  // Get trait mappings for this game
  const traitMappings = await getGameTraitMappings(gameCode);

  // Calculate trait scores
  const traitScores: TraitScore[] = traitMappings.map(mapping => {
    const traitScore = calculateTraitScore(mapping.trait, results, accuracy, averageResponseTime);
    return {
      trait: mapping.trait,
      score: traitScore * mapping.weight,
      weight: mapping.weight,
      rawScore: traitScore
    };
  });

  // Calculate overall score (weighted average of trait scores)
  const overallScore = traitScores.length > 0
    ? traitScores.reduce((sum, ts) => sum + ts.score, 0) / traitScores.length
    : accuracy * 100;

  return {
    overallScore: Math.round(overallScore * 100), // Convert to 0-100 scale
    accuracy: Math.round(accuracy * 100),
    averageResponseTime: Math.round(averageResponseTime),
    traitScores,
    metadata: {
      gameCode,
      trialsCompleted: results.length,
      totalTrials: results.length
    }
  };
}

/**
 * Get trait mappings for a specific game
 */
async function getGameTraitMappings(gameCode: string): Promise<Array<{ trait: string; weight: number }>> {
  try {
    const result = await executeQuery(`
      SELECT gtm.trait, gtm.weight
      FROM GAME_TRAIT_MAP gtm
      JOIN GAMES g ON gtm.game_id = g.id
      WHERE g.code = :gameCode
    `, [gameCode]);

    return result.rows.map((row: any) => ({
      trait: row.TRAIT,
      weight: parseFloat(row.WEIGHT)
    }));
  } catch (error) {
    console.warn(`Failed to get trait mappings for game ${gameCode}:`, error);
    return [];
  }
}

/**
 * Calculate score for a specific trait based on game results
 */
function calculateTraitScore(
  trait: string,
  results: GameResult[],
  accuracy: number,
  averageResponseTime: number
): number {
  switch (trait.toLowerCase()) {
    case 'memory':
      return calculateMemoryScore(results, accuracy);
    case 'attention':
      return calculateAttentionScore(results, accuracy, averageResponseTime);
    case 'logic':
      return calculateLogicScore(results, accuracy);
    case 'processing_speed':
      return calculateProcessingSpeedScore(averageResponseTime);
    case 'executive_function':
      return calculateExecutiveFunctionScore(results, accuracy);
    default:
      return accuracy; // Default to accuracy-based scoring
  }
}

/**
 * Calculate memory trait score
 */
function calculateMemoryScore(results: GameResult[], accuracy: number): number {
  // For memory tasks, consider both accuracy and consistency
  const responseTimeVariance = calculateVariance(results.map(r => r.responseTime));
  const consistencyBonus = Math.max(0, 1 - (responseTimeVariance / 10000)); // Normalize variance

  return (accuracy * 0.7) + (consistencyBonus * 0.3);
}

/**
 * Calculate attention trait score
 */
function calculateAttentionScore(results: GameResult[], accuracy: number, averageResponseTime: number): number {
  // Attention tasks value speed and accuracy balance
  const speedScore = Math.max(0, 1 - (averageResponseTime / 2000)); // Faster is better, up to 2s
  return (accuracy * 0.6) + (speedScore * 0.4);
}

/**
 * Calculate logic trait score
 */
function calculateLogicScore(results: GameResult[], accuracy: number): number {
  // Logic tasks heavily weight accuracy
  return accuracy * 0.9 + (results.length > 10 ? 0.1 : 0); // Small bonus for completing more trials
}

/**
 * Calculate processing speed trait score
 */
function calculateProcessingSpeedScore(averageResponseTime: number): number {
  // Pure speed-based scoring
  return Math.max(0, 1 - (averageResponseTime / 1500)); // Faster than 1.5s is perfect
}

/**
 * Calculate executive function trait score
 */
function calculateExecutiveFunctionScore(results: GameResult[], accuracy: number): number {
  // Executive function considers ability to maintain performance
  const firstHalf = results.slice(0, Math.floor(results.length / 2));
  const secondHalf = results.slice(Math.floor(results.length / 2));

  const firstHalfAccuracy = firstHalf.filter(r => r.correct).length / firstHalf.length;
  const secondHalfAccuracy = secondHalf.filter(r => r.correct).length / secondHalf.length;

  const consistencyScore = 1 - Math.abs(firstHalfAccuracy - secondHalfAccuracy);
  return (accuracy * 0.7) + (consistencyScore * 0.3);
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDifferences = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDifferences.reduce((sum, sq) => sum + sq, 0) / numbers.length;
}

/**
 * Aggregate multiple game scores into assessment-level trait scores
 */
export function aggregateTraitScores(gameResults: GameScoringResult[]): { [trait: string]: number } {
  const traitTotals: { [trait: string]: { total: number; count: number } } = {};

  gameResults.forEach(gameResult => {
    gameResult.traitScores.forEach(traitScore => {
      if (!traitTotals[traitScore.trait]) {
        traitTotals[traitScore.trait] = { total: 0, count: 0 };
      }
      traitTotals[traitScore.trait].total += traitScore.score;
      traitTotals[traitScore.trait].count += 1;
    });
  });

  const aggregatedScores: { [trait: string]: number } = {};
  Object.keys(traitTotals).forEach(trait => {
    aggregatedScores[trait] = traitTotals[trait].total / traitTotals[trait].count;
  });

  return aggregatedScores;
}

