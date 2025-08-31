import React, { useState, useEffect, useCallback } from 'react';

interface StroopConfig {
  trials: number;
  colors: string[];
  congruentRatio: number;
  stimulusDuration: number;
  timer: number;
}

interface StroopTrial {
  word: string;
  color: string;
  isCongruent: boolean;
  response?: string;
  responseTime?: number;
  correct?: boolean;
}

interface StroopProps {
  config: StroopConfig;
  onComplete: (results: StroopTrial[]) => void;
  onProgress: (progress: number) => void;
}

const colorMap: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b'
};

export default function StroopGame({ config, onComplete, onProgress }: StroopProps) {
  const [trials, setTrials] = useState<StroopTrial[]>([]);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [currentColor, setCurrentColor] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [showStimulus, setShowStimulus] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  const generateTrials = useCallback(() => {
    const newTrials: StroopTrial[] = [];
    const congruentCount = Math.floor(config.trials * config.congruentRatio);

    for (let i = 0; i < config.trials; i++) {
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];
      let word: string;
      let isCongruent: boolean;

      if (i < congruentCount) {
        // Congruent trial
        word = color;
        isCongruent = true;
      } else {
        // Incongruent trial
        const otherColors = config.colors.filter(c => c !== color);
        word = otherColors[Math.floor(Math.random() * otherColors.length)];
        isCongruent = false;
      }

      newTrials.push({ word, color, isCongruent });
    }

    return newTrials;
  }, [config]);

  const startGame = useCallback(() => {
    const newTrials = generateTrials();
    setTrials(newTrials);
    setCurrentTrial(0);
    setIsActive(true);
    setStartTime(Date.now());
    presentNextStimulus(newTrials, 0);
  }, [generateTrials]);

  const presentNextStimulus = useCallback((trialList: StroopTrial[], trialIndex: number) => {
    if (trialIndex >= trialList.length) {
      setIsActive(false);
      onComplete(trialList);
      return;
    }

    setCurrentTrial(trialIndex);
    setCurrentWord(trialList[trialIndex].word);
    setCurrentColor(trialList[trialIndex].color);
    setShowStimulus(true);
    setWaitingForResponse(true);

    onProgress((trialIndex + 1) / trialList.length);

    setTimeout(() => {
      setShowStimulus(false);
      setWaitingForResponse(false);

      setTimeout(() => {
        presentNextStimulus(trialList, trialIndex + 1);
      }, 1000); // Brief pause between trials
    }, config.stimulusDuration);
  }, [config, onComplete, onProgress]);

  const handleResponse = useCallback((response: string) => {
    if (!waitingForResponse) return;

    const responseTime = Date.now() - startTime;
    const trial = trials[currentTrial];
    const correct = response === trial.color;

    const updatedTrials = [...trials];
    updatedTrials[currentTrial] = {
      ...trial,
      response,
      responseTime,
      correct
    };

    setTrials(updatedTrials);
    setWaitingForResponse(false);
  }, [waitingForResponse, trials, currentTrial, startTime]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!waitingForResponse) return;

      const key = event.key.toLowerCase();
      if (config.colors.includes(key)) {
        event.preventDefault();
        handleResponse(key);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [waitingForResponse, config.colors, handleResponse]);

  const accuracy = trials.length > 0
    ? trials.filter(t => t.correct).length / trials.length
    : 0;

  const averageResponseTime = trials.length > 0
    ? trials.filter(t => t.responseTime).reduce((sum, t) => sum + (t.responseTime || 0), 0) / trials.filter(t => t.responseTime).length
    : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Stroop Color-Word Test</h2>
          <p className="text-gray-600">
            Name the COLOR of the ink (not the word). Press the first letter of the color.
          </p>
        </div>

        {!isActive ? (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-6xl font-bold bg-gray-200 rounded p-12 mb-4 min-h-[200px] flex items-center justify-center">
                {currentWord ? (
                  <span style={{ color: colorMap[currentColor] || currentColor }}>
                    {currentWord.toUpperCase()}
                  </span>
                ) : (
                  '?'
                )}
              </div>
              <p className="text-sm text-gray-500">
                Press any color key to {trials.length === 0 ? 'start' : 'continue'}
              </p>
            </div>

            {trials.length > 0 && (
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <strong>Progress:</strong> {currentTrial + 1}/{config.trials}
                </div>
                <div>
                  <strong>Accuracy:</strong> {Math.round(accuracy * 100)}%
                </div>
                <div>
                  <strong>Avg Response Time:</strong> {Math.round(averageResponseTime)}ms
                </div>
                <div>
                  <strong>Congruent Trials:</strong> {trials.filter(t => t.isCongruent).length}
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">Color Keys:</p>
              <div className="flex justify-center space-x-2">
                {config.colors.map(color => (
                  <div key={color} className="text-center">
                    <div
                      className="w-8 h-8 rounded mb-1 mx-auto"
                      style={{ backgroundColor: colorMap[color] || color }}
                    />
                    <span className="text-xs font-mono">{color[0].toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-8xl font-bold bg-gray-100 rounded-lg p-16 mb-8 flex items-center justify-center min-h-[300px]">
              {showStimulus ? (
                <span style={{ color: colorMap[currentColor] || currentColor }}>
                  {currentWord.toUpperCase()}
                </span>
              ) : (
                <span className="text-gray-400">+</span>
              )}
            </div>

            <div className="mb-6">
              <div className="bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentTrial + 1) / config.trials) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                Trial {currentTrial + 1} of {config.trials}
              </p>
            </div>

            {waitingForResponse && (
              <div className="text-center">
                <p className="text-lg font-semibold text-green-600 mb-4">
                  What color is the ink?
                </p>
                <div className="flex justify-center space-x-2 flex-wrap">
                  {config.colors.map(color => (
                    <button
                      key={color}
                      onClick={() => handleResponse(color)}
                      className="px-4 py-2 rounded-lg font-semibold border-2 hover:scale-105 transition-transform"
                      style={{
                        borderColor: colorMap[color] || color,
                        color: colorMap[color] || color
                      }}
                    >
                      {color.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
