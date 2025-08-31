import React, { useState, useEffect, useCallback } from 'react';

interface ReactionTimeConfig {
  trials: number;
  stimuli: string[];
  minDelay: number;
  maxDelay: number;
  timer: number;
}

interface ReactionTimeTrial {
  stimulus: string;
  delay: number;
  responseTime?: number;
  correct?: boolean;
}

interface ReactionTimeProps {
  config: ReactionTimeConfig;
  onComplete: (results: ReactionTimeTrial[]) => void;
  onProgress: (progress: number) => void;
}

export default function ReactionTimeGame({ config, onComplete, onProgress }: ReactionTimeProps) {
  const [trials, setTrials] = useState<ReactionTimeTrial[]>([]);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [waitingForStimulus, setWaitingForStimulus] = useState(true);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [tooEarly, setTooEarly] = useState(false);

  const generateTrials = useCallback(() => {
    const newTrials: ReactionTimeTrial[] = [];

    for (let i = 0; i < config.trials; i++) {
      const stimulus = config.stimuli[Math.floor(Math.random() * config.stimuli.length)];
      const delay = config.minDelay + Math.random() * (config.maxDelay - config.minDelay);

      newTrials.push({ stimulus, delay });
    }

    return newTrials;
  }, [config]);

  const startGame = useCallback(() => {
    const newTrials = generateTrials();
    setTrials(newTrials);
    setCurrentTrial(0);
    setIsActive(true);
    setTooEarly(false);
    presentNextStimulus(newTrials, 0);
  }, [generateTrials]);

  const presentNextStimulus = useCallback((trialList: ReactionTimeTrial[], trialIndex: number) => {
    if (trialIndex >= trialList.length) {
      setIsActive(false);
      onComplete(trialList);
      return;
    }

    setCurrentTrial(trialIndex);
    setWaitingForStimulus(true);
    setWaitingForResponse(false);
    setTooEarly(false);
    setCurrentStimulus('');

    const trial = trialList[trialIndex];

    // Wait for the random delay
    setTimeout(() => {
      setCurrentStimulus(trial.stimulus);
      setWaitingForStimulus(false);
      setWaitingForResponse(true);
      setStartTime(Date.now());

      onProgress((trialIndex + 1) / trialList.length);
    }, trial.delay);
  }, [onComplete, onProgress]);

  const handleResponse = useCallback(() => {
    if (!waitingForResponse) {
      if (waitingForStimulus) {
        setTooEarly(true);
        // Penalize for responding too early
        const updatedTrials = [...trials];
        updatedTrials[currentTrial] = {
          ...updatedTrials[currentTrial],
          responseTime: -1, // Negative indicates too early
          correct: false
        };
        setTrials(updatedTrials);
        setWaitingForResponse(false);

        setTimeout(() => {
          presentNextStimulus(trials, currentTrial + 1);
        }, 1000);
      }
      return;
    }

    const responseTime = Date.now() - startTime;

    const updatedTrials = [...trials];
    updatedTrials[currentTrial] = {
      ...updatedTrials[currentTrial],
      responseTime,
      correct: true
    };

    setTrials(updatedTrials);
    setWaitingForResponse(false);

    setTimeout(() => {
      presentNextStimulus(updatedTrials, currentTrial + 1);
    }, 1000); // Brief pause between trials
  }, [waitingForResponse, waitingForStimulus, startTime, trials, currentTrial, presentNextStimulus]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (!isActive) {
          startGame();
        } else {
          handleResponse();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, startGame, handleResponse]);

  const validTrials = trials.filter(t => t.responseTime && t.responseTime > 0);
  const averageResponseTime = validTrials.length > 0
    ? validTrials.reduce((sum, t) => sum + (t.responseTime || 0), 0) / validTrials.length
    : 0;

  const accuracy = trials.length > 0
    ? validTrials.length / trials.length
    : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Simple Reaction Time</h2>
          <p className="text-gray-600">
            Wait for the stimulus to appear, then press SPACE as quickly as possible.
          </p>
        </div>

        {!isActive ? (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-6xl bg-gray-200 rounded p-12 mb-4 min-h-[200px] flex items-center justify-center">
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
                <div>
                  <strong>Avg Response Time:</strong> {Math.round(averageResponseTime)}ms
                </div>
                <div>
                  <strong>Valid Trials:</strong> {validTrials.length}/{trials.length}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="text-8xl bg-gray-100 rounded-lg p-16 mb-8 flex items-center justify-center min-h-[300px]">
              {waitingForStimulus ? (
                <div className="text-center">
                  <div className="text-4xl text-gray-400 mb-4">+</div>
                  <p className="text-sm text-gray-500">Wait for stimulus...</p>
                </div>
              ) : (
                currentStimulus
              )}
            </div>

            <div className="mb-6">
              <div className="bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentTrial + 1) / config.trials) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                Trial {currentTrial + 1} of {config.trials}
              </p>
            </div>

            {tooEarly && (
              <div className="text-center mb-4">
                <p className="text-lg font-semibold text-red-600">
                  Too early! Wait for the stimulus to appear.
                </p>
              </div>
            )}

            {waitingForResponse && (
              <div className="text-center">
                <p className="text-lg font-semibold text-purple-600 mb-4">
                  Press SPACE as quickly as possible!
                </p>
              </div>
            )}

            {!waitingForStimulus && !waitingForResponse && (
              <div className="text-center">
                <p className="text-lg font-semibold text-green-600">
                  Response recorded! Get ready for the next trial...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
