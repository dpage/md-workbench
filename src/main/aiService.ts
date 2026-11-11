//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { ensureFileAccess } from './fileBookmarks';
import {
  AIProvider,
  AIModel,
  AIConnectionStatus,
  AIKeyStatus,
  AIOptions,
  PROVIDER_ENV_VARS,
  PROVIDER_API_ENDPOINTS,
  PROVIDER_REQUIRES_API_KEY,
} from '../shared/aiProviders';

/**
 * Expand ~ to home directory in file paths
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Read API key from a file
 */
async function readKeyFromFile(filePath: string): Promise<string | null> {
  try {
    const expandedPath = expandPath(filePath);
    ensureFileAccess(expandedPath);
    const content = await fs.promises.readFile(expandedPath, 'utf-8');
    return content.trim();
  } catch {
    return null;
  }
}

/**
 * Get API key from environment variable
 */
function getKeyFromEnv(provider: AIProvider): { key: string; envVar: string } | null {
  const envVars = PROVIDER_ENV_VARS[provider];
  if (!envVars) return null;

  for (const envVar of envVars) {
    const key = process.env[envVar];
    if (key) {
      return { key, envVar };
    }
  }
  return null;
}

/**
 * Resolve API key for a provider (file takes precedence over environment)
 */
export async function resolveApiKey(
  provider: AIProvider,
  keyFilePath: string
): Promise<{ key: string | null; source: 'file' | 'environment' | 'none'; detail?: string }> {
  // Try file first
  const fileKey = await readKeyFromFile(keyFilePath);
  if (fileKey) {
    return { key: fileKey, source: 'file', detail: expandPath(keyFilePath) };
  }

  // Try environment
  const envResult = getKeyFromEnv(provider);
  if (envResult) {
    return { key: envResult.key, source: 'environment', detail: envResult.envVar };
  }

  return { key: null, source: 'none' };
}

/**
 * Get the status of API key availability for a provider
 */
export async function getKeyStatus(
  provider: AIProvider,
  keyFilePath: string
): Promise<AIKeyStatus> {
  const result = await resolveApiKey(provider, keyFilePath);

  return {
    available: result.key !== null,
    source: result.source,
    filePath: result.source === 'file' ? result.detail : undefined,
    envVar: result.source === 'environment' ? result.detail : undefined,
  };
}

/**
 * Make an HTTP/HTTPS request and return the response
 */
function makeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };

    const req = transport.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 0, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 0, data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

/**
 * Test connection to a provider
 */
export async function testConnection(
  provider: AIProvider,
  options: AIOptions
): Promise<AIConnectionStatus> {
  try {
    const requiresKey = PROVIDER_REQUIRES_API_KEY[provider];

    if (requiresKey) {
      // Cloud provider - need API key
      const keyFilePath = getKeyFileForProvider(provider, options);
      const keyResult = await resolveApiKey(provider, keyFilePath);

      if (!keyResult.key) {
        return {
          connected: false,
          error: 'No API key configured. Please provide a key file or set the environment variable.',
          authMethod: 'none',
        };
      }

      // Make request to models endpoint
      let endpoint = PROVIDER_API_ENDPOINTS[provider];
      const headers = getAuthHeaders(provider, keyResult.key);

      // Gemini uses query parameter for API key
      if (provider === 'gemini') {
        endpoint = `${endpoint}?key=${keyResult.key}`;
      }

      try {
        const response = await makeRequest(endpoint, { headers, timeout: 10000 });

        if (response.status === 200) {
          return {
            connected: true,
            authMethod: keyResult.source as 'file' | 'environment',
          };
        } else if (response.status === 401 || response.status === 403) {
          return {
            connected: false,
            error: 'Authentication failed. Please check your API key.',
            authMethod: keyResult.source as 'file' | 'environment',
          };
        } else {
          return {
            connected: false,
            error: `API returned status ${response.status}`,
            authMethod: keyResult.source as 'file' | 'environment',
          };
        }
      } catch (err) {
        return {
          connected: false,
          error: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          authMethod: keyResult.source as 'file' | 'environment',
        };
      }
    } else {
      // Local provider - just need endpoint
      const endpoint = getEndpointForProvider(provider, options);
      const modelsUrl = endpoint + PROVIDER_API_ENDPOINTS[provider];

      try {
        const response = await makeRequest(modelsUrl, { timeout: 5000 });

        if (response.status === 200) {
          return { connected: true };
        } else {
          return {
            connected: false,
            error: `Server returned status ${response.status}`,
          };
        }
      } catch (err) {
        return {
          connected: false,
          error: `Cannot connect to ${endpoint}. Is the server running?`,
        };
      }
    }
  } catch (err) {
    return {
      connected: false,
      error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get authentication headers for a provider
 */
function getAuthHeaders(provider: AIProvider, apiKey: string): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    case 'openai':
      return {
        Authorization: `Bearer ${apiKey}`,
      };
    case 'gemini':
      // Gemini uses query parameter, not header
      return {};
    default:
      return {};
  }
}

/**
 * Get the key file path for a provider
 */
function getKeyFileForProvider(provider: AIProvider, options: AIOptions): string {
  switch (provider) {
    case 'anthropic':
      return options.anthropicKeyFile;
    case 'openai':
      return options.openaiKeyFile;
    case 'gemini':
      return options.geminiKeyFile;
    default:
      return '';
  }
}

/**
 * Get the endpoint URL for a local provider
 */
function getEndpointForProvider(provider: AIProvider, options: AIOptions): string {
  switch (provider) {
    case 'ollama':
      return options.ollamaEndpoint;
    case 'dmr':
      return options.dmrEndpoint;
    default:
      return '';
  }
}

/**
 * List available models from a provider
 */
export async function listModels(
  provider: AIProvider,
  options: AIOptions
): Promise<{ models: AIModel[]; error?: string }> {
  try {
    const requiresKey = PROVIDER_REQUIRES_API_KEY[provider];

    if (requiresKey) {
      const keyFilePath = getKeyFileForProvider(provider, options);
      const keyResult = await resolveApiKey(provider, keyFilePath);

      if (!keyResult.key) {
        return { models: [], error: 'No API key available' };
      }

      return await fetchCloudModels(provider, keyResult.key);
    } else {
      const endpoint = getEndpointForProvider(provider, options);
      return await fetchLocalModels(provider, endpoint);
    }
  } catch (err) {
    return {
      models: [],
      error: `Failed to fetch models: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fetch models from a cloud provider
 */
async function fetchCloudModels(
  provider: AIProvider,
  apiKey: string
): Promise<{ models: AIModel[]; error?: string }> {
  let url = PROVIDER_API_ENDPOINTS[provider];
  const headers = getAuthHeaders(provider, apiKey);

  // Gemini uses query parameter for API key
  if (provider === 'gemini') {
    url = `${url}?key=${apiKey}`;
  }

  try {
    const response = await makeRequest(url, { headers, timeout: 15000 });

    if (response.status !== 200) {
      return { models: [], error: `API returned status ${response.status}` };
    }

    const data = response.data as Record<string, unknown>;
    return { models: parseModelsResponse(provider, data) };
  } catch (err) {
    return {
      models: [],
      error: `Request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Fetch models from a local provider
 */
async function fetchLocalModels(
  provider: AIProvider,
  endpoint: string
): Promise<{ models: AIModel[]; error?: string }> {
  const url = endpoint + PROVIDER_API_ENDPOINTS[provider];

  try {
    const response = await makeRequest(url, { timeout: 5000 });

    if (response.status !== 200) {
      return { models: [], error: `Server returned status ${response.status}` };
    }

    const data = response.data as Record<string, unknown>;
    return { models: parseModelsResponse(provider, data) };
  } catch (err) {
    return {
      models: [],
      error: `Request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Parse models response based on provider format
 */
function parseModelsResponse(
  provider: AIProvider,
  data: Record<string, unknown>
): AIModel[] {
  switch (provider) {
    case 'anthropic': {
      // Response: { data: [{ id, display_name, ... }] }
      const models = (data.data as Array<{ id: string; display_name?: string }>) || [];
      return models.map((m) => ({
        id: m.id,
        displayName: m.display_name || m.id,
        provider,
      }));
    }

    case 'openai': {
      // Response: { data: [{ id, owned_by, ... }] }
      const models = (data.data as Array<{ id: string; owned_by?: string }>) || [];
      // Filter to only chat/completion models (exclude embeddings, whisper, etc.)
      const chatModels = models.filter(
        (m) =>
          m.id.includes('gpt') ||
          m.id.includes('o1') ||
          m.id.includes('o3') ||
          m.id.includes('chatgpt')
      );
      return chatModels.map((m) => ({
        id: m.id,
        displayName: m.id,
        provider,
      }));
    }

    case 'gemini': {
      // Response: { models: [{ name, displayName, ... }] }
      const models = (data.models as Array<{ name: string; displayName?: string }>) || [];
      // Filter to generative models
      const generativeModels = models.filter(
        (m) => m.name.includes('gemini') && !m.name.includes('embedding')
      );
      return generativeModels.map((m) => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName || m.name.replace('models/', ''),
        provider,
      }));
    }

    case 'ollama': {
      // Response: { models: [{ name, ... }] }
      const models = (data.models as Array<{ name: string }>) || [];
      return models.map((m) => ({
        id: m.name,
        displayName: m.name,
        provider,
      }));
    }

    case 'dmr': {
      // DMR uses OpenAI-compatible API at /v1/models
      // Response: { object: "list", data: [{ id: "ai/model-name", object: "model", ... }] }
      const models = (data.data as Array<{ id: string; object?: string }>) || [];
      return models.map((m) => ({
        id: m.id,
        displayName: m.id,
        provider,
      }));
    }

    default:
      return [];
  }
}

/**
 * Extract base model name for Anthropic (without date suffix)
 *
 * v3 format: claude-3-opus-20240229 -> claude-3-opus
 * v4 format: claude-sonnet-4-20250514 -> claude-sonnet-4
 */
export function extractAnthropicBaseModel(modelId: string): string {
  // Remove date suffix (8 digits at the end)
  return modelId.replace(/-\d{8}$/, '');
}

/**
 * Find the best matching model from available models for a saved model ID
 * Used for Anthropic's model versioning where dates change
 */
export function matchAnthropicModel(
  savedModelId: string,
  availableModels: AIModel[]
): string | null {
  const savedBase = extractAnthropicBaseModel(savedModelId);

  // Find all models matching the base name
  const matches = availableModels.filter(
    (m) => extractAnthropicBaseModel(m.id) === savedBase
  );

  if (matches.length === 0) {
    // Try partial matching for major version changes
    // e.g., claude-3-sonnet -> claude-sonnet-4
    const savedParts = savedBase.split('-');

    for (const model of availableModels) {
      const modelParts = extractAnthropicBaseModel(model.id).split('-');

      // Check if the model family matches (e.g., "sonnet", "opus", "haiku")
      const savedFamily = savedParts.find((p) =>
        ['opus', 'sonnet', 'haiku'].includes(p)
      );
      const modelFamily = modelParts.find((p) =>
        ['opus', 'sonnet', 'haiku'].includes(p)
      );

      if (savedFamily && modelFamily && savedFamily === modelFamily) {
        return model.id;
      }
    }

    return null;
  }

  // Return the first match (Anthropic returns newest first)
  return matches[0].id;
}

/**
 * Smart match a saved model ID against available models
 * For Anthropic, handles version updates. For others, exact match.
 */
export function smartMatchModel(
  provider: AIProvider,
  savedModelId: string | null,
  availableModels: AIModel[]
): string | null {
  if (!savedModelId || availableModels.length === 0) {
    return availableModels[0]?.id || null;
  }

  // Check for exact match first
  const exactMatch = availableModels.find((m) => m.id === savedModelId);
  if (exactMatch) {
    return exactMatch.id;
  }

  // For Anthropic, try smart matching
  if (provider === 'anthropic') {
    return matchAnthropicModel(savedModelId, availableModels);
  }

  // For other providers, return first available if no exact match
  return availableModels[0]?.id || null;
}
