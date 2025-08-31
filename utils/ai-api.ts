// AI API utilities for Next.js API routes
// Provides server-side access to AI services

import { aiService } from '../lib/ai-service';

export { aiService };

// Helper function to handle AI API requests with error handling
export async function handleAIRequest<T>(
  operation: () => Promise<T>,
  errorMessage = 'AI operation failed'
) {
  try {
    return {
      success: true,
      data: await operation(),
    };
  } catch (error) {
    console.error('AI API Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : errorMessage,
    };
  }
}

// Test AI connection endpoint handler
export async function testAIConnection() {
  return handleAIRequest(
    () => aiService.testConnection(),
    'Failed to test AI connection'
  );
}

// Game generation endpoint handler
export async function generateGame(gameRequest: any) {
  return handleAIRequest(
    () => aiService.generateGame(gameRequest),
    'Failed to generate game'
  );
}

// Job analysis endpoint handler
export async function analyzeJobRole(jobRequest: any) {
  return handleAIRequest(
    () => aiService.analyzeJobRole(jobRequest),
    'Failed to analyze job role'
  );
}

// Content generation endpoint handler
export async function generateContent(prompt: string, type = 'questions') {
  return handleAIRequest(
    () => aiService.generateContent(prompt, type as any),
    'Failed to generate content'
  );
}

// Report generation endpoint handler
export async function generateReport(assessmentData: any, candidateData: any) {
  return handleAIRequest(
    () => aiService.generateReport(assessmentData, candidateData),
    'Failed to generate report'
  );
}