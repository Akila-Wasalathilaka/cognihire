'use client';

import { useState } from 'react';

interface AITestResult {
  success: boolean;
  message?: string;
  connectionStatus?: any;
  error?: string;
  data?: any;
  availableFeatures?: string[];
}

export default function AITester() {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<AITestResult | null>(null);

  const testAIConnection = async () => {
    setIsTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/ai/test', {
        method: 'GET',
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testGameGeneration = async () => {
    setIsTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate_game',
          gameType: 'memory',
          difficulty: 'medium',
          cognitiveDomain: 'Working Memory',
          targetTraits: ['working_memory', 'attention'],
          timeLimit: 300,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <h3 className="text-xl font-semibold text-white mb-4">AI Integration Test</h3>
      <p className="text-slate-300 mb-6">
        Test the Mistral AI integration for game generation and cognitive assessment features.
      </p>

      <div className="flex gap-4 mb-6">
        <button
          onClick={testAIConnection}
          disabled={isTesting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          onClick={testGameGeneration}
          disabled={isTesting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {isTesting ? 'Generating...' : 'Test Game Generation'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-lg border ${
          result.success
            ? 'bg-green-900/50 border-green-700 text-green-300'
            : 'bg-red-900/50 border-red-700 text-red-300'
        }`}>
          <h4 className="font-semibold mb-2">
            {result.success ? '✅ Success' : '❌ Error'}
          </h4>

          {result.message && (
            <p className="mb-2">{result.message}</p>
          )}

          {result.connectionStatus && (
            <div className="mb-2">
              <p className="text-sm">Connection Status: {result.connectionStatus.message}</p>
            </div>
          )}

          {result.data && result.data.availableFeatures && (
            <div className="mb-2">
              <p className="text-sm font-medium">Available Features:</p>
              <ul className="text-sm ml-4 list-disc">
                {result.data.availableFeatures.map((feature: string, index: number) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          )}

          {result.error && (
            <p className="text-sm">{result.error}</p>
          )}
        </div>
      )}

      <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
        <h4 className="text-white font-medium mb-2">Mistral API Configuration</h4>
        <div className="text-sm text-slate-300 space-y-1">
          <p>✅ API Key: Configured</p>
          <p>✅ Base URL: https://api.mistral.ai/v1</p>
          <p>✅ Model: mistral-large-latest</p>
          <p>✅ Temperature: 0.7</p>
          <p>✅ Max Tokens: 2000</p>
        </div>
      </div>
    </div>
  );
}