//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'dmr';

export interface AIOptions {
  provider: AIProvider;

  // API key file paths (cloud providers)
  anthropicKeyFile: string;
  openaiKeyFile: string;
  geminiKeyFile: string;

  // Endpoints (local providers)
  ollamaEndpoint: string;
  dmrEndpoint: string;

  // Selected models per provider (stored as-is, matched on load for Anthropic)
  anthropicModel: string | null;
  openaiModel: string | null;
  geminiModel: string | null;
  ollamaModel: string | null;
  dmrModel: string | null;
}

export const DEFAULT_AI_OPTIONS: AIOptions = {
  provider: 'anthropic',
  anthropicKeyFile: '~/.anthropic-api-key',
  openaiKeyFile: '~/.openai-api-key',
  geminiKeyFile: '~/.gemini-api-key',
  ollamaEndpoint: 'http://localhost:11434',
  dmrEndpoint: 'http://localhost:12434',
  anthropicModel: null,
  openaiModel: null,
  geminiModel: null,
  ollamaModel: null,
  dmrModel: null,
};

// Helper to get the model field name for a provider
export function getModelFieldForProvider(provider: AIProvider): keyof AIOptions {
  switch (provider) {
    case 'anthropic': return 'anthropicModel';
    case 'openai': return 'openaiModel';
    case 'gemini': return 'geminiModel';
    case 'ollama': return 'ollamaModel';
    case 'dmr': return 'dmrModel';
  }
}

// Helper to get the selected model for a provider
export function getSelectedModelForProvider(options: AIOptions, provider: AIProvider): string | null {
  switch (provider) {
    case 'anthropic': return options.anthropicModel;
    case 'openai': return options.openaiModel;
    case 'gemini': return options.geminiModel;
    case 'ollama': return options.ollamaModel;
    case 'dmr': return options.dmrModel;
  }
}

export interface AIModel {
  id: string;
  displayName: string;
  provider: AIProvider;
}

export interface AIConnectionStatus {
  connected: boolean;
  error?: string;
  authMethod?: 'file' | 'environment' | 'none';
}

export interface AIKeyStatus {
  available: boolean;
  source: 'file' | 'environment' | 'none';
  filePath?: string;
  envVar?: string;
}

// Provider display names
export const PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  dmr: 'Docker Model Runner',
};

// Whether provider requires API key (vs just endpoint)
export const PROVIDER_REQUIRES_API_KEY: Record<AIProvider, boolean> = {
  anthropic: true,
  openai: true,
  gemini: true,
  ollama: false,
  dmr: false,
};

// Environment variable names for API keys
export const PROVIDER_ENV_VARS: Record<string, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  gemini: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'], // GOOGLE_API_KEY takes precedence
};

// API endpoints for each provider (model listing)
export const PROVIDER_API_ENDPOINTS: Record<AIProvider, string> = {
  anthropic: 'https://api.anthropic.com/v1/models',
  openai: 'https://api.openai.com/v1/models',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  ollama: '/api/tags', // Appended to endpoint
  dmr: '/v1/models', // OpenAI-compatible endpoint, appended to base endpoint
};

// Chat completion endpoints for each provider
// Note: {model} placeholder is used for Gemini which requires model in URL
export const PROVIDER_CHAT_ENDPOINTS: Record<AIProvider, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent',
  ollama: '/api/chat', // Appended to endpoint
  dmr: '/v1/chat/completions', // OpenAI-compatible endpoint, appended to base endpoint
};

// Whether provider supports tool use / function calling
export const PROVIDER_SUPPORTS_TOOLS: Record<AIProvider, boolean> = {
  anthropic: true,
  openai: true,
  gemini: true,
  ollama: true, // Depends on model, but API supports it
  dmr: true, // OpenAI-compatible
};

// Maximum tokens for chat responses (defaults, can be adjusted)
export const PROVIDER_MAX_TOKENS: Record<AIProvider, number> = {
  anthropic: 4096,
  openai: 4096,
  gemini: 8192,
  ollama: 4096,
  dmr: 4096,
};
