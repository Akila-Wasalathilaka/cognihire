import React, { useState, useEffect, useCallback } from 'react';

interface NBackConfig {
  n: number;
  trials: number;
  stimulusDuration: number;
  isi: number;
  targets: number;
  timer: number;
}

interface NBackTrial {
  stimulus: string;
  isTarget: boolean;
  response?: boolean;
  responseTime?: number;
  correct?: boolean;
}

interface NBackProps {
  config: NBackConfig;
  onComplete: (results: NBackTrial[]) => void;
  onProgress: (progress: number) => void;
}

const stimuli = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function NBackGame({ config, onComplete, onProgress }: NBackProps) {
  const [trials, setTrials] = useState<NBackTrial[]>([]);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [showStimulus, setShowStimulus] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  const generateTrials = useCallback(() => {
    const newTrials: NBackTrial[] = [];
    const targetCount = Math.floor(config.trials * config.targets);

    for (let i = 0; i < config.trials; i++) {
      const stimulus = stimuli[Math.floor(Math.random() * stimuli.length)];
      let isTarget = false;

      if (i >= config.n) {
        // Check if this matches the stimulus N positions back
        isTarget = stimulus === newTrials[i - config.n].stimulus;
      }

      newTrials.push({ stimulus, isTarget });
    }

    // Ensure we have the right number of targets
    let currentTargets = newTrials.filter(t => t.isTarget).length;
    while (currentTargets < targetCount && currentTargets < config.trials - config.n) {
      const nonTargetIndices = newTrials
        .map((trial, index) => ({ trial, index }))
        .filter(({ trial, index }) => !trial.isTarget && index >= config.n)
        .map(({ index }) => index);

      if (nonTargetIndices.length === 0) break;

      const randomIndex = nonTargetIndices[Math.floor(Math.random() * nonTargetIndices.length)];
      newTrials[randomIndex].stimulus = newTrials[randomIndex - config.n].stimulus;
      newTrials[randomIndex].isTarget = true;
      currentTargets++;
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

  const presentNextStimulus = useCallback((trialList: NBackTrial[], trialIndex: number) => {
    if (trialIndex >= trialList.length) {
      setIsActive(false);
      onComplete(trialList);
      return;
    }

    setCurrentTrial(trialIndex);
    setCurrentStimulus(trialList[trialIndex].stimulus);
    setShowStimulus(true);
    setWaitingForResponse(true);

    onProgress((trialIndex + 1) / trialList.length);

    setTimeout(() => {
      setShowStimulus(false);

      setTimeout(() => {
        presentNextStimulus(trialList, trialIndex + 1);
      }, config.isi - config.stimulusDuration);
    }, config.stimulusDuration);
  }, [config, onComplete, onProgress]);

  const handleResponse = useCallback((response: boolean) => {
    if (!waitingForResponse) return;

    const responseTime = Date.now() - startTime;
    const trial = trials[currentTrial];
    const correct = (response && trial.isTarget) || (!response && !trial.isTarget);

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
      if (event.code === 'Space') {
        event.preventDefault();
        if (!isActive) {
          startGame();
        } else if (waitingForResponse) {
          handleResponse(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, waitingForResponse, startGame, handleResponse]);

  const accuracy = trials.length > 0
    ? trials.filter(t => t.correct).length / trials.length
    : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">N-Back Memory Task</h2>
          <p className="text-gray-600">
            Press SPACE when you see a letter that matches the one {config.n} positions back.
          </p>
        </div>

        {!isActive ? (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-4xl font-mono bg-gray-200 rounded p-8 mb-4">
                {currentStimulus || '?'}
              </div>
              <p className="text-sm text-gray-500">
                Press SPACE to {trials.length === 0 ? 'start' : 'continue'}
              </p>
            </div>

            {trials.length > 0 && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Progress:</strong> {currentTrial + 1}/{config.trials}
                </div>
                <div>
                  <strong>Accuracy:</strong> {Math.round(accuracy * 100)}%
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="text-6xl font-mono bg-blue-100 rounded-lg p-12 mb-6 flex items-center justify-center min-h-[200px]">
              {showStimulus ? currentStimulus : '+'}
            </div>

            <div className="mb-4">
              <div className="bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentTrial + 1) / config.trials) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                Trial {currentTrial + 1} of {config.trials}
              </p>
            </div>

            {waitingForResponse && (
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-600 mb-4">
                  Is this a match? Press SPACE for YES
                </p>
                <button
                  onClick={() => handleResponse(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg mr-4 hover:bg-blue-700"
                >
                  YES (Match)
                </button>
                <button
                  onClick={() => handleResponse(false)}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                >
                  NO (No Match)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
