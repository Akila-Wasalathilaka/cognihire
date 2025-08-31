// AI Service for CogniHire
// Provides integration with Mistral API for game generation, job analysis, and content creation

import { aiConfig, AI_MODELS, getAIHeaders, AI_ENDPOINTS } from './config/ai';

export interface GameGenerationRequest {
  gameType: 'memory' | 'attention' | 'logic' | 'reaction' | 'flexibility';
  difficulty: 'easy' | 'medium' | 'hard';
  cognitiveDomain: string;
  targetTraits: string[];
  timeLimit?: number;
  instructions?: string;
}

export interface GameGenerationResponse {
  title: string;
  description: string;
  instructions: string;
  config: any;
  cognitiveTraits: string[];
  estimatedDuration: number;
  difficulty: string;
}

export interface JobAnalysisRequest {
  jobTitle: string;
  jobDescription: string;
  keyResponsibilities: string[];
  requiredSkills: string[];
}

export interface JobAnalysisResponse {
  cognitiveRequirements: {
    trait: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }[];
  recommendedGames: string[];
  assessmentStructure: {
    sections: string[];
    timeAllocation: number;
    difficultyProgression: string[];
  };
}

class AIService {
  private async makeRequest(endpoint: string, payload: any, provider: 'mistral' | 'openai' = 'mistral') {
    try {
      const headers = getAIHeaders(provider);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  /**
   * Generate a cognitive assessment game using Mistral AI
   */
  async generateGame(request: GameGenerationRequest): Promise<GameGenerationResponse> {
    const modelConfig = AI_MODELS.gameGeneration;

    const prompt = `
Generate a cognitive assessment game with the following specifications:

Game Type: ${request.gameType}
Difficulty: ${request.difficulty}
Cognitive Domain: ${request.cognitiveDomain}
Target Traits: ${request.targetTraits.join(', ')}
${request.timeLimit ? `Time Limit: ${request.timeLimit} seconds` : ''}
${request.instructions ? `Additional Instructions: ${request.instructions}` : ''}

Please provide a complete game specification including:
1. Game title
2. Detailed description
3. Step-by-step instructions for candidates
4. Game configuration parameters
5. Cognitive traits being assessed
6. Estimated completion time
7. Difficulty level justification

Format the response as a valid JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "instructions": "string",
  "config": {},
  "cognitiveTraits": ["string"],
  "estimatedDuration": number,
  "difficulty": "string"
}
`;

    const payload = {
      model: modelConfig.model,
      messages: [
        { role: 'system', content: modelConfig.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
    };

    const response = await this.makeRequest(AI_ENDPOINTS.mistral.chat, payload);

    try {
      const content = response.choices[0].message.content;
      // Try to parse JSON response
      const gameSpec = JSON.parse(content);
      return gameSpec;
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: return a structured response based on the text
      return {
        title: `${request.gameType.charAt(0).toUpperCase() + request.gameType.slice(1)} Game`,
        description: response.choices[0].message.content,
        instructions: 'Follow the on-screen instructions to complete this cognitive assessment.',
        config: {},
        cognitiveTraits: request.targetTraits,
        estimatedDuration: request.timeLimit || 300,
        difficulty: request.difficulty,
      };
    }
  }

  /**
   * Analyze a job role and generate cognitive requirements
   */
  async analyzeJobRole(request: JobAnalysisRequest): Promise<JobAnalysisResponse> {
    const modelConfig = AI_MODELS.jobAnalysis;

    const prompt = `
Analyze the following job role and provide cognitive assessment recommendations:

Job Title: ${request.jobTitle}
Job Description: ${request.jobDescription}
Key Responsibilities: ${request.keyResponsibilities.join(', ')}
Required Skills: ${request.requiredSkills.join(', ')}

Please provide:
1. Key cognitive traits required for this role
2. Importance level for each trait (low, medium, high, critical)
3. Recommended cognitive assessment games
4. Suggested assessment structure and timing

Format the response as a valid JSON object with the following structure:
{
  "cognitiveRequirements": [
    {
      "trait": "string",
      "importance": "low|medium|high|critical",
      "description": "string"
    }
  ],
  "recommendedGames": ["string"],
  "assessmentStructure": {
    "sections": ["string"],
    "timeAllocation": number,
    "difficultyProgression": ["string"]
  }
}
`;

    const payload = {
      model: modelConfig.model,
      messages: [
        { role: 'system', content: modelConfig.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
    };

    const response = await this.makeRequest(AI_ENDPOINTS.mistral.chat, payload);

    try {
      const content = response.choices[0].message.content;
      const analysis = JSON.parse(content);
      return analysis;
    } catch (parseError) {
      console.error('Failed to parse job analysis response:', parseError);
      // Return a fallback response
      return {
        cognitiveRequirements: [
          {
            trait: 'Problem Solving',
            importance: 'high',
            description: 'Ability to analyze complex situations and find effective solutions',
          },
          {
            trait: 'Attention to Detail',
            importance: 'medium',
            description: 'Capacity to focus on details while maintaining overall context',
          },
        ],
        recommendedGames: ['logic-puzzles', 'memory-tasks', 'attention-games'],
        assessmentStructure: {
          sections: ['Memory Assessment', 'Logic Assessment', 'Attention Assessment'],
          timeAllocation: 45,
          difficultyProgression: ['easy', 'medium', 'hard'],
        },
      };
    }
  }

  /**
   * Generate assessment questions or content
   */
  async generateContent(prompt: string, contentType: 'questions' | 'instructions' | 'feedback' = 'questions'): Promise<string> {
    const modelConfig = AI_MODELS.jobAnalysis; // Using job analysis config as base

    const systemPrompt = contentType === 'questions'
      ? 'You are an expert in creating cognitive assessment questions. Create fair, valid, and engaging questions.'
      : contentType === 'instructions'
      ? 'You are an expert in writing clear, concise instructions for cognitive assessments.'
      : 'You are an expert in providing constructive feedback for cognitive assessment performance.';

    const payload = {
      model: modelConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
    };

    const response = await this.makeRequest(AI_ENDPOINTS.mistral.chat, payload);
    return response.choices[0].message.content;
  }

  /**
   * Generate a comprehensive assessment report
   */
  async generateReport(assessmentData: any, candidateData: any): Promise<string> {
    const modelConfig = AI_MODELS.reporting;

    const prompt = `
Generate a comprehensive cognitive assessment report based on the following data:

Assessment Data: ${JSON.stringify(assessmentData)}
Candidate Information: ${JSON.stringify(candidateData)}

Please create a professional report that includes:
1. Executive summary
2. Detailed cognitive trait analysis
3. Performance breakdown by game type
4. Strengths and areas for development
5. Recommendations for the candidate
6. Overall assessment score and interpretation

Format as a well-structured, professional report suitable for HR and management review.
`;

    const payload = {
      model: modelConfig.model,
      messages: [
        { role: 'system', content: modelConfig.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
    };

    const response = await this.makeRequest(AI_ENDPOINTS.mistral.chat, payload);
    return response.choices[0].message.content;
  }

  /**
   * Test the AI connection and configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const payload = {
        model: aiConfig.mistral.model,
        messages: [
          { role: 'user', content: 'Hello, can you confirm this connection is working?' }
        ],
        max_tokens: 50,
      };

      const response = await this.makeRequest(AI_ENDPOINTS.mistral.chat, payload);

      if (response.choices && response.choices[0]) {
        return {
          success: true,
          message: 'AI connection successful! Mistral API is responding correctly.',
        };
      } else {
        return {
          success: false,
          message: 'AI connection failed: Unexpected response format.',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `AI connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export a singleton instance
export const aiService = new AIService();
export default aiService;