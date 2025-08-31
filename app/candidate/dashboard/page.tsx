'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../../../utils/api';

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

interface User {
  id: string;
  username: string;
  role: string;
  tenantId: string;
  email?: string;
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
  score?: number;
  metrics?: any;
}

interface TraitScore {
  trait: string;
  score: number;
  weight: number;
  rawScore: number;
}

interface AssessmentResults {
  overallScore: number;
  accuracy: number;
  averageResponseTime: number;
  traitScores: TraitScore[];
  gameResults: AssessmentItem[];
  summary: {
    totalGames: number;
    completedGames: number;
    averageScore: number;
  };
}

export default function CandidateDashboard() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResults | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch current assessment
      const assessmentResponse = await apiRequest('/assessments/current');
      if (assessmentResponse.ok) {
        const assessmentData = await assessmentResponse.json();
        setAssessment(assessmentData.assessment);

        // Fetch detailed results if assessment is completed
        if (assessmentData.assessment?.status === 'COMPLETED') {
          await fetchAssessmentResults(assessmentData.assessment.id);
        }
      }

      // Fetch user profile
      const profileResponse = await apiRequest('/auth/profile');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setUser(profileData);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  };

  const fetchAssessmentResults = async (assessmentId: string) => {
    try {
      // Fetch detailed assessment results
      const response = await apiRequest(`/assessments/${assessmentId}`);
      if (response.ok) {
        const data = await response.json();

        // Get detailed item results
        const itemsResponse = await apiRequest(`/assessments/${assessmentId}/items`);
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();

          // Aggregate results
          const gameResults = itemsData.items || [];
          const completedGames = gameResults.filter((item: any) => item.status === 'SUBMITTED');

          if (completedGames.length > 0) {
            // Calculate trait scores from completed games
            const allTraitScores: { [trait: string]: number[] } = {};

            completedGames.forEach((game: any) => {
              if (game.metrics?.serverScoring?.traitScores) {
                game.metrics.serverScoring.traitScores.forEach((traitScore: TraitScore) => {
                  if (!allTraitScores[traitScore.trait]) {
                    allTraitScores[traitScore.trait] = [];
                  }
                  allTraitScores[traitScore.trait].push(traitScore.score);
                });
              }
            });

            // Average trait scores
            const traitScores: TraitScore[] = Object.entries(allTraitScores).map(([trait, scores]) => ({
              trait,
              score: scores.reduce((sum, score) => sum + score, 0) / scores.length,
              weight: 1,
              rawScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
            }));

            const averageScore = completedGames.reduce((sum: number, game: any) => sum + (game.score || 0), 0) / completedGames.length;

            setAssessmentResults({
              overallScore: Math.round(data.assessment?.totalScore || averageScore),
              accuracy: 0, // Would need to calculate from metrics
              averageResponseTime: 0, // Would need to calculate from metrics
              traitScores,
              gameResults: completedGames,
              summary: {
                totalGames: gameResults.length,
                completedGames: completedGames.length,
                averageScore: Math.round(averageScore)
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch assessment results:', err);
    }
  };

  const downloadReport = async () => {
    if (!assessment) return;

    try {
      const response = await apiRequest(`/reports/${assessment.id}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assessment-report-${assessment.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download report. Please try again.');
      }
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Error downloading report. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      localStorage.removeItem('access_token');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      localStorage.removeItem('access_token');
      router.push('/login');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOT_STARTED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'NOT_STARTED':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'IN_PROGRESS':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'COMPLETED':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'EXPIRED':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading your dashboard...</p>
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
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
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
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-900/50 rounded-full flex items-center justify-center border border-blue-600">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-300">
                  Welcome, {user?.username || 'Candidate'}
                </span>
              </div>
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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Candidate Dashboard</h2>
          <p className="text-slate-300">Manage your cognitive assessments and track your progress</p>
        </div>

        {/* Assessment Card */}
        {assessment ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your Assessment
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Job Role</label>
                  <p className="text-lg font-semibold text-white">{assessment.jobRole.title}</p>
                </div>
                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(assessment.status)}`}>
                      {getStatusIcon(assessment.status)}
                      <span className="ml-2">{formatStatus(assessment.status)}</span>
                    </span>
                  </div>
                </div>
                {assessment.startedAt && (
                  <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Started At</label>
                    <p className="text-lg font-semibold text-white">
                      {new Date(assessment.startedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-slate-400">
                      {new Date(assessment.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {assessment.totalScore !== undefined && (
                  <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Total Score</label>
                    <p className="text-2xl font-bold text-blue-400">{assessment.totalScore}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                {assessment.status === 'NOT_STARTED' && (
                  <button
                    onClick={() => router.push(`/candidate/assessment/${assessment.id}`)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Assessment
                  </button>
                )}
                {assessment.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => router.push(`/candidate/assessment/${assessment.id}`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Continue Assessment
                  </button>
                )}
                {assessment.status === 'COMPLETED' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-green-600 mb-2">Assessment Completed!</h3>
                      <p className="text-gray-600 mb-6">Your results have been submitted successfully.</p>
                      <button
                        onClick={downloadReport}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center mx-auto"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Report
                      </button>
                    </div>

                    {assessmentResults && (
                      <div className="space-y-6">
                        {/* Overall Score */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                          <h4 className="text-lg font-semibold text-green-800 mb-4">Overall Performance</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-green-600">{assessmentResults.overallScore}%</div>
                              <div className="text-sm text-green-600">Overall Score</div>
                            </div>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-blue-600">{assessmentResults.summary.completedGames}</div>
                              <div className="text-sm text-blue-600">Games Completed</div>
                            </div>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-purple-600">{assessmentResults.summary.averageScore}%</div>
                              <div className="text-sm text-purple-600">Average Score</div>
                            </div>
                          </div>
                        </div>

                        {/* Trait Scores */}
                        {assessmentResults.traitScores.length > 0 && (
                          <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Cognitive Trait Scores</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {assessmentResults.traitScores.map((traitScore) => (
                                <div key={traitScore.trait} className="bg-gray-50 rounded-lg p-4">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-700 capitalize">
                                      {traitScore.trait.replace('_', ' ')}
                                    </span>
                                    <span className="text-lg font-bold text-indigo-600">
                                      {Math.round(traitScore.score)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, traitScore.score)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Game Results */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Game Performance</h4>
                          <div className="space-y-3">
                            {assessmentResults.gameResults.map((game) => (
                              <div key={game.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <span className="font-medium text-gray-900">{game.gameTitle}</span>
                                  <span className="text-sm text-gray-500 ml-2">({game.gameCode})</span>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span className="text-sm text-gray-600">
                                    {game.timerSeconds ? `${game.timerSeconds}s` : 'No timer'}
                                  </span>
                                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    game.score && game.score >= 70 ? 'bg-green-100 text-green-800' :
                                    game.score && game.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {game.score || 0}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                No Assessment Assigned
              </h3>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Assessments</h3>
              <p className="text-gray-600 mb-6">
                You don't have any assessments assigned at the moment. Please contact your administrator or HR team to get started.
              </p>
              <button
                onClick={fetchData}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {/* Assessment History */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Assessment History
            </h3>
          </div>
          <div className="p-6">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3l-1 14H7L6 7m13-4v16a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assessment History</h3>
              <p className="text-gray-600">
                Your completed assessments will appear here once you finish them.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
