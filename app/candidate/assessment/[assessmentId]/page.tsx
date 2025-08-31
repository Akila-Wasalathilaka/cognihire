'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameEngine from '@/components/games/GameEngine';

interface Assessment {
  id: string;
  jobRoleId: string;
  status: string;
  startedAt?: string;
  totalScore?: number;
  jobRole: {
    title: string;
    traits: any;
    config: any;
  };
}

interface AssessmentItem {
  id: string;
  gameId: string;
  gameCode: string;
  gameTitle: string;
  orderIndex: number;
  timerSeconds?: number;
  configOverride?: any;
  baseConfig?: any;
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.assessmentId as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssessment();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Auto-submit when time runs out
      handleNext();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const fetchAssessment = async () => {
    try {
      const response = await fetch('/api/assessments/current');
      if (!response.ok) {
        throw new Error('Failed to fetch assessment');
      }
      const data = await response.json();
      setAssessment(data.assessment);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start assessment');
      }

      const data = await response.json();
      setItems(data.assessment.items);
      setCurrentItemIndex(0);
      setTimeLeft(data.assessment.items[0]?.timerSeconds || 300);
      setIsActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assessment');
    }
  };

  const handleNext = async () => {
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      setTimeLeft(items[currentItemIndex + 1]?.timerSeconds || 300);
      setIsActive(false);
    } else {
      // Complete assessment
      try {
        const response = await fetch(`/api/assessments/${assessmentId}/complete`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to complete assessment');
        }

        alert('Assessment completed!');
        router.push('/candidate/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete assessment');
      }
    }
  };

  const handleStartGame = async () => {
    const currentItem = items[currentItemIndex];
    if (!currentItem) return;

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/items/${currentItem.id}/start`, {
        method: 'POST',
      });

      if (response.ok) {
        setIsActive(true);
        setTimeLeft(currentItem.timerSeconds || 300);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start game');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleGameComplete = async (results: any[]) => {
    const currentItem = items[currentItemIndex];
    if (!currentItem) return;

    try {
      // Submit game results
      const response = await fetch(`/api/assessments/${assessmentId}/items/${currentItem.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          results,
          score: calculateScore(results),
          metrics: results
        }),
      });

      if (response.ok) {
        setIsActive(false);

        // Move to next item or complete assessment
        if (currentItemIndex < items.length - 1) {
          setCurrentItemIndex(prev => prev + 1);
        } else {
          await handleCompleteAssessment();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to submit results');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const calculateScore = (results: any[]): number => {
    // Simple scoring based on accuracy
    const correct = results.filter(r => r.correct).length;
    return Math.round((correct / results.length) * 100);
  };

  const handleCompleteAssessment = async () => {
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/complete`, {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/candidate/dashboard?completed=true');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to complete assessment');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (items.length === 0) return 0;
    return ((currentItemIndex + 1) / items.length) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg border border-red-200 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Assessment</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/candidate/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg border border-gray-200 max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Assessment Found</h2>
          <p className="text-gray-600 mb-6">You don't have any active assessments at the moment.</p>
          <button
            onClick={() => router.push('/candidate/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentItem = items[currentItemIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-indigo-600">CogniHire</h1>
              </div>
              <div className="ml-6">
                <h2 className="text-lg font-semibold text-gray-900">{assessment.jobRole.title}</h2>
                <p className="text-sm text-gray-500">Cognitive Assessment</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {items.length > 0 && (
                <div className="text-center">
                  <div className="text-sm text-gray-500">Progress</div>
                  <div className="text-lg font-semibold text-indigo-600">
                    {currentItemIndex + 1} of {items.length}
                  </div>
                </div>
              )}
              {isActive && (
                <div className="text-center">
                  <div className="text-sm text-gray-500">Time Left</div>
                  <div className={`text-xl font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-indigo-600'}`}>
                    {formatTime(timeLeft)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      {items.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Assessment Progress</span>
              <span className="text-sm text-gray-500">{Math.round(getProgressPercentage())}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {currentItem ? currentItem.gameTitle : 'Assessment Overview'}
            </h3>
            <p className="text-indigo-100 mt-1">
              {assessment.status === 'NOT_STARTED'
                ? 'Click start to begin your cognitive assessment'
                : currentItem
                  ? `Complete this ${currentItem.gameCode} game to continue`
                  : 'Assessment in progress'
              }
            </p>
          </div>

          <div className="p-6">
            {assessment.status === 'NOT_STARTED' ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Ready to Start Your Assessment?</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  This assessment contains {items.length} cognitive games that will evaluate your mental abilities.
                  Make sure you're in a quiet environment and ready to focus.
                </p>
                <button
                  onClick={handleStart}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center mx-auto"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Assessment
                </button>
              </div>
            ) : !isActive ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Ready for the Next Game?</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {currentItem ? `Get ready to play ${currentItem.gameTitle}. You have ${currentItem.timerSeconds || 300} seconds to complete this game.` : 'Loading next game...'}
                </p>
                <button
                  onClick={handleStartGame}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center mx-auto"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Game
                </button>
              </div>
            ) : currentItem ? (
              <div className="space-y-6">
                {/* Timer Warning */}
                {timeLeft < 60 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-red-800 font-medium">Less than 1 minute remaining!</span>
                    </div>
                  </div>
                )}

                {/* Game Engine */}
                <GameEngine
                  gameCode={currentItem.gameCode}
                  gameConfig={currentItem.configOverride || currentItem.baseConfig || {}}
                  onComplete={handleGameComplete}
                  onProgress={(progress) => {
                    // Update progress if needed
                  }}
                  assessmentId={assessmentId}
                  itemId={currentItem.id}
                  enableIntegrityTracking={true}
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">No Game Available</h3>
                <p className="text-gray-600">Unable to load the game. Please try again.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
