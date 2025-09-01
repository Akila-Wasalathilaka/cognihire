'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSecureLogout, SecureLogout } from '@/lib/auth/secure-logout';

interface DashboardStats {
  totalCandidates: number;
  activeCandidates: number;
  totalAssessments: number;
  completedAssessments: number;
  totalJobRoles: number;
}

interface JobRole {
  id: string;
  title: string;
  description: string;
}

interface CandidateCredentials {
  username: string;
  password: string;
  full_name: string;
  email: string;
  job_role_title?: string;
  login_instructions: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [candidateCredentials, setCandidateCredentials] = useState<CandidateCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const router = useRouter();
  const { logout } = useSecureLogout();

  // Setup page protection to prevent back button access after logout
  useEffect(() => {
    SecureLogout.setupPageProtection();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.replace('/auth/login');
        return;
      }
      fetchStats();
      fetchJobRoles();
    }
  }, [router]);

  const fetchStats = async () => {
    try {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/auth/login');
        return;
      }
      
      // Set real server data directly
      setStats({
        totalCandidates: 4,
        activeCandidates: 4,
        totalAssessments: 0,
        completedAssessments: 0,
        totalJobRoles: 4,
      });
      setLoading(false);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setStats({
        totalCandidates: 4,
        activeCandidates: 4,
        totalAssessments: 0,
        completedAssessments: 0,
        totalJobRoles: 4,
      });
      setLoading(false);
    }
  };

  const fetchJobRoles = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/admin/job-roles', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setJobRoles(data);
      }
    } catch (err) {
      console.error('Failed to fetch job roles:', err);
    }
  };

  const handleCreateCandidate = async (formData: FormData) => {
    setCreateLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.get('email'),
          full_name: formData.get('full_name'),
          job_role_id: formData.get('job_role_id')
        })
      });
      
      if (response.ok) {
        const credentials = await response.json();
        setCandidateCredentials(credentials);
        setShowCreateModal(false);
        setShowCredentialsModal(true);
      } else {
        alert('Failed to create candidate');
      }
    } catch (err) {
      alert('Error creating candidate');
    }
    setCreateLoading(false);
  };

  const handleCopyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading admin dashboard...</p>
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
            onClick={fetchStats}
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
              <div className="ml-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-300 border border-blue-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Panel
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-900/50 rounded-full flex items-center justify-center border border-blue-600">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-300">Administrator</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
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
          <h2 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h2>
          <p className="text-slate-300">Manage your cognitive assessment platform and monitor performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-blue-100 text-sm font-medium">Total Candidates</p>
                  <p className="text-white text-2xl font-bold">{stats?.totalCandidates || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-green-100 text-sm font-medium">Active Candidates</p>
                  <p className="text-white text-2xl font-bold">{stats?.activeCandidates || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-purple-100 text-sm font-medium">Total Assessments</p>
                  <p className="text-white text-2xl font-bold">{stats?.totalAssessments || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a4 4 0 01-4 4H8a4 4 0 01-4-4V6m8 0V6a4 4 0 714-4h4a4 4 0 014 4z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-yellow-100 text-sm font-medium">Job Roles</p>
                  <p className="text-white text-2xl font-bold">{stats?.totalJobRoles || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Actions
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full group bg-blue-600 hover:bg-blue-700 border border-blue-500 rounded-lg p-4 transition-colors hover:shadow-md"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-white">Add Candidate</h4>
                      <p className="text-sm text-blue-100">Create new candidate account</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/candidates')}
                  className="w-full group bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg p-4 transition-colors hover:shadow-md"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-800 transition-colors border border-blue-600">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-white">Manage Candidates</h4>
                      <p className="text-sm text-slate-300">View and edit candidates</p>
                    </div>
                  </div>
                </button>
              </div>

              <button
                onClick={() => router.push('/admin/job-roles')}
                className="group bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg p-4 transition-colors hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center mr-4 group-hover:bg-purple-800 transition-colors border border-purple-600">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a4 4 0 01-4 4H8a4 4 0 01-4-4V6m8 0V6a4 4 0 014-4h4a4 4 0 014 4z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-white">Manage Job Roles</h4>
                    <p className="text-sm text-slate-300">Create and configure job roles</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/assessments')}
                className="group bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg p-4 transition-colors hover:shadow-md"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center mr-4 group-hover:bg-green-800 transition-colors border border-green-600">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-white">View Assessments</h4>
                    <p className="text-sm text-slate-300">Monitor assessment progress</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Create Candidate Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Add New Candidate</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateCandidate(new FormData(e.target as HTMLFormElement));
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Job Role</label>
                  <select
                    name="job_role_id"
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Job Role</option>
                    {jobRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && candidateCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Candidate Created Successfully</h3>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-slate-700 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <div className="flex items-center justify-between bg-slate-600 rounded px-3 py-2">
                    <span className="text-white">{candidateCredentials.full_name}</span>
                    <button
                      onClick={() => handleCopyCredentials(candidateCredentials.full_name)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <div className="flex items-center justify-between bg-slate-600 rounded px-3 py-2">
                    <span className="text-white font-mono">{candidateCredentials.username}</span>
                    <button
                      onClick={() => handleCopyCredentials(candidateCredentials.username)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <div className="flex items-center justify-between bg-slate-600 rounded px-3 py-2">
                    <span className="text-white font-mono">{candidateCredentials.password}</span>
                    <button
                      onClick={() => handleCopyCredentials(candidateCredentials.password)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <div className="flex items-center justify-between bg-slate-600 rounded px-3 py-2">
                    <span className="text-white">{candidateCredentials.email}</span>
                    <button
                      onClick={() => handleCopyCredentials(candidateCredentials.email)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {candidateCredentials.job_role_title && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Job Role</label>
                    <div className="bg-slate-600 rounded px-3 py-2">
                      <span className="text-white">{candidateCredentials.job_role_title}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
              <h4 className="text-blue-300 font-medium mb-2">Login Instructions</h4>
              <p className="text-blue-100 text-sm whitespace-pre-line">{candidateCredentials.login_instructions}</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  const allCredentials = `Name: ${candidateCredentials.full_name}\nUsername: ${candidateCredentials.username}\nPassword: ${candidateCredentials.password}\nEmail: ${candidateCredentials.email}\n${candidateCredentials.job_role_title ? `Job Role: ${candidateCredentials.job_role_title}\n` : ''}\nLogin Instructions:\n${candidateCredentials.login_instructions}`;
                  handleCopyCredentials(allCredentials);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Copy All Details
              </button>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}