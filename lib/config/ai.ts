// AI Configuration for CogniHire
// Handles Mistral, OpenAI, and HuggingFace API integrations

export interface AIConfig {
  mistral: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  openai?: {
    apiKey: string;
    model: string;
  };
  huggingface?: {
    apiKey: string;
  };
  general: {
    temperature: number;
    maxTokens: number;
    timeout: number;
  };
}

// Get AI configuration from environment variables
export const getAIConfig = (): AIConfig => {
  const config: AIConfig = {
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY || '',
      baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
      model: process.env.DEFAULT_AI_MODEL || 'mistral-large-latest',
    },
    general: {
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
      timeout: 30000, // 30 seconds
    },
  };

  // Optional configurations
  if (process.env.OPENAI_API_KEY) {
    config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
    };
  }

  if (process.env.HUGGINGFACE_API_KEY) {
    config.huggingface = {
      apiKey: process.env.HUGGINGFACE_API_KEY,
    };
  }

  return config;
};

// Validate AI configuration
export const validateAIConfig = (config: AIConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.mistral.apiKey) {
    errors.push('MISTRAL_API_KEY is required');
  }

  if (!config.mistral.baseUrl) {
    errors.push('MISTRAL_BASE_URL is required');
  }

  if (config.general.temperature < 0 || config.general.temperature > 2) {
    errors.push('AI_TEMPERATURE must be between 0 and 2');
  }

  if (config.general.maxTokens < 1 || config.general.maxTokens > 4000) {
    errors.push('AI_MAX_TOKENS must be between 1 and 4000');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Get the current AI configuration
export const aiConfig = getAIConfig();

// Validate configuration on import
const validation = validateAIConfig(aiConfig);
if (!validation.isValid) {
  console.warn('AI Configuration Issues:', validation.errors);
  // In development, we'll continue but log warnings
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Invalid AI configuration: ${validation.errors.join(', ')}`);
  }
}

// AI Service URLs and endpoints
export const AI_ENDPOINTS = {
  mistral: {
    chat: `${aiConfig.mistral.baseUrl}/chat/completions`,
    models: `${aiConfig.mistral.baseUrl}/models`,
  },
  openai: {
    chat: 'https://api.openai.com/v1/chat/completions',
    models: 'https://api.openai.com/v1/models',
  },
  huggingface: {
    inference: 'https://api-inference.huggingface.co/models',
  },
} as const;

// AI Model configurations for different use cases
export const AI_MODELS = {
  // For game generation and content creation
  gameGeneration: {
    model: aiConfig.mistral.model,
    temperature: 0.8,
    maxTokens: 1500,
    systemPrompt: `You are an expert game designer specializing in cognitive assessments.
Create engaging, scientifically validated games that test specific cognitive abilities.
Focus on memory, attention, problem-solving, and logical reasoning tasks.`,
  },

  // For job role analysis and question generation
  jobAnalysis: {
    model: aiConfig.mistral.model,
    temperature: 0.3,
    maxTokens: 1000,
    systemPrompt: `You are an expert in cognitive psychology and job analysis.
Analyze job roles and identify the key cognitive abilities required for success.
Generate assessment questions that are fair, valid, and reliable.`,
  },

  // For report generation and insights
  reporting: {
    model: aiConfig.mistral.model,
    temperature: 0.2,
    maxTokens: 2000,
    systemPrompt: `You are an expert psychometrician and data analyst.
Generate comprehensive assessment reports with actionable insights.
Focus on clear, professional language that helps employers make informed decisions.`,
  },
} as const;

// Helper function to get headers for API requests
export const getAIHeaders = (provider: 'mistral' | 'openai' | 'huggingface') => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  switch (provider) {
    case 'mistral':
      headers['Authorization'] = `Bearer ${aiConfig.mistral.apiKey}`;
      break;
    case 'openai':
      if (aiConfig.openai?.apiKey) {
        headers['Authorization'] = `Bearer ${aiConfig.openai.apiKey}`;
      }
      break;
    case 'huggingface':
      if (aiConfig.huggingface?.apiKey) {
        headers['Authorization'] = `Bearer ${aiConfig.huggingface.apiKey}`;
      }
      break;
  }

  return headers;
};

// Export the configuration for use in other modules
export default aiConfig;