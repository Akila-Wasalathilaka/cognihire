import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useIntegrityTracking } from '@/lib/hooks/useIntegrityTracking';

// Dynamic imports for games
const NBackGame = dynamic(() => import('./NBackGame'), { ssr: false });
const StroopGame = dynamic(() => import('./StroopGame'), { ssr: false });
const ReactionTimeGame = dynamic(() => import('./ReactionTimeGame'), { ssr: false });

interface GameConfig {
  [key: string]: any;
}

interface GameResult {
  [key: string]: any;
}

interface GameEngineProps {
  gameCode: string;
  gameConfig: GameConfig;
  onComplete: (results: GameResult[]) => void;
  onProgress: (progress: number) => void;
  assessmentId?: string;
  itemId?: string;
  enableIntegrityTracking?: boolean;
}

export default function GameEngine({
  gameCode,
  gameConfig,
  onComplete,
  onProgress,
  assessmentId,
  itemId,
  enableIntegrityTracking = true
}: GameEngineProps) {
  const [error, setError] = useState<string | null>(null);

  // Initialize integrity tracking if enabled and IDs are provided
  const { reportIntegrityEvent } = useIntegrityTracking({
    assessmentId: assessmentId || '',
    itemId: itemId || '',
    enabled: enableIntegrityTracking && !!assessmentId && !!itemId,
    onIntegrityEvent: (event) => {
      console.log('Integrity event:', event);
    }
  });

  const renderGame = () => {
    try {
      switch (gameCode) {
        case 'NBACK':
          return (
            <NBackGame
              config={gameConfig as any}
              onComplete={onComplete}
              onProgress={onProgress}
            />
          );

        case 'STROOP':
          return (
            <StroopGame
              config={gameConfig as any}
              onComplete={onComplete}
              onProgress={onProgress}
            />
          );

        case 'REACTION_TIME':
          return (
            <ReactionTimeGame
              config={gameConfig as any}
              onComplete={onComplete}
              onProgress={onProgress}
            />
          );

        default:
          setError(`Unknown game code: ${gameCode}`);
          return null;
      }
    } catch (err) {
      setError(`Error loading game ${gameCode}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Game Error</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => setError(null)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return renderGame();
}
