'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameEngine from '@/components/games/GameEngine';

interface Assessment {
  id: string;
  candidate_id: string;
  job_role_id: string;
  status: string;
  started_at: string;
  completed_at: string;
  total_score: number;
  candidate_name: string;
  job_role_title: string;
  progress_percentage: number;
}

interface AssessmentItem {
  id: string;
  assessment_id: string;
  game_id: string;
  order_index: number;
  timer_seconds: number;
  server_started_at: string;
  server_deadline_at: string;
  status: string;
  score: number;
  metrics_json: any;
  config_snapshot: any;
  game_title: string;
  game_code: string;
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.assessmentId as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [currentItem, setCurrentItem] = useState<AssessmentItem | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    if (assessmentId) {
      fetchAssessment();
    }
  }, [assessmentId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Auto-submit when time runs out
      handleGameTimeout();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const fetchAssessment = async () => {
    try {
      // Fetch assessment details
      const assessmentResponse = await fetch(`http://localhost:8000/assessments/${assessmentId}`);
      if (!assessmentResponse.ok) {
        throw new Error('Failed to fetch assessment');
      }
      const assessmentData = await assessmentResponse.json();
      setAssessment(assessmentData);

      // Fetch assessment items
      const itemsResponse = await fetch(`http://localhost:8000/assessments/${assessmentId}/items`);
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setItems(itemsData);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assessment');
      setLoading(false);
    }
  };

  const handleStartAssessment = async () => {
    try {
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start assessment');
      }

      // Refresh assessment data
      fetchAssessment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assessment');
    }
  };

  const startGameItem = async (item: AssessmentItem) => {
    try {
      const response = await fetch(`http://localhost:8000/assessments/items/${item.id}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start game');
      }

      const result = await response.json();

      // Update item status
      setItems(items =>
        items.map(i => i.id === item.id ? { ...i, status: 'ACTIVE', server_started_at: result.server_started_at, server_deadline_at: result.server_deadline_at } : i)
      );

      setCurrentItem(item);
      setTimeLeft(item.timer_seconds || 300);
      setIsActive(true);
      setShowGame(true);
    } catch (err) {
      setError('Failed to start game');
    }
  };

  const handleGameComplete = async (results: any[]) => {
    if (!currentItem) return;

    try {
      // Calculate score and submit
      const gameResult = results[0]; // Assuming single result for now

      const submitResponse = await fetch(`http://localhost:8000/assessments/items/${currentItem.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: gameResult.score || 0,
          metrics_json: gameResult.metrics || {},
          response_time_ms: gameResult.responseTime || 0,
        }),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit game results');
      }

      // Update local state
      setItems(items =>
        items.map(i => i.id === currentItem.id ? { ...i, status: 'SUBMITTED', score: gameResult.score || 0 } : i)
      );

      setShowGame(false);
      setIsActive(false);
      setCurrentItem(null);

      // Refresh assessment to check completion
      fetchAssessment();
    } catch (err) {
      setError('Failed to submit game results');
    }
  };

  const handleGameTimeout = async () => {
    if (!currentItem) return;

    try {
      // Submit with zero score for timeout
      const submitResponse = await fetch(`http://localhost:8000/assessments/items/${currentItem.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: 0,
          metrics_json: { timeout: true },
          response_time_ms: (currentItem.timer_seconds || 300) * 1000,
        }),
      });

      if (!submitResponse.ok) {
        throw new Error('Failed to submit game results');
      }

      // Update local state
      setItems(items =>
        items.map(i => i.id === currentItem.id ? { ...i, status: 'SUBMITTED', score: 0 } : i)
      );

      setShowGame(false);
      setIsActive(false);
      setCurrentItem(null);

      // Refresh assessment
      fetchAssessment();
    } catch (err) {
      setError('Failed to submit game results');
    }
  };

  const handleGameProgress = (progress: number) => {
    // Could update progress indicator here
    console.log('Game progress:', progress);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800';
      case 'SUBMITTED':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:8000/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center bg-slate-800/50 backdrop-blur-sm p-8 rounded-lg shadow-lg border border-red-700 max-w-md">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Assessment</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={fetchAssessment}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (showGame && currentItem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        <GameEngine
          gameCode={currentItem.game_code}
          gameConfig={currentItem.config_snapshot || {}}
          onComplete={handleGameComplete}
          onProgress={handleGameProgress}
          assessmentId={assessmentId}
          itemId={currentItem.id}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-blue-400">CogniHire</h1>
              </div>
              {assessment && (
                <div className="ml-6">
                  <h2 className="text-lg font-semibold text-white">{assessment.job_role_title}</h2>
                  <p className="text-sm text-slate-400">Cognitive Assessment</p>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-6">
              {items.length > 0 && (
                <div className="text-center">
                  <div className="text-sm text-slate-400">Progress</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {items.filter(i => i.status === 'SUBMITTED').length} of {items.length}
                  </div>
                </div>
              )}
              {isActive && (
                <div className="text-center">
                  <div className="text-sm text-slate-400">Time Left</div>
                  <div className={`text-xl font-bold ${timeLeft < 60 ? 'text-red-400' : 'text-blue-400'}`}>
                    {formatTime(timeLeft)}
                  </div>
                </div>
              )}
              <button
                onClick={() => router.push('/candidate/dashboard')}
                className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      {assessment && items.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">Assessment Progress</span>
              <span className="text-sm text-slate-400">{assessment.progress_percentage}% Complete</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${assessment.progress_percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Assessment Header */}
        {assessment && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cognitive Assessment
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Job Role</label>
                  <p className="text-lg font-semibold text-white">{assessment.job_role_title}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(assessment.status)}`}>
                    {formatStatus(assessment.status)}
                  </span>
                </div>
                {assessment.started_at && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Started At</label>
                    <p className="text-white">
                      {new Date(assessment.started_at).toLocaleDateString()} at {new Date(assessment.started_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Progress</label>
                  <div className="flex items-center">
                    <div className="w-full bg-slate-700 rounded-full h-2 mr-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${assessment.progress_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-300">
                      {assessment.progress_percentage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Actions */}
        {assessment && assessment.status === 'NOT_STARTED' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden mb-8">
            <div className="p-6 text-center">
              <h3 className="text-lg font-medium text-white mb-4">Ready to Begin Your Assessment?</h3>
              <p className="text-slate-300 mb-6">
                This assessment will evaluate your cognitive abilities through a series of interactive games.
                Please ensure you have a quiet environment and stable internet connection.
              </p>
              <button
                onClick={handleStartAssessment}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center mx-auto"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Assessment
              </button>
            </div>
          </div>
        )}

        {/* Assessment Items */}
        {assessment && assessment.status !== 'NOT_STARTED' && items.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white">Assessment Games</h3>

            {items.map((item, index) => (
              <div key={item.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">
                        Game {index + 1}: {item.game_title}
                      </h4>
                      <p className="text-slate-300 mb-2">{item.game_code}</p>
                      <div className="flex items-center space-x-4 text-sm text-slate-400">
                        <span>Order: {item.order_index + 1}</span>
                        {item.timer_seconds && <span>Time: {item.timer_seconds}s</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-2 ${getStatusColor(item.status)}`}>
                        {formatStatus(item.status)}
                      </span>
                      {item.score !== undefined && item.score !== null && (
                        <div className="text-2xl font-bold text-blue-400">
                          {item.score}%
                        </div>
                      )}
                    </div>
                  </div>

                  {item.status === 'PENDING' && (
                    <button
                      onClick={() => startGameItem(item)}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm"
                    >
                      Start Game
                    </button>
                  )}

                  {item.status === 'ACTIVE' && (
                    <div className="text-center">
                      <div className="animate-pulse bg-blue-600 text-white font-medium py-2 px-6 rounded-lg">
                        Game In Progress...
                      </div>
                    </div>
                  )}

                  {item.status === 'SUBMITTED' && (
                    <div className="text-green-400 font-medium">
                      ✓ Game Completed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completion Message */}
        {assessment && assessment.status === 'COMPLETED' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Assessment Completed!
              </h3>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Congratulations!</h3>
              <p className="text-slate-300 mb-6">
                You have successfully completed your cognitive assessment.
                Your results will be reviewed by the hiring team.
              </p>
              {assessment.total_score && (
                <div className="mb-6">
                  <div className="text-3xl font-bold text-blue-400 mb-2">
                    {assessment.total_score}%
                  </div>
                  <div className="text-slate-300">Overall Score</div>
                </div>
              )}
              <button
                onClick={() => router.push('/candidate/dashboard')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
